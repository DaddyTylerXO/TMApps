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
    sealed class CalendarHandler : System.Net.Http.HttpMessageHandler {
        public int Reads, Writes;
        protected override Task<System.Net.Http.HttpResponseMessage> SendAsync(System.Net.Http.HttpRequestMessage request, System.Threading.CancellationToken token) {
            if (request.Method.Method == "PROPFIND") {
                string props = request.RequestUri.AbsolutePath == "/" ? "<d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal>" : request.RequestUri.AbsolutePath.Contains("principal") ? "<c:calendar-home-set><d:href>/123/calendars/</d:href></c:calendar-home-set>" : null;
                string rows = props != null ? "<d:response><d:propstat><d:prop>" + props + "</d:prop></d:propstat></d:response>" : String.Concat(Enumerable.Range(1, 3).Select(i => "<d:response><d:href>/123/calendars/" + i + "/</d:href><d:propstat><d:prop><d:displayname>Calendar " + i + "</d:displayname><d:resourcetype><c:calendar/></d:resourcetype><d:current-user-privilege-set><d:privilege>" + (i == 3 ? "<d:read/>" : "<d:write/>") + "</d:privilege></d:current-user-privilege-set></d:prop></d:propstat></d:response>"));
                return Task.FromResult(new System.Net.Http.HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new System.Net.Http.StringContent("<d:multistatus xmlns:d='DAV:' xmlns:c='urn:ietf:params:xml:ns:caldav'>" + rows + "</d:multistatus>") });
            }
            if (request.Method.Method == "REPORT") Reads++; else Writes++;
            string ics = CalendarImport.CreateEvent("Downloaded iCloud event", DateTime.Today.AddHours(9), DateTime.Today.AddHours(10), "", "None", 1);
            string xml = "<d:multistatus xmlns:d='DAV:' xmlns:c='urn:ietf:params:xml:ns:caldav'><d:response><d:propstat><d:prop><c:calendar-data><![CDATA[" + ics + "]]></c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>";
            return Task.FromResult(new System.Net.Http.HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new System.Net.Http.StringContent(xml) });
        }
    }
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
        var app = new App { ShutdownMode = ShutdownMode.OnExplicitShutdown }; Call(app, "Initialize"); var main = (Window)Get(app, "window"); var prefs = (Preferences)Get(app, "preferences"); prefs.CalendarReminders = false; main.Show(); int reminderSounds = 0; string lastReminderSound = null; typeof(App).GetField("calendarSoundPlayer", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, new Action<string, string>((sound, path) => { reminderSounds++; lastReminderSound = sound; }));
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
        Wait((Task)Call(app, "CheckCalendarReminders")); var records = (Dictionary<string, CalendarReminderRecord>)Get(app, "reminderRecords"); Check(reminderSounds == 1 && lastReminderSound == "Cozy", "Due reminder did not request configured sound"); Wait((Task)Call(app, "CheckCalendarReminders")); Check(reminderSounds == 1, "Reminder sound repeated on refresh"); Check(records.Count == 1 && records.Values.Single().NextUtc <= DateTime.UtcNow, "Due reminder was not scheduled");
        Call(app, "ShowReminderWindow"); var reminder = (Window)Get(app, "reminderWindow"); Check(((ListBox)Get(app, "reminderList")).Items.Count == 1, "Due reminder missing from popup list"); var reminderRows = (ListBox)Get(app, "reminderList"); Check(reminderRows.Background.ToString() == "#FF0D2419" && reminderRows.Foreground.ToString() == "#FFFFFFFF", "Reminder list retained white theme"); var buttons = Nodes(reminder).OfType<Button>().ToList(); buttons.Single(b => Convert.ToString(b.Content) == "Snooze").RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Wait((Task)Call(app, "SaveReminderRecords")); var record = records.Values.Single(); Check(reminderRows.Items.Count == 0 && !buttons.Single(b => Convert.ToString(b.Content) == "Snooze").IsEnabled, "Snoozed reminder remained visible or buttons stayed active"); Check(record.NextUtc > DateTime.UtcNow && !record.Dismissed && !record.PopupShown && !record.DesktopShown, "Snooze did not reset next alert");
        record.NextUtc = DateTime.UtcNow.AddSeconds(-1); prefs.CalendarReminderDesktop = true; Wait((Task)Call(app, "CheckCalendarReminders")); var reminderBanners = ((IEnumerable<Window>)Get(app, "banners")).ToList(); Check(reminderBanners.Count == 1 && ((Border)reminderBanners[0].Content).Background.ToString() == "#FF0D2419" && Nodes(reminderBanners[0]).OfType<TextBlock>().Any(t => t.Text == "Calendar Reminder") && Nodes(reminderBanners[0]).OfType<Image>().Any(), "Calendar desktop reminder did not use branded mail notification layout"); reminderBanners[0].Close(); prefs.CalendarReminderDesktop = false; Check(reminderSounds == 2, "Snoozed reminder did not sound when due again"); Call(app, "RenderReminderList"); buttons.Single(b => Convert.ToString(b.Content) == "Dismiss").RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Wait((Task)Call(app, "SaveReminderRecords")); Check(record.Dismissed, "Dismiss did not clear reminder");
        typeof(App).GetField("reminderRecords", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, null); Wait((Task)Call(app, "LoadReminderRecords")); Check(((Dictionary<string, CalendarReminderRecord>)Get(app, "reminderRecords")).Values.Single().Dismissed, "Dismiss state did not persist across reload");
        records = (Dictionary<string, CalendarReminderRecord>)Get(app, "reminderRecords"); records["bulk-a"] = new CalendarReminderRecord { Key = "bulk-a", Title = "A", NextUtc = DateTime.UtcNow.AddMinutes(-1), Start = DateTime.Now }; records["bulk-b"] = new CalendarReminderRecord { Key = "bulk-b", Title = "B", NextUtc = DateTime.UtcNow.AddMinutes(-1), Start = DateTime.Now }; Call(app, "RenderReminderList");
        buttons.Single(b => Convert.ToString(b.Content) == "Dismiss all").RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Wait((Task)Call(app, "SaveReminderRecords")); Check(records.Values.All(r => r.Dismissed) && reminderRows.Items.Count == 0 && ((TextBlock)Get(app, "reminderFeedback")).Text.Contains("2 reminders dismissed"), "Dismiss all failed to clear reminders with feedback");
        Wait((Task)Call(app, "CheckCalendarReminders")); Check(reminderRows.Items.Count == 0 && reminderSounds == 2, "Dismissed reminders returned or sounded after refresh");
        reminder.Close(); failure = null; DateTime settingsDeadline = DateTime.UtcNow.AddSeconds(10); var settingsTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(25) };
        settingsTimer.Tick += delegate { var settings = app.Windows.Cast<Window>().FirstOrDefault(w => w.Title == "Settings · TMA-Mail"); if (settings == null) { if (DateTime.UtcNow > settingsDeadline) { failure = new Exception("Settings did not open."); settingsTimer.Stop(); } return; } settingsTimer.Stop(); try {
            var nodes = Nodes(settings).ToList(); var tabs = nodes.OfType<TabControl>().Single(); Check(((System.Windows.Media.SolidColorBrush)tabs.Background).Color.ToString() == "#FF0D2419", "Settings rail lost forest green");
            var header = nodes.OfType<TextBlock>().Single(t => t.Text == "TMA-Mail  /  Settings"); Check(((System.Windows.Media.SolidColorBrush)((Border)header.Parent).Background).Color.ToString() == "#FF0D2419", "Settings header lost forest green");
            var calendarTab = tabs.Items.Cast<TabItem>().Single(t => ((TextBlock)t.Header).Text == "Calendar");
            var calendarButtons = Nodes((DependencyObject)calendarTab.Content).OfType<Button>().ToList(); Check(calendarButtons.Any(b => Convert.ToString(b.Content).Contains("Preview calendar reminder sound")), "Calendar sound preview missing"); var reminderSoundChoice = (ComboBox)Get(app, "calendarSoundChoice"); reminderSoundChoice.SelectedItem = "None"; Check(((Preferences)Get(app, "preferences")).CalendarReminderSound == "None", "Calendar sound preview setting not applied");
            Check(calendarButtons.Count > 3 && calendarButtons.All(b => b.Background.ToString() == Theme.B("SidebarAccent").ToString() || b.Background.ToString() == Theme.B("SidebarSelected").ToString()), "Calendar settings retained non-green buttons");
            Check(calendarButtons.All(b => b.Margin.Bottom >= 10 && b.MinHeight >= 36), "Calendar settings buttons have insufficient spacing");
            Check(nodes.OfType<Button>().Single(b => Convert.ToString(b.Content) == "Save changes").Background.ToString() == Theme.B("SidebarAccent").ToString(), "Settings save button retained blue colour");
            Func<string, List<CheckBox>> toggles = name => Nodes((DependencyObject)((TabItem)tabs.Items.Cast<TabItem>().Single(t => ((TextBlock)t.Header).Text == name)).Content).OfType<CheckBox>().Where(c => c.Content.ToString().Contains("calendar reminders") || c.Content.ToString().Contains("reminder window") || c.Content.ToString().Contains("calendar notifications")).ToList();
            var calendarChecks = toggles("Calendar"); var notificationChecks = toggles("Notifications"); calendarChecks[1].IsChecked = true; Check(notificationChecks[1].IsChecked == true, "Reminder controls did not mirror between tabs"); calendarChecks[0].IsChecked = false; Check(notificationChecks[0].IsChecked == false, "Reminder master switch did not mirror");
            ((CheckBox)Get(app, "calendarSyncToggle")).IsChecked = true; Check(!(bool)typeof(App).GetProperty("CalendarSyncEnabled", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(app, null), "Settings preview activated provider writes");
        } catch (Exception ex) { failure = ex; } finally { settings.Close(); } };
        settingsTimer.Start(); Call(app, "ShowSettings", "Calendar"); settingsTimer.Stop(); if (failure != null) throw failure; var restored = (Preferences)Get(app, "preferences"); Check(restored.CalendarReminders && !restored.CalendarReminderPopup && !restored.CalendarProviderSync && restored.CalendarReminderSound == "Cozy", "Cancel did not restore reminder/sync preferences");
        var local = new CalendarSource { Id = "local-test", Name = "Local", Provider = "Local", Writable = true, Ics = CalendarImport.CreateEvent("Local event", DateTime.Today.AddHours(11), DateTime.Today.AddHours(12), "", "None", 1) };
        var connected = new CalendarSource { Id = "cloud-test", Name = "iCloud", Provider = "iCloud", Login = new MailAccount { Provider = "iCloud", Email = "synthetic@icloud.com", Password = "synthetic" }, RemoteUrl = "https://p01-caldav.icloud.com/123/calendars/personal/", Ics = CalendarImport.Empty, Pending = new List<string> { local.Ics } };
        typeof(App).GetField("calendarSources", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, new List<CalendarSource> { local, connected });
        Call(app, "ShowCalendarView"); Wait(Task.Delay(100));
        var selector = (ComboBox)Get(app, "calendarSelector"); selector.SelectedItem = selector.Items.Cast<CalendarSource>().Single(c => c.Id == "__all"); Wait(Task.Delay(100)); Call(app, "UpdateCalendarSelector");
        Check(((CalendarSource)selector.SelectedItem).ToString() == "All Calendars", "All Calendars selection did not survive refresh");
        Check(((IEnumerable<CalendarSource>)Call(app, "VisibleCalendarSources")).Count() == 2, "All Calendars omitted a source");
        selector.SelectedItem = selector.Items.Cast<CalendarSource>().Single(c => c.Id == local.Id); Wait(Task.Delay(100)); Check(((IEnumerable<CalendarSource>)Call(app, "VisibleCalendarSources")).Single() == local, "Single-calendar filtering was lost");
        var handler = new CalendarHandler(); typeof(App).GetField("calendarClientFactory", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, new Func<MailAccount, CalendarProviderClient>(account => new CalendarProviderClient(account, handler)));
        typeof(App).GetField("offlinePreview", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, false);
        try {
            Wait((Task)Call(app, "SynchronizeCalendar", connected, false)); Check(handler.Reads == 0 && handler.Writes == 0, "Paused automatic sync contacted provider");
            Wait((Task)Call(app, "SynchronizeCalendar", connected, true)); Check(handler.Reads == 1 && handler.Writes == 0 && connected.Pending.Count == 1, "Manual download uploaded queued events while sync paused");
            Check(connected.Ics.Contains("Downloaded iCloud event") && connected.Ics.Contains("Local event"), "Manual download lost provider or queued events");
            Check(CalendarImport.Month(new[] { local, connected }, new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1)).Any(e => e.SourceId == connected.Id && e.Summary == "Downloaded iCloud event"), "Downloaded iCloud event not visible");
        } finally { typeof(App).GetField("offlinePreview", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, true); }
        var pickerHandler = new CalendarHandler(); typeof(App).GetField("calendarClientFactory", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, new Func<MailAccount, CalendarProviderClient>(account => new CalendarProviderClient(account, pickerHandler)));
        typeof(App).GetField("calendarSources", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, new List<CalendarSource> { local });
        typeof(App).GetField("offlinePreview", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, false);
        try {
            for (int pass = 0; pass < 2; pass++) {
                int stage = 0; bool useAll = pass == 1; Exception pickerFailure = null; DateTime pickerDeadline = DateTime.UtcNow.AddSeconds(10);
                var pickerTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(25) };
                pickerTimer.Tick += delegate {
                    var dialog = app.Windows.Cast<Window>().FirstOrDefault(w => w.Title == "Connect calendar · TMA-Mail");
                    try {
                        if (DateTime.UtcNow > pickerDeadline) throw new Exception("Calendar connection picker timed out.");
                        if (dialog == null) return; var nodes = Nodes(dialog).ToList(); var list = nodes.OfType<ListBox>().Single(); var pickerButtons = nodes.OfType<Button>().ToList();
                        if (stage == 0) { stage = 1; nodes.OfType<ComboBox>().Single().SelectedItem = "iCloud"; nodes.OfType<TextBox>().Single().Text = "synthetic@icloud.com"; nodes.OfType<PasswordBox>().Single().Password = "synthetic"; pickerButtons.Single(b => Convert.ToString(b.Content) == "Sign in and list calendars").RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); }
                        else if (stage == 1 && list.Items.Count == 3) {
                            stage = 2; list.UpdateLayout(); Check(list.Background.ToString() == "#FF0D2419" && list.Foreground.ToString() == "#FFFFFFFF" && list.SelectionMode == SelectionMode.Multiple, "Calendar picker lost readable green theme or multi-selection");
                            var firstItem = (ListBoxItem)list.ItemContainerGenerator.ContainerFromIndex(0); Check(firstItem != null && firstItem.Background.ToString() == "#FF28503A", "Calendar row retained Windows white background");
                            pickerButtons.Single(b => Convert.ToString(b.Content) == "Select all").RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Check(list.SelectedItems.Count == 3, "Select all omitted calendars");
                            pickerButtons.Single(b => Convert.ToString(b.Content) == "Clear selection").RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Check(list.SelectedItems.Count == 0 && !pickerButtons.Single(b => Convert.ToString(b.Content) == "Add selected calendars").IsEnabled, "Clear selection did not disable adding empty selection");
                            if (!useAll) { list.SelectedItems.Add(list.Items[0]); list.SelectedItems.Add(list.Items[1]); Check(nodes.OfType<TextBlock>().Any(t => t.Text == "2 of 3 calendars selected"), "Calendar selection count incorrect"); }
                            pickerButtons.Single(b => Convert.ToString(b.Content) == (useAll ? "Add all calendars" : "Add selected calendars")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                        }
                    } catch (Exception ex) { pickerFailure = ex; if (dialog != null) dialog.Close(); pickerTimer.Stop(); }
                };
                pickerTimer.Start(); Call(app, "ShowConnectCalendar"); pickerTimer.Stop(); if (pickerFailure != null) throw pickerFailure;
                int expectedReads = useAll ? 5 : 2; while (pickerHandler.Reads < expectedReads && DateTime.UtcNow < pickerDeadline) Wait(Task.Delay(25)); Wait(Task.Delay(100));
                var addedSources = (List<CalendarSource>)Get(app, "calendarSources"); Check(addedSources.Count == (useAll ? 4 : 3) && addedSources.Count(c => c.Login != null) == (useAll ? 3 : 2), "Bulk calendar connection omitted choices or duplicated existing calendars");
                Check(addedSources.Where(c => c.Login != null).All(c => c.Ics.Contains("Downloaded iCloud event")) && pickerHandler.Writes == 0, "Bulk connection did not download all calendars without writes");
                Check((string)Get(app, "selectedCalendarId") == "__all", "Adding multiple calendars did not switch to combined view");
                if (!useAll) { var keep = addedSources.First(c => c.Login != null); keep.Pending = new List<string> { local.Ics }; }
                else Check(addedSources.First(c => c.Login != null).Pending.Count == 1 && !addedSources.Single(c => c.Name == "Calendar 3").Writable, "Reconnect lost pending events or read-only access");
            }
        } finally { typeof(App).GetField("offlinePreview", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(app, true); }
        main.Close(); app.Shutdown(); Console.WriteLine("Passed " + checks + " calendar editor/reminder/settings integration checks. Synthetic local data only; no provider contacted.");
    }
}
