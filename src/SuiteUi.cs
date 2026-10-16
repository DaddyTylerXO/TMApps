using System;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using Microsoft.Win32;
namespace Postbox {
    public partial class App {
        private Grid suiteCenter, suiteHeader, headerLeft;
        private Border headerSearch;
        private Button managementButton, calendarButton;
        private FrameworkElement calendarPage;
        private void InitializeSuiteUi() {
            managementButton = Action("🔧  Mailbox management", false); managementButton.ToolTip = "Mailbox management"; managementButton.Click += delegate { ShowMailboxManagement(); };
            calendarButton = Action("▦  Calendar", false); calendarButton.ToolTip = "Calendar"; calendarButton.Click += delegate { ShowCalendarView(); };
            var profileRow = (StackPanel)Find<Button>("AccountTop").Parent;
            var quickNew = Action("✉⁺", false); quickNew.ToolTip = "New message"; quickNew.FontSize = 23; quickNew.Padding = new Thickness(9, 3, 9, 3); quickNew.Margin = new Thickness(0, 0, 12, 0); quickNew.Click += delegate { Compose(null, ""); }; profileRow.Children.Insert(0, quickNew);
            var toolbar = (Panel)Find<Button>("DeleteButton").Parent;
            var toolbarHost = (DockPanel)toolbar.Parent; var star = Find<Button>("StarButton"); toolbarHost.Children.Remove(star); DockPanel.SetDock(star, Dock.Right); toolbarHost.Children.Insert(0, star);
            foreach (string label in new[] { "↶ Reply", "↶ Reply all", "↪ Forward", "⚑ Follow up", "▦ Categorise", "▧ Print", "⇩ Save .eml", "▦ Apps" }) {
                string action = label; var button = Action(label, false); button.Padding = new Thickness(10, 7, 10, 7); button.Margin = new Thickness(2); button.Click += delegate { RunMailboxAction(action, button); }; toolbar.Children.Add(button);
            }
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
        private void ShowMailView() { if (calendarPage != null) calendarPage.Visibility = Visibility.Collapsed; if (mailArea != null) mailArea.Visibility = Visibility.Visible; if (window != null) Find<TextBox>("SearchBox").IsEnabled = true; }
    }
}
