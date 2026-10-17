using System;
using System.Linq;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
namespace Postbox {
    public partial class App {
        private bool calendarSyncRunning;
        private Func<MailAccount, CalendarProviderClient> calendarClientFactory = account => new CalendarProviderClient(account);
        private bool calendarSyncCommitted;
        private bool CalendarSyncEnabled { get { return preferences.CalendarProviderSync && calendarSyncCommitted; } }
        private DispatcherTimer calendarProviderTimer;
        private readonly Dictionary<string, DateTime> calendarReadMonths = new Dictionary<string, DateTime>();
        private void ShowExportToProvider(CalendarSource source) {
            var dialog = Dialog("Export events · TMA-Mail", 560, 380); var panel = new StackPanel { Margin = new Thickness(24) }; dialog.Content = panel;
            panel.Children.Add(Label("Copy " + source.Name + " to a provider calendar", 22, "Text")); panel.Children.Add(Label("Copies events into the selected connected calendar. Local originals remain. Events queue on this PC until Calendar sync is enabled and saved.", 12, "Muted"));
            var targets = new ComboBox { ItemsSource = calendarSources.Where(c => c.Login != null && c.Writable).ToList(), SelectedIndex = 0 }; panel.Children.Add(targets); var status = Label("", 12, "Muted"); panel.Children.Add(status); var queue = Action("Queue calendar export", true); panel.Children.Add(queue);
            queue.Click += async delegate { var target = targets.SelectedItem as CalendarSource; if (target == null) { status.Text = "Connect a writable provider calendar first."; return; } queue.IsEnabled = false; await calendarGate.WaitAsync(); var additions = new List<string>(); string oldIcs = target.Ics; try { if (target.Pending == null) target.Pending = new List<string>(); var prepared = await Task.Run(() => { var seen = new HashSet<string>(target.UploadedIds ?? new List<string>()); foreach (var pending in target.Pending) seen.Add(Ical.Net.Calendar.Load(pending).Events.Single().Uid); var result = new List<string>(); foreach (System.Text.RegularExpressions.Match match in System.Text.RegularExpressions.Regex.Matches(source.Ics ?? "", @"BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT")) { string item = CalendarImport.Append(CalendarImport.Empty, match.Value); if (seen.Add(Ical.Net.Calendar.Load(item).Events.Single().Uid)) result.Add(item); } return result; }); foreach (var item in prepared) { target.Pending.Add(item); target.Ics = CalendarImport.Append(target.Ics, item); additions.Add(item); } await SaveCalendars(); status.Text = additions.Count + " events queued."; dialog.Close(); } catch (Exception ex) { foreach (var item in additions) target.Pending.Remove(item); target.Ics = oldIcs; status.Text = ex.Message; } finally { calendarGate.Release(); queue.IsEnabled = true; } if (CalendarSyncEnabled) await SynchronizeCalendar(target); }; dialog.ShowDialog();
        }
        private void StartCalendarProviderTimer() { calendarSyncCommitted = preferences.CalendarProviderSync; calendarProviderTimer = new DispatcherTimer { Interval = TimeSpan.FromMinutes(2) }; calendarProviderTimer.Tick += async delegate { try { if (!CalendarSyncEnabled || offlinePreview) return; await EnsureCalendars(); foreach (var source in calendarSources.Where(c => c.Login != null).ToList()) { if (!CalendarSyncEnabled) break; await SynchronizeCalendar(source); } } catch (Exception ex) { Status("Calendar sync could not start: " + ex.Message); } }; calendarProviderTimer.Start(); window.Closed += delegate { calendarProviderTimer.Stop(); }; }
        private async Task SynchronizeCalendar(CalendarSource source, bool downloadRequested = false) {
            if (offlinePreview || (!downloadRequested && !CalendarSyncEnabled)) { Status("Calendar provider sync is paused. Enable it and Save changes in Settings → Calendar."); return; }
            if (source.Login == null) { Status("This calendar is local or an imported snapshot. Connect a provider calendar in Settings → Calendar."); return; }
            if (calendarSyncRunning) return; calendarSyncRunning = true; await calendarGate.WaitAsync();
            try {
                Status("Syncing calendar · " + source.Email + " · " + source.Name);
                DateTime requestedMonth = calendarMonth;
                using (var client = calendarClientFactory(source.Login)) {
                    foreach (string pending in (CalendarSyncEnabled ? source.Pending ?? new List<string>() : new List<string>()).ToList()) { if (!CalendarSyncEnabled) return; await client.Upload(source, pending); if (source.UploadedIds == null) source.UploadedIds = new List<string>(); string uid = Ical.Net.Calendar.Load(pending).Events.Single().Uid; if (!source.UploadedIds.Contains(uid)) source.UploadedIds.Add(uid); source.Pending.Remove(pending); await SaveCalendars(); }
                    if (!downloadRequested && !CalendarSyncEnabled) return; string text = await client.Read(source, requestedMonth); source.Ics = text; foreach (var pending in source.Pending ?? new List<string>()) source.Ics = CalendarImport.Append(source.Ics, pending); await SaveCalendars(); calendarReadMonths[source.Id] = requestedMonth; Status("Calendar up to date · " + source.Email + " · " + source.Name); RenderCalendarMonth();
                }
            } catch (Exception ex) { string error = "Calendar sync interrupted · " + ex.Message + " · cached and queued events kept locally"; Status(error); if (calendarStatus != null) calendarStatus.Text = error; }
            finally { calendarGate.Release(); calendarSyncRunning = false; }
        }
        private void ShowConnectCalendar() {
            var dialog = Dialog("Connect calendar · TMA-Mail", 580, 650); dialog.MinWidth = 480; dialog.MinHeight = 500; var root = new StackPanel { Margin = new Thickness(24) }; dialog.Content = new ScrollViewer { Content = root, VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
            root.Children.Add(Label("Connect a provider calendar", 23, "Text")); root.Children.Add(Label("Outlook/Google ask for calendar consent in your browser. iCloud uses an app-specific password. Connections are saved encrypted for your Windows user. Newly created events upload only when Calendar sync is enabled.", 12, "Muted"));
            var provider = Choice(root, "Provider", activeAccount == null || !new[] { "Microsoft", "Gmail", "iCloud" }.Contains(activeAccount.Provider) ? "iCloud" : activeAccount.Provider, new[] { "Microsoft", "Gmail", "iCloud" });
            var email = TextField(root, "iCloud email address", activeAccount != null && activeAccount.Provider == "iCloud" ? activeAccount.Email : "", false); FieldLabel(root, "iCloud app-specific password (leave blank to use this mailbox's saved app password)"); var password = new PasswordBox { Padding = new Thickness(10), Margin = new Thickness(0, 4, 0, 12) }; root.Children.Add(password);
            var status = Label("", 12, "Muted"); root.Children.Add(status); var discover = Action("Sign in and list calendars", true); root.Children.Add(discover);
            root.Children.Add(Label("Choose calendars to add", 14, "Text"));
            var choices = UiPolish.CalendarChoices(); choices.Margin = new Thickness(0, 8, 0, 12); root.Children.Add(choices);
            var selectionActions = new WrapPanel(); root.Children.Add(selectionActions); var selectAll = Action("Select all", false); var clear = Action("Clear selection", false); selectionActions.Children.Add(selectAll); selectionActions.Children.Add(clear);
            var selectedCount = Label("No calendars selected", 12, "Muted"); root.Children.Add(selectedCount);
            var add = Action("Add selected calendars", true); var addAll = Action("Add all calendars", false); root.Children.Add(add); root.Children.Add(addAll);
            bool busy = false; Action updateSelection = delegate { int count = choices.SelectedItems.Count; selectedCount.Text = count + " of " + choices.Items.Count + " calendars selected"; add.IsEnabled = !busy && count > 0; addAll.IsEnabled = selectAll.IsEnabled = clear.IsEnabled = !busy && choices.Items.Count > 0; };
            choices.SelectionChanged += delegate { updateSelection(); }; selectAll.Click += delegate { choices.SelectAll(); }; clear.Click += delegate { choices.UnselectAll(); };
            var cancellation = new CancellationTokenSource(); dialog.Closed += delegate { cancellation.Cancel(); }; Action showFields = delegate { bool apple = Value(provider) == "iCloud"; email.IsEnabled = password.IsEnabled = apple; choices.ItemsSource = null; updateSelection(); }; provider.SelectionChanged += delegate { showFields(); }; showFields();
            discover.Click += async delegate {
                if (offlinePreview) { status.Text = "Provider connections are disabled in the offline preview."; return; } busy = true; discover.IsEnabled = provider.IsEnabled = choices.IsEnabled = false; choices.ItemsSource = null; updateSelection();
                try {
                    var login = new MailAccount { Id = Guid.NewGuid().ToString("N"), Provider = Value(provider) };
                    if (login.Provider == "iCloud") { login.Email = WelcomeFlow.ValidateEmail(email.Text); login.Password = password.Password; if (String.IsNullOrEmpty(login.Password)) { var saved = mailAccounts.FirstOrDefault(a => a.Provider == "iCloud" && String.Equals(a.Email, login.Email, StringComparison.OrdinalIgnoreCase)); if (saved != null) login.Password = saved.Password; } if (String.IsNullOrEmpty(login.Password)) throw new ArgumentException("Enter an iCloud app-specific password."); }
                    else await ProviderLogin.SignIn(login, ProviderConfiguration.Load(), cancellation.Token, true);
                    using (var client = calendarClientFactory(login)) { var found = await client.Discover(); cancellation.Token.ThrowIfCancellationRequested(); choices.ItemsSource = found; status.Text = found.Count + " calendars found. Select any number or add all; read-only calendars can be viewed but cannot receive new events."; }
                } catch (OperationCanceledException) { } catch (Exception ex) { status.Text = "Calendar connection failed: " + ex.Message; } finally { busy = false; discover.IsEnabled = provider.IsEnabled = choices.IsEnabled = true; updateSelection(); }
            };
            Func<List<CalendarSource>, Task> addCalendars = async selected => {
                if (busy || selected.Count == 0) return; busy = true; discover.IsEnabled = provider.IsEnabled = choices.IsEnabled = false; updateSelection();
                var connected = new List<CalendarSource>(); await calendarGate.WaitAsync(); List<CalendarSource> previous = null;
                try {
                    await EnsureCalendars(); previous = calendarSources.ToList();
                    foreach (var source in selected) {
                        var existing = calendarSources.FirstOrDefault(c => c.Provider == source.Provider && String.Equals(c.Email, source.Email, StringComparison.OrdinalIgnoreCase) && c.RemoteId == source.RemoteId);
                        if (existing != null) { source.Id = existing.Id; source.Ics = existing.Ics; source.Pending = existing.Pending; source.UploadedIds = existing.UploadedIds; calendarSources[calendarSources.IndexOf(existing)] = source; }
                        else calendarSources.Add(source);
                        connected.Add(source);
                    }
                    await SaveCalendars(); selectedCalendarId = connected.Count > 1 ? "__all" : connected[0].Id; dialog.Close(); RenderCalendarMonth();
                } catch (Exception ex) { if (previous != null) calendarSources = previous; status.Text = "Calendars could not be added: " + ex.Message; connected.Clear(); }
                finally { calendarGate.Release(); busy = false; discover.IsEnabled = provider.IsEnabled = choices.IsEnabled = true; updateSelection(); }
                foreach (var source in connected) await SynchronizeCalendar(source, true);
            };
            add.Click += async delegate { await addCalendars(choices.SelectedItems.Cast<CalendarSource>().ToList()); };
            addAll.Click += async delegate { await addCalendars(choices.Items.Cast<CalendarSource>().ToList()); };
            dialog.ShowDialog();
        }
    }
}
