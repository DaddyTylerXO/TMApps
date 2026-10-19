using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Win32;

namespace Postbox {
    public partial class App {
        private event Action mailToolbarChanged;
        private void NotifyMailToolbarChanged() { if (mailToolbarChanged != null) mailToolbarChanged(); }
        private sealed class MessageWindowContext {
            public string Id; public MailAccount Account; public MailStore Mailbox; public Window Window;
            public TextBlock Subject, Status; public StackPanel Body; public Action Refresh;
        }
        private Message WindowMessage(MessageWindowContext context) {
            if (context.Account != null && !mailAccounts.Any(a => Object.ReferenceEquals(a, context.Account))) return null;
            return context.Mailbox.Messages.FirstOrDefault(m => m.Id == context.Id);
        }
        private IEnumerable<string> WindowMoveDestinations(MailAccount account) {
            return new[] { "Inbox", "Drafts", "Sent", "Archive", "Trash" }.Concat((account == null ? new List<ServerFolder>() : account.Folders ?? new List<ServerFolder>()).Where(f => f.Selectable && f.LocalName.StartsWith("Server:")).Select(f => f.LocalName));
        }
        private string WindowFolderName(MailAccount account, string key) {
            var folderInfo = account == null || account.Folders == null ? null : account.Folders.FirstOrDefault(f => f.LocalName == key);
            return folderInfo == null ? key : folderInfo.Name;
        }
        private void OpenMessageWindow(Message message, MailAccount account, MailStore mailbox) {
            if (message == null) return;
            var pop = Dialog(message.Subject + " · TMA-Mail", 1120, 820); pop.MinWidth = 680; pop.MinHeight = 480;
            var root = new DockPanel(); pop.Content = root;
            var actions = new WrapPanel { ItemHeight = 40, HorizontalAlignment = HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Top };
            var fast = new WrapPanel { ItemHeight = 40 };
            var bar = new Border { Background = Theme.B("Surface"), Child = CreateMailToolbar(actions, fast) }; DockPanel.SetDock(bar, Dock.Top); root.Children.Add(bar);
            var status = Label("", 12, "Muted"); DockPanel.SetDock(status, Dock.Bottom); root.Children.Add(status);
            var body = new StackPanel { Margin = new Thickness(24) };
            var subject = Label(message.Subject, 25, "Text"); subject.Name = "PoppedSubject"; subject.ToolTip = "Double-click to edit the subject in TMA-Mail"; body.Children.Add(subject);
            body.Children.Add(Label(message.Sender + " <" + message.Address + ">\nTo: " + message.To + "\n" + message.Date.ToString("f"), 13, "Muted"));
            var context = new MessageWindowContext { Id = message.Id, Account = account, Mailbox = mailbox, Window = pop, Subject = subject, Status = status, Body = body };
            pop.Tag = context;
            HtmlMessageView html = null;
            if (!String.IsNullOrWhiteSpace(message.HtmlBody)) { html = new HtmlMessageView(dataDirectory) { MinHeight = 450, Visibility = Visibility.Visible }; html.SetImagePolicy(preferences.AutoLoadImages); body.Children.Add(html); html.ShowMessage(message); }
            else { var rich = new RichTextBox { IsReadOnly = true, Background = Theme.B("Surface"), Foreground = Theme.B("Text"), BorderThickness = new Thickness(0), FontFamily = new FontFamily("Segoe UI"), FontSize = preferences.TextSize }; if (String.IsNullOrEmpty(message.RichBody) || !RichMail.Load(rich, message.RichBody)) rich.Document = new FlowDocument(new Paragraph(new Run(message.Body))); body.Children.Add(rich); }
            foreach (var attachment in message.Attachments ?? new List<MailAttachment>()) {
                var captured = attachment; var save = Action("📎 " + System.IO.Path.GetFileName(captured.Name), false);
                save.Click += delegate { var picker = new SaveFileDialog { FileName = System.IO.Path.GetFileName(captured.Name) }; if (picker.ShowDialog(pop) == true) System.IO.File.WriteAllBytes(picker.FileName, Convert.FromBase64String(captured.Data)); }; body.Children.Add(save);
            }
            root.Children.Add(new ScrollViewer { Content = body, VerticalScrollBarVisibility = ScrollBarVisibility.Auto });
            Action render = delegate {
                foreach (var button in actions.Children.OfType<Button>()) toolbarKeys.Remove(button);
                actions.Children.Clear(); fast.Children.Clear(); var current = WindowMessage(context);
                if (current != null) { subject.Text = current.Subject; pop.Title = current.Subject + " · TMA-Mail"; }
                var main = (Panel)Find<Button>("DeleteButton").Parent;
                foreach (var source in main.Children.OfType<Button>().Where(toolbarKeys.ContainsKey).ToList()) {
                    string key = toolbarKeys[source]; string caption = Convert.ToString(source.Content);
                    if (key == "ReadButton" && current != null) caption = current.Unread ? "Mark Read" : "Mark Unread";
                    if (key == "DeleteButton" && current != null) caption = current.Folder == "Trash" ? "↶  Restore" : "♧  Delete";
                    var button = Action(caption, false); UiPolish.MailAction(button); button.Tag = key; button.IsEnabled = current != null;
                    if (key == "ArchiveButton" && current != null) button.IsEnabled = current.Folder != "Archive" && current.Folder != "Drafts";
                    toolbarKeys[button] = key; EnableToolbarDrag(button, actions);
                    button.Click += async delegate { if (!toolbarEditing) { await RunWindowMailAction(key, button, context); if (pop.IsVisible) context.Refresh(); } }; actions.Children.Add(button);
                }
                var edit = Action(toolbarEditing ? "Done Editing" : "Edit Bar", false); UiPolish.MailAction(edit); edit.Background = Theme.B(toolbarEditing ? "SidebarSelected" : "Raised"); edit.Click += delegate { editBarButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); }; actions.Children.Add(edit);
                foreach (var entry in preferences.FastFunctions.Where(f => String.IsNullOrEmpty(f.AccountId) || account != null && f.AccountId == account.Id)) {
                    var function = entry; var button = Action(function.Name, false); UiPolish.MailAction(button); button.Tag = function; button.IsEnabled = current != null; EnableToolbarDrag(button, fast);
                    button.Click += async delegate { if (toolbarEditing) return; var target = WindowMessage(context); if (target != null) { await RunFastFunctionForMessages(function, button, new List<Message> { target }, account, mailbox, pop); if (pop.IsVisible) context.Refresh(); } };
                    var menu = new ContextMenu(); var change = new MenuItem { Header = "Edit Fast Function" }; change.Click += delegate { ShowFastFunctionEditorForAccount(function, account, pop); }; menu.Items.Add(change);
                    var remove = new MenuItem { Header = "Remove Fast Function" }; remove.Click += delegate { preferences.FastFunctions.Remove(function); settingsStore.Save(preferences); RenderFastFunctions(); }; menu.Items.Add(remove); button.ContextMenu = menu; fast.Children.Add(button);
                }
                var create = Action("+ Create New Button", false); UiPolish.MailAction(create); create.Click += delegate { ShowFastFunctionEditorForAccount(null, account, pop); }; fast.Children.Add(create);
                if (current == null) status.Text = "This message was moved, removed, or its mailbox disconnected. Reopen it from the mailbox.";
            };
            context.Refresh = render; mailToolbarChanged += render;
            subject.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs e) { if (e.ClickCount == 2) { EditWindowSubject(context); e.Handled = true; } };
            pop.Activated += delegate { render(); };
            pop.Closed += delegate { mailToolbarChanged -= render; foreach (var button in actions.Children.OfType<Button>()) toolbarKeys.Remove(button); if (html != null) html.Dispose(); };
            render(); pop.Show();
        }
        private void SaveWindowSubject(MessageWindowContext context, string text) {
            var message = WindowMessage(context); if (message == null) throw new InvalidOperationException("This message is no longer available.");
            if (String.IsNullOrWhiteSpace(text) || text.Trim().Length > 998 || text.IndexOfAny(new[] { '\r', '\n' }) >= 0) throw new InvalidOperationException("Enter a subject of 1–998 characters on one line.");
            message.Subject = message.EditedSubject = text.Trim(); SaveMailboxInBackground(context.Mailbox);
            if (store == context.Mailbox) Refresh(selected == null ? null : selected.Id); context.Refresh();
        }
        private void EditWindowSubject(MessageWindowContext context) {
            var message = WindowMessage(context); if (message == null) return;
            var dialog = Dialog("Edit Subject · TMA-Mail", 580, 340); dialog.Owner = context.Window;
            var panel = new StackPanel { Margin = new Thickness(24) }; dialog.Content = panel;
            panel.Children.Add(Label("Change the subject in TMA-Mail. The original subject on the mail server stays unchanged.", 12, "Muted"));
            var input = TextField(panel, "Subject", message.Subject, false); input.Name = "SubjectEditor"; input.MaxLength = 998;
            var error = Label("", 12, "Muted"); panel.Children.Add(error); var row = new WrapPanel(); panel.Children.Add(row);
            var save = Action("Save Subject", true); save.IsDefault = true; save.Click += delegate { try { SaveWindowSubject(context, input.Text); dialog.Close(); } catch (Exception ex) { error.Text = ex.Message; } }; row.Children.Add(save);
            var cancel = Action("Cancel", false); cancel.IsCancel = true; cancel.Click += delegate { dialog.Close(); }; row.Children.Add(cancel);
            dialog.Loaded += delegate { input.Focus(); input.SelectAll(); }; dialog.ShowDialog();
        }
        private async Task RunWindowMailAction(string key, Button anchor, MessageWindowContext context) {
            var message = WindowMessage(context); if (message == null) { context.Refresh(); return; }
            Action changed = delegate { SaveMailboxInBackground(context.Mailbox); if (store == context.Mailbox) Refresh(selected == null ? null : selected.Id); context.Refresh(); };
            try {
                if (key == "ArchiveButton" || key == "DeleteButton") {
                    string target = key == "ArchiveButton" ? "Archive" : message.Folder == "Trash" ? "Inbox" : "Trash";
                    if (target == "Trash") { context.Body.Visibility = Visibility.Collapsed; context.Status.Text = "Deleting…"; }
                    bool moved;
                    if (message.RemoteUid != 0 && context.Account != null) moved = await MoveServerMessages(new List<Message> { message }, context.Account, context.Mailbox, target);
                    else { message.Folder = target; changed(); moved = true; }
                    if (moved) context.Window.Close(); else { context.Body.Visibility = Visibility.Visible; context.Status.Text = "Delete or move could not be completed. The message has been restored; check the app status for details."; }
                } else if (key == "ReadButton") { SetUnreadLocal(message, !message.Unread); SaveServerFlags(message); changed(); }
                else if (key == "StarButton") { message.Starred = !message.Starred; SaveServerFlags(message); changed(); }
                else if (key == "↗ Move to…") {
                    var menu = new ContextMenu { PlacementTarget = anchor };
                    foreach (var destination in WindowMoveDestinations(context.Account)) { string target = destination; var item = new MenuItem { Header = WindowFolderName(context.Account, target) }; item.Click += async delegate { if (target == "Drafts" || target == "Sent") { context.Status.Text = "Drafts and Sent are managed by composing and delivery."; return; } if (message.RemoteUid != 0 && context.Account != null) { if (await MoveServerMessages(new List<Message> { message }, context.Account, context.Mailbox, target)) context.Window.Close(); } else { message.Folder = target; changed(); context.Window.Close(); } }; menu.Items.Add(item); } menu.IsOpen = true;
                } else if (key == "↶ Reply" || key == "↶ Reply all" || key == "↪ Forward") ComposeMessageInWindow(message, context.Account, context.Mailbox, key == "↪ Forward" ? "forward" : key == "↶ Reply all" ? "replyAll" : "reply", context.Window);
                else if (key == "⚑ Follow up") { message.FollowUp = !message.FollowUp; changed(); }
                else if (key == "▦ Categorise") { var menu = new ContextMenu { PlacementTarget = anchor }; foreach (var category in new[] { "Work", "Personal", "Finance", "Travel", "Important", "Clear category" }) { string value = category; var item = new MenuItem { Header = value }; item.Click += delegate { message.Category = value == "Clear category" ? "" : value; changed(); }; menu.Items.Add(item); } menu.IsOpen = true; }
                else if (key == "▦ Apps") ShowPluginMenu(anchor);
                else if (key == "⇩ Save .eml") { var picker = new SaveFileDialog { Filter = "Email message (*.eml)|*.eml", FileName = "message.eml" }; if (picker.ShowDialog(context.Window) == true) { var copy = message.CopyForSync(); copy.To = copy.To ?? ""; MailTransport.CreateMime(copy).WriteTo(picker.FileName); } }
                else if (key == "▧ Print") { var printer = new PrintDialog(); if (printer.ShowDialog() == true) printer.PrintDocument(((IDocumentPaginatorSource)new FlowDocument(new Paragraph(new Run(message.Subject + "\n\n" + message.Sender + " <" + message.Address + ">\n\n" + message.Body))) { FontFamily = new FontFamily("Segoe UI"), FontSize = 12, Foreground = Brushes.Black, Background = Brushes.White }).DocumentPaginator, "TMA-Mail message"); }
            } catch (Exception ex) { context.Body.Visibility = Visibility.Visible; context.Status.Text = "Action failed: " + ex.Message; }
        }
    }
}
