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
            if (destination.StartsWith("Server:") && messages.All(m => m.RemoteUid == 0)) { Status("Local drafts stay on this PC. Server folders are available for synced messages."); return; }
            if (activeAccount != null && messages.Any(m => m.RemoteUid != 0)) {
                var movingAccount = activeAccount; var movingService = new MailTransport(movingAccount, accountStore);
                if (destination == "Drafts" || destination == "Sent") { Status("Server mail can be moved to Inbox, Archive, or Trash. Drafts and Sent are managed by composing and delivery."); return; }
                if (!await mailGate.WaitAsync(0)) { Status("Please wait for the current mail operation."); return; }
                try { Status("Moving messages on the server…"); await System.Threading.Tasks.Task.Run(() => movingService.Move(messages, destination)); lastBatchMove = null; }
                catch (Exception ex) { Status("Server move failed or was interrupted: " + ex.Message + " · sync to check the server before retrying"); return; }
                finally { mailGate.Release(); }
                await SyncMail(movingAccount.Id); return;
            }
            var history = messages.ToDictionary(m => m.Id, m => m.Folder);
            store.MoveMany(messages, destination); lastBatchMove = history; Refresh(null);
            Status(messages.Count + " message(s) moved to " + destination + " · Ctrl+Z to undo");
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
            Find<Button>("StarButton").Content = "Toggle Star";
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
