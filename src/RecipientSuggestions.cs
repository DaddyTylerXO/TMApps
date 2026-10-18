using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Mail;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;

namespace Postbox {
    public static class RecipientHistory {
        public static List<string> Build(IEnumerable<Message> messages, string ownAddress, string accountId = null) {
            var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var latest = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
            foreach (var message in messages.Where(m => (m.Folder == "Sent" || m.DeliveryState == "Sent") && (String.IsNullOrEmpty(accountId) || String.IsNullOrEmpty(m.AccountId) || m.AccountId == accountId))) {
                if (!String.IsNullOrWhiteSpace(message.Address) && !String.Equals(message.Address, ownAddress, StringComparison.OrdinalIgnoreCase)) continue;
                var recipients = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var field in new[] { message.To, message.Cc, message.Bcc }) foreach (var value in (field ?? "").Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)) {
                    if (String.IsNullOrWhiteSpace(value)) continue;
                    try { var address = new MailAddress(value.Trim()).Address; if (address.Contains("@") && !String.Equals(address, ownAddress, StringComparison.OrdinalIgnoreCase)) recipients.Add(address); } catch (FormatException) { }
                }
                foreach (var address in recipients) { if (!counts.ContainsKey(address)) { counts[address] = 0; latest[address] = DateTime.MinValue; } counts[address]++; if (message.Date > latest[address]) latest[address] = message.Date; }
            }
            return counts.Keys.OrderByDescending(a => counts[a]).ThenByDescending(a => latest[a]).ThenBy(a => a, StringComparer.OrdinalIgnoreCase).ToList();
        }
        public static int TokenStart(string text, int caret) { int end = Math.Max(0, Math.Min(caret, text.Length)); while (end > 0 && text[end - 1] != ';' && text[end - 1] != ',') end--; return end; }
        public static string Complete(string text, int caret, string address, out int nextCaret) {
            int start = TokenStart(text, caret), end = Math.Max(0, Math.Min(caret, text.Length));
            while (end < text.Length && text[end] != ';' && text[end] != ',') end++;
            string prefix = text.Substring(0, start), inserted = (start > 0 ? " " : "") + address;
            string suffix = end < text.Length ? text.Substring(end) : "; ";
            nextCaret = prefix.Length + inserted.Length + (end < text.Length ? 0 : 2);
            return prefix + inserted + suffix;
        }
    }
    public partial class ComposerWindow {
        private readonly List<string> recipientHistory;
        private readonly List<Popup> recipientSuggestionPopups = new List<Popup>();
        private void AttachRecipientSuggestions(TextBox input) {
            var list = new ListBox { Background = Theme.B("Surface"), Foreground = Theme.B("Text"), BorderThickness = new Thickness(0), MaxHeight = 220, MinWidth = 250, Focusable = false };
            var style = new Style(typeof(ListBoxItem)); style.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(10, 7, 10, 7))); style.Setters.Add(new Setter(UIElement.FocusableProperty, false));
            var selected = new Trigger { Property = ListBoxItem.IsSelectedProperty, Value = true }; selected.Setters.Add(new Setter(Control.BackgroundProperty, Theme.B("SidebarAccent"))); selected.Setters.Add(new Setter(Control.ForegroundProperty, Brushes.White)); style.Triggers.Add(selected); list.ItemContainerStyle = style;
            var popup = new Popup { PlacementTarget = input, Placement = PlacementMode.Bottom, StaysOpen = false, AllowsTransparency = true, Child = new Border { Child = list, Background = Theme.B("Surface"), BorderBrush = Theme.B("SidebarAccent"), BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(8), Padding = new Thickness(4) } };
            recipientSuggestionPopups.Add(popup);
            bool committing = false;
            Action update = delegate {
                if (committing || !input.IsKeyboardFocusWithin) { popup.IsOpen = false; return; }
                int start = RecipientHistory.TokenStart(input.Text, input.CaretIndex);
                string query = input.Text.Substring(start, Math.Max(0, input.CaretIndex - start)).Trim();
                if (query.Length == 0) { popup.IsOpen = false; return; }
                var already = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var box in new[] { to, cc, bcc }.Where(b => b != null)) foreach (var value in box.Text.Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)) if (box != input || !String.Equals(value.Trim(), query, StringComparison.OrdinalIgnoreCase)) already.Add(value.Trim());
                var matches = recipientHistory.Where(a => a.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0 && !already.Contains(a)).Take(8).ToList();
                list.ItemsSource = matches; list.SelectedIndex = matches.Count > 0 ? 0 : -1; popup.IsOpen = matches.Count > 0;
            };
            Action commit = delegate { var address = list.SelectedItem as string; if (address == null) return; committing = true; int caret; input.Text = RecipientHistory.Complete(input.Text, input.CaretIndex, address, out caret); input.CaretIndex = caret; popup.IsOpen = false; committing = false; input.Focus(); };
            input.TextChanged += delegate { update(); }; input.SelectionChanged += delegate { if (!committing) update(); }; input.GotKeyboardFocus += delegate { update(); };
            input.LostKeyboardFocus += delegate { popup.IsOpen = false; };
            input.PreviewKeyDown += delegate(object sender, KeyEventArgs e) {
                if (!popup.IsOpen) return;
                if (e.Key == Key.Down || e.Key == Key.Up) { list.SelectedIndex = Math.Max(0, Math.Min(list.Items.Count - 1, list.SelectedIndex + (e.Key == Key.Down ? 1 : -1))); list.ScrollIntoView(list.SelectedItem); e.Handled = true; }
                else if (e.Key == Key.Enter || e.Key == Key.Tab) { commit(); e.Handled = e.Key == Key.Enter; }
                else if (e.Key == Key.Escape) { popup.IsOpen = false; e.Handled = true; }
            };
            list.PreviewMouseLeftButtonUp += delegate(object sender, MouseButtonEventArgs e) { var row = ItemsControl.ContainerFromElement(list, e.OriginalSource as DependencyObject) as ListBoxItem; if (row != null) { list.SelectedItem = row.DataContext; commit(); e.Handled = true; } };
            Closed += delegate { popup.IsOpen = false; };
        }
    }
}
