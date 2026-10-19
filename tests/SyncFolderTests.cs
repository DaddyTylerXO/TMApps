using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using MailKit.Net.Imap;
using MailKit.Security;
using Postbox;

// In-memory IMAP peer: exercises MailKit's actual LIST parser and EXAMINE commands.
class SyncFolderTests {
    sealed class Peer : Stream {
        readonly Queue<byte> incoming = new Queue<byte>();
        readonly StringBuilder command = new StringBuilder();
        public readonly List<string> Commands = new List<string>();
        public bool FailProjects;
        public Peer() { Reply("* PREAUTH [CAPABILITY IMAP4rev1 NAMESPACE SPECIAL-USE UNSELECT] Synthetic test server"); }
        void Reply(string value) { foreach (byte b in Encoding.ASCII.GetBytes(value + "\r\n")) incoming.Enqueue(b); }
        void Handle(string line) {
            Commands.Add(line); int space = line.IndexOf(' '); string tag = line.Substring(0, space), text = line.Substring(space + 1);
            if (text.StartsWith("CAPABILITY")) Reply("* CAPABILITY IMAP4rev1 NAMESPACE SPECIAL-USE UNSELECT");
            else if (text.StartsWith("NAMESPACE")) Reply("* NAMESPACE ((\"\" \"/\")) NIL NIL");
            else if (text.StartsWith("LIST")) {
                if (text == "LIST \"\" \"\"") Reply("* LIST (\\Noselect) \"/\" \"\"");
                else {
                    Reply("* LIST (\\Inbox) \"/\" INBOX");
                    Reply("* LIST (\\HasChildren) \"/\" \"[Gmail]\"");
                    Reply("* LIST (\\HasChildren) \"/\" \"[Google Mail]\"");
                    Reply("* LIST (\\All) \"/\" \"[Gmail]/All Mail\"");
                    Reply("* LIST (\\Noselect \\HasChildren) \"/\" Containers");
                    Reply("* LIST (\\NonExistent \\HasChildren) \"/\" Ghosts");
                    Reply("* LIST (\\HasChildren) \"/\" Projects");
                    Reply("* LIST () \"/\" \"Projects/Current\"");
                }
            } else if (text.StartsWith("STATUS") || text.StartsWith("EXAMINE")) {
                string path = text.Substring(text.IndexOf(' ') + 1); if (path.StartsWith("\"")) path = path.Substring(1, path.IndexOf('"', 1) - 1); else path = path.Split(' ')[0];
                if (new[] { "[Gmail]", "[Google Mail]", "Containers", "Ghosts" }.Contains(path)) { Reply(tag + " NO Unknown Mailbox: " + path + " (Failure)"); return; }
                if (path == "Projects" && FailProjects) { Reply(tag + " NO Mailbox temporarily unavailable"); return; }
                if (text.StartsWith("STATUS")) Reply("* STATUS \"" + path + "\" (MESSAGES 1 UNSEEN 0)");
                else { Reply("* FLAGS (\\Seen \\Flagged)"); Reply("* 1 EXISTS"); Reply("* OK [UIDVALIDITY 9] Stable UIDs"); Reply("* OK [UIDNEXT 8] Next UID"); }
            } else if (text.StartsWith("FETCH")) Reply("* 1 FETCH (UID 7 FLAGS (\\Seen) RFC822.SIZE 100)");
            else if (text.StartsWith("LOGOUT")) Reply("* BYE Closing");
            else if (!text.StartsWith("UNSELECT") && !text.StartsWith("CLOSE")) throw new Exception("Unexpected synthetic command: " + text);
            Reply(tag + " OK " + (text.StartsWith("EXAMINE") ? "[READ-ONLY] " : "") + "Completed");
        }
        public override void Write(byte[] buffer, int offset, int count) { for (int i = 0; i < count; i++) { command.Append((char)buffer[offset + i]); if (command.Length >= 2 && command.ToString().EndsWith("\r\n")) { string line = command.ToString().TrimEnd('\r', '\n'); command.Clear(); Handle(line); } } }
        public override int Read(byte[] buffer, int offset, int count) { if (incoming.Count == 0) throw new Exception("Synthetic server has no response"); int n = Math.Min(count, incoming.Count); for (int i = 0; i < n; i++) buffer[offset + i] = incoming.Dequeue(); return n; }
        public override bool CanRead { get { return true; } } public override bool CanWrite { get { return true; } } public override bool CanSeek { get { return false; } }
        public override long Length { get { throw new NotSupportedException(); } } public override long Position { get { throw new NotSupportedException(); } set { throw new NotSupportedException(); } }
        public override void Flush() {} public override long Seek(long offset, SeekOrigin origin) { throw new NotSupportedException(); } public override void SetLength(long length) { throw new NotSupportedException(); }
    }
    static int checks;
    static void Check(bool condition, string message) { if (!condition) throw new Exception(message); checks++; }
    static SyncSnapshot Run(Peer peer, List<Message> cached, List<string> completed, CancellationToken token) {
        using (var client = new ImapClient()) {
            client.Connect(peer, "synthetic.invalid", 143, SecureSocketOptions.None);
            var transport = new MailTransport(new MailAccount { Id = "test", Provider = "Gmail" }, null);
            try { return (SyncSnapshot)typeof(MailTransport).GetMethod("SynchronizeConnected", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(transport, new object[] { client, cached, null, null, new Action<ServerFolder, List<Message>>(delegate(ServerFolder f, List<Message> batch) { completed.Add(f.Path); }), token }); }
            catch (TargetInvocationException error) { throw error.InnerException; }
        }
    }
    static void Main() {
        var paths = new[] { "INBOX", "[Gmail]/All Mail", "Projects", "Projects/Current" };
        var cached = paths.Select(path => new Message { Id = path, AccountId = "test", RemoteFolder = path, RemoteUid = 7, UidValidity = 9, ContentVersion = 2, Body = "Retained cached body", Unread = true }).ToList();
        var peer = new Peer(); var completed = new List<string>(); var result = Run(peer, cached, completed, CancellationToken.None);
        Check(result.Folders.Count == 8, "Container hierarchy was lost");
        Check(result.Folders.Count(f => f.Selectable) == 4, "Placeholder or Gmail parent is selectable");
        Check(paths.All(p => completed.Contains(p)) && completed.Count == 4, "Real child or selectable parent mailbox was skipped");
        Check(result.Messages.Count == 4 && result.Messages.All(m => m.Body == "Retained cached body" && !m.Unread), "Cached messages or fetched flags lost");
        Check(cached.All(m => m.Unread), "Sync mutated the original cache");
        Check(result.Messages.Single(m => m.RemoteFolder == "[Gmail]/All Mail").Folder == "Archive", "Gmail All Mail mapping lost");
        Check(!peer.Commands.Any(c => c.Contains("STATUS \"[Gmail]\"") || c.Contains("EXAMINE \"[Gmail]\"") || c.Contains("STATUS Ghosts") || c.Contains("EXAMINE Ghosts")), "Invalid container command reached the server");
        peer = new Peer { FailProjects = true }; completed.Clear();
        try { Run(peer, cached, completed, CancellationToken.None); throw new Exception("Real mailbox failure was hidden"); } catch (ImapCommandException) { checks++; }
        Check(completed.Count == 0 && cached.All(m => m.Unread), "Discovery failure replaced cached mail");
        using (var stop = new CancellationTokenSource()) { stop.Cancel(); try { Run(new Peer(), cached, new List<string>(), stop.Token); throw new Exception("Cancelled sync continued"); } catch (OperationCanceledException) { checks++; } }
        Console.WriteLine(checks + " synthetic IMAP folder checks passed.");
    }
}
