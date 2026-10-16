using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;

namespace Postbox {
    public partial class App {
        private MailAccount activeAccount;
        private AccountStore accountStore;
        private MailTransport transport;
        private readonly SemaphoreSlim mailGate = new SemaphoreSlim(1, 1);
        private DispatcherTimer syncTimer;
        private bool syncing;
        private void InitializeConnection() {
            accountStore = new AccountStore(dataDirectory); activeAccount = accountStore.Load();
            if (activeAccount != null) transport = new MailTransport(activeAccount, accountStore);
        }
        private MailStore CurrentMailbox() { return activeAccount == null ? new MailStore(Path.Combine(dataDirectory, "mailbox.json")) : new MailStore(Path.Combine(dataDirectory, "mail-" + activeAccount.Id + ".protected"), true, false); }
        private async void StartMailConnection() {
            var toolbar = (StackPanel)Find<Button>("DeleteButton").Parent;
            var sync = Action("↻ Sync", false); sync.Click += async delegate { await SyncMail(); }; toolbar.Children.Add(sync);
            syncTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(60) };
            syncTimer.Tick += async delegate { if (activeAccount != null) await SyncMail(); };
            syncTimer.Start(); window.Closed += delegate { syncTimer.Stop(); };
            if (activeAccount != null) { preferences.EmailAddress = activeAccount.Email; ApplyPreferences(); await SyncMail(); }
            else { Status("Explore mode · connect an account to receive and send real mail"); if (showAfterWelcome && !String.IsNullOrEmpty(preferences.EmailAddress)) ShowAccounts(); }
        }
        private async Task SyncMail() {
            if (activeAccount == null) { Status("Connect an email account using Accounts."); return; }
            if (syncing || !await mailGate.WaitAsync(0)) return;
            syncing = true; Status("Syncing " + activeAccount.Email + "…");
            try {
                var oldInbox = new HashSet<string>(store.Messages.Where(m => m.Folder == "Inbox").Select(m => m.Id));
                var cached = store.Messages.ToList();
                var received = await Task.Run(() => transport.Synchronize(cached));
                var local = store.Messages.Where(m => m.RemoteUid == 0 && (m.Folder != "Sent" || !received.Any(r => r.InternetMessageId == m.InternetMessageId))).ToList();
                var old = store.Messages.ToList(); store.Messages.Clear(); store.Messages.AddRange(local); store.Messages.AddRange(received);
                try { store.Save(); } catch { store.Messages.Clear(); store.Messages.AddRange(old); throw; }
                Refresh(selected == null ? null : selected.Id);
                Status("Connected · " + activeAccount.Email + " · synced " + DateTime.Now.ToString("HH:mm") + " · latest 200 per folder");
                var fresh = received.Where(m => m.Folder == "Inbox" && m.Unread && !oldInbox.Contains(m.Id)).ToList();
                if (oldInbox.Count > 0 && fresh.Count > 0) MailNotification(true, fresh.Count == 1 ? fresh[0].Subject : fresh.Count + " new messages");
            } catch (Exception ex) { Status("Sync failed · " + ex.Message + " · cached mail kept. Use Accounts to check sign-in."); }
            finally { syncing = false; mailGate.Release(); }
        }
        private async Task<string> SendMail(Message message) {
            if (activeAccount == null) throw new InvalidOperationException("Connect an email account first. Your draft is saved locally.");
            await mailGate.WaitAsync();
            try { message.Address = activeAccount.Email; message.AccountId = activeAccount.Id; return await Task.Run(() => transport.Send(message)); }
            finally { mailGate.Release(); }
        }
        private async void SaveServerFlags(Message message) {
            if (activeAccount == null || message.RemoteUid == 0) return;
            // Capture intended flags before another UI interaction changes them.
            var value = new Message { RemoteUid = message.RemoteUid, RemoteFolder = message.RemoteFolder, UidValidity = message.UidValidity, Unread = message.Unread, Starred = message.Starred };
            await mailGate.WaitAsync();
            try { await Task.Run(() => transport.Flags(value)); }
            catch (Exception ex) { Status("Server flags were not updated: " + ex.Message + " · sync to reload server state"); }
            finally { mailGate.Release(); }
        }
        private void ShowConnectedAccounts() {
            if (mailGate.CurrentCount == 0) { Status("Please wait for the current mail operation to finish before changing accounts."); return; }
            var dialog = Dialog("Account connections · TMA-Mail", 650, 780);
            var panel = new StackPanel { Margin = new Thickness(28) }; dialog.Content = new ScrollViewer { Content = panel, VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
            panel.Children.Add(Label(activeAccount == null ? "Connect your mailbox" : "Connected: " + activeAccount.Email, 24, "Text"));
            panel.Children.Add(Label("One active account in this release. Connections require TLS; credentials and live mail cache are protected for your Windows user. Existing sample mail stays separate.", 12, "#8793A7"));
            Func<string, string, TextBox> field = delegate(string label, string value) { panel.Children.Add(Label(label, 12, "Text")); var input = new TextBox { Text = value ?? "", Margin = new Thickness(0, 0, 0, 10) }; System.Windows.Automation.AutomationProperties.SetName(input, label); panel.Children.Add(input); return input; };
            panel.Children.Add(Label("Provider", 12, "Text"));
            var provider = new ComboBox { ItemsSource = new[] { "Microsoft", "Gmail", "Other IMAP" }, SelectedItem = activeAccount == null ? "Microsoft" : activeAccount.Provider, Margin = new Thickness(0, 0, 0, 12) }; panel.Children.Add(provider);
            var email = field("Email address", activeAccount == null ? preferences.EmailAddress : activeAccount.Email);
            var username = field("Username (blank uses email address)", activeAccount == null ? "" : activeAccount.UserName);
            var imap = field("IMAP server (TLS)", activeAccount == null ? "outlook.office365.com" : activeAccount.ImapHost);
            var imapPort = field("IMAP port (993 implicit TLS; other ports require STARTTLS)", activeAccount == null ? "993" : activeAccount.ImapPort.ToString());
            var smtp = field("SMTP server", activeAccount == null ? "smtp-mail.outlook.com" : activeAccount.SmtpHost);
            var smtpPort = field("SMTP port (587 STARTTLS or 465 implicit TLS)", activeAccount == null ? "587" : activeAccount.SmtpPort.ToString());
            var clientId = field("Microsoft application (client) ID — see SETUP.md", activeAccount == null ? "" : activeAccount.ClientId);
            panel.Children.Add(Label("App password (Gmail / other IMAP accounts)", 12, "Text"));
            var password = new PasswordBox { Margin = new Thickness(0, 0, 0, 10), Padding = new Thickness(9) }; panel.Children.Add(password);
            password.IsEnabled = provider.SelectedItem as string != "Microsoft";
            panel.Children.Add(Label("Microsoft uses browser sign-in, never your account password. Gmail requires 2-step verification and a Google app password. Some work accounts require administrator consent or IMAP/SMTP enablement.", 12, "#8793A7"));
            var progress = Label("", 12, "Text"); panel.Children.Add(progress);
            var codePanel = new StackPanel { Visibility = Visibility.Collapsed }; panel.Children.Add(codePanel);
            var code = new TextBox { IsReadOnly = true, FontSize = 22, Margin = new Thickness(0, 0, 0, 8) }; codePanel.Children.Add(code);
            var open = Action("Open Microsoft sign-in", false); open.Click += delegate { Process.Start("https://microsoft.com/devicelogin"); }; codePanel.Children.Add(open);
            var connect = Action("Sign in & test connection", true); connect.Margin = new Thickness(0, 12, 0, 12); panel.Children.Add(connect);
            var cancel = new CancellationTokenSource(); bool connecting = false;
            dialog.Closing += delegate(object sender, System.ComponentModel.CancelEventArgs args) { if (connecting) { cancel.Cancel(); args.Cancel = true; progress.Text = "Cancelling sign-in…"; } };
            dialog.Closed += delegate { cancel.Cancel(); };
            provider.SelectionChanged += delegate { string choice = provider.SelectedItem as string; if (choice == "Microsoft") { imap.Text = "outlook.office365.com"; smtp.Text = "smtp-mail.outlook.com"; } else if (choice == "Gmail") { imap.Text = "imap.gmail.com"; smtp.Text = "smtp.gmail.com"; } imapPort.Text = "993"; smtpPort.Text = "587"; clientId.Visibility = choice == "Microsoft" ? Visibility.Visible : Visibility.Collapsed; password.IsEnabled = choice != "Microsoft"; };
            connect.Click += async delegate {
                if (connecting || !await mailGate.WaitAsync(0)) return;
                connecting = true; connect.IsEnabled = false;
                try {
                    int incoming, outgoing; if (!Int32.TryParse(imapPort.Text, out incoming) || !Int32.TryParse(smtpPort.Text, out outgoing)) throw new ArgumentException("Enter valid port numbers.");
                    var value = new MailAccount { Id = activeAccount != null && String.Equals(activeAccount.Email, email.Text.Trim(), StringComparison.OrdinalIgnoreCase) ? activeAccount.Id : Guid.NewGuid().ToString("N"), Provider = (string)provider.SelectedItem, Email = email.Text.Trim(), UserName = username.Text.Trim(), ImapHost = imap.Text.Trim(), ImapPort = incoming, SmtpHost = smtp.Text.Trim(), SmtpPort = outgoing, SmtpSsl = outgoing == 465, ClientId = clientId.Text.Trim(), Password = password.Password };
                    if (String.IsNullOrEmpty(value.Password) && activeAccount != null && value.Id == activeAccount.Id && value.Provider == activeAccount.Provider) value.Password = activeAccount.Password;
                    value.Validate(); progress.Text = "Connecting securely…";
                    if (value.Provider == "Microsoft") await Task.Run(() => MicrosoftLogin.SignIn(value, delegate(string uri, string userCode) { Dispatcher.Invoke(new Action(delegate { code.Text = userCode; codePanel.Visibility = Visibility.Visible; progress.Text = "Open Microsoft sign-in and enter this code:"; })); }, cancel.Token));
                    cancel.Token.ThrowIfCancellationRequested();
                    var candidate = new MailTransport(value, accountStore, false);
                    await Task.Run(() => candidate.Test()); cancel.Token.ThrowIfCancellationRequested();
                    // Do not save a candidate or discard the old view until both services validate.
                    var mailbox = new MailStore(Path.Combine(dataDirectory, "mail-" + value.Id + ".protected"), true, false);
                    accountStore.Save(value); activeAccount = value; transport = new MailTransport(value, accountStore); store = mailbox;
                    lastBatchMove = null; selected = null; preferences.EmailAddress = value.Email; settingsStore.Save(preferences); ApplyPreferences(); Refresh(null);
                    connecting = false; dialog.Close();
                } catch (OperationCanceledException) { progress.Text = "Sign-in cancelled. Close this window and try again."; }
                catch (Exception ex) { progress.Text = "Could not connect: " + ex.Message; }
                finally { connecting = false; connect.IsEnabled = !cancel.IsCancellationRequested; mailGate.Release(); }
                if (!dialog.IsVisible && activeAccount != null) await SyncMail();
            };
            if (activeAccount != null) {
                var disconnect = Action("Disconnect account", false); panel.Children.Add(disconnect);
                disconnect.Click += delegate { if (connecting || mailGate.CurrentCount == 0) return; accountStore.Remove(); activeAccount = null; transport = null; store = CurrentMailbox(); lastBatchMove = null; selected = null; Refresh(null); Status("Disconnected · encrypted cache remains on this PC · explore mode"); dialog.Close(); };
            }
            var close = Action("Close / cancel sign-in", false); panel.Children.Add(close); close.Click += delegate { dialog.Close(); };
            dialog.ShowDialog();
        }
    }
}
