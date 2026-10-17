using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
namespace Postbox {
    public class CalendarReminderRecord { public string Key { get; set; } public string Title { get; set; } public string Email { get; set; } public string Location { get; set; } public DateTime Start { get; set; } public DateTime NextUtc { get; set; } public bool Dismissed { get; set; } public bool PopupShown { get; set; } public bool DesktopShown { get; set; } public bool SoundShown { get; set; } public override string ToString() { return Title + " · " + Start.ToString("g") + " · " + Location; } }
    public partial class App {
        private static readonly string[] ReminderChoices = { "None", "At exact time", "5 minutes before", "10 minutes before", "15 minutes before", "30 minutes before", "1 hour before", "2 hours before", "1 day before", "2 days before", "1 week before", "Custom" };
        public static int ParseReminderChoice(string choice, string custom) { int index = Array.IndexOf(ReminderChoices, choice); int[] values = { -1, 0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080 }; if (index >= 0 && index < values.Length) return values[index]; int number; if (choice != "Custom" || !Int32.TryParse(custom, out number) || number < 0 || number > 525600) throw new ArgumentException("Enter reminder minutes between 0 and 525600."); return number; }
        private readonly List<CheckBox[]> reminderOptionGroups = new List<CheckBox[]>();
        private bool syncingReminderOptions, checkingReminders;
        private CheckBox calendarSyncToggle;
        private ComboBox calendarSoundChoice;
        private TextBox calendarSoundPath;
        private Action<string, string> calendarSoundPlayer = null;
        private bool reminderActionRunning;
        private TextBlock reminderFeedback;
        private readonly List<Button> reminderActionButtons = new List<Button>();
        private void AddCalendarSoundOptions(StackPanel panel) {
            calendarSoundChoice = Choice(panel, "Calendar reminder sound", preferences.CalendarReminderSound, SoundCatalog.Choices);
            calendarSoundPath = SoundFileField(panel, preferences.CalendarReminderWavePath);
            var preview = Action("▶  Preview calendar reminder sound", false); preview.Click += delegate { PlaySound(Value(calendarSoundChoice), calendarSoundPath.Text); }; panel.Children.Add(preview);
            panel.Children.Add(Label("Choose None for silent reminders. Sounds play once when a reminder becomes due, including after snoozing, while calendar reminders are enabled.", 12, "Muted"));
        }
        private Dictionary<string, CalendarReminderRecord> reminderRecords;
        private readonly System.Threading.SemaphoreSlim reminderSaveGate = new System.Threading.SemaphoreSlim(1, 1);
        private DispatcherTimer calendarReminderTimer;
        private Window reminderWindow;
        private ListBox reminderList;
        private void AddReminderOptions(StackPanel panel) {
            var group = new[] { Toggle(panel, "Enable calendar reminders while TMA-Mail is running", preferences.CalendarReminders), Toggle(panel, "Show in-app reminder window", preferences.CalendarReminderPopup), Toggle(panel, "Show desktop calendar notifications", preferences.CalendarReminderDesktop) }; reminderOptionGroups.Add(group);
            for (int i = 0; i < group.Length; i++) { int column = i; RoutedEventHandler sync = delegate { if (syncingReminderOptions) return; syncingReminderOptions = true; try { foreach (var peer in reminderOptionGroups.Where(p => p != group)) peer[column].IsChecked = group[column].IsChecked; } finally { syncingReminderOptions = false; } }; group[i].Checked += sync; group[i].Unchecked += sync; }
        }
        private void StartCalendarReminders() { calendarReminderTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(15) }; calendarReminderTimer.Tick += async delegate { await CheckCalendarReminders(); }; calendarReminderTimer.Start(); window.Closed += delegate { calendarReminderTimer.Stop(); if (reminderWindow != null) reminderWindow.Close(); }; }
        private async Task LoadReminderRecords() { if (reminderRecords != null) return; string path = Path.Combine(dataDirectory, "calendar-reminders.protected"); var loaded = await Task.Run(() => File.Exists(path) ? new JavaScriptSerializer { MaxJsonLength = 16777216 }.Deserialize<Dictionary<string, CalendarReminderRecord>>(ProtectedFile.Read(path)) : new Dictionary<string, CalendarReminderRecord>()); if (reminderRecords == null) reminderRecords = loaded; }
        private async Task SaveReminderRecords() { await reminderSaveGate.WaitAsync(); try { string text = new JavaScriptSerializer { MaxJsonLength = 16777216 }.Serialize(reminderRecords); await Task.Run(() => ProtectedFile.Write(Path.Combine(dataDirectory, "calendar-reminders.protected"), text)); } finally { reminderSaveGate.Release(); } }
        private async Task CheckCalendarReminders() {
            if (checkingReminders || reminderActionRunning || !preferences.CalendarReminders) return; checkingReminders = true;
            try {
                await EnsureCalendars(); await LoadReminderRecords(); var sources = calendarSources.ToList(); var events = await Task.Run(() => CalendarImport.Month(sources, DateTime.Today)); DateTime now = DateTime.UtcNow; bool changed = false; bool popup = false; bool sound = false;
                foreach (var entry in events.Where(e => e.ReminderMinutes >= 0 && e.Start.ToUniversalTime().AddMinutes(-e.ReminderMinutes) >= now.AddDays(-7))) {
                    string key = entry.SourceId + ":" + entry.Uid + ":" + entry.Start.Ticks; CalendarReminderRecord record;
                    if (!reminderRecords.TryGetValue(key, out record)) { record = new CalendarReminderRecord { Key = key, Title = entry.Summary, Location = entry.Location, Start = entry.Start, Email = sources.First(s => s.Id == entry.SourceId).Email, NextUtc = entry.Start.ToUniversalTime().AddMinutes(-entry.ReminderMinutes) }; reminderRecords[key] = record; changed = true; }
                    if (record.Dismissed || record.NextUtc > now || record.NextUtc < now.AddDays(-7)) continue;
                    if (!record.SoundShown) { sound = true; record.SoundShown = true; changed = true; }
                    if (preferences.CalendarReminderDesktop && !record.DesktopShown) { ShowNotification("Calendar Reminder", NotificationDetail(record.Email, record.Title + " · " + record.Start.ToString("g"))); record.DesktopShown = true; changed = true; }
                    if (preferences.CalendarReminderPopup && !record.PopupShown) { popup = true; record.PopupShown = true; changed = true; }
                }
                foreach (string key in reminderRecords.Where(p => p.Value.Start < DateTime.Now.AddDays(-30)).Select(p => p.Key).ToList()) { reminderRecords.Remove(key); changed = true; }
                if (changed) await SaveReminderRecords(); if (sound) { if (calendarSoundPlayer != null) calendarSoundPlayer(preferences.CalendarReminderSound, preferences.CalendarReminderWavePath); else PlaySound(preferences.CalendarReminderSound, preferences.CalendarReminderWavePath); } if (popup) ShowReminderWindow(); else RenderReminderList();
            } catch (Exception ex) { Status("Calendar reminders could not update: " + ex.Message); } finally { checkingReminders = false; }
        }
        private void UpdateReminderActions() { foreach (var button in reminderActionButtons) button.IsEnabled = !reminderActionRunning && reminderList != null && (Convert.ToString(button.Content) == "Dismiss all" ? reminderList.Items.Count > 0 : reminderList.SelectedItem != null); }
        private void RenderReminderList() {
            if (reminderList == null || reminderRecords == null) return; var selectedRecord = reminderList.SelectedItem as CalendarReminderRecord;
            reminderList.ItemsSource = reminderRecords.Values.Where(r => !r.Dismissed && r.NextUtc <= DateTime.UtcNow && r.NextUtc >= DateTime.UtcNow.AddDays(-7)).OrderBy(r => r.Start).ToList();
            if (selectedRecord != null) reminderList.SelectedItem = reminderList.Items.Cast<CalendarReminderRecord>().FirstOrDefault(r => r.Key == selectedRecord.Key);
            if (reminderList.SelectedItem == null && reminderList.Items.Count > 0) reminderList.SelectedIndex = 0; UpdateReminderActions();
        }
        private async Task ApplyReminderAction(string operation, int snoozeMinutes) {
            if (reminderActionRunning || reminderList == null || reminderRecords == null) return;
            var selected = reminderList.SelectedItem as CalendarReminderRecord;
            var targets = (operation == "Dismiss all" ? reminderList.Items.Cast<CalendarReminderRecord>() : selected == null ? Enumerable.Empty<CalendarReminderRecord>() : new[] { selected }).Select(r => reminderRecords.ContainsKey(r.Key) ? reminderRecords[r.Key] : null).Where(r => r != null).ToList();
            if (targets.Count == 0) { if (reminderFeedback != null) reminderFeedback.Text = "Select a reminder first."; return; }
            var previous = targets.Select(r => new CalendarReminderRecord { Key = r.Key, Dismissed = r.Dismissed, NextUtc = r.NextUtc, PopupShown = r.PopupShown, DesktopShown = r.DesktopShown, SoundShown = r.SoundShown }).ToList();
            reminderActionRunning = true;
            try {
                foreach (var record in targets) { if (operation == "Snooze") { record.NextUtc = DateTime.UtcNow.AddMinutes(snoozeMinutes); record.PopupShown = record.DesktopShown = record.SoundShown = false; } else record.Dismissed = true; }
                RenderReminderList(); await SaveReminderRecords();
                if (reminderFeedback != null) reminderFeedback.Text = operation == "Snooze" ? "Reminder snoozed for " + snoozeMinutes + " minutes." : targets.Count + (targets.Count == 1 ? " reminder dismissed." : " reminders dismissed.");
            } catch (Exception ex) {
                foreach (var old in previous) { var record = reminderRecords[old.Key]; record.Dismissed = old.Dismissed; record.NextUtc = old.NextUtc; record.PopupShown = old.PopupShown; record.DesktopShown = old.DesktopShown; record.SoundShown = old.SoundShown; }
                string error = "Reminder action could not be saved: " + ex.Message; if (reminderFeedback != null) reminderFeedback.Text = error; Status(error);
            } finally { reminderActionRunning = false; RenderReminderList(); }
        }
        private async void ShowReminderWindow() {
            try { await LoadReminderRecords(); } catch (Exception ex) { Status(ex.Message); return; }
            if (reminderWindow != null) { RenderReminderList(); reminderWindow.Show(); reminderWindow.Activate(); return; }
            var dialog = Dialog("Calendar Reminders · TMA-Mail", 680, 500); dialog.MinWidth = 480; dialog.MinHeight = 380; reminderWindow = dialog; var root = new DockPanel { Margin = new Thickness(20) }; dialog.Content = root;
            var heading = Label("Calendar Reminders", 23, "Text"); DockPanel.SetDock(heading, Dock.Top); root.Children.Add(heading);
            var actions = new StackPanel(); DockPanel.SetDock(actions, Dock.Bottom); root.Children.Add(actions); var snooze = Choice(actions, "Snooze selected reminder", "5 minutes", new[] { "5 minutes", "10 minutes", "15 minutes", "30 minutes", "1 hour", "1 day" }); var row = new WrapPanel(); actions.Children.Add(row);
            reminderActionButtons.Clear();
            foreach (string label in new[] { "Dismiss", "Snooze", "Dismiss all" }) { string operation = label; var button = Action(label, true); UiPolish.SettingsButton(button); button.Background = Theme.B("SidebarAccent"); button.Foreground = System.Windows.Media.Brushes.White; row.Children.Add(button); reminderActionButtons.Add(button); button.Click += async delegate { int[] minutes = { 5, 10, 15, 30, 60, 1440 }; await ApplyReminderAction(operation, minutes[Math.Max(0, snooze.SelectedIndex)]); }; }
            reminderFeedback = Label("Select a reminder, then dismiss or snooze it.", 12, "Muted"); actions.Children.Add(reminderFeedback);
            reminderList = UiPolish.ReminderList(); reminderList.SelectionChanged += delegate { UpdateReminderActions(); }; root.Children.Add(reminderList); RenderReminderList(); dialog.Closed += delegate { reminderWindow = null; reminderList = null; reminderFeedback = null; reminderActionButtons.Clear(); }; dialog.Show();
        }
    }
}
