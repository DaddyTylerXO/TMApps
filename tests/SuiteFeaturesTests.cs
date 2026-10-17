using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Postbox;
using MimeKit;
class SuiteFeaturesTests {
    static int checks;
    static void Check(bool value, string name) { if (!value) throw new Exception(name); checks++; }
    static object Get(object value, string field) { return value.GetType().GetField(field, BindingFlags.NonPublic | BindingFlags.Instance).GetValue(value); }
    static object Call(object value, string method, params object[] args) { return value.GetType().GetMethod(method, BindingFlags.NonPublic | BindingFlags.Instance).Invoke(value, args); }
    static void Reject(Action action, string name) { bool failed = false; try { action(); } catch { failed = true; } Check(failed, name); }
    class Handler : HttpMessageHandler { public string Method, Body; protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation) { Method = request.Method.Method; Body = await request.Content.ReadAsStringAsync(); return new HttpResponseMessage(HttpStatusCode.OK); } }
    static void Layout(Window window) { var root = (FrameworkElement)window.Content; root.Measure(new Size(1180, 850)); root.Arrange(new Rect(0, 0, 1180, 850)); root.UpdateLayout(); }
    [STAThread] static void Main(string[] args) {
        Check(new SyncProgress { Completed = 600, Total = 1200 }.ItemsText == "600 / 1200 items · 50%", "Sync percentage is incorrect");
        Check(new SyncProgress { Completed = 395, Total = 1027 }.ItemsText.EndsWith("38%"), "Sync percentage rounding is incorrect");
        Check(new SyncProgress { Completed = 1200, Total = 1200 }.ItemsText.EndsWith("100%"), "Finished sync does not show 100%");
        Check(new SyncProgress { Completed = 2, Total = 0 }.ItemsText == "", "Unknown sync total shows a percentage");
        Check(new SyncProgress { Completed = -1, Total = 10 }.ItemsText.StartsWith("0 / 10"), "Sync progress fell below zero");
        Check(new SyncProgress { Completed = 20, Total = 10 }.ItemsText == "10 / 10 items · 100%", "Sync progress exceeded 100%");
        var defaults = new Preferences(); Check(!defaults.AutoMarkRead && defaults.CalendarMonday, "Reading/week defaults wrong"); Check(defaults.ReceiveSound == "Cozy" && defaults.SendSound == "Cozy", "Cozy defaults missing");
        Check(!SoundCatalog.Choices.Intersect(new[] { "Notification", "Chime", "Exclamation" }).Any() && SoundCatalog.Choices.Contains("None"), "Legacy Windows sounds still offered");
        defaults.ReceiveSound = "Notification"; defaults.SendSound = "Chime"; defaults.Normalize(); Check(defaults.ReceiveSound == "Cozy" && defaults.SendSound == "Cozy", "Legacy sound settings were not migrated");
        string localIcs = CalendarImport.CreateEvent("Coffee, planning; notes\nBEGIN:VEVENT", new DateTime(2026, 10, 20, 9, 30, 0), new DateTime(2026, 10, 20, 10, 30, 0), "Studio, upstairs", "Weekly", 3);
        CalendarImport.Validate(localIcs); var localEvents = CalendarImport.Month(new[] { new CalendarSource { Name = "Local", Ics = localIcs } }, new DateTime(2026, 10, 1));
        Check(localEvents.Count == 3 && localEvents[0].Start.Hour == 9 && localEvents[0].Location == "Studio, upstairs" && localEvents[0].Summary.Contains("\nBEGIN:VEVENT"), "Created event lost recurrence, time or escaped text");
        Reject(() => CalendarImport.CreateEvent("", DateTime.Today, DateTime.Today.AddHours(1), "", "None", 1), "Empty event accepted");
        Reject(() => CalendarImport.CreateEvent("Bad", DateTime.Today, DateTime.Today, "", "None", 1), "Invalid duration accepted");
        string everyFour = CalendarImport.CreateEvent("All-day series", new DateTime(2026, 10, 20), new DateTime(2026, 10, 21), "", "Daily", 3, true, 4, 10080);
        var fourDays = CalendarImport.Month(new[] { new CalendarSource { Id = "four", Ics = everyFour } }, new DateTime(2026, 10, 1)); Check(fourDays.Count == 3 && fourDays.All(e => e.AllDay && e.ReminderMinutes == 10080) && (fourDays[1].Start - fourDays[0].Start).Days == 4, "All-day custom interval or week reminder lost");
        Check(CalendarImport.Month(new[] { new CalendarSource { Ics = CalendarImport.Append(CalendarImport.Empty, everyFour) } }, new DateTime(2026, 10, 1)).Count == 3, "Appending event to named empty calendar failed");
        Check(CalendarImport.Month(new[] { new CalendarSource { Ics = CalendarImport.Append(everyFour, everyFour) } }, new DateTime(2026, 10, 1)).Count == 3, "Overlapping provider ranges duplicated calendar events");
        Check(App.ParseReminderChoice("At exact time", "") == 0 && App.ParseReminderChoice("2 days before", "") == 2880 && App.ParseReminderChoice("Custom", "17") == 17, "Reminder choices incorrect"); Reject(() => App.ParseReminderChoice("Custom", "bad"), "Invalid custom reminder accepted");
        Check(defaults.CalendarReminders && defaults.CalendarReminderPopup && defaults.CalendarReminderDesktop && !defaults.CalendarProviderSync, "Calendar reminder/sync defaults wrong");
        foreach (var name in SoundCatalog.Cozy) foreach (bool sent in new[] { false, true }) { byte[] wav = File.ReadAllBytes(SoundCatalog.PathFor(name, sent)); Check(System.Text.Encoding.ASCII.GetString(wav, 0, 4) == "RIFF" && wav.Length > 10000, "Bundled sound invalid"); }
        Check(!File.ReadAllBytes(SoundCatalog.PathFor("Cozy", false)).SequenceEqual(File.ReadAllBytes(SoundCatalog.PathFor("Cozy", true))), "Send and receive sounds are identical");
        var headers = new HeaderList(); headers.Add("List-Id", "Weekly notes <notes.example.com>"); headers.Add("List-Unsubscribe", "<mailto:leave@example.com>, <https://example.com/unsubscribe?token=synthetic>"); headers.Add("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
        var subscription = SubscriptionHeaders.Parse(headers, "notes@example.com", "Weekly notes"); Check(subscription != null && subscription.OneClick && subscription.Url.StartsWith("https://"), "Subscription headers not discovered");
        var handler = new Handler(); SubscriptionHeaders.Request(subscription, handler).GetAwaiter().GetResult(); Check(handler.Method == "POST" && handler.Body == "List-Unsubscribe=One-Click", "Unsubscribe request does not use the explicit POST form");
        var plainHeaders = new HeaderList(); plainHeaders.Add("List-Unsubscribe", "<mailto:leave@example.com>"); Check(!SubscriptionHeaders.Parse(plainHeaders, "a@example.com", "A").OneClick, "Mailto incorrectly supports bulk one-click");
        Reject(() => SafeWeb.Https("http://example.com"), "Plain HTTP accepted"); Reject(() => SafeWeb.Https("https://localhost"), "Local unsubscribe endpoint accepted"); Reject(() => SafeWeb.Https("https://name:password@example.com"), "URL credentials accepted");
        var plugin = PluginManifest.Parse("{\"Id\":\"calendar-tool\",\"Name\":\"Calendar tool\",\"Version\":\"1.0\",\"Url\":\"https://example.com/tool\"}"); Check(plugin.Enabled && plugin.Name == "Calendar tool", "Plug-in manifest not parsed");
        Reject(() => PluginManifest.Parse("{\"Id\":\"../escape\",\"Name\":\"Bad\",\"Url\":\"https://example.com\"}"), "Invalid plugin id accepted"); Reject(() => PluginManifest.Parse("{\"Id\":\"bad\",\"Name\":\"Bad\",\"Url\":\"file:///C:/private\"}"), "Executable/local plugin URL accepted");
        Check(UpdateManifest.Parse("{\"Version\":\"0.10.0\",\"DownloadUrl\":\"https://github.com/DaddyTylerXO/TMApps/raw/refs/heads/TMA-Mail/dist/app.zip\"}").Version == "0.10.0", "Update manifest invalid");
        string ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TMA-Mail Tests//EN\r\nBEGIN:VEVENT\r\nUID:weekly\r\nDTSTART:20261012T090000Z\r\nDTEND:20261012T100000Z\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE:20261019T090000Z\r\nSUMMARY:Weekly catch-up\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:all-day\r\nDTSTART;VALUE=DATE:20261022\r\nDTEND;VALUE=DATE:20261023\r\nSUMMARY:Day off\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:tz\r\nDTSTART;TZID=Europe/London:20261020T100000\r\nDTEND;TZID=Europe/London:20261020T110000\r\nSUMMARY:London time\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        CalendarImport.Validate(ics); var entries = CalendarImport.Month(new[] { new CalendarSource { Name = "Synthetic", Ics = ics } }, new DateTime(2026, 10, 1));
        Check(entries.Count(e => e.Summary == "Weekly catch-up") == 3, "Recurring calendar or EXDATE incorrect"); Check(entries.Single(e => e.AllDay).Start.Day == 22, "All-day date shifted"); Check(entries.Single(e => e.Summary == "London time").Start.ToUniversalTime().Hour == 9, "Calendar time zone not preserved"); Reject(() => CalendarImport.Validate("not a calendar"), "Invalid calendar accepted");
        var floating = CalendarImport.Month(new[] { new CalendarSource { Name = "Floating", Ics = ics.Replace("DTSTART;TZID=Europe/London:", "DTSTART:").Replace("DTEND;TZID=Europe/London:", "DTEND:") } }, new DateTime(2026, 10, 1)); Check(floating.Single(e => e.Summary == "London time").Start.Hour == 10, "Floating local event time shifted with daylight saving");
        string directory = args[1]; Directory.CreateDirectory(directory); var account = ProviderChoices.Account("Other IMAP"); account.Email = "reader@example.com"; account.Password = "synthetic"; account.ImapHost = "127.0.0.1"; account.SmtpHost = "127.0.0.1"; account.Validate(); account.Folders = new List<ServerFolder> { new ServerFolder { Name = "Inbox", Path = "INBOX", LocalName = "Inbox", Count = 100, Unread = 20, Selectable = true } }; new AccountStore(directory).Save(account, true);
        var saved = new MailStore(Path.Combine(directory, "mail-" + account.Id + ".protected"), true, false); saved.Messages.Add(new Message { Id = "sample", AccountId = account.Id, Folder = "Inbox", RemoteFolder = "INBOX", RemoteUid = 0, Unread = true, Sender = "Team", Address = "team@example.com", To = account.Email, Subject = "Read test", Body = "Synthetic body", Date = DateTime.Now }); saved.Save();
        // These harnesses initialize WPF without Application.Run; use its UI context explicitly.
        System.Threading.SynchronizationContext.SetSynchronizationContext(new System.Windows.Threading.DispatcherSynchronizationContext(System.Windows.Threading.Dispatcher.CurrentDispatcher));
        var app = new App(); Call(app, "Initialize"); var window = (Window)Get(app, "window"); var prefs = (Preferences)Get(app, "preferences"); var liveAccount = (MailAccount)Get(app, "activeAccount"); var mailbox = (MailStore)Get(app, "store"); var message = mailbox.Messages.Single(); var list = (ListBox)window.FindName("MessageList");
        list.SelectedItem = null; list.SelectedItem = message; Check(message.Unread && liveAccount.Folders[0].Unread == 20, "Opening mail marked it read by default");
        prefs.AutoMarkRead = true; list.SelectedItem = null; list.SelectedItem = message; Check(!message.Unread && liveAccount.Folders[0].Unread == 19 && ((Button)window.FindName("InboxNav")).Content.ToString().Contains("19"), "Auto read did not update live unread count");
        Call(app, "ToggleSelectedRead"); Check(message.Unread && liveAccount.Folders[0].Unread == 20, "Mark unread did not update live count");
        Check(window.TaskbarItemInfo.Overlay != null && window.TaskbarItemInfo.Description.Contains("20 unread") && window.Icon is System.Windows.Media.Imaging.BitmapFrame, "Unread icon did not reflect mailbox count");
        liveAccount.Folders[0].Unread = 120; Call(app, "UpdateNavigationLabels"); Check(window.TaskbarItemInfo.Description.Contains("120 unread") && (int)Get(app, "lastUnreadBadge") == 120, "Large unread count missing");
        prefs.UnreadBadge = false; Call(app, "ApplyPreferences"); Check(window.TaskbarItemInfo.Overlay == null, "Disabling badge kept taskbar overlay"); prefs.UnreadBadge = true;
        liveAccount.Folders[0].Unread = 0; Call(app, "UpdateNavigationLabels"); Check(window.TaskbarItemInfo.Overlay == null, "Zero unread count kept badge");
        prefs.NotificationAddress = false; prefs.NotificationSubject = false; Check((string)Call(app, "NotificationDetail", "private@example.com", "Private subject") == "", "Notification hides neither private field");
        prefs.NotificationSubject = true; Check((string)Call(app, "NotificationDetail", "private@example.com", "Private subject") == "Private subject", "Address leaked into subject-only banner");
        prefs.NotificationSubject = false; prefs.NotificationAddress = true; Check((string)Call(app, "NotificationDetail", "private@example.com", "Private subject") == "private@example.com", "Subject leaked into address-only banner");
        Call(app, "PlaySound", "None", "", false); Check(Get(app, "soundPlayer") == null, "None created a sound player");
        Check(((FrameworkElement)((TextBlock)window.FindName("WorkspaceBadge")).Parent).Visibility == Visibility.Collapsed, "Connected mail badge still visible");
        Check(window.FindName("FooterSyncButton") != null && Get(app, "managementButton") != null && Get(app, "calendarButton") != null, "New navigation/footer actions missing");
        liveAccount.Folders[0].Name = "INBOX"; Check((string)Call(app, "FolderDisplayName", "Inbox") == "Inbox", "Inbox server casing leaked into menus");
        Call(app, "PopulateMessageContext", list.ContextMenu); var contextNames = list.ContextMenu.Items.OfType<MenuItem>().Select(i => i.Header.ToString()).ToList(); Check(contextNames.Contains("Copy") && contextNames.Contains("▧ Print") && contextNames.Contains("↶ Reply all") && contextNames.Contains("↪ Forward"), "Expanded message context actions missing");
        prefs.FastFunctions.Add(new FastFunction { Name = "File project", Action = "Move to folder", Destination = "Archive", AccountId = liveAccount.Id }); Call(app, "RenderFastFunctions"); var fastPanel = (WrapPanel)Get(app, "fastFunctionButtons"); ((Button)fastPanel.Children[0]).RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Check(message.Folder == "Archive", "Fast Function did not move selected message"); mailbox.Move(message, "Inbox"); Call(app, "Refresh", message.Id);
        prefs.MailToolbarHeight = 190; Call(app, "ApplyPreferences"); Check(((Grid)Get(app, "mailToolbarContainer")).Height == 190, "Toolbar height preference not applied");
        prefs.MailToolbarHeight = 128; Call(app, "ApplyPreferences"); Layout(window); var compactToolbar = ((Grid)Get(app, "mailToolbarContainer")).Children.OfType<ScrollViewer>().Single(); Check(compactToolbar.ScrollableWidth > 0 && compactToolbar.ScrollableHeight < 1, "Retracted toolbar: horizontal=" + compactToolbar.ScrollableWidth + ", vertical=" + compactToolbar.ScrollableHeight + ", viewport=" + compactToolbar.ViewportHeight + ", extent=" + compactToolbar.ExtentHeight); prefs.MailToolbarHeight = 176;
        var actionContainer = (Grid)Get(app, "mailToolbarContainer");
        foreach (double width in new double[] { 320, 540, 900, 1500 }) foreach (double height in new double[] { 128, 176, 220, 300 }) {
            actionContainer.Width = width; prefs.MailToolbarHeight = height; Call(app, "ApplyPreferences"); Layout(window); Layout(window);
            var actionContent = (StackPanel)compactToolbar.Content; var actions = (WrapPanel)actionContent.Children[0];
            Check(actionContent.DesiredSize.Height <= compactToolbar.ViewportHeight + 1, "Toolbar clips at " + width + "x" + height + ": content=" + actionContent.DesiredSize.Height + " viewport=" + compactToolbar.ViewportHeight);
            Check(actions.Children.OfType<Button>().All(b => b.Height == 32 && (b.Content.ToString() == "Edit Bar" || b.Background.ToString() == Theme.B("SidebarAccent").ToString())), "Toolbar action sizes/colours differ");
        }
        Check(((Button)window.FindName("StarButton")).Content.ToString() == "☆ Toggle Star", "Star action has no readable label");
        Check(((Button)Get(app, "managementButton")).Content.ToString() == "Mailbox Management", "Management caption is not title case");
        actionContainer.Width = Double.NaN; prefs.MailToolbarHeight = 176; Call(app, "ApplyPreferences"); Layout(window);
        app.ShutdownMode = ShutdownMode.OnExplicitShutdown; window.Show(); message.HtmlBody = "<p>Synthetic pop-out body</p>"; Call(app, "OpenMessageWindow", message, liveAccount, mailbox); var popped = app.Windows.Cast<Window>().First(w => w != window && w.Title.Contains(message.Subject)); Check(popped.Owner == window && popped.Content is DockPanel, "Message did not open in a separate owned window"); var popBody = (StackPanel)((DockPanel)popped.Content).Children.OfType<ScrollViewer>().Single().Content; Check(popBody.Children.OfType<HtmlMessageView>().Single().Visibility == Visibility.Visible, "Pop-out HTML reader remained collapsed"); popped.Close();
        prefs.CalendarProviderSync = true; Check(!(bool)typeof(App).GetProperty("CalendarSyncEnabled", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(app, null), "Unsaved preview enabled external calendar writes"); prefs.CalendarProviderSync = false;
        var tray = Get(app, "tray"); Func<bool> trayVisible = () => (bool)tray.GetType().GetProperty("Visible").GetValue(tray, null);
        Check(trayVisible(), "Tray icon missing while app window is open");
        Call(app, "HideToTray"); Check(trayVisible() && !window.IsVisible, "Hiding the window removed its tray icon");
        Call(app, "RestoreWindow"); Check(trayVisible() && window.IsVisible, "Restoring the window removed its tray icon");
        Call(app, "ShowTrayMenu"); var trayMenu = (ContextMenu)Get(app, "trayMenu"); trayMenu.UpdateLayout();
        Check(trayMenu.IsOpen && trayMenu.Items.Count == 3, "Custom tray menu did not open");
        foreach (MenuItem item in trayMenu.Items) { item.ApplyTemplate(); var bubble = item.Template.FindName("bubble", item) as System.Windows.Controls.Border; Check(bubble != null && bubble.CornerRadius.TopLeft == 19 && item.Background.ToString() == "#FF3A8C5E", "Tray action is not a green bubble"); }
        ((MenuItem)trayMenu.Items[0]).RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent)); Check(window.IsVisible && trayVisible() && !trayMenu.IsOpen, "Tray Open action did not restore and dismiss correctly");
        prefs.SpotifyPlacement = "Off"; Call(app, "ApplyPreferences"); Layout(window); var profile = (Button)window.FindName("AccountTop"); double y = profile.TranslatePoint(new Point(), (FrameworkElement)window.Content).Y;
        prefs.SpotifyPlacement = "Top"; Call(app, "ApplyPreferences"); Layout(window); Check(Math.Abs(profile.TranslatePoint(new Point(), (FrameworkElement)window.Content).Y - y) < 1, "Spotify lowered the profile button");
        var music = (FrameworkElement)Get(app, "spotify"); double musicRight = music.TranslatePoint(new Point(music.ActualWidth, 0), (FrameworkElement)window.Content).X; double profileLeft = profile.TranslatePoint(new Point(), (FrameworkElement)window.Content).X; Check(musicRight <= profileLeft, "Spotify overlaps profile button");
        Call(app, "ShowCalendarView"); Check(((Grid)Get(app, "mailArea")).Visibility == Visibility.Collapsed && ((FrameworkElement)Get(app, "calendarPage")).Visibility == Visibility.Visible, "Calendar did not replace mail view");
        Check(((Button)window.FindName("ComposeButton")).Content.ToString().Contains("Add to Calendar") && ((Button)Get(app, "calendarButton")).Content.ToString().Contains("Return to Mailbox"), "Calendar navigation labels did not switch");
        Call(app, "ApplyPreferences"); Check(((Button)Get(app, "calendarButton")).Content.ToString().Contains("Return to Mailbox"), "Settings reset calendar navigation");
        Call(app, "ShowMailView"); Check(((Grid)Get(app, "mailArea")).Visibility == Visibility.Visible && ((Button)window.FindName("ComposeButton")).Content.ToString().Contains("New Message"), "Could not return from calendar to mail");
        var original = new Message { Sender = "Sender", Address = "sender@example.com", To = "reader@example.com; colleague@example.com", Cc = "cc@example.com; reader@example.com", Subject = "Meeting", Body = "Hi" }; var composer = new ComposerWindow(prefs, mailbox, null, "replyAll", original); Check(((TextBox)Get(composer, "to")).Text.Contains("colleague@example.com") && !((TextBox)Get(composer, "to")).Text.Contains("reader@example.com") && ((TextBox)Get(composer, "cc")).Text == "cc@example.com", "Reply all recipients incorrect"); composer.Close();
        prefs.CloseToTray = true; ((MenuItem)trayMenu.Items[2]).RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent)); Check(!window.IsVisible && !trayVisible(), "Tray Exit did not close and dispose the icon"); app.Shutdown(); Console.WriteLine("Passed " + checks + " workspace-suite checks: read counts, layout, calendars, 14 sounds, plug-ins, updates, and intercepted unsubscribe POST. No external server contacted or unsubscribe sent.");
    }
}
