using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Effects;

namespace Postbox {
    public partial class App {
        private readonly Dictionary<string, CancellationTokenSource> mailWatchers = new Dictionary<string, CancellationTokenSource>();
        private readonly Dictionary<string, bool> mailHealth = new Dictionary<string, bool>();
        private readonly HashSet<string> pendingMailSync = new HashSet<string>();
        private readonly HashSet<string> syncedAccounts = new HashSet<string>();
        private readonly CancellationTokenSource mailShutdown = new CancellationTokenSource();
        private NetworkAvailabilityChangedEventHandler networkHandler;
        private void QueueMailSync(string id) { Dispatcher.BeginInvoke(new Action(async delegate { await SyncMail(id); })); }
        private void EnsureMailWatchers() {
            if (offlinePreview || mailShutdown.IsCancellationRequested) return;
            if (networkHandler == null) {
                networkHandler = delegate { Dispatcher.BeginInvoke(new Action(UpdateConnectionLamp)); };
                NetworkChange.NetworkAvailabilityChanged += networkHandler;
            }
            foreach (var account in mailAccounts) {
                if (mailWatchers.ContainsKey(account.Id)) continue;
                var cancellation = CancellationTokenSource.CreateLinkedTokenSource(mailShutdown.Token); mailWatchers[account.Id] = cancellation;
                var watcher = new MailTransport(account, accountStore);
                Task.Run(delegate { watcher.WatchInbox(
                    delegate { Dispatcher.BeginInvoke(new Action(async delegate { if (!mailShutdown.IsCancellationRequested && mailAccounts.Any(a => a.Id == account.Id)) await SyncMail(account.Id); })); },
                    delegate(bool good, string phase) { Dispatcher.BeginInvoke(new Action(delegate { if (cancellation.IsCancellationRequested) return; mailHealth[account.Id] = good; UpdateConnectionLamp(); if (!syncing && activeAccount != null && activeAccount.Id == account.Id) Status(account.Email + " · " + phase); })); }, cancellation.Token); });
            }
        }
        private void RestartMailWatcher(string id) { CancellationTokenSource source; if (mailWatchers.TryGetValue(id, out source)) { source.Cancel(); mailWatchers.Remove(id); } mailHealth[id] = false; }
        private void StopMailWatchers() { mailShutdown.Cancel(); foreach (var source in mailWatchers.Values) source.Cancel(); if (networkHandler != null) NetworkChange.NetworkAvailabilityChanged -= networkHandler; }
        private void UpdateConnectionLamp() {
            if (window == null) return;
            var lamp = Find<System.Windows.Shapes.Ellipse>("ConnectionLamp"); if (lamp == null) return;
            bool good = activeAccount != null && mailHealth.ContainsKey(activeAccount.Id) && mailHealth[activeAccount.Id] && NetworkInterface.GetIsNetworkAvailable();
            var color = (Color)ColorConverter.ConvertFromString(good ? "#39FF70" : "#FF3B4D"); lamp.Fill = new SolidColorBrush(color); lamp.Effect = new DropShadowEffect { Color = color, BlurRadius = 10, ShadowDepth = 0, Opacity = 0.9 };
            lamp.ToolTip = good ? "Online · connected to the mail server" : activeAccount == null ? "No mailbox connected" : "Connection issue · offline, reconnecting, or waiting for the mail server";
            System.Windows.Automation.AutomationProperties.SetName(lamp, (string)lamp.ToolTip);
        }
        private void SelectMailbox(MailAccount account, string target) {
            if (activeAccount == null || activeAccount.Id != account.Id) {
                accountStore.Activate(account.Id); activeAccount = account; transport = new MailTransport(account, accountStore); store = CurrentMailbox(); lastBatchMove = null; selected = null; preferences.EmailAddress = account.Email;
            }
            folder = target; unreadOnly = false; Find<TextBox>("SearchBox").Text = ""; ApplyPreferences(); Refresh(null); UpdateConnectionLamp();
            Status(account.Email + " · " + FolderDisplayName(folder));
            if (!syncedAccounts.Contains(account.Id) && syncTimer != null) QueueMailSync(account.Id);
        }
        private string FolderDisplayName(string key) { var value = activeAccount == null || activeAccount.Folders == null ? null : activeAccount.Folders.FirstOrDefault(f => f.LocalName == key); return value == null ? key : value.Name; }
        private async Task SyncMail(string accountId = null) {
            if (offlinePreview) { Status("Offline preview · network connections disabled"); return; }
            var account = accountId == null ? activeAccount : mailAccounts.FirstOrDefault(a => a.Id == accountId); if (account == null) { Status("Add an email account in Settings → Accounts."); return; }
            if (syncing || !await mailGate.WaitAsync(0)) { pendingMailSync.Add(account.Id); return; }
            syncing = true;
            try {
                var mailbox = activeAccount != null && account.Id == activeAccount.Id ? store : new MailStore(Path.Combine(dataDirectory, "mail-" + account.Id + ".protected"), true, false);
                var oldInbox = new HashSet<string>(mailbox.Messages.Where(m => m.Folder == "Inbox").Select(m => m.Id));
                var cached = mailbox.Messages.ToList(); var service = new MailTransport(account, accountStore); DateTime lastProgress = DateTime.MinValue;
                var snapshot = await Task.Run(() => service.Synchronize(cached,
                    delegate(SyncProgress progress) {
                        if ((DateTime.UtcNow - lastProgress).TotalMilliseconds < 150 && progress.Phase == "Syncing" && progress.Completed < progress.Total) return; lastProgress = DateTime.UtcNow;
                        Dispatcher.BeginInvoke(new Action(delegate { if (!mailAccounts.Any(a => Object.ReferenceEquals(a, account))) return; Status(account.Email + " · " + progress.Phase + (String.IsNullOrEmpty(progress.Folder) ? "" : " " + progress.Folder) + (progress.Total == 0 ? "…" : " · " + progress.Completed + " / " + progress.Total + " items")); }));
                    }, delegate(List<ServerFolder> foldersFound) { Dispatcher.Invoke(new Action(delegate { if (!mailAccounts.Any(a => Object.ReferenceEquals(a, account))) throw new OperationCanceledException(); account.Folders = foldersFound; accountStore.Save(account); ApplyNavigation(); })); },
                    delegate(ServerFolder completed, List<Message> batch) { Dispatcher.Invoke(new Action(delegate {
                        if (!mailAccounts.Any(a => Object.ReferenceEquals(a, account))) throw new OperationCanceledException(); var targetStore = activeAccount != null && account.Id == activeAccount.Id ? store : mailbox;
                        var previous = targetStore.Messages.ToList();
                        targetStore.Messages.RemoveAll(m => m.RemoteUid != 0 && m.RemoteFolder == completed.Path);
                        targetStore.Messages.RemoveAll(m => m.Folder == "Sent" && m.RemoteUid == 0 && !String.IsNullOrEmpty(m.InternetMessageId) && batch.Any(r => r.InternetMessageId == m.InternetMessageId));
                        targetStore.Messages.AddRange(batch);
                        try { targetStore.Save(); } catch { targetStore.Messages.Clear(); targetStore.Messages.AddRange(previous); throw; }
                        if (activeAccount != null && account.Id == activeAccount.Id) Refresh(selected == null ? null : selected.Id);
                    })); }, mailShutdown.Token));
                if (!mailAccounts.Any(a => Object.ReferenceEquals(a, account))) return; account.Folders = snapshot.Folders; accountStore.Save(account); mailHealth[account.Id] = true; UpdateConnectionLamp();
                if (activeAccount != null && account.Id == activeAccount.Id) { ApplyNavigation(); Refresh(selected == null ? null : selected.Id); }
                var fresh = snapshot.Messages.Where(m => m.Folder == "Inbox" && m.Unread && !oldInbox.Contains(m.Id)).ToList();
                if (syncedAccounts.Contains(account.Id) && fresh.Count > 0) MailNotification(true, account.Email + " · " + (fresh.Count == 1 ? fresh[0].Subject : fresh.Count + " new messages"));
                syncedAccounts.Add(account.Id); Status(account.Email + " · Up to date · " + snapshot.Messages.Count + " cached items in " + snapshot.Folders.Count + " folders · listening for mail");
            } catch (OperationCanceledException) { }
            catch (Exception error) { mailHealth[account.Id] = false; UpdateConnectionLamp(); Status(account.Email + " · Sync interrupted: " + error.Message.Split('\n')[0] + " · cached mail kept; retrying automatically"); }
            finally {
                syncing = false; mailGate.Release();
                if (pendingMailSync.Count > 0 && !mailShutdown.IsCancellationRequested) { string next = pendingMailSync.First(); pendingMailSync.Remove(next); QueueMailSync(next); }
            }
        }
        private void RemoveMailAccount(string id) {
            RestartMailWatcher(id); accountStore.Remove(id); mailAccounts = accountStore.LoadAll();
            if (activeAccount != null && activeAccount.Id == id) { activeAccount = accountStore.Load(); transport = activeAccount == null ? null : new MailTransport(activeAccount, accountStore); store = CurrentMailbox(); selected = null; lastBatchMove = null; folder = "Inbox"; }
            pendingMailSync.Remove(id); ApplyPreferences(); Refresh(null); UpdateConnectionLamp();
        }
    }
}
