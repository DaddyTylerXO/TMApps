using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using MimeKit;
using MailKit;
using Postbox;
using MailStore = Postbox.MailStore;
using MailTransport = Postbox.MailTransport;

class ConnectionTests {
    static int checks;
    static void Check(bool condition, string name) { if (!condition) throw new Exception(name); checks++; }
    static object Get(object obj, string name) { return obj.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic).GetValue(obj); }
    static object Call(object obj, string name, params object[] args) { return obj.GetType().GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic).Invoke(obj, args); }
    [STAThread] static void Main(string[] args) {
        var app = new Application(); app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
        string directory = Path.Combine(args[0], "connections-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(directory);
        var accountStore = new AccountStore(directory);
        var account = new MailAccount { Email = "tester@example.com", UserName = "tester", Provider = "Other IMAP", ImapHost = "imap.example.com", ImapPort = 993, SmtpHost = "smtp.example.com", SmtpPort = 587, Password = "fake-test-password", RefreshToken = "fake-test-refresh-token" }; account.Validate(); accountStore.Save(account);
        var disk = File.ReadAllBytes(Path.Combine(directory, "account.protected"));
        Check(!Encoding.UTF8.GetString(disk).Contains("fake-test"), "Credentials leaked in plaintext");
        Check(accountStore.Load().Password == account.Password && accountStore.Load().RefreshToken == account.RefreshToken, "Protected credential roundtrip");
        var mailbox = new MailStore(Path.Combine(directory, "mail.protected"), true, false);
        Check(mailbox.Messages.Count == 0, "Live cache seeded fictional mail");
        mailbox.Messages.Add(new Message { Id = "one", Folder = "Inbox", Body = "private-cache-text" }); mailbox.Save();
        Check(!Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(directory, "mail.protected"))).Contains("private-cache-text"), "Live mail cache leaked plaintext");
        Check(new MailStore(Path.Combine(directory, "mail.protected"), true, false).Messages.Single().Body == "private-cache-text", "Protected cache reload");
        var message = new Message { Sender = "Tester", Address = "tester@example.com", To = "one@example.com; two@example.com", Cc = "cc@example.com", Bcc = "hidden@example.com", Subject = "MIME test ✓", Body = "Plain text", HtmlBody = "<p><b>Rich text</b><img src=\"data:image/png;base64,AQID\"></p>", Importance = "High", Attachments = new System.Collections.Generic.List<MailAttachment> { new MailAttachment { Name = "sample.txt", Size = 3, Data = "AQID" } } };
        var mime = MailTransport.CreateMime(message);
        Check(mime.To.Count == 2 && mime.Cc.Count == 1 && mime.Bcc.Count == 1, "MIME recipients");
        Check(mime.BodyParts.OfType<MimePart>().Any(p => p.ContentId != null), "Signature graphic did not become a CID resource");
        using (var stream = new MemoryStream()) {
            mime.WriteTo(stream); stream.Position = 0; var parsed = MimeMessage.Load(stream);
            Check(parsed.Subject == message.Subject && parsed.HtmlBody.Contains("cid:") && parsed.TextBody == message.Body, "MIME UTF8/plain/HTML roundtrip");
            var incoming = MailTransport.ConvertMessage(parsed, account.Id, "Inbox", "INBOX", 8, 42, MessageFlags.Seen | MessageFlags.Flagged);
            Check(incoming.RemoteUid == 42 && incoming.UidValidity == 8 && !incoming.Unread && incoming.Starred, "IMAP UID and flags mapping");
            Check(incoming.Attachments.Single().Data == "AQID", "MIME attachment decode");
        }
        string plain = MailTransport.PlainHtml("<html><head><style>bad-style</style></head><body><p>Hello &amp; welcome</p><script>bad-script</script><p>Next line</p></body></html>");
        Check(plain.Contains("Hello & welcome") && plain.Contains("Next line") && !plain.Contains("bad-script") && !plain.Contains("bad-style"), "Safe HTML to text conversion");
        var document = new FlowDocument(new Paragraph(new Bold(new Run("<safe & formatted>"))));
        string html = MailHtml.Export(document); Check(html.Contains("&lt;safe &amp; formatted&gt;") && html.Contains("font-weight:bold"), "Rich composer HTML export");
        var prefs = new Preferences(); prefs.Normalize();
        var composer = new ComposerWindow(prefs, mailbox, null, "", null);
        ((TextBox)Get(composer, "to")).Text = "recipient@example.com";
        composer.Deliver = delegate(Message outgoing) { var failure = new TaskCompletionSource<string>(); failure.SetException(new IOException("Simulated connection failure")); return failure.Task; };
        Call(composer, "Persist", true);
        Check(mailbox.Messages.Count(m => m.Folder == "Sent") == 0, "Failed send recorded as Sent");
        var draft = mailbox.Messages.Single(m => m.Folder == "Drafts");
        Check(draft.DeliveryState == "Unknown", "Ambiguous delivery not retained");
        Call(composer, "SaveMessage", false);
        Check(mailbox.Messages.Count(m => m.Folder == "Drafts") == 1 && mailbox.Messages.Single(m => m.Folder == "Drafts").DeliveryState == "Unknown", "Draft save duplicated mail or erased delivery guard");
        composer.Close();
        var success = new ComposerWindow(prefs, mailbox, null, "", null); ((TextBox)Get(success, "to")).Text = "recipient@example.com";
        int deliveries = 0; success.Deliver = delegate(Message outgoing) { deliveries++; return Task.FromResult<string>(null); };
        Call(success, "Persist", true);
        Check(deliveries == 1 && mailbox.Messages.Count(m => m.Folder == "Sent") == 1 && mailbox.Messages.Single(m => m.Folder == "Sent").DeliveryState == "Sent", "Accepted delivery not committed exactly once");
        Check(new System.Drawing.Icon(typeof(App).Assembly.GetManifestResourceStream("TMA-Mail.ico"), 32, 32).Width == 32, "Embedded Windows icon missing");
        accountStore.Remove(); Check(accountStore.Load() == null, "Disconnect did not remove credentials");
        Console.WriteLine("Passed " + checks + " connection checks (DPAPI, encrypted cache, MIME, HTML, delivery failure/success, icon). No external mail was sent.");
        app.Shutdown();
    }
}
