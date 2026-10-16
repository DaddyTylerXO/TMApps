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
        var defaults = new Preferences(); Check(!defaults.AutoMarkRead && defaults.CalendarMonday, "Reading/week defaults wrong"); Check(defaults.ReceiveSound == "Cozy" && defaults.SendSound == "Cozy", "Cozy defaults missing");
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
        var app = new App(); Call(app, "Initialize"); var window = (Window)Get(app, "window"); var prefs = (Preferences)Get(app, "preferences"); var liveAccount = (MailAccount)Get(app, "activeAccount"); var mailbox = (MailStore)Get(app, "store"); var message = mailbox.Messages.Single(); var list = (ListBox)window.FindName("MessageList");
        list.SelectedItem = null; list.SelectedItem = message; Check(message.Unread && liveAccount.Folders[0].Unread == 20, "Opening mail marked it read by default");
        prefs.AutoMarkRead = true; list.SelectedItem = null; list.SelectedItem = message; Check(!message.Unread && liveAccount.Folders[0].Unread == 19 && ((Button)window.FindName("InboxNav")).Content.ToString().Contains("19"), "Auto read did not update live unread count");
        Call(app, "ToggleSelectedRead"); Check(message.Unread && liveAccount.Folders[0].Unread == 20, "Mark unread did not update live count");
        Check(((FrameworkElement)((TextBlock)window.FindName("WorkspaceBadge")).Parent).Visibility == Visibility.Collapsed, "Connected mail badge still visible");
        Check(window.FindName("FooterSyncButton") != null && Get(app, "managementButton") != null && Get(app, "calendarButton") != null, "New navigation/footer actions missing");
        prefs.SpotifyPlacement = "Off"; Call(app, "ApplyPreferences"); Layout(window); var profile = (Button)window.FindName("AccountTop"); double y = profile.TranslatePoint(new Point(), (FrameworkElement)window.Content).Y;
        prefs.SpotifyPlacement = "Top"; Call(app, "ApplyPreferences"); Layout(window); Check(Math.Abs(profile.TranslatePoint(new Point(), (FrameworkElement)window.Content).Y - y) < 1, "Spotify lowered the profile button");
        var music = (FrameworkElement)Get(app, "spotify"); double musicRight = music.TranslatePoint(new Point(music.ActualWidth, 0), (FrameworkElement)window.Content).X; double profileLeft = profile.TranslatePoint(new Point(), (FrameworkElement)window.Content).X; Check(musicRight <= profileLeft, "Spotify overlaps profile button");
        Call(app, "ShowCalendarView"); Check(((Grid)Get(app, "mailArea")).Visibility == Visibility.Collapsed && ((FrameworkElement)Get(app, "calendarPage")).Visibility == Visibility.Visible, "Calendar did not replace mail view"); Call(app, "ShowMailView"); Check(((Grid)Get(app, "mailArea")).Visibility == Visibility.Visible, "Could not return from calendar to mail");
        var original = new Message { Sender = "Sender", Address = "sender@example.com", To = "reader@example.com; colleague@example.com", Cc = "cc@example.com; reader@example.com", Subject = "Meeting", Body = "Hi" }; var composer = new ComposerWindow(prefs, mailbox, null, "replyAll", original); Check(((TextBox)Get(composer, "to")).Text.Contains("colleague@example.com") && !((TextBox)Get(composer, "to")).Text.Contains("reader@example.com") && ((TextBox)Get(composer, "cc")).Text == "cc@example.com", "Reply all recipients incorrect"); composer.Close();
        window.Close(); app.Shutdown(); Console.WriteLine("Passed " + checks + " workspace-suite checks: read counts, layout, calendars, 14 sounds, plug-ins, updates, and intercepted unsubscribe POST. No external server contacted or unsubscribe sent.");
    }
}
