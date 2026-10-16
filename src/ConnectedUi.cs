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
            else Status("Explore mode · connect an account to receive and send real mail");
            if (showAfterWelcome && welcomeProvider != null) ShowConnectedAccounts(welcomeProvider);
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
        private async Task ConnectAccount(MailAccount value, CancellationToken cancellation) {
            if (!await mailGate.WaitAsync(0)) throw new InvalidOperationException("Please wait for the current mail operation to finish.");
            try {
                if (activeAccount != null && String.Equals(value.Email, activeAccount.Email, StringComparison.OrdinalIgnoreCase)) value.Id = activeAccount.Id;
                var candidate = new MailTransport(value, accountStore, false);
                await Task.Run(() => candidate.Test()); cancellation.ThrowIfCancellationRequested();
                var mailbox = new MailStore(Path.Combine(dataDirectory, "mail-" + value.Id + ".protected"), true, false);
                accountStore.Save(value); activeAccount = value; transport = new MailTransport(value, accountStore); store = mailbox;
                lastBatchMove = null; selected = null; preferences.EmailAddress = value.Email;
                try { settingsStore.Save(preferences); } catch { Status("Account connected. Profile preferences could not be saved."); }
                ApplyPreferences(); Refresh(null);
            } finally { mailGate.Release(); }
        }
        private void DisconnectAccount() {
            accountStore.Remove(); activeAccount = null; transport = null; store = CurrentMailbox(); lastBatchMove = null; selected = null; ApplyPreferences(); Refresh(null); Status("Disconnected · explore mode");
        }
        private async void ShowConnectedAccounts(string initialProvider = null) {
            if (mailGate.CurrentCount == 0) { Status("Please wait for the current mail operation to finish before changing accounts."); return; }
            try {
                var setup = new AccountSetupWindow(activeAccount, ProviderConfiguration.Load(), ConnectAccount, DisconnectAccount, initialProvider) { Owner = window };
                setup.ShowDialog();
                if (setup.Connected) await SyncMail();
            } catch (Exception ex) { Status("Account setup could not open: " + ex.Message); }
        }
    }
}
