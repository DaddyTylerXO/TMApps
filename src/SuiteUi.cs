using System;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shell;
using System.Globalization;
using Microsoft.Win32;
namespace Postbox {
    public partial class App {
        private Grid suiteCenter, suiteHeader, headerLeft;
        private Border headerSearch;
        private Button managementButton, calendarButton;
        private FrameworkElement calendarPage;
        private int lastUnreadBadge = -1;
        private void UpdateUnreadBadge() {
            if (window == null || preferences == null) return;
            int count = !preferences.UnreadBadge ? 0 : mailAccounts != null && mailAccounts.Count > 0 ? mailAccounts.Sum(a => a.Folders == null ? 0 : a.Folders.Where(f => f.LocalName == "Inbox").Select(f => Math.Max(0, f.Unread)).DefaultIfEmpty(0).Max()) : store == null ? 0 : store.Messages.Count(m => m.Folder == "Inbox" && m.Unread);
            if (count == lastUnreadBadge) return; lastUnreadBadge = count;
            if (window.TaskbarItemInfo == null) window.TaskbarItemInfo = new TaskbarItemInfo();
            if (count == 0) { window.Icon = AppBrand.Logo(); window.TaskbarItemInfo.Overlay = null; window.TaskbarItemInfo.Description = "TMA-Mail"; return; }
            string number = count > 99 ? "99+" : count.ToString(CultureInfo.InvariantCulture);
            var visual = new DrawingVisual(); using (var draw = visual.RenderOpen()) { draw.DrawImage(AppBrand.Logo(), new Rect(0, 0, 64, 64)); DrawUnreadCircle(draw, number, 40, 24, 24); }
            var icon = new RenderTargetBitmap(64, 64, 96, 96, PixelFormats.Pbgra32); icon.Render(visual); icon.Freeze(); window.Icon = icon;
            window.TaskbarItemInfo.Overlay = null; window.TaskbarItemInfo.Description = "TMA-Mail · " + count + " unread inbox messages";
        }
        private static void DrawUnreadCircle(DrawingContext draw, string text, double x, double y, double radius) {
            draw.DrawEllipse(new SolidColorBrush(Color.FromRgb(231, 49, 67)), null, new Point(x, y), radius, radius);
            var label = new FormattedText(text, CultureInfo.InvariantCulture, FlowDirection.LeftToRight, new Typeface(new FontFamily("Segoe UI"), FontStyles.Normal, FontWeights.Bold, FontStretches.Normal), text.Length > 2 ? radius * 0.9 : radius * 1.15, Brushes.White, 1.0);
            draw.DrawText(label, new Point(x - label.Width / 2, y - label.Height / 2));
        }
        private void InitializeSuiteUi() {
            managementButton = Action("🔧  Mailbox management", false); managementButton.ToolTip = "Mailbox management"; managementButton.Click += delegate { ShowMailboxManagement(); };
            calendarButton = Action("▦  Calendar", false); calendarButton.ToolTip = "Calendar"; calendarButton.Click += delegate { if (CalendarVisible) ShowMailView(); else ShowCalendarView(); };
            var profileRow = (StackPanel)Find<Button>("AccountTop").Parent;
            var quickNew = Action("✉⁺", false); quickNew.ToolTip = "New message"; quickNew.FontSize = 23; quickNew.Padding = new Thickness(9, 3, 9, 3); quickNew.Margin = new Thickness(0, 0, 12, 0); quickNew.Click += delegate { Compose(null, ""); }; profileRow.Children.Insert(0, quickNew);
            var toolbar = (Panel)Find<Button>("DeleteButton").Parent;
            var toolbarHost = (DockPanel)toolbar.Parent; var star = Find<Button>("StarButton"); toolbarHost.Children.Remove(star); DockPanel.SetDock(star, Dock.Right); toolbarHost.Children.Insert(0, star);
            foreach (string label in new[] { "↶ Reply", "↶ Reply all", "↪ Forward", "⚑ Follow up", "▦ Categorise", "▧ Print", "⇩ Save .eml", "▦ Apps" }) {
                string action = label; var button = Action(label, false); button.VerticalAlignment = VerticalAlignment.Center; button.Padding = new Thickness(10, 7, 10, 7); button.Margin = new Thickness(2); button.Click += delegate { RunMailboxAction(action, button); }; toolbar.Children.Add(button);
            }
            InitializeExtendedMailUi(toolbar, toolbarHost);
            StartCalendarReminders();
            StartCalendarProviderTimer();
        }
        private void RunMailboxAction(string action, Button anchor) {
            if (action == "▦ Apps") { ShowPluginMenu(anchor); return; }
            if (selected == null) { Status("Select an email first."); return; }
            if (SelectedMessages().Count > 1 && action != "⚑ Follow up" && action != "▦ Categorise") { Status("Select one message for this action."); return; }
            if (action == "↶ Reply") Compose(null, "reply");
            else if (action == "↶ Reply all") Compose(null, "replyAll");
            else if (action == "↪ Forward") Compose(null, "forward");
            else if (action == "⚑ Follow up") { var messages = SelectedMessages(); bool enabled = messages.Any(m => !m.FollowUp); foreach (var message in messages) message.FollowUp = enabled; SaveMailboxInBackground(store); Refresh(selected.Id); Status(enabled ? "Follow-up flag added" : "Follow-up flag cleared"); }
            else if (action == "▦ Categorise") { var menu = new ContextMenu { PlacementTarget = anchor }; foreach (var name in new[] { "Work", "Personal", "Finance", "Travel", "Important", "Clear category" }) { string value = name; var entry = new MenuItem { Header = name }; entry.Click += delegate { foreach (var message in SelectedMessages()) message.Category = value == "Clear category" ? "" : value; SaveMailboxInBackground(store); Refresh(selected.Id); }; menu.Items.Add(entry); } menu.IsOpen = true; }
            else if (action == "⇩ Save .eml") { var dialog = new SaveFileDialog { Filter = "Email message (*.eml)|*.eml", FileName = "message.eml" }; if (dialog.ShowDialog(window) == true) { var message = selected.CopyForSync(); message.To = message.To ?? ""; Postbox.MailTransport.CreateMime(message).WriteTo(dialog.FileName); Status("Message exported as .eml"); } }
            else if (action == "▧ Print") { var dialog = new PrintDialog(); if (dialog.ShowDialog() == true) { var document = new FlowDocument(new Paragraph(new Run(selected.Subject + "\n\n" + selected.Sender + " <" + selected.Address + ">\n\n" + selected.Body))) { FontFamily = new FontFamily("Segoe UI"), FontSize = 12, Foreground = Brushes.Black, Background = Brushes.White }; dialog.PrintDocument(((IDocumentPaginatorSource)document).DocumentPaginator, "TMA-Mail message"); } }
        }
        private bool CalendarVisible { get { return calendarPage != null && calendarPage.Visibility == Visibility.Visible; } }
        private void UpdateCalendarButtons() {
            bool compact = preferences.NavigationCollapsed; bool calendar = CalendarVisible;
            Find<Button>("ComposeButton").Content = calendar ? (compact ? "▦⁺" : "▦⁺  Add to Calendar") : (compact ? "✉⁺" : "✉⁺  New message");
            Find<Button>("ComposeButton").ToolTip = calendar ? "Add a local calendar event" : "New message (Ctrl+N)";
            if (calendarButton != null) { calendarButton.Content = calendar ? (compact ? "↶✉" : "↶  Return to Mailbox") : (compact ? "▦" : "▦  Calendar"); calendarButton.ToolTip = calendar ? "Return to Mailbox" : "Calendar"; }
        }
        private void ShowMailView() { if (calendarPage != null) calendarPage.Visibility = Visibility.Collapsed; if (mailArea != null) mailArea.Visibility = Visibility.Visible; if (window != null) { Find<TextBox>("SearchBox").IsEnabled = true; UpdateCalendarButtons(); } }
    }
}
