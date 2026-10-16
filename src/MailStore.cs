using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace Postbox {
    public class MailAttachment {
        public string Name { get; set; }
        public string Data { get; set; }
        public long Size { get; set; }
    }
    public class InlineMailImage { public string ContentId { get; set; } public string MimeType { get; set; } public string Data { get; set; } }
    public class ServerFolder {
        public string Name { get; set; } public string Path { get; set; } public string ParentPath { get; set; } public string LocalName { get; set; }
        public int Count { get; set; } public int Unread { get; set; } public bool Selectable { get; set; }
    }
    public class Message {
        public string Id { get; set; }
        public string Sender { get; set; }
        public string Address { get; set; }
        public string To { get; set; }
        public string Cc { get; set; }
        public string Bcc { get; set; }
        public string RichBody { get; set; }
        public string HtmlBody { get; set; }
        public List<InlineMailImage> InlineImages { get; set; }
        public int ContentVersion { get; set; }
        public string InternetMessageId { get; set; }
        public string DeliveryState { get; set; }
        public string AccountId { get; set; }
        public string RemoteFolder { get; set; }
        public uint RemoteUid { get; set; }
        public uint UidValidity { get; set; }
        public string Importance { get; set; }
        public bool FollowUp { get; set; }
        public List<MailAttachment> Attachments { get; set; }
        public string Subject { get; set; }
        public string Body { get; set; }
        public string Folder { get; set; }
        public DateTime Date { get; set; }
        public bool Unread { get; set; }
        public bool Starred { get; set; }
        [ScriptIgnore] public string Initials { get { return String.Join("", (Sender ?? "?").Split(' ').Where(s => s.Length > 0).Take(2).Select(s => s.Substring(0, 1))).ToUpperInvariant(); } }
        public Message CopyForSync() { return (Message)MemberwiseClone(); }
        private string previewHtml, previewText;
        [ScriptIgnore] public string Preview { get {
            string text = Body ?? "";
            if (!String.IsNullOrWhiteSpace(HtmlBody)) {
                if (previewHtml != HtmlBody) { previewHtml = HtmlBody; try { previewText = MailTransport.PlainHtml(HtmlBody); } catch { previewText = ""; } }
                if (!String.IsNullOrWhiteSpace(previewText)) text = previewText;
            }
            return System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ").Trim();
        } }
        [ScriptIgnore] public string TimeLabel { get { return Date.Date == DateTime.Today ? Date.ToString("HH:mm") : Date.ToString("dd MMM"); } }
        [ScriptIgnore] public string StarLabel { get { return Starred ? "★" : "☆"; } }
    }

    public class MailStore {
        public List<Message> Messages { get; private set; }
        private readonly string path;
        private readonly bool encrypted;
        private readonly object writeGate = new object();
        private long writeVersion;
        private readonly JavaScriptSerializer serializer = new JavaScriptSerializer { MaxJsonLength = 268435456 };
        public string LoadWarning { get; private set; }
        public MailStore(string dataPath) : this(dataPath, false, true) { }
        public MailStore(string dataPath, bool protect, bool seed) {
            path = dataPath;
            encrypted = protect;
            if (File.Exists(path)) {
                try {
                    Messages = serializer.Deserialize<List<Message>>(encrypted ? ProtectedFile.Read(path) : File.ReadAllText(path, Encoding.UTF8));
                    if (Messages == null || Messages.Any(m => m == null || String.IsNullOrEmpty(m.Id) || m.Folder == null)) throw new InvalidDataException();
                } catch (Exception ex) {
                    if (!(ex is ArgumentException || ex is InvalidOperationException || ex is InvalidDataException)) throw;
                    // Keep the original file recoverable before creating a fresh demo mailbox.
                    string backup = path + ".recovery-" + DateTime.Now.ToString("yyyyMMddHHmmssfff");
                    File.Copy(path, backup);
                    LoadWarning = "The mailbox file could not be read. A recovery copy was kept at " + backup;
                }
            }
            if (Messages == null) { Messages = seed ? Seed() : new List<Message>(); Save(); }
        }
        public void Save() {
            long version = Interlocked.Increment(ref writeVersion);
            lock (writeGate) { if (version == Interlocked.Read(ref writeVersion)) Write(Messages); }
        }
        public Task SaveAsync() {
            // Capture only message records on the UI thread. Large immutable bodies and
            // attachment strings are shared; JSON, encryption and disk writes run off-thread.
            long version = Interlocked.Increment(ref writeVersion);
            var snapshot = Messages.Select(m => m.CopyForSync()).ToList();
            return Task.Run(delegate {
                if (version != Interlocked.Read(ref writeVersion)) return;
                string json = Serialize(snapshot);
                lock (writeGate) { if (version == Interlocked.Read(ref writeVersion)) WriteSerialized(json); }
            });
        }
        private static string Serialize(List<Message> messages) { return new JavaScriptSerializer { MaxJsonLength = 268435456 }.Serialize(messages); }
        private void Write(List<Message> messages) {
            WriteSerialized(Serialize(messages));
        }
        private void WriteSerialized(string json) {
            if (encrypted) { ProtectedFile.Write(path, json); return; }
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
            string temp = path + ".tmp";
            File.WriteAllText(temp, json, Encoding.UTF8);
            if (File.Exists(path)) File.Replace(temp, path, null); else File.Move(temp, path);
        }
        public bool ApplyFolderBatch(ServerFolder folder, List<Message> batch) {
            var old = Messages.Where(m => m.RemoteUid != 0 && m.RemoteFolder == folder.Path).GroupBy(m => m.Id).ToDictionary(g => g.Key, g => g.First());
            var sentIds = new HashSet<string>(batch.Where(m => !String.IsNullOrEmpty(m.InternetMessageId)).Select(m => m.InternetMessageId));
            bool localSent = folder.LocalName == "Sent" && Messages.Any(m => m.Folder == "Sent" && m.RemoteUid == 0 && !String.IsNullOrEmpty(m.InternetMessageId) && sentIds.Contains(m.InternetMessageId));
            bool changed = localSent || old.Count != batch.Count || batch.Any(m => { Message previous; return !old.TryGetValue(m.Id, out previous) || previous.Unread != m.Unread || previous.Starred != m.Starred || previous.ContentVersion != m.ContentVersion || previous.HtmlBody != m.HtmlBody || previous.Body != m.Body; });
            if (!changed) return false;
            Messages.RemoveAll(m => m.RemoteUid != 0 && m.RemoteFolder == folder.Path);
            if (localSent) Messages.RemoveAll(m => m.Folder == "Sent" && m.RemoteUid == 0 && !String.IsNullOrEmpty(m.InternetMessageId) && sentIds.Contains(m.InternetMessageId));
            Messages.AddRange(batch); return true;
        }
        public IEnumerable<Message> Query(string folder, string search, bool unreadOnly) {
            IEnumerable<Message> result = Messages.Where(m => folder == "Starred" ? m.Starred && m.Folder != "Trash" : m.Folder == folder);
            if (unreadOnly) result = result.Where(m => m.Unread);
            if (!String.IsNullOrWhiteSpace(search)) result = result.Where(m => ((m.Sender ?? "") + " " + (m.Address ?? "") + " " + (m.To ?? "") + " " + (m.Subject ?? "") + " " + (m.Body ?? "")).IndexOf(search, StringComparison.OrdinalIgnoreCase) >= 0);
            return result.OrderByDescending(m => m.Date).ToList();
        }
        public void Move(Message message, string folder) { message.Folder = folder; Save(); }
        public void MoveMany(IEnumerable<Message> messages, string destination) {
            if (!new[] { "Inbox", "Drafts", "Sent", "Archive", "Trash" }.Contains(destination)) throw new ArgumentException("Choose a mail folder.");
            var originals = messages.Distinct().ToDictionary(m => m, m => m.Folder);
            try { foreach (var message in originals.Keys) message.Folder = destination; Save(); }
            catch { foreach (var entry in originals) entry.Key.Folder = entry.Value; throw; }
        }
        public Message SaveDraft(string id, string to, string subject, string body, bool sent, string sender = "You") {
            Message message = Messages.FirstOrDefault(m => m.Id == id && m.Folder == "Drafts");
            if (message == null) { message = new Message { Id = Guid.NewGuid().ToString(), Sender = "You", Address = "you@postbox.local" }; Messages.Add(message); }
            message.Sender = sender;
            message.To = to; message.Subject = String.IsNullOrWhiteSpace(subject) ? "(No subject)" : subject;
            message.Body = body; message.Folder = sent ? "Sent" : "Drafts"; message.Date = DateTime.Now;
            Save(); return message;
        }
        private static List<Message> Seed() {
            var data = new List<Message>();
            Add(data, "Sophie Chen", "sophie@example.com", "A little inspiration for the week", "Hi Tyler,\n\nI pulled together a few ideas for our next project. I keep coming back to one thought: the best tools make space for the work that matters.\n\nA calmer inbox, a clearer plan, and a little room to think. That's a pretty good place to start.\n\nWould love to hear what you think when you have a moment.\n\nSpeak soon,\nSophie", 0.3, true, true);
            Add(data, "Alex Morgan", "alex@example.com", "Coffee & a catch-up?", "Hey Tyler,\n\nAre you around on Friday morning? There's a new coffee place near the station that looks promising.\n\nLet me know what works for you.\n\nAlex", 1.2, true, false);
            Add(data, "Studio North", "hello@example.com", "Your workspace, reimagined", "A little less noise. A lot more possibility.\n\nThis month's studio notes are all about creating a space that works for you. Start small: clear your desk, open a window, and choose one thing to focus on.\n\nThe Studio North team", 2, true, false);
            Add(data, "Daniel Brooks", "daniel@example.com", "Re: Project notes", "Hi Tyler,\n\nThanks for sharing the notes. I've added my thoughts and a few questions for us to discuss.\n\nThe overall direction looks good. Let's keep the first version focused and build from there.\n\nBest,\nDaniel", 4, false, false);
            Add(data, "Emma Wilson", "emma@example.com", "Weekend plans", "Hi!\n\nA few of us are heading out for a walk this weekend. Nothing too ambitious, just some fresh air and lunch afterwards.\n\nYou're welcome to join!\n\nEmma", 20, false, true);
            Add(data, "The Reading List", "reading@example.com", "Three things worth your time", "Good morning,\n\nA few ideas for your reading list:\n\n1. Designing for everyday life\n2. The art of paying attention\n3. Making room for creative work\n\nEnjoy a slower read.\n\nThe Reading List", 25, false, false);
            Add(data, "Jamie Park", "jamie@example.com", "Thanks for yesterday", "Hi Tyler,\n\nReally enjoyed our conversation yesterday. Lots to think about, and I'm looking forward to seeing where the project goes.\n\nLet's stay in touch.\n\nJamie", 46, false, false);
            data.Add(new Message { Id = Guid.NewGuid().ToString(), Sender = "You", Address = "you@postbox.local", To = "sophie@example.com", Subject = "Ideas for next week", Body = "Hi Sophie,\n\nHere are a few initial thoughts...", Folder = "Drafts", Date = DateTime.Now.AddHours(-2) });
            return data;
        }
        private static void Add(List<Message> data, string sender, string address, string subject, string body, double hours, bool unread, bool starred) {
            data.Add(new Message { Id = Guid.NewGuid().ToString(), Sender = sender, Address = address, To = "you@postbox.local", Subject = subject, Body = body, Folder = "Inbox", Date = DateTime.Now.AddHours(-hours), Unread = unread, Starred = starred });
        }
    }
}
