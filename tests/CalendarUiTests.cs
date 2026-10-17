using System;
using System.IO;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Postbox;
class CalendarUiTests {
    static int checks;
    static void Check(bool value, string name) { if (!value) throw new Exception(name); checks++; }
    static object Get(object value, string field) { return value.GetType().GetField(field, BindingFlags.NonPublic | BindingFlags.Instance).GetValue(value); }
    static object Call(object value, string method, params object[] args) { return value.GetType().GetMethod(method, BindingFlags.NonPublic | BindingFlags.Instance).Invoke(value, args); }
    static IEnumerable<DependencyObject> Nodes(DependencyObject root) { yield return root; foreach (var child in LogicalTreeHelper.GetChildren(root).OfType<DependencyObject>()) foreach (var next in Nodes(child)) yield return next; }
    static void Wait(Task task) { if (!task.IsCompleted) { var frame = new DispatcherFrame(); var dispatcher = Dispatcher.CurrentDispatcher; task.ContinueWith(t => dispatcher.BeginInvoke(new Action(() => frame.Continue = false))); Dispatcher.PushFrame(frame); } task.GetAwaiter().GetResult(); }
    [STAThread] static void Main(string[] args) {
        string directory = args[1]; Directory.CreateDirectory(directory); var empty = new MailStore(Path.Combine(directory, "mailbox.json")); empty.Messages.Clear(); empty.Save();
        // These harnesses initialize WPF without Application.Run; use its UI context explicitly.
        System.Threading.SynchronizationContext.SetSynchronizationContext(new System.Windows.Threading.DispatcherSynchronizationContext(System.Windows.Threading.Dispatcher.CurrentDispatcher));
        var app = new App { ShutdownMode = ShutdownMode.OnExplicitShutdown }; Call(app, "Initialize"); var main = (Window)Get(app, "window"); var prefs = (Preferences)Get(app, "preferences"); prefs.CalendarReminders = false; main.Show();
        Wait((Task)Call(app, "EnsureCalendars")); Exception failure = null; bool edited = false; DateTime deadline = DateTime.UtcNow.AddSeconds(15); var frame = new DispatcherFrame(); var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(25) };
        timer.Tick += delegate {
            var dialog = app.Windows.Cast<Window>().FirstOrDefault(w => w.Title == "Add to Calendar · TMA-Mail");
            try {
                if (DateTime.UtcNow > deadline) throw new Exception("Calendar editor did not save/close within 15 seconds.");
                if (dialog == null) { if (edited) frame.Continue = false; return; } if (edited) return; edited = true;
                var nodes = Nodes(dialog).ToList(); var text = nodes.OfType<TextBox>().Where(t => !(t is System.Windows.Controls.Primitives.DatePickerTextBox)).ToList(); var dates = nodes.OfType<DatePicker>().ToList(); var choices = nodes.OfType<ComboBox>().ToList(); var allDay = nodes.OfType<CheckBox>().Single(c => c.Content.ToString() == "All day");
                text[0].Text = "UI recurring day"; allDay.IsChecked = true; Check(!text[1].IsEnabled && !text[2].IsEnabled && text[1].Text == "" && text[2].Text == "", "All-day did not clear and disable both times");
                dates[0].SelectedDate = new DateTime(2026, 10, 20); dates[1].SelectedDate = new DateTime(2026, 10, 20); choices[1].SelectedItem = "Custom"; choices[2].SelectedItem = "Daily"; text[4].Text = "4"; text[5].Text = "3"; choices[3].SelectedItem = "1 week before";
                nodes.OfType<Button>().Single(b => Convert.ToString(b.Content) == "Add event").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            } catch (Exception ex) { failure = ex; if (dialog != null) dialog.Close(); frame.Continue = false; }
        };
        timer.Start(); Call(app, "ShowAddCalendarEvent"); Dispatcher.PushFrame(frame); timer.Stop(); if (failure != null) throw failure;
        var sources = (List<CalendarSource>)Get(app, "calendarSources"); var saved = sources.Single(s => s.Ics.Contains("UI recurring day")); var entries = CalendarImport.Month(new[] { saved }, new DateTime(2026, 10, 1)); Check(entries.Count == 3 && entries.All(e => e.AllDay && e.ReminderMinutes == 10080) && (entries[1].Start - entries[0].Start).Days == 4, "Saved UI event lost all-day, custom repeat or reminder"); Check(File.Exists(Path.Combine(directory, "calendars.protected")), "Calendar event not persisted protected");
        var due = new CalendarSource { Id = "due", Name = "Test calendar", Email = "synthetic@example.com", Ics = CalendarImport.CreateEvent("Upcoming reminder", DateTime.Now.AddMinutes(10), DateTime.Now.AddMinutes(40), "Test room", "None", 1, false, 1, 15) }; typeof(App).GetField("calendarSources", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, new List<CalendarSource> { due }); prefs.CalendarReminders = true; prefs.CalendarReminderPopup = prefs.CalendarReminderDesktop = false;
        Wait((Task)Call(app, "CheckCalendarReminders")); var records = (Dictionary<string, CalendarReminderRecord>)Get(app, "reminderRecords"); Check(records.Count == 1 && records.Values.Single().NextUtc <= DateTime.UtcNow, "Due reminder was not scheduled");
        Call(app, "ShowReminderWindow"); var reminder = (Window)Get(app, "reminderWindow"); Check(((ListBox)Get(app, "reminderList")).Items.Count == 1, "Due reminder missing from popup list"); var buttons = Nodes(reminder).OfType<Button>().ToList(); buttons.Single(b => Convert.ToString(b.Content) == "Snooze").RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Wait((Task)Call(app, "SaveReminderRecords")); var record = records.Values.Single(); Check(record.NextUtc > DateTime.UtcNow && !record.Dismissed && !record.PopupShown && !record.DesktopShown, "Snooze did not reset next alert");
        record.NextUtc = DateTime.UtcNow.AddSeconds(-1); Call(app, "RenderReminderList"); buttons.Single(b => Convert.ToString(b.Content) == "Dismiss").RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Wait((Task)Call(app, "SaveReminderRecords")); Check(record.Dismissed, "Dismiss did not clear reminder");
        typeof(App).GetField("reminderRecords", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, null); Wait((Task)Call(app, "LoadReminderRecords")); Check(((Dictionary<string, CalendarReminderRecord>)Get(app, "reminderRecords")).Values.Single().Dismissed, "Dismiss state did not persist across reload");
        reminder.Close(); failure = null; DateTime settingsDeadline = DateTime.UtcNow.AddSeconds(10); var settingsTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(25) };
        settingsTimer.Tick += delegate { var settings = app.Windows.Cast<Window>().FirstOrDefault(w => w.Title == "Settings · TMA-Mail"); if (settings == null) { if (DateTime.UtcNow > settingsDeadline) { failure = new Exception("Settings did not open."); settingsTimer.Stop(); } return; } settingsTimer.Stop(); try {
            var nodes = Nodes(settings).ToList(); var tabs = nodes.OfType<TabControl>().Single(); Check(((System.Windows.Media.SolidColorBrush)tabs.Background).Color.ToString() == "#FF0D2419", "Settings rail lost forest green");
            var header = nodes.OfType<TextBlock>().Single(t => t.Text == "TMA-Mail  /  Settings"); Check(((System.Windows.Media.SolidColorBrush)((Border)header.Parent).Background).Color.ToString() == "#FF0D2419", "Settings header lost forest green");
            var calendarTab = tabs.Items.Cast<TabItem>().Single(t => ((TextBlock)t.Header).Text == "Calendar");
            var calendarButtons = Nodes((DependencyObject)calendarTab.Content).OfType<Button>().ToList();
            Check(calendarButtons.Count > 3 && calendarButtons.All(b => b.Background.ToString() == Theme.B("SidebarAccent").ToString() || b.Background.ToString() == Theme.B("SidebarSelected").ToString()), "Calendar settings retained non-green buttons");
            Check(calendarButtons.All(b => b.Margin.Bottom >= 10 && b.MinHeight >= 36), "Calendar settings buttons have insufficient spacing");
            Check(nodes.OfType<Button>().Single(b => Convert.ToString(b.Content) == "Save changes").Background.ToString() == Theme.B("SidebarAccent").ToString(), "Settings save button retained blue colour");
            Func<string, List<CheckBox>> toggles = name => Nodes((DependencyObject)((TabItem)tabs.Items.Cast<TabItem>().Single(t => ((TextBlock)t.Header).Text == name)).Content).OfType<CheckBox>().Where(c => c.Content.ToString().Contains("calendar reminders") || c.Content.ToString().Contains("reminder window") || c.Content.ToString().Contains("calendar notifications")).ToList();
            var calendarChecks = toggles("Calendar"); var notificationChecks = toggles("Notifications"); calendarChecks[1].IsChecked = true; Check(notificationChecks[1].IsChecked == true, "Reminder controls did not mirror between tabs"); calendarChecks[0].IsChecked = false; Check(notificationChecks[0].IsChecked == false, "Reminder master switch did not mirror");
            ((CheckBox)Get(app, "calendarSyncToggle")).IsChecked = true; Check(!(bool)typeof(App).GetProperty("CalendarSyncEnabled", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(app, null), "Settings preview activated provider writes");
        } catch (Exception ex) { failure = ex; } finally { settings.Close(); } };
        settingsTimer.Start(); Call(app, "ShowSettings", "Calendar"); settingsTimer.Stop(); if (failure != null) throw failure; var restored = (Preferences)Get(app, "preferences"); Check(restored.CalendarReminders && !restored.CalendarReminderPopup && !restored.CalendarProviderSync, "Cancel did not restore reminder/sync preferences");
        main.Close(); app.Shutdown(); Console.WriteLine("Passed " + checks + " calendar editor/reminder/settings integration checks. Synthetic local data only; no provider contacted.");
    }
}
