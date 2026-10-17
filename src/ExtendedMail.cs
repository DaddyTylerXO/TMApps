using System;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
namespace Postbox {
    public partial class App {
        private WrapPanel fastFunctionButtons;
        private Grid mailToolbarContainer;
        private void InitializeExtendedMailUi(Panel toolbar, DockPanel host) {
            var border = (Border)host.Parent; border.Child = null;
            mailToolbarContainer = new Grid { Height = preferences.MailToolbarHeight }; mailToolbarContainer.RowDefinitions.Add(new RowDefinition()); mailToolbarContainer.RowDefinitions.Add(new RowDefinition { Height = new GridLength(7) }); border.Child = mailToolbarContainer;
            var scroll = new ScrollViewer { Content = host, HorizontalScrollBarVisibility = ScrollBarVisibility.Auto, VerticalScrollBarVisibility = ScrollBarVisibility.Auto }; mailToolbarContainer.Children.Add(scroll);
            Border fast = null; StackPanel fastStack = null; TextBlock fastTitle = null;
            Action fit = delegate { bool compact = mailToolbarContainer.Height < 100; var wrap = toolbar as WrapPanel; if (wrap != null) wrap.Width = compact ? Double.NaN : Math.Max(300, scroll.ActualWidth - 100); foreach (var button in toolbar.Children.OfType<Button>()) { button.VerticalAlignment = VerticalAlignment.Center; button.Padding = new Thickness(10, 6, 10, 6); } if (fastStack != null) { fastStack.Orientation = compact ? Orientation.Horizontal : Orientation.Vertical; fastTitle.Margin = compact ? new Thickness(0, 0, 8, 0) : new Thickness(0, 0, 0, 4); fastTitle.VerticalAlignment = VerticalAlignment.Center; fast.Padding = new Thickness(6, 3, 6, 3); } };
            scroll.SizeChanged += delegate { fit(); };
            var grip = new Thumb { Cursor = Cursors.SizeNS, Background = Theme.B("SidebarAccent"), ToolTip = "Drag up or down to resize mail actions", Height = 7 }; Grid.SetRow(grip, 1); mailToolbarContainer.Children.Add(grip);
            var gripBorder = new FrameworkElementFactory(typeof(Border)); gripBorder.SetValue(Border.BackgroundProperty, Theme.B("SidebarAccent")); gripBorder.SetValue(Border.CornerRadiusProperty, new CornerRadius(3)); gripBorder.SetValue(Border.MarginProperty, new Thickness(2, 1, 2, 1)); grip.Template = new ControlTemplate(typeof(Thumb)) { VisualTree = gripBorder };
            grip.DragDelta += delegate(object sender, DragDeltaEventArgs e) { preferences.MailToolbarHeight = Math.Max(88, Math.Min(300, mailToolbarContainer.Height + e.VerticalChange)); mailToolbarContainer.Height = preferences.MailToolbarHeight; fit(); };
            grip.DragCompleted += delegate { settingsStore.Save(preferences); };
            fast = new Border { BorderBrush = Theme.B("SidebarAccent"), BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(12), Padding = new Thickness(6, 3, 6, 3), Margin = new Thickness(4, 2, 4, 2) }; fastStack = new StackPanel(); fast.Child = fastStack; fastTitle = Label("Fast Functions", 11, "Muted"); fastStack.Children.Add(fastTitle); fastFunctionButtons = new WrapPanel(); fastStack.Children.Add(fastFunctionButtons); toolbar.Children.Add(fast); RenderFastFunctions(); fit();
            var list = Find<ListBox>("MessageList"); list.MouseDoubleClick += delegate(object sender, MouseButtonEventArgs e) { if (ItemsControl.ContainerFromElement(list, e.OriginalSource as DependencyObject) is ListBoxItem && selected != null && selected.Folder != "Drafts") OpenMessageWindow(selected, activeAccount, store); };
            list.PreviewMouseRightButtonDown += delegate(object sender, MouseButtonEventArgs e) { var row = ItemsControl.ContainerFromElement(list, e.OriginalSource as DependencyObject) as ListBoxItem; if (row != null && !row.IsSelected) { list.SelectedItem = row.DataContext; row.Focus(); } };
            list.ContextMenu.Opened += delegate { PopulateMessageContext(list.ContextMenu); };
        }
        private void PopulateMessageContext(ContextMenu menu) {
            menu.Items.Clear(); bool single = SelectedMessages().Count == 1;
            Action<string, Action, bool> add = (name, action, enabled) => { var item = new MenuItem { Header = name, IsEnabled = enabled }; item.Click += delegate { action(); }; menu.Items.Add(item); };
            add("Open in new window", () => OpenMessageWindow(selected, activeAccount, store), single);
            add("Copy", CopySelectedMessage, SelectedMessages().Count > 0);
            foreach (var action in new[] { "↶ Reply", "↶ Reply all", "↪ Forward", "▧ Print", "⇩ Save .eml", "⚑ Follow up", "▦ Categorise" }) { string name = action; add(name, () => RunMailboxAction(name, moveButton), single || name == "⚑ Follow up" || name == "▦ Categorise"); }
            add("Mark read / unread", ToggleSelectedRead, SelectedMessages().Count > 0); add("Star / unstar", ToggleSelectedStars, SelectedMessages().Count > 0);
            var move = new MenuItem { Header = "Move to…" }; foreach (string destination in MoveDestinations()) { string captured = destination; var item = new MenuItem { Header = FolderDisplayName(destination) }; item.Click += delegate { MoveSelected(captured); }; move.Items.Add(item); } menu.Items.Add(move);
            add("Archive", () => MoveSelected("Archive"), SelectedMessages().Count > 0); add("Delete", () => MoveSelected("Trash"), SelectedMessages().Count > 0);
        }
        private void CopySelectedMessage() { try { Clipboard.SetText(String.Join("\n\n", SelectedMessages().Select(m => m.Subject + "\n" + m.Address + "\n\n" + m.Body))); } catch (Exception ex) { Status("Could not copy: " + ex.Message); } }
        private void RenderFastFunctions() {
            if (fastFunctionButtons == null) return; fastFunctionButtons.Children.Clear();
            foreach (var entry in preferences.FastFunctions.Where(f => String.IsNullOrEmpty(f.AccountId) || activeAccount != null && f.AccountId == activeAccount.Id)) {
                var function = entry; var button = Action(function.Name, false); button.Click += delegate { if (SelectedMessages().Count == 0) return; if (function.Action == "Move to folder") MoveSelected(function.Destination); else if (function.Action == "Mark read" || function.Action == "Mark unread") { foreach (var m in SelectedMessages()) { SetUnreadLocal(m, function.Action == "Mark unread"); SaveServerFlags(m); } SaveMailboxInBackground(store); Refresh(selected == null ? null : selected.Id); } else if (function.Action == "Star / unstar") ToggleSelectedStars(); else RunMailboxAction(function.Action, button); };
                var menu = new ContextMenu(); var remove = new MenuItem { Header = "Remove Fast Function" }; remove.Click += delegate { preferences.FastFunctions.Remove(function); settingsStore.Save(preferences); RenderFastFunctions(); }; menu.Items.Add(remove); button.ContextMenu = menu; fastFunctionButtons.Children.Add(button);
            }
            var create = Action("＋ Create new", false); create.Click += delegate { ShowCreateFastFunction(); }; fastFunctionButtons.Children.Add(create);
        }
        private void ShowCreateFastFunction() {
            var dialog = Dialog("Create Fast Function · TMA-Mail", 480, 440); var panel = new StackPanel { Margin = new Thickness(24) }; dialog.Content = panel;
            var name = TextField(panel, "Button name", "", false); var action = Choice(panel, "Action", "Move to folder", new[] { "Move to folder", "Mark read", "Mark unread", "Star / unstar", "⚑ Follow up", "↶ Reply", "↶ Reply all", "↪ Forward", "▦ Categorise" });
            var destinations = MoveDestinations().ToList(); FieldLabel(panel, "Folder (for Move to folder)"); var folderChoice = new ComboBox { ItemsSource = destinations.Select(d => new FolderChoice { Key = d, Name = FolderDisplayName(d) }).ToList(), SelectedIndex = 0 }; panel.Children.Add(folderChoice);
            var status = Label("Fast Functions save immediately. Right-click a button to remove it.", 12, "Muted"); panel.Children.Add(status); var save = Action("Create button", true); panel.Children.Add(save);
            save.Click += delegate { if (String.IsNullOrWhiteSpace(name.Text) || preferences.FastFunctions.Count >= 24) { status.Text = "Enter a name; a maximum of 24 buttons is supported."; return; } preferences.FastFunctions.Add(new FastFunction { Name = name.Text.Trim(), Action = Value(action), Destination = ((FolderChoice)folderChoice.SelectedItem).Key, AccountId = activeAccount == null ? null : activeAccount.Id }); settingsStore.Save(preferences); RenderFastFunctions(); dialog.Close(); }; dialog.ShowDialog();
        }
        private class FolderChoice { public string Key; public string Name; public override string ToString() { return Name; } }
        private void OpenMessageWindow(Message message, MailAccount account, MailStore mailbox) {
            if (message == null) return; var pop = Dialog(message.Subject + " · TMA-Mail", 1120, 820); pop.MinWidth = 680; pop.MinHeight = 480; var root = new DockPanel(); pop.Content = root;
            var actions = new WrapPanel { Margin = new Thickness(12) }; var bar = new Border { Background = Brush("#0D2419"), BorderBrush = Theme.B("SidebarAccent"), BorderThickness = new Thickness(0, 0, 0, 3), Child = new ScrollViewer { Content = actions, HorizontalScrollBarVisibility = ScrollBarVisibility.Auto } }; DockPanel.SetDock(bar, Dock.Top); root.Children.Add(bar);
            Action<string, Action> add = (label, click) => { var button = Action(label, false); button.Background = Theme.B("SidebarAccent"); button.Foreground = Brushes.White; button.Click += delegate { click(); }; actions.Children.Add(button); };
            foreach (string mode in new[] { "reply", "replyAll", "forward" }) { string captured = mode; add(mode == "replyAll" ? "Reply all" : mode == "reply" ? "Reply" : "Forward", () => ComposeMessageInWindow(message, account, mailbox, captured, pop)); }
            add("Copy", () => { try { Clipboard.SetText(message.Subject + "\n" + message.Address + "\n\n" + message.Body); } catch { } });
            add("Print", () => { var printer = new PrintDialog(); if (printer.ShowDialog() == true) printer.PrintDocument(((IDocumentPaginatorSource)new FlowDocument(new Paragraph(new Run(message.Subject + "\n\n" + message.Body))) { Foreground = Brushes.Black, Background = Brushes.White }).DocumentPaginator, "TMA-Mail message"); });
            add("Mark read / unread", () => { SetUnreadLocal(message, !message.Unread); SaveServerFlags(message); SaveMailboxInBackground(mailbox); UpdateNavigationLabels(); if (store == mailbox) Refresh(message.Id); });
            foreach (string target in new[] { "Inbox", "Archive", "Trash" }) { string destination = target; add("Move to " + target, async () => { await MovePoppedMessage(message, account, mailbox, destination); }); }
            var body = new StackPanel { Margin = new Thickness(24) }; body.Children.Add(Label(message.Subject, 25, "Text")); body.Children.Add(Label(message.Sender + " <" + message.Address + ">\nTo: " + message.To + "\n" + message.Date.ToString("f"), 13, "Muted"));
            HtmlMessageView html = null; if (!String.IsNullOrWhiteSpace(message.HtmlBody)) { html = new HtmlMessageView(dataDirectory) { MinHeight = 450, Visibility = Visibility.Visible }; html.SetImagePolicy(preferences.AutoLoadImages); body.Children.Add(html); html.ShowMessage(message); } else { var rich = new RichTextBox { IsReadOnly = true, Background = Theme.B("Surface"), Foreground = Theme.B("Text"), BorderThickness = new Thickness(0), FontFamily = new FontFamily("Segoe UI"), FontSize = preferences.TextSize }; if (String.IsNullOrEmpty(message.RichBody) || !RichMail.Load(rich, message.RichBody)) rich.Document = new FlowDocument(new Paragraph(new Run(message.Body))); body.Children.Add(rich); }
            foreach (var attachment in message.Attachments ?? new List<MailAttachment>()) { var captured = attachment; add("📎 " + System.IO.Path.GetFileName(captured.Name), () => { var save = new Microsoft.Win32.SaveFileDialog { FileName = System.IO.Path.GetFileName(captured.Name) }; if (save.ShowDialog(pop) == true) System.IO.File.WriteAllBytes(save.FileName, Convert.FromBase64String(captured.Data)); }); }
            root.Children.Add(new ScrollViewer { Content = body, VerticalScrollBarVisibility = ScrollBarVisibility.Auto }); pop.Closed += delegate { if (html != null) html.Dispose(); }; pop.Show();
        }
        private void ComposeMessageInWindow(Message message, MailAccount account, MailStore mailbox, string mode, Window owner) {
            var composer = new ComposerWindow(settingsStore.Clone(preferences), mailbox, null, mode, message) { Owner = owner }; if (account != null) composer.Deliver = m => SendMail(m, account);
            composer.Saved += delegate(bool sent, string subject) { if (store == mailbox) Refresh(selected == null ? null : selected.Id); if (sent) MailNotification(false, subject, composer.RecipientAddresses); }; composer.ShowDialog();
        }
        private async Task MovePoppedMessage(Message message, MailAccount account, MailStore mailbox, string destination) {
            if (message.RemoteUid != 0 && account != null) { if (!await mailGate.WaitAsync(0)) { Status("Please wait for the current mail operation."); return; } try { await Task.Run(() => new MailTransport(account, accountStore).Move(new List<Message> { message }, destination)); } catch (Exception ex) { Status("Move failed: " + ex.Message); return; } finally { mailGate.Release(); } await SyncMail(account.Id); }
            else { mailbox.Move(message, destination); if (mailbox == store) Refresh(null); }
        }
    }
}
