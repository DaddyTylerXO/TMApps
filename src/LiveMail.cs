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
        private TaskCompletionSource<bool> syncCompletion;
        private readonly HashSet<Task> cacheWrites = new HashSet<Task>();
        private bool closingCache, cacheCloseReady;
        private async Task PersistMailboxAsync(MailStore mailbox) {
            Task write = mailbox.SaveAsync(); cacheWrites.Add(write);
            try { await write; } finally { cacheWrites.Remove(write); }
        }
        private async void SaveMailboxInBackground(MailStore mailbox) {
            try { await PersistMailboxAsync(mailbox); } catch (Exception ex) { Status("Local mail cache could not be saved: " + ex.Message); }
        }
        private void InitializeCacheShutdown() {
            window.Closing += async delegate(object sender, System.ComponentModel.CancelEventArgs e) {
                if (e.Cancel || cacheCloseReady) return;
                if (closingCache) { e.Cancel = true; return; }
                if (!syncing && cacheWrites.Count == 0) return;
                e.Cancel = true; closingCache = true; StopMailWatchers(); if (syncTimer != null) syncTimer.Stop();
                Status("Finishing background cache writes…");
                try { if (syncCompletion != null) await syncCompletion.Task; await Task.WhenAll(cacheWrites.ToArray()); }
                catch (Exception ex) { MessageBox.Show(window, "The latest local cache could not be saved: " + ex.Message, "Cache save"); }
                cacheCloseReady = true; window.Close();
            };
        }
        private static string FolderState(IEnumerable<ServerFolder> values) { return values == null ? "" : String.Join("|", values.Select(f => f.Path + ":" + f.Name + ":" + f.Count + ":" + f.Unread)); }
        private async Task SyncMail(string accountId = null) {
            if (offlinePreview) { Status("Offline preview · network connections disabled"); return; }
            if (mailShutdown.IsCancellationRequested) return;
            var account = accountId == null ? activeAccount : mailAccounts.FirstOrDefault(a => a.Id == accountId); if (account == null) { Status("Add an email account in Settings → Accounts."); return; }
            if (syncing || !await mailGate.WaitAsync(0)) { pendingMailSync.Add(account.Id); return; }
            syncing = true; var completion = new TaskCompletionSource<bool>(); syncCompletion = completion;
            MailStore mailbox = null; bool changed = false; string oldFolders = FolderState(account.Folders);
            object progressGate = new object(); bool progressQueued = false, reporting = true; string latestProgress = null;
            try {
                try {
                    mailbox = await GetMailboxAsync(account);
                    var oldInbox = new HashSet<string>(mailbox.Messages.Where(m => m.Folder == "Inbox").Select(m => m.Id));
                    var cached = mailbox.Messages.ToList(); var service = new MailTransport(account, accountStore); DateTime lastProgress = DateTime.MinValue;
                    var snapshot = await Task.Run(() => service.Synchronize(cached,
                        delegate(SyncProgress progress) {
                            if ((DateTime.UtcNow - lastProgress).TotalMilliseconds < 200) return; lastProgress = DateTime.UtcNow;
                            lock (progressGate) {
                                latestProgress = account.Email + " · " + progress.Phase + (String.IsNullOrEmpty(progress.Folder) ? "" : " " + progress.Folder) + (progress.Total == 0 ? "…" : " · " + progress.Completed + " / " + progress.Total + " items");
                                if (progressQueued) return; progressQueued = true;
                            }
                            Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Background, new Action(delegate {
                                string text; lock (progressGate) { text = latestProgress; progressQueued = false; if (!reporting) return; }
                                if (mailAccounts.Any(a => Object.ReferenceEquals(a, account))) Status(text);
                            }));
                        }, delegate(List<ServerFolder> foldersFound) {
                            Dispatcher.Invoke(System.Windows.Threading.DispatcherPriority.Background, new Action(delegate {
                                if (!mailAccounts.Any(a => Object.ReferenceEquals(a, account))) throw new OperationCanceledException();
                                account.Folders = foldersFound.Select(f => new ServerFolder { Name = f.Name, Path = f.Path, ParentPath = f.ParentPath, LocalName = f.LocalName, Count = f.Count, Unread = f.Unread, Selectable = f.Selectable }).ToList();
                            }));
                        }, delegate(ServerFolder completed, List<Message> batch) { Dispatcher.Invoke(System.Windows.Threading.DispatcherPriority.Background, new Action(delegate {
                            if (!mailAccounts.Any(a => Object.ReferenceEquals(a, account))) throw new OperationCanceledException();
                            bool folderChanged = mailbox.ApplyFolderBatch(completed, batch); changed |= folderChanged;
                            if (folderChanged && activeAccount != null && account.Id == activeAccount.Id && (folder == completed.LocalName || folder == "Starred")) Refresh(selected == null ? null : selected.Id);
                        })); }, mailShutdown.Token));
                    lock (progressGate) reporting = false;
                    if (!mailAccounts.Any(a => Object.ReferenceEquals(a, account))) return;
                    account.Folders = snapshot.Folders; await Task.Run(() => accountStore.SaveTokens(account)); mailHealth[account.Id] = true; UpdateConnectionLamp();
                    if (activeAccount != null && account.Id == activeAccount.Id) { if (oldFolders != FolderState(account.Folders)) ApplyNavigation(); UpdateCounts(); }
                    var fresh = snapshot.Messages.Where(m => m.Folder == "Inbox" && m.Unread && !oldInbox.Contains(m.Id)).ToList();
                    if (syncedAccounts.Contains(account.Id) && fresh.Count > 0) MailNotification(true, account.Email + " · " + (fresh.Count == 1 ? fresh[0].Subject : fresh.Count + " new messages"));
                    syncedAccounts.Add(account.Id); Status(account.Email + " · Up to date · " + snapshot.Messages.Count + " cached items in " + snapshot.Folders.Count + " folders · listening for mail");
                } catch (OperationCanceledException) { }
                catch (Exception error) { mailHealth[account.Id] = false; UpdateConnectionLamp(); Status(account.Email + " · Sync interrupted: " + error.Message.Split('\n')[0] + " · cached mail kept; retrying automatically"); }
                    lock (progressGate) reporting = false;
                try { if (changed && mailbox != null) await PersistMailboxAsync(mailbox); }
                catch (Exception ex) { Status(account.Email + " · Local cache could not be saved: " + ex.Message); }
            } finally {
                lock (progressGate) reporting = false;
                syncing = false; mailGate.Release(); completion.TrySetResult(true);
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
