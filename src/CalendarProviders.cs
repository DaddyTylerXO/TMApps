using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Xml;
using System.Xml.Linq;
using System.Security.Cryptography;
namespace Postbox {
    public sealed class CalendarProviderClient : IDisposable {
        private readonly HttpClient client;
        private readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 16777216 };
        private readonly MailAccount login;
        private readonly bool test;
        private Uri responseUri;
        public CalendarProviderClient(MailAccount account, HttpMessageHandler handler = null) { login = account; test = handler != null; client = new HttpClient(handler ?? new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false }) { Timeout = TimeSpan.FromSeconds(30) }; client.DefaultRequestHeaders.UserAgent.ParseAdd("TMA-Mail/0.16.2"); }
        public void Dispose() { client.Dispose(); }
        public static Uri CheckedEndpoint(string value, string provider) { var uri = SafeWeb.Https(value); bool valid = provider == "Microsoft" ? uri.Host == "graph.microsoft.com" : provider == "Gmail" ? uri.Host == "www.googleapis.com" : uri.Host == "caldav.icloud.com" || uri.Host.EndsWith("-caldav.icloud.com", StringComparison.OrdinalIgnoreCase); if (!valid) throw new ArgumentException("Unexpected calendar server. Credentials were not sent."); return uri; }
        private async Task<string> Request(string method, string url, string body = null, string media = "application/json", string depth = null, bool create = false) {
            Uri uri = CheckedEndpoint(url, login.Provider); if (!test && login.Provider != "iCloud") await Task.Run(() => ProviderLogin.Refresh(login, true));
            for (int redirect = 0; redirect < 3; redirect++) using (var request = new HttpRequestMessage(new HttpMethod(method), uri)) {
                request.Headers.Authorization = login.Provider == "iCloud" ? new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes(login.Email + ":" + login.Password))) : new AuthenticationHeaderValue("Bearer", login.AccessToken);
                if (body != null) request.Content = new StringContent(body, Encoding.UTF8, media); if (depth != null) request.Headers.Add("Depth", depth); if (create && method == "PUT") request.Headers.TryAddWithoutValidation("If-None-Match", "*");
                using (var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead)) {
                    if ((int)response.StatusCode >= 300 && (int)response.StatusCode < 400 && login.Provider == "iCloud" && response.Headers.Location != null) { uri = CheckedEndpoint(new Uri(uri, response.Headers.Location).AbsoluteUri, login.Provider); continue; }
                    if (create && ((method == "PUT" && response.StatusCode == HttpStatusCode.PreconditionFailed) || (login.Provider == "Gmail" && response.StatusCode == HttpStatusCode.Conflict))) return "";
                    responseUri = uri;
                    if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Calendar server returned HTTP " + (int)response.StatusCode + ". Reconnect if calendar access was revoked.");
                    using (var stream = await response.Content.ReadAsStreamAsync()) using (var memory = new MemoryStream()) { var buffer = new byte[16384]; int count; while ((count = await stream.ReadAsync(buffer, 0, buffer.Length)) > 0) { if (memory.Length + count > 10000000) throw new InvalidDataException("Calendar response exceeded 10 MB."); memory.Write(buffer, 0, count); } return Encoding.UTF8.GetString(memory.ToArray()); }
                }
            }
            throw new InvalidOperationException("Calendar server redirected too many times.");
        }
        private static XDocument Xml(string text) { using (var reader = XmlReader.Create(new StringReader(text), new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null })) return XDocument.Load(reader); }
        private static readonly XNamespace Dav = "DAV:", Cal = "urn:ietf:params:xml:ns:caldav";
        private async Task<XDocument> PropFind(string url, string props, string depth) { return Xml(await Request("PROPFIND", url, "<d:propfind xmlns:d='DAV:' xmlns:c='urn:ietf:params:xml:ns:caldav'><d:prop>" + props + "</d:prop></d:propfind>", "application/xml", depth)); }
        private static Dictionary<string, object> Obj(object value) { return value as Dictionary<string, object> ?? new Dictionary<string, object>(); }
        private static string Text(Dictionary<string, object> item, string key) { object value; return item.TryGetValue(key, out value) && value != null ? Convert.ToString(value, CultureInfo.InvariantCulture) : ""; }
        private static IEnumerable<Dictionary<string, object>> Items(Dictionary<string, object> item, string key) { object value; return item.TryGetValue(key, out value) && value is object[] ? ((object[])value).Select(Obj) : Enumerable.Empty<Dictionary<string, object>>(); }
        public async Task<List<CalendarSource>> Discover() {
            var result = new List<CalendarSource>();
            if (login.Provider == "iCloud") {
                string root = "https://caldav.icloud.com/"; var principal = await PropFind(root, "<d:current-user-principal/>", "0"); string href = principal.Descendants(Dav + "current-user-principal").Descendants(Dav + "href").Select(x => x.Value).FirstOrDefault(); if (href == null) throw new InvalidDataException("iCloud did not return a calendar principal.");
                string principalUrl = new Uri(responseUri ?? new Uri(root), href).AbsoluteUri; var home = await PropFind(principalUrl, "<c:calendar-home-set/>", "0"); string homeHref = home.Descendants(Cal + "calendar-home-set").Descendants(Dav + "href").Select(x => x.Value).FirstOrDefault(); if (homeHref == null) throw new InvalidDataException("iCloud did not return a calendar home."); string homeUrl = new Uri(responseUri ?? new Uri(principalUrl), homeHref).AbsoluteUri;
                var folders = await PropFind(homeUrl, "<d:displayname/><d:resourcetype/><d:current-user-privilege-set/>", "1"); var foldersUrl = responseUri ?? new Uri(homeUrl); foreach (var item in folders.Descendants(Dav + "response").Where(r => r.Descendants(Cal + "calendar").Any())) { string address = item.Element(Dav + "href").Value; var source = Source(item.Descendants(Dav + "displayname").Select(x => x.Value).FirstOrDefault() ?? "Calendar", address); source.RemoteUrl = CheckedEndpoint(new Uri(foldersUrl, address).AbsoluteUri, "iCloud").AbsoluteUri; source.Writable = item.Descendants(Dav + "write").Any() || item.Descendants(Dav + "write-content").Any() || !item.Descendants(Dav + "current-user-privilege-set").Any(); result.Add(source); }
            } else {
                string url = login.Provider == "Microsoft" ? "https://graph.microsoft.com/v1.0/me/calendars?$top=100" : "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250";
                for (int page = 0; page < 20 && url != null; page++) { var data = Obj(json.DeserializeObject(await Request("GET", url))); foreach (var item in Items(data, login.Provider == "Microsoft" ? "value" : "items")) { var source = Source(Text(item, login.Provider == "Microsoft" ? "name" : "summary"), Text(item, "id")); source.Writable = login.Provider == "Microsoft" ? Text(item, "canEdit").ToLowerInvariant() == "true" : new[] { "owner", "writer" }.Contains(Text(item, "accessRole")); result.Add(source); } string next = Text(data, login.Provider == "Microsoft" ? "@odata.nextLink" : "nextPageToken"); url = String.IsNullOrEmpty(next) ? null : login.Provider == "Microsoft" ? next : "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&pageToken=" + Uri.EscapeDataString(next); }
            }
            return result;
        }
        private CalendarSource Source(string name, string id) { return new CalendarSource { Id = Guid.NewGuid().ToString("N"), Name = name, Email = login.Email, Provider = login.Provider, RemoteId = id, Login = login, Ics = CalendarImport.Empty, Pending = new List<string>() }; }
        private static string Iso(DateTime value) { return value.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture); }
        public async Task<string> Read(CalendarSource source, DateTime month) {
            DateTime requested = new DateTime(month.Year, month.Month, 1), current = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1); string requestedData = await ReadRange(source, requested.AddDays(-8), requested.AddMonths(3)); if (current >= requested.AddDays(-8) && current < requested.AddMonths(3)) return requestedData; return CalendarImport.Append(await ReadRange(source, current.AddDays(-8), current.AddMonths(3)), requestedData);
        }
        private async Task<string> ReadRange(CalendarSource source, DateTime start, DateTime end) {
            string ics = CalendarImport.Empty;
            if (login.Provider == "iCloud") { string query = "<c:calendar-query xmlns:d='DAV:' xmlns:c='urn:ietf:params:xml:ns:caldav'><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name='VCALENDAR'><c:comp-filter name='VEVENT'><c:time-range start='" + start.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'") + "' end='" + end.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'") + "'/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>"; var data = Xml(await Request("REPORT", source.RemoteUrl, query, "application/xml", "1")); foreach (var item in data.Descendants(Cal + "calendar-data")) ics = CalendarImport.Append(ics, item.Value); return ics; }
            string baseUrl = login.Provider == "Microsoft" ? "https://graph.microsoft.com/v1.0/me/calendars/" + Uri.EscapeDataString(source.RemoteId) + "/calendarView?startDateTime=" + Uri.EscapeDataString(Iso(start)) + "&endDateTime=" + Uri.EscapeDataString(Iso(end)) + "&$top=500" : "https://www.googleapis.com/calendar/v3/calendars/" + Uri.EscapeDataString(source.RemoteId) + "/events?singleEvents=true&maxResults=2500&timeMin=" + Uri.EscapeDataString(Iso(start)) + "&timeMax=" + Uri.EscapeDataString(Iso(end));
            string url = baseUrl; for (int page = 0; page < 40 && url != null; page++) { var data = Obj(json.DeserializeObject(await Request("GET", url))); foreach (var item in Items(data, login.Provider == "Microsoft" ? "value" : "items")) { if (Text(item, "status") == "cancelled" || Text(item, "isCancelled").ToLowerInvariant() == "true") continue; ics = CalendarImport.Append(ics, FromJson(item)); } string next = Text(data, login.Provider == "Microsoft" ? "@odata.nextLink" : "nextPageToken"); url = String.IsNullOrEmpty(next) ? null : login.Provider == "Microsoft" ? next : baseUrl + "&pageToken=" + Uri.EscapeDataString(next); }
            return ics;
        }
        private string FromJson(Dictionary<string, object> value) {
            bool google = login.Provider == "Gmail"; var start = Obj(value["start"]); var finish = Obj(value["end"]); bool allDay = google ? !String.IsNullOrEmpty(Text(start, "date")) : Text(value, "isAllDay").ToLowerInvariant() == "true";
            Func<Dictionary<string, object>, DateTime> date = item => { string raw = Text(item, allDay && google ? "date" : "dateTime"); if (allDay && google) return DateTime.Parse(raw, CultureInfo.InvariantCulture).Date; DateTime parsed = DateTime.Parse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal); if (!google && !raw.EndsWith("Z") && Text(item, "timeZone") != "UTC") { var local = DateTime.SpecifyKind(DateTime.Parse(raw, CultureInfo.InvariantCulture), DateTimeKind.Unspecified); try { return TimeZoneInfo.ConvertTimeToUtc(local, TimeZoneInfo.FindSystemTimeZoneById(Text(item, "timeZone"))).ToLocalTime(); } catch { return DateTime.SpecifyKind(local, DateTimeKind.Local); } } return parsed.ToLocalTime(); };
            int reminder = -1; if (!google && Text(value, "isReminderOn").ToLowerInvariant() == "true") Int32.TryParse(Text(value, "reminderMinutesBeforeStart"), out reminder); else if (google && value.ContainsKey("reminders")) { var offsets = Items(Obj(value["reminders"]), "overrides").Select(r => Int32.Parse(Text(r, "minutes"))).ToList(); if (offsets.Count > 0) reminder = offsets.Min(); }
            DateTime begins = date(start), ends = date(finish); if (allDay) { begins = begins.Date; ends = ends.Date; }
            string text = CalendarImport.CreateEvent(Text(value, google ? "summary" : "subject") == "" ? "Untitled event" : Text(value, google ? "summary" : "subject"), begins, ends, google ? Text(value, "location") : value.ContainsKey("location") ? Text(Obj(value["location"]), "displayName") : "", "None", 1, allDay, 1, reminder);
            return System.Text.RegularExpressions.Regex.Replace(text, @"(?m)^UID:[^\r\n]+", "UID:" + StableId(Text(value, "id")) + "@provider");
        }
        public static string StableId(string uid) { using (var hash = SHA256.Create()) return "e" + String.Concat(hash.ComputeHash(Encoding.UTF8.GetBytes(uid)).Take(16).Select(b => b.ToString("x2"))); }
        public static string ExportWithTimeZone(string ics) { var calendar = Ical.Net.Calendar.Load(ics); string zone = NodaTime.DateTimeZoneProviders.Tzdb.GetSystemDefault().Id; bool changed = false; foreach (var item in calendar.Events.Where(e => e.DtStart != null && e.DtStart.HasTime && !e.DtStart.IsUtc && String.IsNullOrEmpty(e.DtStart.TzId))) { item.DtStart = new Ical.Net.DataTypes.CalDateTime(DateTime.SpecifyKind(item.DtStart.Value, DateTimeKind.Unspecified), zone); if (item.DtEnd != null) item.DtEnd = new Ical.Net.DataTypes.CalDateTime(DateTime.SpecifyKind(item.DtEnd.Value, DateTimeKind.Unspecified), zone); changed = true; } if (!changed) return ics; calendar.AddTimeZone(Ical.Net.CalendarComponents.VTimeZone.FromDateTimeZone(zone)); return new Ical.Net.Serialization.CalendarSerializer().SerializeToString(calendar); }
        public async Task Upload(CalendarSource source, string ics) {
            var item = Ical.Net.Calendar.Load(ics).Events.Single(); string id = StableId(item.Uid);
            if (login.Provider == "iCloud") { await Request("PUT", source.RemoteUrl.TrimEnd('/') + "/" + id + ".ics", ExportWithTimeZone(ics), "text/calendar", null, true); return; }
            bool allDay = !item.DtStart.HasTime; DateTime start = item.DtStart.Value, end = item.DtEnd.Value; var offsets = CalendarImport.ReminderOffsets(ics); int reminder; bool hasReminder = offsets.TryGetValue(item.Uid, out reminder);
            var body = new Dictionary<string, object>(); string recurrence = System.Text.RegularExpressions.Regex.Match(ics, @"(?m)^RRULE:([^\r\n]+)").Groups[1].Value;
            if (login.Provider == "Gmail") {
                body["id"] = id; body["summary"] = item.Summary; body["location"] = item.Location; string zone = NodaTime.DateTimeZoneProviders.Tzdb.GetSystemDefault().Id;
                body["start"] = allDay ? (object)new { date = start.ToString("yyyy-MM-dd") } : new { dateTime = start.ToString("yyyy-MM-dd'T'HH:mm:ss"), timeZone = zone }; body["end"] = allDay ? (object)new { date = end.ToString("yyyy-MM-dd") } : new { dateTime = end.ToString("yyyy-MM-dd'T'HH:mm:ss"), timeZone = zone };
                if (recurrence != "") body["recurrence"] = new[] { "RRULE:" + recurrence }; body["reminders"] = new { useDefault = false, overrides = hasReminder ? new[] { new { method = "popup", minutes = reminder } } : new object[0] };
            } else {
                body["transactionId"] = id; body["subject"] = item.Summary; body["location"] = new { displayName = item.Location }; body["isAllDay"] = allDay; body["start"] = new { dateTime = start.ToString("yyyy-MM-dd'T'HH:mm:ss"), timeZone = TimeZoneInfo.Local.Id }; body["end"] = new { dateTime = end.ToString("yyyy-MM-dd'T'HH:mm:ss"), timeZone = TimeZoneInfo.Local.Id }; body["isReminderOn"] = hasReminder; if (hasReminder) body["reminderMinutesBeforeStart"] = reminder;
                if (recurrence != "") { var values = recurrence.Split(';').Select(p => p.Split('=')).ToDictionary(p => p[0], p => p[1]); string freq = values["FREQ"]; var pattern = new Dictionary<string, object> { { "type", freq == "DAILY" ? "daily" : freq == "WEEKLY" ? "weekly" : freq == "MONTHLY" ? "absoluteMonthly" : "absoluteYearly" }, { "interval", values.ContainsKey("INTERVAL") ? Int32.Parse(values["INTERVAL"]) : 1 } }; if (freq == "WEEKLY") { pattern["daysOfWeek"] = new[] { start.DayOfWeek.ToString().ToLowerInvariant() }; pattern["firstDayOfWeek"] = "monday"; } if (freq == "MONTHLY" || freq == "YEARLY") pattern["dayOfMonth"] = start.Day; if (freq == "YEARLY") pattern["month"] = start.Month; body["recurrence"] = new { pattern = pattern, range = new { type = "numbered", startDate = start.ToString("yyyy-MM-dd"), numberOfOccurrences = Int32.Parse(values["COUNT"]), recurrenceTimeZone = TimeZoneInfo.Local.Id } }; }
            }
            string url = login.Provider == "Microsoft" ? "https://graph.microsoft.com/v1.0/me/calendars/" + Uri.EscapeDataString(source.RemoteId) + "/events" : "https://www.googleapis.com/calendar/v3/calendars/" + Uri.EscapeDataString(source.RemoteId) + "/events?sendUpdates=none";
            await Request("POST", url, json.Serialize(body), "application/json", null, true);
        }
    }
}
