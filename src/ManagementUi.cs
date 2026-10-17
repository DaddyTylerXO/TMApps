using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace Postbox {
    public partial class App {
        private void ShowMailboxManagement() {
            var account = activeAccount; var mailbox = store;
            var dialog = Dialog("Mailbox Management · TMA-Mail", 1020, 790);
            var root = new DockPanel { Margin = new Thickness(24) }; dialog.Content = root;
            var heading = new StackPanel(); DockPanel.SetDock(heading, Dock.Top); root.Children.Add(heading);
            heading.Children.Add(Label("Mailbox Management", 24, "Text"));
            heading.Children.Add(Label(account == null ? "Sample mailbox" : account.Email, 14, "Muted"));
            heading.Children.Add(Label("Mailbox Subscriptions finds mailing lists and lets you review unsubscribe requests. Mailbox Analytics counts your most common Inbox subjects and senders, and lets you select matching emails to move or delete. Scans start only when you choose Scan Mailbox.", 12, "Muted"));
            var choices = new WrapPanel { Margin = new Thickness(0, 0, 0, 14) }; heading.Children.Add(choices);
            var subscriptions = Action("Mailbox Subscriptions", false); var analytics = Action("Mailbox Analytics", false); choices.Children.Add(subscriptions); choices.Children.Add(analytics);
            var page = new ContentControl { HorizontalContentAlignment = HorizontalAlignment.Stretch, VerticalContentAlignment = VerticalAlignment.Stretch }; root.Children.Add(page);
            page.Content = Label("Choose an option above to get started.", 15, "Muted");
            CancellationTokenSource scanCancellation = null;
            Action<bool> show = delegate(bool subscriptionsPage) {
                if (scanCancellation != null) scanCancellation.Cancel(); scanCancellation = new CancellationTokenSource();
                subscriptions.Background = Theme.B(subscriptionsPage ? "SidebarAccent" : "SidebarSelected"); analytics.Background = Theme.B(subscriptionsPage ? "SidebarSelected" : "SidebarAccent");
                page.Content = subscriptionsPage ? CreateSubscriptionsPage(dialog, account, scanCancellation) : CreateAnalyticsPage(dialog, account, mailbox, scanCancellation);
            };
            subscriptions.Click += delegate { show(true); }; analytics.Click += delegate { show(false); };
            dialog.Closed += delegate { if (scanCancellation != null) scanCancellation.Cancel(); };
            dialog.ShowDialog();
        }
        public static List<Message> AnalyticsMatches(IEnumerable<Message> snapshot, MailAnalyticRow row, bool senders) {
            return snapshot.Where(m => m.Folder == "Inbox" && String.Equals(senders ? (m.Address ?? "").Trim() : System.Text.RegularExpressions.Regex.Replace((m.Subject ?? "(No subject)").Trim(), @"\s+", " "), row.Key, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        private FrameworkElement CreateAnalyticsPage(Window owner, MailAccount account, MailStore mailbox, CancellationTokenSource cancellation) {
            var root = new DockPanel(); var heading = new StackPanel(); DockPanel.SetDock(heading, Dock.Top); root.Children.Add(heading);
            heading.Children.Add(Label("Mailbox Analytics", 21, "Text"));
            var status = Label("Choose Scan Mailbox to count Inbox subjects and sender addresses. Nothing has been scanned yet.", 12, "Muted"); heading.Children.Add(status);
            var controls = new WrapPanel { Margin = new Thickness(0, 0, 0, 12) }; heading.Children.Add(controls);
            var scan = Action("Scan Mailbox", true); var moveSelected = Action("Move Selected…", false); var deleteSelected = Action("Delete Selected", false); var clear = Action("Clear Selection", false);
            controls.Children.Add(scan); controls.Children.Add(moveSelected); controls.Children.Add(deleteSelected); controls.Children.Add(clear);
            var selectedCount = Label("0 emails selected", 12, "Muted"); heading.Children.Add(selectedCount);
            var results = new StackPanel(); root.Children.Add(new ScrollViewer { Content = results, VerticalScrollBarVisibility = ScrollBarVisibility.Auto });
            var snapshot = new List<Message>(); var selectedIds = new HashSet<string>(); bool busy = false;
            Func<Message, string> key = m => m.RemoteUid != 0 ? m.RemoteFolder + ":" + m.UidValidity + ":" + m.RemoteUid : m.Id;
            Action updateSelection = delegate { selectedCount.Text = selectedIds.Count + " emails selected"; moveSelected.IsEnabled = deleteSelected.IsEnabled = !busy && selectedIds.Count > 0; clear.IsEnabled = !busy && selectedIds.Count > 0; };
            Action render = null; Func<List<Message>, string, Task> move = null;
            Action<List<Message>, Button> chooseMove = (messages, anchor) => {
                var menu = new ContextMenu { PlacementTarget = anchor };
                var destinations = new[] { "Archive", "Trash" }.Concat(account == null ? new string[0] : (account.Folders ?? new List<ServerFolder>()).Where(f => f.Selectable && f.LocalName.StartsWith("Server:")).Select(f => f.LocalName)).Distinct();
                foreach (string destination in destinations) { string captured = destination; var item = new MenuItem { Header = FolderDisplayName(captured) }; item.Click += async delegate { await move(messages, captured); }; menu.Items.Add(item); }
                menu.IsOpen = true;
            };
            move = async delegate(List<Message> messages, string destination) {
                if (busy || messages.Count == 0 || cancellation.IsCancellationRequested) return;
                string destinationName = destination == "Trash" ? "Trash" : FolderDisplayName(destination);
                if (MessageBox.Show(owner, (destination == "Trash" ? "Delete " : "Move ") + messages.Count + " matching Inbox emails" + (destination == "Trash" ? " by moving them to Trash?" : " to " + destinationName + "?") + "\n\nThis applies to all selected matches, including emails outside the local cache.", "Review mailbox changes", MessageBoxButton.YesNo, MessageBoxImage.Question, MessageBoxResult.No) != MessageBoxResult.Yes) return;
                busy = true; scan.IsEnabled = false; updateSelection(); results.IsEnabled = false;
                try {
                    if (account != null) {
                        if (offlinePreview) throw new InvalidOperationException("Server changes are unavailable in offline preview.");
                        if (!await mailGate.WaitAsync(0)) throw new InvalidOperationException("Please wait for the current mail operation.");
                        try { status.Text = "Moving " + messages.Count + " emails…"; await Task.Run(() => new MailTransport(account, accountStore).Move(messages, destination)); } finally { mailGate.Release(); }
                        await SyncMail(account.Id);
                    } else { mailbox.MoveMany(messages, destination); if (mailbox == store) Refresh(null); }
                    var moved = new HashSet<string>(messages.Select(key)); snapshot.RemoveAll(m => moved.Contains(key(m))); selectedIds.ExceptWith(moved);
                    if (!cancellation.IsCancellationRequested) { render(); status.Text = "Moved " + moved.Count + " emails to " + destinationName + ". Scan Mailbox again to refresh current server counts."; }
                } catch (Exception ex) { if (!cancellation.IsCancellationRequested) status.Text = "Move failed or was interrupted: " + ex.Message + " Scan again before retrying; some server changes may already have completed."; }
                finally { busy = false; scan.IsEnabled = true; results.IsEnabled = true; updateSelection(); }
            };
            render = delegate {
                results.Children.Clear();
                for (int section = 0; section < 2; section++) {
                    bool senders = section == 1;
                    var title = Label(senders ? "Top 10 sender email addresses" : "Top 10 repeated subjects", 17, "#FFFFFF"); title.Margin = new Thickness(0);
                    results.Children.Add(new Border { Background = Theme.B("SidebarAccent"), CornerRadius = new CornerRadius(16), Padding = new Thickness(16, 10, 16, 10), Margin = new Thickness(0, 12, 0, 12), Child = title });
                    foreach (var row in MailAnalytics.Top(snapshot, senders)) {
                        var matches = AnalyticsMatches(snapshot, row, senders); var line = new Grid { Margin = new Thickness(4, 0, 4, 10) }; line.ColumnDefinitions.Add(new ColumnDefinition()); line.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
                        var info = Label(row.Name + "  ·  " + row.Count + (row.Count == 1 ? " email" : " emails"), 13, "Text"); info.Margin = new Thickness(0, 10, 12, 4); line.Children.Add(info);
                        var actions = new WrapPanel { HorizontalAlignment = HorizontalAlignment.Right, MaxWidth = 390 }; Grid.SetColumn(actions, 1); line.Children.Add(actions);
                        var select = new CheckBox { Content = "Select All", IsChecked = matches.All(m => selectedIds.Contains(key(m))), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 12, 0) };
                        select.Checked += delegate { foreach (var message in matches) selectedIds.Add(key(message)); render(); }; select.Unchecked += delegate { foreach (var message in matches) selectedIds.Remove(key(message)); render(); }; actions.Children.Add(select);
                        var rowMove = Action("Move…", false); rowMove.ToolTip = "Move all " + row.Count + " matching Inbox emails"; rowMove.Click += delegate { chooseMove(matches, rowMove); }; actions.Children.Add(rowMove);
                        var rowDelete = Action("Delete", false); rowDelete.ToolTip = "Move all " + row.Count + " matching Inbox emails to Trash"; rowDelete.Click += async delegate { await move(matches, "Trash"); }; actions.Children.Add(rowDelete); results.Children.Add(line);
                    }
                } updateSelection();
            };
            moveSelected.Click += delegate { chooseMove(snapshot.Where(m => selectedIds.Contains(key(m))).ToList(), moveSelected); };
            deleteSelected.Click += async delegate { await move(snapshot.Where(m => selectedIds.Contains(key(m))).ToList(), "Trash"); };
            clear.Click += delegate { selectedIds.Clear(); render(); };
            scan.IsEnabled = account == null || !offlinePreview;
            scan.Click += async delegate {
                if (busy || cancellation.IsCancellationRequested) return; busy = true; scan.IsEnabled = false; updateSelection(); results.IsEnabled = false;
                try {
                    status.Text = account == null ? "Reading sample Inbox…" : "Scanning Inbox headers…";
                    snapshot = account == null ? mailbox.Messages.Where(m => m.Folder == "Inbox").ToList() : await Task.Run(() => new MailTransport(account, accountStore).InboxAnalytics((done, total) => Dispatcher.BeginInvoke(new Action(delegate { if (!cancellation.IsCancellationRequested) status.Text = "Scanning Inbox headers · " + done + " / " + total; })), cancellation.Token));
                    if (cancellation.IsCancellationRequested) return; selectedIds.Clear(); render(); status.Text = "Scanned " + snapshot.Count + " Inbox emails. Subjects ignore case and extra spaces; reply/forward prefixes remain separate. Select All selects every match, not only cached mail.";
                } catch (OperationCanceledException) { } catch (Exception ex) { if (!cancellation.IsCancellationRequested) status.Text = "Scan failed: " + ex.Message; }
                finally { busy = false; scan.IsEnabled = account == null || !offlinePreview; results.IsEnabled = true; updateSelection(); }
            };
            updateSelection(); return root;
        }
    }
}
