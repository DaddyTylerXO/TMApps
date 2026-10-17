using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Postbox;

class MailToolsTests {
    static int checks;
    static void Check(bool value, string name) { if (!value) throw new Exception(name); checks++; }
    static object Get(object value, string field) { return value.GetType().GetField(field, BindingFlags.NonPublic | BindingFlags.Instance).GetValue(value); }
    static object Call(object value, string method, params object[] args) { return value.GetType().GetMethod(method, BindingFlags.NonPublic | BindingFlags.Instance).Invoke(value, args); }
    static IEnumerable<DependencyObject> Nodes(DependencyObject root) { yield return root; foreach (var child in LogicalTreeHelper.GetChildren(root).OfType<DependencyObject>()) foreach (var next in Nodes(child)) yield return next; }
    static void Wait(Task task) { if (!task.IsCompleted) { var frame = new DispatcherFrame(); task.ContinueWith(t => Application.Current.Dispatcher.BeginInvoke(new Action(() => frame.Continue = false))); Dispatcher.PushFrame(frame); } task.GetAwaiter().GetResult(); }
    static void Dialog(App app, string title, Action open, Action<Window> check) {
        Exception failure = null; DateTime deadline = DateTime.UtcNow.AddSeconds(10); var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(30) };
        timer.Tick += delegate { var dialog = app.Windows.Cast<Window>().FirstOrDefault(w => w.Title.Contains(title)); if (dialog == null) { if (DateTime.UtcNow > deadline) { failure = new Exception("Dialog did not open: " + title); timer.Stop(); } return; } timer.Stop(); try { check(dialog); } catch (Exception ex) { failure = ex; } finally { if (dialog.IsVisible) dialog.Close(); } };
        timer.Start(); open(); timer.Stop(); if (failure != null) throw new Exception(title + ": " + failure.ToString());
    }
    [STAThread] static void Main() {
        System.Threading.SynchronizationContext.SetSynchronizationContext(new DispatcherSynchronizationContext(Dispatcher.CurrentDispatcher));
        var sample = new[] { new Message { Folder = "Inbox", Date = new DateTime(2026, 1, 1), Unread = true, Subject = "Weekly   Notes", Address = "a@example.com", Importance = "High" }, new Message { Folder = "Inbox", Date = new DateTime(2026, 1, 2), FollowUp = true, Subject = "weekly notes", Address = "A@example.com" }, new Message { Folder = "Sent", Date = new DateTime(2026, 1, 3), Starred = true, Subject = "Weekly Notes", Address = "other@example.com" } };
        Check(App.FilterInbox(sample, "Unread", false).Count() == 1, "Unread filter failed"); Check(App.FilterInbox(sample, "Flagged", false).Count() == 2, "Flagged filter failed"); Check(App.FilterInbox(sample, "Important", false).Single() == sample[0], "Importance filter failed"); Check(App.FilterInbox(sample, "All", true).First() == sample[0], "Oldest sorting failed");
        Check(MailAnalytics.Top(sample, false).Single().Count == 2 && MailAnalytics.Top(sample, true).Single().Count == 2, "Inbox analytics did not group subjects/senders correctly");
        Check(App.AnalyticsMatches(sample, MailAnalytics.Top(sample, false).Single(), false).Count == 2, "Subject bulk selection included non-Inbox mail or missed whitespace/case matches");
        Check(App.AnalyticsMatches(sample, MailAnalytics.Top(sample, true).Single(), true).Count == 2, "Sender bulk selection included non-Inbox mail or missed case matches");
        Check(!SpotifyClient.IsProvider("YouTube Music", "chrome.exe") && SpotifyClient.IsProvider("YouTube Music", "YouTubeMusic.exe") && SpotifyClient.IsProvider("Apple Music", "AppleInc.AppleMusic_123!App") && SpotifyClient.IsProvider("Amazon Music", "Amazon Music.exe"), "Music source matching is unsafe or incomplete");
        var app = new App { ShutdownMode = ShutdownMode.OnExplicitShutdown }; Call(app, "Initialize"); var window = (Window)Get(app, "window"); window.Show();
        var prefs = (Preferences)Get(app, "preferences"); var store = (MailStore)Get(app, "store"); var message = store.Messages.First(m => m.Folder == "Inbox"); ((ListBox)window.FindName("MessageList")).SelectedItem = message;
        var archive = (Button)window.FindName("ArchiveButton"); var delete = (Button)window.FindName("DeleteButton"); var actions = (Panel)archive.Parent; int oldIndex = actions.Children.IndexOf(archive);
        Call(app, "SwapToolbarButtons", actions, archive, delete); Check(actions.Children.IndexOf(delete) == oldIndex && prefs.MailToolbarOrder.First() == "DeleteButton", "Toolbar actions were not swapped or persisted");
        Dialog(app, "Create Fast Function", () => Call(app, "ShowCreateFastFunction"), dialog => {
            var nodes = Nodes(dialog).ToList(); nodes.OfType<TextBox>().First().Text = "Reply and file";
            var kind = nodes.OfType<ComboBox>().First(c => c.Items.Contains("Reply")); kind.SelectedItem = "Reply";
            Check(!Nodes(dialog).OfType<TextBlock>().Any(t => t.Text == "Folder to Move to"), "Folder field visible for Reply");
            var target = Nodes(dialog).OfType<ComboBox>().Single(c => c.Items.Contains("Reply to sender")); target.SelectedItem = "Custom email addresses";
            Nodes(dialog).OfType<TextBox>().Last().Text = "team@example.com";
            Nodes(dialog).OfType<Button>().Single(b => Convert.ToString(b.Content) == "+ Add another action").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Check(Nodes(dialog).OfType<TextBlock>().Count(t => t.Text == "Folder to Move to") == 1, "Second move action did not show its folder field");
            Nodes(dialog).OfType<Button>().Single(b => Convert.ToString(b.Content) == "Create Button").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        });
        var function = prefs.FastFunctions.Last(); Check(function.Actions.Count == 2 && function.Actions[0].Recipients == "team@example.com" && function.Actions[1].Action == "Move to folder", "Fast Function steps/recipients were not saved");
        var clone = ((SettingsStore)Get(app, "settingsStore")).Clone(prefs); Check(clone.FastFunctions.Last().Actions[0].Recipients == "team@example.com" && clone.MailToolbarOrder.SequenceEqual(prefs.MailToolbarOrder), "New settings did not round-trip");
        Dialog(app, "Mailbox Management", () => Call(app, "ShowMailboxManagement"), dialog => {
            Check(Nodes(dialog).OfType<TextBlock>().Any(t => t.Text == "Mailbox Management") && !Nodes(dialog).OfType<Button>().Any(b => Convert.ToString(b.Content) == "Scan Mailbox"), "Management did not open on its overview");
            int windows = app.Windows.Count;
            Nodes(dialog).OfType<Button>().Single(b => Convert.ToString(b.Content) == "Mailbox Subscriptions").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Check(Nodes(dialog).OfType<Button>().Any(b => Convert.ToString(b.Content) == "Unsubscribe From Selected"), "Subscription controls did not appear in the management window");
            Nodes(dialog).OfType<Button>().Single(b => Convert.ToString(b.Content) == "Mailbox Analytics").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Check(app.Windows.Count == windows && !Nodes(dialog).OfType<Button>().Any(b => Convert.ToString(b.Content) == "Unsubscribe From Selected"), "Analytics opened another window or retained subscription controls");
            Check(Nodes(dialog).OfType<TextBlock>().Any(t => t.Text.Contains("Nothing has been scanned yet")) && !Nodes(dialog).OfType<TextBlock>().Any(t => t.Text == "Top 10 repeated subjects"), "Analytics scanned automatically");
            Nodes(dialog).OfType<Button>().Single(b => Convert.ToString(b.Content) == "Scan Mailbox").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            var header = Nodes(dialog).OfType<TextBlock>().Single(t => t.Text == "Top 10 repeated subjects"); Check(header.Parent is Border && ((Border)header.Parent).Background.ToString() == Theme.B("SidebarAccent").ToString(), "Analytics list heading is not a green bubble");
            var check = Nodes(dialog).OfType<CheckBox>().First(c => Convert.ToString(c.Content) == "Select All"); check.IsChecked = true;
            Check(Nodes(dialog).OfType<Button>().Single(b => Convert.ToString(b.Content) == "Move Selected…").IsEnabled && Nodes(dialog).OfType<Button>().Single(b => Convert.ToString(b.Content) == "Delete Selected").IsEnabled, "Selecting an analytics group did not enable bulk actions");
            Check(Nodes(dialog).OfType<Button>().Any(b => Convert.ToString(b.Content) == "Move…") && Nodes(dialog).OfType<Button>().Any(b => Convert.ToString(b.Content) == "Delete"), "Per-result move/delete actions are missing");
        });
        Dialog(app, "New message", () => Wait((Task)Call(app, "RunFastFunction", function, new Button())), composer => {
            Check(((TextBox)Get(composer, "to")).Text == "team@example.com" && ((TextBox)Get(composer, "cc")).Text == "", "Custom reply recipients incorrect");
        });
        Check(message.Folder == "Inbox", "Closing an unchanged composer ran subsequent move actions");
        var chain = new FastFunction { Actions = new List<FastAction> { new FastAction { Action = "Flag" }, new FastAction { Action = "Mark important" }, new FastAction { Action = "Mark read" }, new FastAction { Action = "Move to folder", Destination = "Archive" } } };
        Wait((Task)Call(app, "RunFastFunction", chain, new Button())); Check(message.FollowUp && message.Importance == "High" && !message.Unread && message.Folder == "Archive", "Multi-action function did not run in order");
        Dialog(app, "Settings", () => Call(app, "ShowSettings", "Widgets"), dialog => {
            var tabs = Nodes(dialog).OfType<TabControl>().Single(); var names = tabs.Items.Cast<TabItem>().Select(t => ((TextBlock)t.Header).Text).ToList(); Check(names.IndexOf("Widgets") == names.IndexOf("Appearance") + 1, "Widgets is not below Appearance");
            var widgets = (DependencyObject)((TabItem)tabs.SelectedItem).Content; var provider = Nodes(widgets).OfType<ComboBox>().Single(c => c.Items.Contains("YouTube Music")); provider.SelectedItem = "None";
            var placement = Nodes(widgets).OfType<ComboBox>().Single(c => c.Items.Contains("Sidebar")); Check(!placement.IsVisible, "Player position shown without a music provider"); provider.SelectedItem = "Apple Music"; Check(placement.IsVisible, "Player position hidden after provider selection");
            var appearance = (DependencyObject)tabs.Items.Cast<TabItem>().Single(t => ((TextBlock)t.Header).Text == "Appearance").Content; var notifications = (DependencyObject)tabs.Items.Cast<TabItem>().Single(t => ((TextBlock)t.Header).Text == "Notifications").Content;
            var badge = Nodes(appearance).OfType<CheckBox>().Single(c => Convert.ToString(c.Content).Contains("unread notification badge")); var notificationBadge = Nodes(notifications).OfType<CheckBox>().Single(c => Convert.ToString(c.Content).Contains("unread inbox count")); badge.IsChecked = false;
            Check(notificationBadge.IsChecked == false && window.TaskbarItemInfo.Overlay == null, "Appearance badge toggle did not clear and mirror");
            notificationBadge.IsChecked = true; Check(badge.IsChecked == true && window.TaskbarItemInfo.Overlay != null && window.Icon is System.Windows.Media.Imaging.BitmapFrame, "Badge toggle did not restore overlay with the full logo");
        });
        prefs = (Preferences)Get(app, "preferences"); prefs.CloseToTray = false; window.Close(); app.Shutdown(); Console.WriteLine("Passed " + checks + " inbox filter, analytics, toolbar order, multi-action editor/recipient, and Widgets integration checks. Synthetic mail only; no email sent or provider contacted.");
    }
}
