using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using Microsoft.Win32;

namespace Postbox {
    public partial class App {
        private Dictionary<string, string> lastBatchMove;
        private RichTextBox richReader;
        private StackPanel attachmentReader;
        private Button moveButton;
        private bool favouritesTab;
        private Func<MailAccount, List<Message>, string, Dictionary<string, Message>> serverMove;
        private readonly HashSet<string> pendingServerMoves = new HashSet<string>();
        private readonly Dictionary<MailStore, HashSet<string>> pendingDeletes = new Dictionary<MailStore, HashSet<string>>();
        private bool DeletePending(MailStore mailbox, Message message) {
            HashSet<string> ids; return message.Folder != "Trash" && pendingDeletes.TryGetValue(mailbox, out ids) && ids.Contains(message.Id);
        }
        private int PendingDeleteCount(MailStore mailbox, string source, bool unread) {
            return mailbox == null ? 0 : mailbox.Messages.Count(m => m.Folder == source && (!unread || m.Unread) && DeletePending(mailbox, m));
        }
        private int DisplayedInboxUnread(MailAccount account) {
            MailStore mailbox; connectedMailboxes.TryGetValue(account.Id, out mailbox);
            int count = account.Folders == null ? 0 : account.Folders.Where(f => f.LocalName == "Inbox").Select(f => Math.Max(0, f.Unread)).DefaultIfEmpty(0).Max();
            return Math.Max(0, count - PendingDeleteCount(mailbox, "Inbox", true));
        }
        private void InitializeMailboxFeatures() {
            var list = Find<ListBox>("MessageList"); list.SelectionMode = SelectionMode.Extended;
            list.ToolTip = "Ctrl+click to select individual messages. Shift+click to select a range.";
            var toolbar = (Panel)Find<Button>("DeleteButton").Parent;
            moveButton = Action("↗ Move to…", false); moveButton.Click += delegate { ShowMoveMenu(moveButton); }; toolbar.Children.Insert(2, moveButton);
            var menu = new ContextMenu();
            foreach (string target in new[] { "Inbox", "Drafts", "Sent", "Archive", "Trash" }) { string destination = target; var item = new MenuItem { Header = "Move to " + target }; item.Click += delegate { MoveSelected(destination); }; menu.Items.Add(item); }
            list.ContextMenu = menu;
            menu.Opened += delegate { menu.Items.Clear(); foreach (string target in MoveDestinations()) { string destination = target; var entry = new MenuItem { Header = "Move to " + FolderDisplayName(target) }; entry.Click += delegate { MoveSelected(destination); }; menu.Items.Add(entry); } };
            var body = Find<TextBox>("BodyText"); var parent = (StackPanel)body.Parent; int index = parent.Children.IndexOf(body);
            richReader = new RichTextBox { IsReadOnly = true, BorderThickness = new Thickness(0), Background = Theme.B("Surface"), Foreground = Theme.B("Text"), Padding = new Thickness(0), VerticalScrollBarVisibility = ScrollBarVisibility.Disabled, Visibility = Visibility.Collapsed };
            parent.Children.Insert(index, richReader);
            attachmentReader = new StackPanel { Margin = new Thickness(0, 16, 0, 0) }; parent.Children.Insert(index + 2, attachmentReader);
            foreach (string name in folders) {
                string favourite = name; var nav = Find<Button>(name + "Nav");
                var favouritesMenu = new ContextMenu(); var toggle = new MenuItem(); favouritesMenu.Items.Add(toggle);
                favouritesMenu.Opened += delegate { toggle.Header = preferences.FavouriteFolders.Contains(favourite) ? "Remove from favourites" : "Add to favourites"; };
                toggle.Click += delegate {
                    var updated = settingsStore.Clone(preferences);
                    if (updated.FavouriteFolders.Contains(favourite)) updated.FavouriteFolders.Remove(favourite); else updated.FavouriteFolders.Add(favourite);
                    settingsStore.Save(updated); preferences = updated; ApplyNavigation();
                }; nav.ContextMenu = favouritesMenu;
            }
        }
        private List<Message> SelectedMessages() { return Find<ListBox>("MessageList").SelectedItems.Cast<Message>().ToList(); }
        private void ShowMoveMenu(Button anchor) {
            var menu = new ContextMenu { PlacementTarget = anchor };
            foreach (string name in MoveDestinations()) { string target = name; var item = new MenuItem { Header = FolderDisplayName(name) }; item.Click += delegate { MoveSelected(target); }; menu.Items.Add(item); }
            menu.IsOpen = true;
        }
        private async void MoveSelected(string destination) {
            var messages = SelectedMessages().Where(m => m.Folder != destination).ToList(); if (messages.Count == 0) return;
            if (destination.StartsWith("Server:") && messages.Any(m => m.RemoteUid == 0)) { Status("Local drafts stay on this PC. Select only synced messages to move to a server folder."); return; }
            if (activeAccount != null && messages.Any(m => m.RemoteUid != 0)) {
                var movingAccount = activeAccount; var movingMailbox = store;
                if (destination == "Drafts" || destination == "Sent") { Status("Server mail can be moved to Inbox, Archive, or Trash. Drafts and Sent are managed by composing and delivery."); return; }
                await MoveServerMessages(messages, movingAccount, movingMailbox, destination); return;
            }
            var history = messages.ToDictionary(m => m.Id, m => m.Folder);
            foreach (var message in messages) message.Folder = destination;
            lastBatchMove = history; Refresh(null); SaveMailboxInBackground(store);
            Status(messages.Count + " message(s) moved to " + destination + " · Ctrl+Z to undo");
        }
        private async System.Threading.Tasks.Task<bool> MoveServerMessages(List<Message> messages, MailAccount account, MailStore mailbox, string destination) {
            if (destination == "Drafts" || destination == "Sent") { Status("Drafts and Sent are managed by composing and delivery."); return false; }
            var moveKeys = messages.Select(m => account.Id + ":" + m.Id).ToList();
            if (moveKeys.Any(k => pendingServerMoves.Contains(k))) { Status("These messages are already being moved."); return false; }
            foreach (var key in moveKeys) pendingServerMoves.Add(key);
            bool deleting = destination == "Trash", committed = false;
            if (deleting) {
                HashSet<string> hidden;
                if (!pendingDeletes.TryGetValue(mailbox, out hidden)) pendingDeletes[mailbox] = hidden = new HashSet<string>();
                foreach (var message in messages) hidden.Add(message.Id);
                // Hide immediately without changing cached folders or remote UIDs before server confirmation.
                if (store == mailbox) Refresh(null); UpdateUnreadBadge();
            }
            string interrupted = null;
            var waiting = mailGate.WaitAsync();
            if (!waiting.IsCompleted) { Status("Waiting for the current mail operation…"); if (currentSyncCancellation != null) { interrupted = currentSyncAccountId; currentSyncCancellation.Cancel(); } }
            await waiting;
            try {
                if (!mailAccounts.Any(a => Object.ReferenceEquals(a, account)) || removingMailAccounts.Contains(account.Id)) { Status("The mailbox was disconnected before the move started."); return false; }
                Status("Moving messages on the server…");
                var remote = messages.Where(m => m.RemoteUid != 0).Select(m => m.CopyForSync()).ToList();
                var moved = await System.Threading.Tasks.Task.Run(() => serverMove == null ? new MailTransport(account, accountStore).Move(remote, destination) : serverMove(account, remote, destination));
                var ids = new HashSet<string>(remote.Select(m => m.Id));
                var destinationIds = new HashSet<string>(moved.Values.Select(m => m.Id)); mailbox.Messages.RemoveAll(m => ids.Contains(m.Id) || destinationIds.Contains(m.Id)); mailbox.Messages.AddRange(moved.Values);
                foreach (var message in messages.Where(m => m.RemoteUid == 0)) message.Folder = destination;
                committed = true;
                lastBatchMove = null;
                foreach (var group in remote.GroupBy(m => m.RemoteFolder)) { var source = (account.Folders ?? new List<ServerFolder>()).FirstOrDefault(f => f.Path == group.Key); if (source != null) { source.Count = Math.Max(0, source.Count - group.Count()); source.Unread = Math.Max(0, source.Unread - group.Count(m => m.Unread)); } }
                var target = (account.Folders ?? new List<ServerFolder>()).FirstOrDefault(f => f.LocalName == destination); if (target != null) { target.Count += remote.Count; target.Unread += remote.Count(m => m.Unread); }
                if (store == mailbox) Refresh(null); UpdateUnreadBadge(); UpdateNavigationLabels();
                try { await PersistMailboxAsync(mailbox); } catch { Status("Messages moved on the server, but the local cache could not be saved. Sync before retrying."); return true; }
                Status(messages.Count + " message(s) moved to " + FolderDisplayName(destination) + (pausedMailSync.Contains(account.Id) && moved.Count < remote.Count ? " · resume sync to refresh destination messages" : ""));
            } catch (Exception ex) { Status("Server move failed or was interrupted: " + ex.Message + (deleting ? " · messages restored in the app" : "") + " · sync to check the server before retrying"); return false; }
            finally {
                foreach (var key in moveKeys) pendingServerMoves.Remove(key);
                if (deleting) {
                    HashSet<string> hidden;
                    if (pendingDeletes.TryGetValue(mailbox, out hidden)) { foreach (var message in messages) hidden.Remove(message.Id); if (hidden.Count == 0) pendingDeletes.Remove(mailbox); }
                    if (!committed && store == mailbox) Refresh(selected == null ? null : selected.Id);
                    UpdateUnreadBadge();
                }
                mailGate.Release(); if (interrupted != null && !pausedMailSync.Contains(interrupted) && mailAccounts.Any(a => a.Id == interrupted)) QueueMailSync(interrupted);
            }
            if (!pausedMailSync.Contains(account.Id)) QueueMailSync(account.Id);
            return true;
        }
        private IEnumerable<string> MoveDestinations() { return new[] { "Inbox", "Drafts", "Sent", "Archive", "Trash" }.Concat(activeAccount == null ? new string[0] : (activeAccount.Folders ?? new List<ServerFolder>()).Where(f => f.Selectable && f.LocalName.StartsWith("Server:")).Select(f => f.LocalName)); }
        private void UndoMove() {
            if (lastBatchMove == null) return;
            var originals = store.Messages.Where(m => lastBatchMove.ContainsKey(m.Id)).ToDictionary(m => m, m => m.Folder);
            try { foreach (var message in originals.Keys) message.Folder = lastBatchMove[message.Id]; SaveMailboxInBackground(store); }
            catch { foreach (var item in originals) item.Key.Folder = item.Value; throw; }
            string id = lastBatchMove.Keys.First(); folder = lastBatchMove[id]; lastBatchMove = null; Refresh(id); Status("Move undone");
        }
        private void ToggleSelectedStars() {
            var messages = SelectedMessages(); if (messages.Count == 0) return;
            bool star = messages.Any(m => !m.Starred); foreach (var message in messages) message.Starred = star;
            foreach (var message in messages) SaveServerFlags(message);
            SaveMailboxInBackground(store); Refresh(selected.Id);
        }
        private void ToggleSelectedRead() {
            var messages = SelectedMessages(); if (messages.Count == 0) return;
            bool markUnread = !messages.Any(m => m.Unread); foreach (var message in messages) SetUnreadLocal(message, markUnread);
            foreach (var message in messages) SaveServerFlags(message);
            SaveMailboxInBackground(store); Refresh(selected.Id);
        }
        private bool RenderMultipleSelection() {
            var messages = SelectedMessages(); bool multiple = messages.Count > 1;
            Find<Button>("ReplyButton").IsEnabled = !multiple; Find<Button>("ForwardButton").IsEnabled = !multiple;
            moveButton.IsEnabled = messages.Count > 0;
            if (!multiple) return false; if (htmlReader != null) htmlReader.Visibility = Visibility.Collapsed;
            Find<TextBlock>("SubjectText").Text = messages.Count + " messages selected";
            Find<TextBlock>("SenderInitials").Text = "✓"; Find<TextBlock>("SenderText").Text = "Manage your selection";
            Find<TextBlock>("AddressText").Text = "Ctrl+click to add or remove messages · Shift+click for a range";
            Find<TextBlock>("DateText").Text = "";
            Find<TextBox>("BodyText").Visibility = Visibility.Visible; Find<TextBox>("BodyText").Text = "Use Move to, Archive, Delete, Star, or Mark read to update all selected messages.\n\n" + String.Join("\n", messages.Select(m => "• " + m.Subject));
            richReader.Visibility = Visibility.Collapsed; attachmentReader.Children.Clear();
            Find<Button>("ArchiveButton").IsEnabled = true;
            Find<Button>("ReadButton").Content = messages.Any(m => m.Unread) ? "Mark Read" : "Mark Unread";
            Find<Button>("StarButton").Content = "☆ Toggle Star";
            return true;
        }
        private void RenderRichMessage(Message message) {
            richReader.Visibility = Visibility.Collapsed; if (htmlReader != null) htmlReader.Visibility = Visibility.Collapsed; Find<TextBox>("BodyText").Visibility = Visibility.Visible;
            if (!String.IsNullOrEmpty(message.RichBody)) {
                if (RichMail.Load(richReader, message.RichBody)) { richReader.Visibility = Visibility.Visible; Find<TextBox>("BodyText").Visibility = Visibility.Collapsed; }
            }
            if (!String.IsNullOrWhiteSpace(message.HtmlBody) && htmlReader != null) {
                richReader.Visibility = Visibility.Collapsed; Find<TextBox>("BodyText").Visibility = Visibility.Collapsed;
                htmlReader.Height = Math.Max(300, previewPanel.ActualHeight - 280); htmlReader.Visibility = Visibility.Visible; htmlReader.ShowMessage(message);
            }
            attachmentReader.Children.Clear();
            if (message.Importance == "High" || message.FollowUp) attachmentReader.Children.Add(Label((message.Importance == "High" ? "! High importance   " : "") + (message.FollowUp ? "⚑ Follow up" : ""), 12, "#BC9451"));
            foreach (var attachment in message.Attachments ?? new List<MailAttachment>()) {
                var button = Action("📎 " + attachment.Name + "  ·  Save…", false); button.HorizontalAlignment = HorizontalAlignment.Left; button.Margin = new Thickness(0, 4, 0, 4);
                button.Click += delegate {
                    var save = new SaveFileDialog { FileName = Path.GetFileName(attachment.Name), Title = "Save attachment" };
                    if (save.ShowDialog(window) == true) File.WriteAllBytes(save.FileName, Convert.FromBase64String(attachment.Data));
                }; attachmentReader.Children.Add(button);
            }
        }
    }
}
