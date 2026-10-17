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
            host.Children.Remove(toolbar); var star = Find<Button>("StarButton"); host.Children.Remove(star); toolbar.Children.Add(star); star.Content = "Toggle Star"; star.ToolTip = "Toggle Star";
            foreach (var other in toolbar.Children.Cast<UIElement>().Where(c => !(c is Button)).ToList()) toolbar.Children.Remove(other);
            var wrap = (WrapPanel)toolbar; wrap.ItemHeight = 40; wrap.Margin = new Thickness(0); wrap.HorizontalAlignment = HorizontalAlignment.Left; wrap.VerticalAlignment = VerticalAlignment.Top; foreach (var button in wrap.Children.OfType<Button>()) UiPolish.MailAction(button);
            var content = new StackPanel { Margin = new Thickness(8, 6, 8, 6), HorizontalAlignment = HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Top }; content.Children.Add(wrap);
            content.Children.Add(new Border { Height = 1, Background = Theme.B("SidebarAccent"), Margin = new Thickness(0, 4, 0, 4), HorizontalAlignment = HorizontalAlignment.Stretch });
            var fastRow = new StackPanel { Orientation = Orientation.Horizontal, Height = 40 }; fastRow.Children.Add(new TextBlock { Text = "Fast Functions:", FontSize = 12, Foreground = Theme.B("Text"), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 12, 0) }); fastFunctionButtons = new WrapPanel { ItemHeight = 40 }; fastRow.Children.Add(fastFunctionButtons); content.Children.Add(fastRow); RenderFastFunctions();
            var scroll = new ScrollViewer { Content = content, HorizontalScrollBarVisibility = ScrollBarVisibility.Auto, VerticalScrollBarVisibility = ScrollBarVisibility.Disabled, VerticalContentAlignment = VerticalAlignment.Top }; mailToolbarContainer.Children.Add(scroll);
            bool fitting = false;
            Action fit = delegate {
                if (fitting) return; fitting = true; try {
                    int maxRows = Math.Max(1, (int)Math.Floor((mailToolbarContainer.Height - 88) / 40)); var widths = new List<double>(); foreach (var button in wrap.Children.OfType<Button>()) { button.Measure(new Size(Double.PositiveInfinity, 40)); widths.Add(button.DesiredSize.Width); }
                    double lower = widths.DefaultIfEmpty(1).Max(), upper = widths.Sum() + 1;
                    for (int attempt = 0; attempt < 24; attempt++) { double candidate = (lower + upper) / 2, row = 0; int rows = 1; foreach (double width in widths) { if (row + width > candidate) { rows++; row = 0; } row += width; } if (rows > maxRows) lower = candidate; else upper = candidate; }
                    double viewport = scroll.ViewportWidth > 0 ? scroll.ViewportWidth : scroll.ActualWidth; double targetWidth = Math.Max(Math.Max(1, viewport - 16), upper + 1); if (Double.IsNaN(wrap.Width) || Math.Abs(wrap.Width - targetWidth) > 0.1) wrap.Width = targetWidth; content.MinWidth = Math.Max(0, viewport - 16);
                } finally { fitting = false; }
            };
            scroll.SizeChanged += delegate { fit(); }; mailToolbarContainer.SizeChanged += delegate { fit(); };
            foreach (var button in wrap.Children.OfType<Button>()) button.SizeChanged += delegate { fit(); };
            var grip = new Thumb { Cursor = Cursors.SizeNS, Background = Theme.B("SidebarAccent"), ToolTip = "Drag up or down to resize mail actions", Height = 7 }; Grid.SetRow(grip, 1); mailToolbarContainer.Children.Add(grip);
            var gripBorder = new FrameworkElementFactory(typeof(Border)); gripBorder.SetValue(Border.BackgroundProperty, Theme.B("SidebarAccent")); gripBorder.SetValue(Border.CornerRadiusProperty, new CornerRadius(3)); gripBorder.SetValue(Border.MarginProperty, new Thickness(2, 1, 2, 1)); grip.Template = new ControlTemplate(typeof(Thumb)) { VisualTree = gripBorder };
            grip.DragDelta += delegate(object sender, DragDeltaEventArgs e) { preferences.MailToolbarHeight = Math.Max(128, Math.Min(300, mailToolbarContainer.Height + e.VerticalChange)); mailToolbarContainer.Height = preferences.MailToolbarHeight; fit(); };
            grip.DragCompleted += delegate { settingsStore.Save(preferences); };
            fit();
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
                var menu = new ContextMenu(); var remove = new MenuItem { Header = "Remove Fast Function" }; remove.Click += delegate { preferences.FastFunctions.Remove(function); settingsStore.Save(preferences); RenderFastFunctions(); }; menu.Items.Add(remove); button.ContextMenu = menu; UiPolish.MailAction(button); fastFunctionButtons.Children.Add(button);
            }
            var create = Action("+ Create New Button", false); UiPolish.MailAction(create); create.Click += delegate { ShowCreateFastFunction(); }; fastFunctionButtons.Children.Add(create);
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
            Action<string, Action> add = (label, click) => { var button = Action(label, false); UiPolish.MailAction(button); button.Click += delegate { click(); }; actions.Children.Add(button); };
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
