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

            host.Children.Remove(toolbar); var star = Find<Button>("StarButton"); host.Children.Remove(star); toolbar.Children.Add(star); star.Content = "☆ Toggle Star"; star.ToolTip = "Toggle Star";
            foreach (var other in toolbar.Children.Cast<UIElement>().Where(c => !(c is Button)).ToList()) toolbar.Children.Remove(other);
            var wrap = (WrapPanel)toolbar; wrap.ItemHeight = 40; wrap.Margin = new Thickness(0); wrap.HorizontalAlignment = HorizontalAlignment.Left; wrap.VerticalAlignment = VerticalAlignment.Top; foreach (var button in wrap.Children.OfType<Button>()) UiPolish.MailAction(button);
            InitializeToolbarEditing(wrap);
            fastFunctionButtons = new WrapPanel { ItemHeight = 40 }; RenderFastFunctions();
            mailToolbarContainer = CreateMailToolbar(wrap, fastFunctionButtons); border.Child = mailToolbarContainer;
            var list = Find<ListBox>("MessageList"); list.MouseDoubleClick += delegate(object sender, MouseButtonEventArgs e) { if (ItemsControl.ContainerFromElement(list, e.OriginalSource as DependencyObject) is ListBoxItem && selected != null && selected.Folder != "Drafts") OpenMessageWindow(selected, activeAccount, store); };
            list.PreviewMouseRightButtonDown += delegate(object sender, MouseButtonEventArgs e) { var row = ItemsControl.ContainerFromElement(list, e.OriginalSource as DependencyObject) as ListBoxItem; if (row != null && !row.IsSelected) { list.SelectedItem = row.DataContext; row.Focus(); } };
            list.ContextMenu.Opened += delegate { PopulateMessageContext(list.ContextMenu); };
        }
        private Grid CreateMailToolbar(WrapPanel wrap, WrapPanel fastButtons) {
            var container = new Grid { Height = preferences.MailToolbarHeight }; container.RowDefinitions.Add(new RowDefinition()); container.RowDefinitions.Add(new RowDefinition { Height = new GridLength(7) });
            var content = new StackPanel { Margin = new Thickness(8, 6, 8, 6), HorizontalAlignment = HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Top }; content.Children.Add(wrap);
            content.Children.Add(new Border { Height = 1, Background = Theme.B("SidebarAccent"), Margin = new Thickness(0, 4, 0, 4), HorizontalAlignment = HorizontalAlignment.Stretch });
            var fastRow = new StackPanel { Orientation = Orientation.Horizontal, Height = 40 }; fastRow.Children.Add(new TextBlock { Text = "Fast Functions:", FontSize = 12, Foreground = Theme.B("Text"), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 12, 0) }); fastRow.Children.Add(fastButtons); content.Children.Add(fastRow);
            var scroll = new ScrollViewer { Content = content, HorizontalScrollBarVisibility = ScrollBarVisibility.Auto, VerticalScrollBarVisibility = ScrollBarVisibility.Disabled, VerticalContentAlignment = VerticalAlignment.Top }; container.Children.Add(scroll);
            bool fitting = false;
            Action fit = delegate {
                if (fitting) return; fitting = true; try {
                    int maxRows = Math.Max(1, (int)Math.Floor((container.Height - 88) / 40)); var widths = new List<double>(); foreach (var button in wrap.Children.OfType<Button>()) { button.Measure(new Size(Double.PositiveInfinity, 40)); widths.Add(button.DesiredSize.Width); }
                    double lower = widths.DefaultIfEmpty(1).Max(), upper = widths.Sum() + 1;
                    for (int attempt = 0; attempt < 24; attempt++) { double candidate = (lower + upper) / 2, row = 0; int rows = 1; foreach (double width in widths) { if (row + width > candidate) { rows++; row = 0; } row += width; } if (rows > maxRows) lower = candidate; else upper = candidate; }
                    double viewport = scroll.ViewportWidth > 0 ? scroll.ViewportWidth : scroll.ActualWidth; double targetWidth = Math.Max(Math.Max(1, viewport - 16), upper + 1); if (Double.IsNaN(wrap.Width) || Math.Abs(wrap.Width - targetWidth) > 0.1) wrap.Width = targetWidth; content.MinWidth = Math.Max(0, viewport - 16);
                } finally { fitting = false; }
            };
            scroll.SizeChanged += delegate { fit(); }; container.SizeChanged += delegate { fit(); }; wrap.SizeChanged += delegate { fit(); };
            foreach (var button in wrap.Children.OfType<Button>()) button.SizeChanged += delegate { fit(); };
            var grip = new Thumb { Cursor = Cursors.SizeNS, Background = Theme.B("SidebarAccent"), ToolTip = "Drag up or down to resize mail actions", Height = 7 }; Grid.SetRow(grip, 1); container.Children.Add(grip);
            var gripBorder = new FrameworkElementFactory(typeof(Border)); gripBorder.SetValue(Border.BackgroundProperty, Theme.B("SidebarAccent")); gripBorder.SetValue(Border.CornerRadiusProperty, new CornerRadius(3)); gripBorder.SetValue(Border.MarginProperty, new Thickness(2, 1, 2, 1)); grip.Template = new ControlTemplate(typeof(Thumb)) { VisualTree = gripBorder };
            grip.DragDelta += delegate(object sender, DragDeltaEventArgs e) { preferences.MailToolbarHeight = Math.Max(128, Math.Min(300, container.Height + e.VerticalChange)); container.Height = preferences.MailToolbarHeight; fit(); };
            grip.DragCompleted += delegate { settingsStore.Save(preferences); };
            fit();
            return container;
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
                var function = entry; var button = Action(function.Name, false); button.Tag = function; button.Click += async delegate { if (!toolbarEditing) await RunFastFunction(function, button); };
                EnableToolbarDrag(button, fastFunctionButtons); var menu = new ContextMenu(); var edit = new MenuItem { Header = "Edit Fast Function" }; edit.Click += delegate { ShowFastFunctionEditor(function); }; menu.Items.Add(edit); var remove = new MenuItem { Header = "Remove Fast Function" }; remove.Click += delegate { preferences.FastFunctions.Remove(function); settingsStore.Save(preferences); RenderFastFunctions(); }; menu.Items.Add(remove); button.ContextMenu = menu; UiPolish.MailAction(button); fastFunctionButtons.Children.Add(button);
            }
            var create = Action("+ Create New Button", false); UiPolish.MailAction(create); create.Click += delegate { ShowCreateFastFunction(); }; fastFunctionButtons.Children.Add(create);
            NotifyMailToolbarChanged();
        }
        private class FolderChoice { public string Key; public string Name; public override string ToString() { return Name; } }
        private void ComposeMessageInWindow(Message message, MailAccount account, MailStore mailbox, string mode, Window owner) {
            var composer = new ComposerWindow(ComposerPreferences(account), mailbox, null, mode, message, account == null ? null : account.Id) { Owner = owner }; if (account != null) composer.Deliver = m => SendMail(m, account);
            composer.Saved += delegate(bool sent, string subject) { if (store == mailbox) Refresh(selected == null ? null : selected.Id); if (sent) MailNotification(false, subject, composer.RecipientAddresses); }; composer.ShowDialog();
        }
    }
}
