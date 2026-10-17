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
        private List<MailAccount> mailAccounts;
        private bool offlinePreview;
        private void InitializeConnection() {
            offlinePreview = Environment.GetCommandLineArgs().Contains("--offline-preview");
            accountStore = new AccountStore(dataDirectory); activeAccount = accountStore.Load(); mailAccounts = accountStore.LoadAll();
            if (activeAccount != null) transport = new MailTransport(activeAccount, accountStore);
        }
        private readonly Dictionary<string, MailStore> connectedMailboxes = new Dictionary<string, MailStore>();
        private MailStore CurrentMailbox() {
            if (activeAccount == null) return new MailStore(Path.Combine(dataDirectory, "mailbox.json"));
            MailStore cached; if (!connectedMailboxes.TryGetValue(activeAccount.Id, out cached)) { cached = new MailStore(Path.Combine(dataDirectory, "mail-" + activeAccount.Id + ".protected"), true, false); connectedMailboxes[activeAccount.Id] = cached; }
            return cached;
        }
        private async Task<MailStore> GetMailboxAsync(MailAccount account) {
            MailStore cached; if (connectedMailboxes.TryGetValue(account.Id, out cached)) return cached;
            var loaded = await Task.Run(() => new MailStore(Path.Combine(dataDirectory, "mail-" + account.Id + ".protected"), true, false));
            if (connectedMailboxes.TryGetValue(account.Id, out cached)) return cached;
            connectedMailboxes[account.Id] = loaded; return loaded;
        }
        private bool periodicSyncRunning;
        private async void StartMailConnection() {
            Find<Button>("FooterSyncButton").Click += async delegate { await SyncMail(); };
            InitializeCacheShutdown();
            if (offlinePreview) { Status("Offline preview · synthetic mailboxes · no server connections"); return; }
            syncTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(30) };
            syncTimer.Tick += async delegate { if (periodicSyncRunning || syncing || mailGate.CurrentCount == 0) return; periodicSyncRunning = true; try { foreach (var item in mailAccounts.ToList()) { if (mailShutdown.IsCancellationRequested) break; await SyncMail(item.Id); } } finally { periodicSyncRunning = false; } };
            syncTimer.Start(); EnsureMailWatchers(); window.Closed += delegate { syncTimer.Stop(); StopMailWatchers(); };
            if (activeAccount != null) { preferences.EmailAddress = activeAccount.Email; ApplyPreferences(); await SyncMail(); foreach (var item in mailAccounts.Where(a => a.Id != activeAccount.Id).ToList()) await SyncMail(item.Id); }
            else Status("Explore mode · connect an account to receive and send real mail");
            if (showAfterWelcome && welcomeProvider != null) ShowConnectedAccounts(welcomeProvider);
        }
        private async Task<string> SendMail(Message message, MailAccount sendingAccount) {
            if (sendingAccount == null || !mailAccounts.Any(a => Object.ReferenceEquals(a, sendingAccount))) throw new InvalidOperationException("The composing account was disconnected or reconnected. Save your draft and reopen it before sending.");
            var sendingService = new MailTransport(sendingAccount, accountStore);
            await mailGate.WaitAsync();
            try {
                if (!mailAccounts.Any(a => Object.ReferenceEquals(a, sendingAccount))) throw new InvalidOperationException("The composing account changed. Save your draft and reopen it before sending.");
                message.Address = sendingAccount.Email; message.AccountId = sendingAccount.Id; return await Task.Run(() => sendingService.Send(message));
            }
            finally { mailGate.Release(); }
        }
        private async void SaveServerFlags(Message message) {
            if (activeAccount == null || message.RemoteUid == 0) return;
            // Capture intended flags before another UI interaction changes them.
            var value = new Message { RemoteUid = message.RemoteUid, RemoteFolder = message.RemoteFolder, UidValidity = message.UidValidity, Unread = message.Unread, Starred = message.Starred };
            var account = mailAccounts.FirstOrDefault(a => a.Id == message.AccountId); if (account == null) return; var service = new MailTransport(account, accountStore);
            await mailGate.WaitAsync();
            try { await Task.Run(() => service.Flags(value)); }
            catch (Exception ex) { Status("Server flags were not updated: " + ex.Message + " · sync to reload server state"); }
            finally { mailGate.Release(); }
        }
        private async Task ConnectAccount(MailAccount value, CancellationToken cancellation) {
            await mailGate.WaitAsync(cancellation);
            try {
                var previous = mailAccounts.FirstOrDefault(a => String.Equals(value.Email, a.Email, StringComparison.OrdinalIgnoreCase)); if (previous != null) value.Id = previous.Id;
                var candidate = new MailTransport(value, accountStore, false);
                await Task.Run(() => candidate.Test()); cancellation.ThrowIfCancellationRequested();
                var mailbox = await GetMailboxAsync(value);
                accountStore.Save(value, true); mailAccounts = accountStore.LoadAll(); RestartMailWatcher(value.Id); activeAccount = value; transport = new MailTransport(value, accountStore); store = mailbox;
                lastBatchMove = null; selected = null; preferences.EmailAddress = value.Email;
                try { settingsStore.Save(preferences); } catch { Status("Account connected. Profile preferences could not be saved."); }
                folder = "Inbox"; ApplyPreferences(); Refresh(null); EnsureMailWatchers();
            } finally { mailGate.Release(); }
        }
        private void DisconnectAccount() {
            if (activeAccount != null) RemoveMailAccount(activeAccount.Id);
        }
        private async void ShowConnectedAccounts(string initialProvider = null) {
            try {
                var setup = new AccountSetupWindow(activeAccount, ProviderConfiguration.Load(), ConnectAccount, DisconnectAccount, initialProvider, preferences.LauncherEmailSuggestions) { Owner = window };
                setup.ShowDialog();
                if (setup.Connected) await SyncMail();
            } catch (Exception ex) { Status("Account setup could not open: " + ex.Message); }
        }
    }
}
