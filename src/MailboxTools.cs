using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace Postbox {
    public sealed class MailAnalyticRow { public string Name { get; set; } public string Key { get; set; } public int Count { get; set; } }
    public static class MailAnalytics {
        public static List<MailAnalyticRow> Top(IEnumerable<Message> messages, bool senders) {
            return messages.Where(m => m.Folder == "Inbox").GroupBy(m => senders ? (m.Address ?? "").Trim() : Regex.Replace((m.Subject ?? "(No subject)").Trim(), @"\s+", " "), StringComparer.OrdinalIgnoreCase)
                .Select(g => new MailAnalyticRow { Key = g.Key, Name = String.IsNullOrWhiteSpace(g.Key) ? (senders ? "Unknown sender" : "(No subject)") : g.Key, Count = g.Count() })
                .OrderByDescending(r => r.Count).ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase).Take(10).ToList();
        }
    }
    public partial class App {
        private string preferencesInboxFilter = "All";
        private bool oldestFirst, toolbarEditing;
        private Button sortOrderButton, editBarButton;
        private Point toolbarDragStart;
        private readonly Dictionary<Button, string> toolbarKeys = new Dictionary<Button, string>();
        public static IEnumerable<Message> FilterInbox(IEnumerable<Message> source, string filter, bool oldest) {
            if (filter == "Unread") source = source.Where(m => m.Unread);
            else if (filter == "Flagged") source = source.Where(m => m.FollowUp || m.Starred);
            else if (filter == "Important") source = source.Where(m => String.Equals(m.Importance, "High", StringComparison.OrdinalIgnoreCase));
            else if (filter == "With attachments") source = source.Where(m => m.Attachments != null && m.Attachments.Count > 0);
            else if (filter == "Read") source = source.Where(m => !m.Unread);
            return oldest ? source.OrderBy(m => m.Date) : source.OrderByDescending(m => m.Date);
        }
        private void InitializeInboxTools() {
            var unread = Find<Button>("UnreadFilter"); var originalFilters = (Panel)unread.Parent; var bar = (Panel)originalFilters.Parent; originalFilters.Visibility = Visibility.Collapsed;
            var oldSort = bar.Children.OfType<TextBlock>().FirstOrDefault(t => t.Text == "Newest first");
            if (oldSort != null) bar.Children.Remove(oldSort);
            var filter = new ComboBox { ItemsSource = new[] { "All", "Unread", "Read", "Flagged", "Important", "With attachments" }, SelectedIndex = 0, Width = 132, Margin = new Thickness(8, 0, 8, 0), ToolTip = "Filter this folder", FontSize = 11 };
            sortOrderButton = Action("↓ Newest first", false); sortOrderButton.FontSize = 11; sortOrderButton.Padding = new Thickness(9, 5, 9, 5); sortOrderButton.Margin = new Thickness(0);
            var controls = new WrapPanel { HorizontalAlignment = HorizontalAlignment.Right }; controls.Children.Add(filter); controls.Children.Add(sortOrderButton);
            DockPanel.SetDock(controls, Dock.Right); bar.Children.Insert(0, controls);
            filter.SelectionChanged += delegate { preferencesInboxFilter = Value(filter); unreadOnly = false; Refresh(null); };
            sortOrderButton.Click += delegate { oldestFirst = !oldestFirst; sortOrderButton.Content = oldestFirst ? "↑ Oldest first" : "↓ Newest first"; Refresh(selected == null ? null : selected.Id); };
            Find<Button>("AllFilter").Click += delegate { filter.SelectedIndex = 0; preferencesInboxFilter = "All"; Refresh(null); };
            unread.Click += delegate { filter.SelectedItem = "Unread"; preferencesInboxFilter = "Unread"; unreadOnly = false; Refresh(null); };
        }
        private void InitializeToolbarEditing(WrapPanel wrap) {
            var buttons = wrap.Children.OfType<Button>().ToList();
            foreach (var button in buttons) toolbarKeys[button] = String.IsNullOrEmpty(button.Name) ? button.Content.ToString() : button.Name;
            foreach (var button in buttons.OrderBy(b => { int i = preferences.MailToolbarOrder.IndexOf(toolbarKeys[b]); return i < 0 ? Int32.MaxValue : i; }).ToList()) { wrap.Children.Remove(button); wrap.Children.Add(button); }
            foreach (var button in buttons) EnableToolbarDrag(button, wrap);
            editBarButton = Action("Edit Bar", false); UiPolish.MailAction(editBarButton); editBarButton.Background = Theme.B("Raised"); editBarButton.ToolTip = "Enable editing, then drag one action onto another to swap their positions";
            editBarButton.Click += delegate { toolbarEditing = !toolbarEditing; editBarButton.Content = toolbarEditing ? "Done Editing" : "Edit Bar"; editBarButton.Background = Theme.B(toolbarEditing ? "SidebarSelected" : "Raised"); Status(toolbarEditing ? "Drag an action onto another to swap positions. Choose Done Editing when finished." : "Toolbar order saved"); };
            wrap.Children.Add(editBarButton);
        }
        private void EnableToolbarDrag(Button button, Panel panel) {
            button.AllowDrop = true;
            button.PreviewKeyDown += delegate(object sender, KeyEventArgs e) { if (toolbarEditing && (e.Key == Key.Space || e.Key == Key.Enter)) e.Handled = true; };
            button.PreviewMouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs e) { if (toolbarEditing) { toolbarDragStart = e.GetPosition(button); e.Handled = true; button.CaptureMouse(); } };
            button.PreviewMouseLeftButtonUp += delegate(object sender, MouseButtonEventArgs e) { if (toolbarEditing) { button.ReleaseMouseCapture(); e.Handled = true; } };
            button.PreviewMouseMove += delegate(object sender, MouseEventArgs e) {
                if (!toolbarEditing || e.LeftButton != MouseButtonState.Pressed || !button.IsMouseCaptured) return;
                Point point = e.GetPosition(button); if (Math.Abs(point.X - toolbarDragStart.X) < SystemParameters.MinimumHorizontalDragDistance && Math.Abs(point.Y - toolbarDragStart.Y) < SystemParameters.MinimumVerticalDragDistance) return;
                button.ReleaseMouseCapture(); DragDrop.DoDragDrop(button, new DataObject("TMA-Mail.ActionButton", button), DragDropEffects.Move); e.Handled = true;
            };
            button.DragOver += delegate(object sender, DragEventArgs e) { var source = e.Data.GetData("TMA-Mail.ActionButton") as Button; e.Effects = toolbarEditing && source != null && source.Parent == panel ? DragDropEffects.Move : DragDropEffects.None; e.Handled = true; };
            button.Drop += delegate(object sender, DragEventArgs e) { var source = e.Data.GetData("TMA-Mail.ActionButton") as Button; if (toolbarEditing && source != null && source != button && source.Parent == panel) SwapToolbarButtons(panel, source, button); e.Handled = true; };
        }
        private void SwapToolbarButtons(Panel panel, Button first, Button second) {
            var children = panel.Children.Cast<UIElement>().ToList(); int a = children.IndexOf(first), b = children.IndexOf(second); if (a < 0 || b < 0) return;
            children[a] = second; children[b] = first; panel.Children.Clear(); foreach (var child in children) panel.Children.Add(child);
            if (toolbarKeys.ContainsKey(first)) preferences.MailToolbarOrder = children.OfType<Button>().Where(toolbarKeys.ContainsKey).Select(x => toolbarKeys[x]).ToList();
            else { var one = preferences.FastFunctions.FirstOrDefault(f => f == first.Tag); var two = preferences.FastFunctions.FirstOrDefault(f => f == second.Tag); if (one != null && two != null) { int x = preferences.FastFunctions.IndexOf(one), y = preferences.FastFunctions.IndexOf(two); preferences.FastFunctions[x] = two; preferences.FastFunctions[y] = one; } }
            settingsStore.Save(preferences);
        }
        private static string FastKind(string action) {
            if (action == "↶ Reply") return "Reply"; if (action == "↶ Reply all") return "Reply all"; if (action == "↪ Forward") return "Forward";
            if (action == "Star / unstar") return "Toggle Star"; if (action == "⚑ Follow up") return "Flag"; if (action == "▦ Categorise") return "Set category"; return action;
        }
        private async Task RunFastFunction(FastFunction function, Button button) {
            var messages = SelectedMessages().ToList(); var account = activeAccount; var mailbox = store;
            if (messages.Count == 0) { Status("Select an email first."); return; }
            if (function.Steps().Any(s => new[] { "Reply", "Reply all", "Forward" }.Contains(FastKind(s.Action))) && messages.Count != 1) { Status("Select one email for a reply or forward Fast Function."); return; }
            button.IsEnabled = false;
            try {
                foreach (var step in function.Steps()) {
                    string kind = FastKind(step.Action);
                    if (new[] { "Reply", "Reply all", "Forward" }.Contains(kind)) {
                        var composer = new ComposerWindow(settingsStore.Clone(preferences), mailbox, null, kind == "Forward" ? "forward" : kind == "Reply all" ? "replyAll" : "reply", messages[0]) { Owner = window };
                        if (!String.IsNullOrWhiteSpace(step.Recipients)) composer.SetFastRecipients(step.Recipients);
                        if (account != null) composer.Deliver = m => SendMail(m, account);
                        bool saved = false; composer.Saved += delegate(bool sent, string subject) { saved = true; if (sent) MailNotification(false, subject, composer.RecipientAddresses); };
                        composer.ShowDialog(); if (!saved) break;
                    } else if (kind == "Move to folder") {
                        if (String.IsNullOrEmpty(step.Destination)) throw new InvalidOperationException("Choose a folder for this action.");
                        if (account != null && messages.Any(m => m.RemoteUid != 0)) {
                            if (!await mailGate.WaitAsync(0)) throw new InvalidOperationException("Please wait for the current mail operation.");
                            try { await Task.Run(() => new MailTransport(account, accountStore).Move(messages, step.Destination)); } finally { mailGate.Release(); }
                            await SyncMail(account.Id);
                            var relocated = new List<Message>(); foreach (var original in messages) { var candidates = mailbox.Messages.Where(m => m.Folder == step.Destination && !String.IsNullOrEmpty(original.InternetMessageId) && m.InternetMessageId == original.InternetMessageId).ToList(); if (candidates.Count != 1) throw new InvalidOperationException("The move completed, but its destination copy is not uniquely available in the cache. Later actions were stopped; sync and select the moved email before continuing."); relocated.Add(candidates[0]); } messages = relocated;
                        } else foreach (var message in messages) message.Folder = step.Destination;
                    } else foreach (var message in messages) {
                        if (kind == "Mark read" || kind == "Mark unread") SetUnreadLocal(message, kind == "Mark unread");
                        else if (kind == "Toggle Star") message.Starred = !message.Starred;
                        else if (kind == "Flag") message.FollowUp = true;
                        else if (kind == "Mark important") message.Importance = "High";
                        else if (kind == "Set category") message.Category = step.Category ?? "";
                        if ((kind == "Mark read" || kind == "Mark unread" || kind == "Toggle Star") && account != null && message.RemoteUid != 0) {
                            if (!await mailGate.WaitAsync(0)) throw new InvalidOperationException("Please wait for the current mail operation.");
                            try { await Task.Run(() => new MailTransport(account, accountStore).Flags(message)); } finally { mailGate.Release(); }
                        }
                    }
                    SaveMailboxInBackground(mailbox); if (mailbox == store) Refresh(messages[0].Id);
                }
            } catch (Exception ex) { Status("Fast Function stopped: " + ex.Message); }
            finally { button.IsEnabled = true; }
        }
        private sealed class FastActionEditor {
            public StackPanel Root = new StackPanel(); public ComboBox Kind, Target, Folder, Category; public TextBox Addresses;
        }
        private void ShowCreateFastFunction() { ShowFastFunctionEditor(null); }
        private void ShowFastFunctionEditor(FastFunction existing) {
            var dialog = Dialog((existing == null ? "Create" : "Edit") + " Fast Function · TMA-Mail", 600, 720); dialog.MinHeight = 520;
            var root = new DockPanel { Margin = new Thickness(24) }; dialog.Content = root;
            var footer = new StackPanel(); DockPanel.SetDock(footer, Dock.Bottom); root.Children.Add(footer);
            var status = Label("Actions run in order. Replies/forwards open a composer for review. Closing an unchanged composer stops later actions.", 12, "Muted"); footer.Children.Add(status);
            var save = Action(existing == null ? "Create Button" : "Save Button", true); footer.Children.Add(save);
            var panel = new StackPanel(); root.Children.Add(new ScrollViewer { Content = panel, VerticalScrollBarVisibility = ScrollBarVisibility.Auto });
            var name = TextField(panel, "Button name", existing == null ? "" : existing.Name, false); var actionList = new StackPanel(); panel.Children.Add(actionList); var editors = new List<FastActionEditor>();
            Action<FastAction> add = step => {
                if (editors.Count >= 12) { status.Text = "A button supports up to 12 actions."; return; }
                var editor = new FastActionEditor(); editors.Add(editor); editor.Root.Margin = new Thickness(0, 4, 0, 16); actionList.Children.Add(editor.Root);
                editor.Kind = Choice(editor.Root, "Action", step == null ? "Move to folder" : FastKind(step.Action), new[] { "Move to folder", "Mark read", "Mark unread", "Toggle Star", "Flag", "Mark important", "Reply", "Reply all", "Forward", "Set category" });
                var details = new StackPanel(); editor.Root.Children.Add(details);
                Action fields = delegate {
                    details.Children.Clear(); string kind = Value(editor.Kind);
                    if (kind == "Move to folder") { FieldLabel(details, "Folder to Move to"); editor.Folder = new ComboBox { ItemsSource = MoveDestinations().Select(d => new FolderChoice { Key = d, Name = FolderDisplayName(d) }).ToList(), SelectedIndex = 0, MinHeight = 38 }; if (step != null) editor.Folder.SelectedItem = ((IEnumerable<FolderChoice>)editor.Folder.ItemsSource).FirstOrDefault(d => d.Key == step.Destination) ?? ((IEnumerable<FolderChoice>)editor.Folder.ItemsSource).FirstOrDefault(); details.Children.Add(editor.Folder); }
                    if (kind == "Reply" || kind == "Reply all" || kind == "Forward") {
                        editor.Target = Choice(details, kind == "Forward" ? "Forward to who" : "Reply to who", step != null && !String.IsNullOrWhiteSpace(step.Recipients) || kind == "Forward" ? "Custom email addresses" : kind == "Reply all" ? "Sender and all recipients" : "Reply to sender", kind == "Forward" ? new[] { "Custom email addresses" } : new[] { kind == "Reply all" ? "Sender and all recipients" : "Reply to sender", "Custom email addresses" });
                        var recipientFields = new StackPanel(); details.Children.Add(recipientFields); editor.Addresses = TextField(recipientFields, "Email addresses (separate with semicolons)", step == null ? "" : step.Recipients ?? "", false);
                        Action recipientVisibility = delegate { recipientFields.Visibility = Value(editor.Target) == "Custom email addresses" ? Visibility.Visible : Visibility.Collapsed; }; editor.Target.SelectionChanged += delegate { recipientVisibility(); }; recipientVisibility();
                    }
                    if (kind == "Set category") editor.Category = Choice(details, "Category", step == null ? "Work" : step.Category ?? "Work", new[] { "Work", "Personal", "Finance", "Travel", "Important", "Clear category" });
                };
                editor.Kind.SelectionChanged += delegate { fields(); }; fields();
                var remove = Action("Remove action", false); remove.Margin = new Thickness(0, 10, 0, 8); remove.HorizontalAlignment = HorizontalAlignment.Left; remove.Click += delegate { editors.Remove(editor); actionList.Children.Remove(editor.Root); }; editor.Root.Children.Add(remove);
            };
            foreach (var step in existing == null ? new List<FastAction> { new FastAction { Action = "Move to folder" } } : existing.Steps()) add(step);
            var another = Action("+ Add another action", false); another.HorizontalAlignment = HorizontalAlignment.Left; another.Margin = new Thickness(0, 8, 0, 12); another.Click += delegate { add(null); }; panel.Children.Add(another);
            save.Click += delegate {
                try {
                    if (String.IsNullOrWhiteSpace(name.Text) || name.Text.Trim().Length > 60) throw new InvalidOperationException("Enter a button name of up to 60 characters.");
                    if (existing == null && preferences.FastFunctions.Count >= 24) throw new InvalidOperationException("A maximum of 24 buttons is supported.");
                    if (editors.Count == 0) throw new InvalidOperationException("Add at least one action.");
                    var steps = new List<FastAction>(); foreach (var editor in editors) {
                        var step = new FastAction { Action = Value(editor.Kind) };
                        if (step.Action == "Move to folder") { var destination = editor.Folder.SelectedItem as FolderChoice; if (destination == null) throw new InvalidOperationException("Choose a destination folder."); step.Destination = destination.Key; }
                        if (new[] { "Reply", "Reply all", "Forward" }.Contains(step.Action) && Value(editor.Target) == "Custom email addresses") { var addresses = RichMail.Recipients(editor.Addresses.Text); if (addresses.Count == 0) throw new InvalidOperationException("Enter at least one email address."); step.Recipients = String.Join("; ", addresses); }
                        if (step.Action == "Set category") step.Category = Value(editor.Category) == "Clear category" ? "" : Value(editor.Category); steps.Add(step);
                    }
                    var function = existing ?? new FastFunction { AccountId = activeAccount == null ? null : activeAccount.Id }; function.Name = name.Text.Trim(); function.Actions = steps; function.Action = null; function.Destination = null;
                    if (existing == null) preferences.FastFunctions.Add(function); settingsStore.Save(preferences); RenderFastFunctions(); dialog.Close();
                } catch (Exception ex) { status.Text = ex.Message; }
            }; dialog.ShowDialog();
        }
    }
}
