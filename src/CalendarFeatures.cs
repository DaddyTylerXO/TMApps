using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Win32;
using Ical.Net.DataTypes;
using Ical.Net.CalendarComponents;
namespace Postbox {
    public class CalendarSource { public string Id { get; set; } public string Name { get; set; } public string Email { get; set; } public string Ics { get; set; } public string Url { get; set; } }
    public class CalendarEntry { public DateTime Start; public DateTime End; public string Summary; public string Location; public string Description; public string Source; public bool AllDay; }
    public static class CalendarImport {
        public static string CreateEvent(string title, DateTime start, DateTime end, string location, string recurrence, int occurrences) {
            if (String.IsNullOrWhiteSpace(title)) throw new ArgumentException("Enter an event title.");
            if (end <= start) throw new ArgumentException("The end must be after the start.");
            string[] rules = { "None", "Daily", "Weekly", "Monthly", "Yearly" }; if (!rules.Contains(recurrence)) throw new ArgumentException("Choose a recurrence.");
            if (occurrences < 1 || occurrences > 1000) throw new ArgumentException("Repeat count must be between 1 and 1000.");
            Func<string, string> escape = value => (value ?? "").Replace("\\", "\\\\").Replace("\r\n", "\n").Replace("\r", "\n").Replace("\n", "\\n").Replace(";", "\\;").Replace(",", "\\,");
            string rule = recurrence == "None" ? "" : "RRULE:FREQ=" + recurrence.ToUpperInvariant() + ";COUNT=" + occurrences.ToString(System.Globalization.CultureInfo.InvariantCulture) + "\r\n";
            return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TMA-Mail//Local Calendar//EN\r\nBEGIN:VEVENT\r\nUID:" + Guid.NewGuid().ToString("N") + "@tma-mail.local\r\nDTSTAMP:" + DateTime.UtcNow.ToString("yyyyMMdd'T'HHmmss'Z'", System.Globalization.CultureInfo.InvariantCulture) + "\r\nDTSTART:" + start.ToString("yyyyMMdd'T'HHmmss", System.Globalization.CultureInfo.InvariantCulture) + "\r\nDTEND:" + end.ToString("yyyyMMdd'T'HHmmss", System.Globalization.CultureInfo.InvariantCulture) + "\r\nSUMMARY:" + escape(title.Trim()) + "\r\nLOCATION:" + escape(location) + "\r\n" + rule + "END:VEVENT\r\nEND:VCALENDAR\r\n";
        }
        private static DateTime LocalTime(CalDateTime date) { return !date.HasTime ? date.Value.Date : String.IsNullOrEmpty(date.TzId) && !date.IsUtc ? DateTime.SpecifyKind(date.Value, DateTimeKind.Local) : date.AsUtc.ToLocalTime(); }
        public static void Validate(string text) { if (String.IsNullOrWhiteSpace(text) || text.Length > 5000000 || !text.Contains("BEGIN:VCALENDAR")) throw new InvalidDataException("Choose an iCalendar (.ics) file of at most 5 MB."); var calendar = Ical.Net.Calendar.Load(text); if (calendar == null || calendar.Events.Count == 0) throw new InvalidDataException("No calendar events were found."); }
        public static List<CalendarEntry> Month(IEnumerable<CalendarSource> sources, DateTime month) {
            var start = new DateTime(month.Year, month.Month, 1).AddDays(-7); var end = start.AddDays(49); var result = new List<CalendarEntry>();
            foreach (var source in sources) {
                var calendar = Ical.Net.Calendar.Load(source.Ics);
                foreach (var occurrence in calendar.GetOccurrences(new CalDateTime(start.AddMonths(-1)), null).Take(10000)) {
                    var item = occurrence.Source as CalendarEvent; if (item == null || item.Status == "CANCELLED") continue;
                    var date = occurrence.Period.StartTime; var finish = occurrence.Period.EffectiveEndTime;
                    DateTime begins = LocalTime(date);
                    DateTime ends = finish == null ? begins.AddHours(1) : LocalTime(finish);
                    if (begins >= end) break; if (ends <= start) continue;
                    result.Add(new CalendarEntry { Start = begins, End = ends, AllDay = !date.HasTime, Summary = item.Summary ?? "Untitled event", Description = item.Description, Location = item.Location, Source = source.Name });
                }
            }
            return result.OrderBy(e => e.Start).ToList();
        }
    }
    public partial class App {
        private List<CalendarSource> calendarSources;
        private readonly System.Threading.SemaphoreSlim calendarGate = new System.Threading.SemaphoreSlim(1, 1);
        private DateTime calendarMonth = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
        private int calendarGeneration;
        private Grid calendarDays;
        private TextBlock calendarHeading, calendarStatus;
        private void ShowAddCalendarEvent() {
            var dialog = Dialog("Add to Calendar · TMA-Mail", 560, 760); dialog.MinWidth = 440; dialog.MinHeight = 540;
            var root = new DockPanel { Margin = new Thickness(24) }; dialog.Content = root;
            var row = new WrapPanel { Margin = new Thickness(0, 12, 0, 0) }; DockPanel.SetDock(row, Dock.Bottom); root.Children.Add(row);
            var panel = new StackPanel(); root.Children.Add(new ScrollViewer { Content = panel, VerticalScrollBarVisibility = ScrollBarVisibility.Auto });
            panel.Children.Add(Label("Add to Calendar", 24, "Text")); panel.Children.Add(Label("Saved on this PC in TMA-Mail. This does not send invitations or change your email provider's calendar. Times use your PC time zone.", 12, "Muted"));
            var title = TextField(panel, "Title", "", false);
            panel.Children.Add(Label("Start date", 12, "Muted")); var startDate = EventDatePicker(); panel.Children.Add(startDate);
            var startTime = TextField(panel, "Start time (24-hour HH:mm)", "09:00", false);
            panel.Children.Add(Label("End date", 12, "Muted")); var endDate = EventDatePicker(); panel.Children.Add(endDate);
            var endTime = TextField(panel, "End time (24-hour HH:mm)", "10:00", false);
            var location = TextField(panel, "Location", "", false); var repeat = Choice(panel, "Repeat", "None", new[] { "None", "Daily", "Weekly", "Monthly", "Yearly" });
            var count = TextField(panel, "Number of occurrences (including first)", "12", false); count.IsEnabled = false; repeat.SelectionChanged += delegate { count.IsEnabled = Value(repeat) != "None"; };
            var status = Label("", 12, "Muted"); panel.Children.Add(status); var cancel = Action("Cancel", false); var save = Action("Add event", true); row.Children.Add(cancel); row.Children.Add(save); cancel.Click += delegate { dialog.Close(); };
            save.Click += async delegate {
                save.IsEnabled = false; CalendarSource added = null; await calendarGate.WaitAsync();
                try {
                    DateTime from, until; var culture = System.Globalization.CultureInfo.InvariantCulture;
                    if (!startDate.SelectedDate.HasValue || !endDate.SelectedDate.HasValue || !DateTime.TryParseExact(startTime.Text.Trim(), "HH:mm", culture, System.Globalization.DateTimeStyles.None, out from) || !DateTime.TryParseExact(endTime.Text.Trim(), "HH:mm", culture, System.Globalization.DateTimeStyles.None, out until)) throw new ArgumentException("Choose start/end dates and times in HH:mm format.");
                    int number = 1; if (Value(repeat) != "None" && !Int32.TryParse(count.Text, out number)) throw new ArgumentException("Enter a whole number of occurrences.");
                    var start = startDate.SelectedDate.Value.Date + from.TimeOfDay; var end = endDate.SelectedDate.Value.Date + until.TimeOfDay;
                    string ics = CalendarImport.CreateEvent(title.Text, start, end, location.Text, Value(repeat), number); CalendarImport.Validate(ics); await EnsureCalendars();
                    added = new CalendarSource { Id = Guid.NewGuid().ToString("N"), Name = "Local · " + title.Text.Trim(), Email = "Local calendar", Ics = ics }; calendarSources.Add(added); await SaveCalendars(); calendarMonth = new DateTime(start.Year, start.Month, 1); RenderCalendarMonth(); dialog.Close();
                } catch (Exception ex) { if (added != null) calendarSources.Remove(added); status.Text = "Event could not be saved: " + ex.Message; } finally { calendarGate.Release(); save.IsEnabled = true; }
            }; dialog.ShowDialog();
        }
        private DatePicker EventDatePicker() {
            var picker = new DatePicker { SelectedDate = DateTime.Today, Margin = new Thickness(0, 4, 0, 8), Foreground = Theme.B("Text"), Background = Theme.B("Surface") };
            var style = new Style(typeof(System.Windows.Controls.Primitives.DatePickerTextBox)); style.Setters.Add(new Setter(Control.ForegroundProperty, Theme.B("Text"))); style.Setters.Add(new Setter(Control.BackgroundProperty, Theme.B("Surface"))); style.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(8))); style.Setters.Add(new Setter(Control.MinHeightProperty, 38.0)); picker.Resources[typeof(System.Windows.Controls.Primitives.DatePickerTextBox)] = style; return picker;
        }
        private async Task EnsureCalendars() { if (calendarSources != null) return; string path = Path.Combine(dataDirectory, "calendars.protected"); var loaded = await Task.Run(() => File.Exists(path) ? new JavaScriptSerializer { MaxJsonLength = 67108864 }.Deserialize<List<CalendarSource>>(ProtectedFile.Read(path)) : new List<CalendarSource>()); if (calendarSources == null) calendarSources = loaded ?? new List<CalendarSource>(); }
        private async Task SaveCalendars() { var snapshot = calendarSources.ToList(); await Task.Run(() => ProtectedFile.Write(Path.Combine(dataDirectory, "calendars.protected"), new JavaScriptSerializer { MaxJsonLength = 67108864 }.Serialize(snapshot))); }
        private void ShowCalendarView() {
            if (calendarPage == null) {
                var root = new DockPanel { Margin = new Thickness(24) }; calendarPage = root; Grid.SetRow(root, 1); suiteCenter.Children.Add(root);
                var top = new DockPanel { Margin = new Thickness(0, 0, 0, 16) }; DockPanel.SetDock(top, Dock.Top); root.Children.Add(top);
                var controls = new StackPanel { Orientation = Orientation.Horizontal }; DockPanel.SetDock(controls, Dock.Right); top.Children.Add(controls);
                foreach (string action in new[] { "‹", "Today", "›", "Import calendars" }) { string choice = action; var button = Action(action, false); button.Click += delegate { if (choice == "Import calendars") ShowSettings("Calendar"); else { calendarMonth = choice == "Today" ? new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1) : calendarMonth.AddMonths(choice == "‹" ? -1 : 1); RenderCalendarMonth(); } }; controls.Children.Add(button); }
                calendarHeading = Label("Calendar", 25, "Text"); top.Children.Add(calendarHeading);
                calendarStatus = Label("", 12, "Muted"); DockPanel.SetDock(calendarStatus, Dock.Bottom); root.Children.Add(calendarStatus);
                calendarDays = new Grid(); for (int i = 0; i < 7; i++) calendarDays.ColumnDefinitions.Add(new ColumnDefinition()); calendarDays.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); for (int i = 0; i < 6; i++) calendarDays.RowDefinitions.Add(new RowDefinition()); root.Children.Add(calendarDays);
            }
            mailArea.Visibility = Visibility.Collapsed; calendarPage.Visibility = Visibility.Visible; Find<TextBox>("SearchBox").IsEnabled = false; UpdateCalendarButtons(); RenderCalendarMonth();
        }
        private async void RenderCalendarMonth() {
            if (calendarDays == null) return; int generation = ++calendarGeneration; DateTime month = calendarMonth; calendarHeading.Text = month.ToString("MMMM yyyy"); calendarStatus.Text = "Loading calendars…";
            try {
                await EnsureCalendars(); var sources = calendarSources.ToList(); var entries = await Task.Run(() => CalendarImport.Month(sources, month)); if (generation != calendarGeneration) return;
                calendarDays.Children.Clear(); int firstDay = preferences.CalendarMonday ? 1 : 0; string[] days = { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
                for (int i = 0; i < 7; i++) { var label = Label(days[(i + firstDay) % 7], 12, "Muted"); Grid.SetColumn(label, i); calendarDays.Children.Add(label); }
                DateTime date = month.AddDays(-((7 + (int)month.DayOfWeek - firstDay) % 7));
                for (int i = 0; i < 42; i++, date = date.AddDays(1)) {
                    DateTime captured = date; var dayEvents = entries.Where(e => e.Start.Date <= captured && (e.End > captured || e.Start.Date == captured)).ToList();
                    var panel = new StackPanel(); panel.Children.Add(new TextBlock { Text = date.Day.ToString(), FontWeight = FontWeights.SemiBold, Foreground = date.Date == DateTime.Today ? Brush("#75D49B") : Brush(date.Month == month.Month ? "Text" : "Muted"), Margin = new Thickness(0, 0, 0, 5) });
                    foreach (var item in dayEvents.Take(3)) panel.Children.Add(new TextBlock { Text = (item.AllDay ? "" : item.Start.ToString("HH:mm") + " ") + item.Summary, FontSize = 11, TextTrimming = TextTrimming.CharacterEllipsis, Foreground = Brush("#75D49B"), ToolTip = item.Summary });
                    if (dayEvents.Count > 3) panel.Children.Add(Label("+" + (dayEvents.Count - 3) + " more", 10, "Muted"));
                    var button = Action("", false); button.Content = panel; button.Margin = new Thickness(3); button.Padding = new Thickness(10); button.HorizontalContentAlignment = HorizontalAlignment.Stretch; button.VerticalContentAlignment = VerticalAlignment.Top; button.Click += delegate { ShowCalendarDay(captured, dayEvents); }; Grid.SetColumn(button, i % 7); Grid.SetRow(button, 1 + i / 7); calendarDays.Children.Add(button);
                }
                calendarStatus.Text = sources.Count == 0 ? "Import an exported calendar or a calendar invitation to get started." : sources.Count + " calendars · imports are read-only · new events are saved locally · PC time zone";
            } catch (Exception ex) { calendarStatus.Text = "Calendar could not load: " + ex.Message; }
        }
        private void ShowCalendarDay(DateTime date, List<CalendarEntry> entries) { var dialog = Dialog(date.ToString("dddd, d MMMM yyyy"), 620, 580); var panel = new StackPanel { Margin = new Thickness(24) }; dialog.Content = new ScrollViewer { Content = panel, VerticalScrollBarVisibility = ScrollBarVisibility.Auto }; panel.Children.Add(Label(date.ToString("D"), 22, "Text")); if (entries.Count == 0) panel.Children.Add(Label("No events", 14, "Muted")); foreach (var entry in entries) { panel.Children.Add(Label(entry.Summary, 17, "Text")); panel.Children.Add(Label((entry.AllDay ? "All day" : entry.Start.ToString("g") + " – " + entry.End.ToString("g")) + " · " + entry.Source + "\n" + entry.Location + "\n" + entry.Description, 13, "Muted")); } dialog.ShowDialog(); }
        private StackPanel CalendarSettings(Window owner) {
            var panel = SettingsSection("Calendars", "Import Outlook, Google or iCloud .ics exports, HTTPS calendar links, or invitations received in your mailbox. Imports are read-only snapshots and take effect immediately; they do not change your provider calendar.");
            var accounts = Choice(panel, "Associate imported calendar with", activeAccount == null ? "Local calendar" : activeAccount.Email, mailAccounts.Select(a => a.Email).Concat(new[] { "Local calendar" }).ToArray());
            var row = new WrapPanel(); panel.Children.Add(row); var file = Action("Import .ics file", true); var mail = Action("Import from mail invitations", false); row.Children.Add(file); row.Children.Add(mail);
            var url = TextField(panel, "Calendar export URL (HTTPS / webcal)", "", false); var link = Action("Import calendar link", false); panel.Children.Add(link);
            var status = Label("", 12, "Muted"); panel.Children.Add(status); var list = new StackPanel(); panel.Children.Add(list);
            Action render = null; render = delegate { list.Children.Clear(); foreach (var source in calendarSources ?? new List<CalendarSource>()) { var captured = source; var card = new StackPanel { Margin = new Thickness(0, 8, 0, 10) }; card.Children.Add(Label(source.Name + " · " + source.Email, 14, "Text")); var remove = Action("Remove imported calendar", false); remove.Click += async delegate { await calendarGate.WaitAsync(); try { calendarSources.Remove(captured); await SaveCalendars(); render(); RenderCalendarMonth(); } finally { calendarGate.Release(); } }; card.Children.Add(remove); list.Children.Add(card); } };
            Func<string, string, string, Task> import = async delegate(string text, string name, string sourceUrl) { await calendarGate.WaitAsync(); try { await Task.Run(() => CalendarImport.Validate(text)); await EnsureCalendars(); string email = Value(accounts); if (calendarSources.Any(s => s.Email == email && s.Ics == text)) { status.Text = "This calendar is already imported."; return; } if (sourceUrl != null) calendarSources.RemoveAll(s => s.Url == sourceUrl && s.Email == email); calendarSources.Add(new CalendarSource { Id = Guid.NewGuid().ToString("N"), Name = name, Email = email, Ics = text, Url = sourceUrl }); await SaveCalendars(); render(); status.Text = "Calendar imported."; RenderCalendarMonth(); } finally { calendarGate.Release(); } };
            file.Click += async delegate { var picker = new OpenFileDialog { Filter = "iCalendar (*.ics)|*.ics" }; if (picker.ShowDialog(owner) != true) return; try { if (new FileInfo(picker.FileName).Length > 5000000) throw new InvalidDataException("Choose a calendar file of at most 5 MB."); string text = await Task.Run(() => File.ReadAllText(picker.FileName)); await import(text, Path.GetFileNameWithoutExtension(picker.FileName), null); } catch (Exception ex) { status.Text = ex.Message; } };
            link.Click += async delegate { link.IsEnabled = false; try { string address = url.Text.Trim(); if (address.StartsWith("webcal://", StringComparison.OrdinalIgnoreCase)) address = "https://" + address.Substring(9); string text = await SafeWeb.GetText(address, 5000000); await import(text, "Imported calendar", address); } catch (Exception ex) { status.Text = ex.Message; } finally { link.IsEnabled = true; } };
            mail.Click += async delegate { try { var target = mailAccounts.FirstOrDefault(a => a.Email == Value(accounts)); if (target == null) throw new InvalidOperationException("Select an email account first."); var mailbox = await GetMailboxAsync(target); var attachments = mailbox.Messages.SelectMany(m => (m.Attachments ?? new List<MailAttachment>()).Where(a => a.Name.EndsWith(".ics", StringComparison.OrdinalIgnoreCase))).ToList(); if (attachments.Count == 0) { status.Text = "No calendar attachments in the cached messages. You can import a provider .ics export instead."; return; } foreach (var attachment in attachments) await import(System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(attachment.Data)), attachment.Name, null); status.Text = attachments.Count + " invitations imported."; } catch (Exception ex) { status.Text = ex.Message; } };
            panel.Loaded += async delegate { try { await EnsureCalendars(); render(); } catch (Exception ex) { status.Text = ex.Message; } }; return panel;
        }
    }
}
