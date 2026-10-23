using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Search;
using MailKit.Security;
using MimeKit;
using MimeKit.Text;

namespace Postbox {
    public sealed partial class MailTransport {
        private readonly MailAccount account;
        private readonly Action<IMailService, MailAccount, CancellationToken> authenticateAccount;
        private MailTransport(MailAccount value, Action<IMailService, MailAccount, CancellationToken> authentication, int marker) { if (value == null) throw new ArgumentNullException("value"); if (authentication == null) throw new ArgumentNullException("authentication"); account = value; authenticateAccount = authentication; }
        public static MailTransport Create(MailAccount value, Action<IMailService, MailAccount, CancellationToken> authentication) { return new MailTransport(value, authentication, 0); }
        private void Authenticate(IMailService client, CancellationToken cancellation = default(CancellationToken)) { lock (account) {
            cancellation.ThrowIfCancellationRequested();
            authenticateAccount(client, account, cancellation);
        }
        }
        internal static ImapClient CreateImapClient() { return new ImapClient { Timeout = 30000, SslProtocols = System.Security.Authentication.SslProtocols.None, CheckCertificateRevocation = true }; }
        internal static SmtpClient CreateSmtpClient() { return new SmtpClient { Timeout = 30000, SslProtocols = System.Security.Authentication.SslProtocols.None, CheckCertificateRevocation = true }; }
        private ImapClient Connect(CancellationToken cancellation = default(CancellationToken)) {
            var client = CreateImapClient();
            try { client.Connect(account.ImapHost, account.ImapPort, account.ImapPort == 993 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, cancellation); Authenticate(client, cancellation); return client; }
            catch { client.Dispose(); throw; }
        }
        private SmtpClient ConnectSmtp(CancellationToken cancellation = default(CancellationToken)) {
            var client = CreateSmtpClient();
            try { client.Connect(account.SmtpHost, account.SmtpPort, account.SmtpSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, cancellation); Authenticate(client, cancellation); return client; }
            catch { client.Dispose(); throw; }
        }
        public void Test() { using (var client = Connect()) client.Disconnect(true); using (var client = ConnectSmtp()) client.Disconnect(true); }
        private IMailFolder Folder(ImapClient client, string name) {
            if (name.StartsWith("Server:", StringComparison.Ordinal)) return client.GetFolder(Uri.UnescapeDataString(name.Substring(7)));
            if (name == "Inbox") return client.Inbox;
            try {
                IMailFolder advertised = name == "Drafts" ? client.GetFolder(SpecialFolder.Drafts) : name == "Sent" ? client.GetFolder(SpecialFolder.Sent) : name == "Trash" ? client.GetFolder(SpecialFolder.Trash) : name == "Archive" ? client.GetFolder(SpecialFolder.Archive) : null;
                if (advertised != null) return advertised;
            } catch (NotSupportedException) { } catch (FolderNotFoundException) { }
            if (name == "Archive" && account.Provider == "Gmail") { try { return client.GetFolder(SpecialFolder.All); } catch (NotSupportedException) { } catch (FolderNotFoundException) { } }
            var known = (account.Folders ?? new List<ServerFolder>()).FirstOrDefault(f => f.Selectable && (f.LocalName == name || FolderAliases(name).Contains(f.Name, StringComparer.OrdinalIgnoreCase)));
            if (known != null) return client.GetFolder(known.Path);
            return null;
        }
        public static string[] FolderAliases(string name) {
            return name == "Trash" ? new[] { "Trash", "Deleted Messages", "Deleted Items", "Bin" } : name == "Archive" ? new[] { "Archive", "Archives" } : name == "Sent" ? new[] { "Sent", "Sent Messages", "Sent Items" } : name == "Drafts" ? new[] { "Drafts" } : new string[0];
        }
        private bool CanSelectFolder(IMailFolder folder) {
            if (!folder.Exists || String.IsNullOrEmpty(folder.FullName) || (folder.Attributes & (FolderAttributes.NoSelect | FolderAttributes.NonExistent)) != 0) return false;
            // Gmail's reserved system-label parents are containers even if LIST omits \Noselect.
            return account.Provider != "Gmail" || (folder.FullName != "[Gmail]" && folder.FullName != "[Google Mail]");
        }
        public static Message ConvertMessage(MimeMessage mime, string accountId, string localFolder, string remoteFolder, uint validity, uint uid, MessageFlags flags) {
            var from = mime.From.Mailboxes.FirstOrDefault();
            string body = mime.TextBody;
            if (String.IsNullOrEmpty(body) && !String.IsNullOrEmpty(mime.HtmlBody)) body = PlainHtml(mime.HtmlBody);
            var attachments = new List<MailAttachment>();
            var inlineImages = new List<InlineMailImage>();
            foreach (var image in mime.BodyParts.OfType<MimePart>().Where(p => !String.IsNullOrEmpty(p.ContentId) && new[] { "image/png", "image/jpeg", "image/gif", "image/webp" }.Contains(p.ContentType.MimeType.ToLowerInvariant()))) {
                using (var data = new MemoryStream()) { image.Content.DecodeTo(data); if (data.Length <= 5 * 1024 * 1024) inlineImages.Add(new InlineMailImage { ContentId = image.ContentId, MimeType = image.ContentType.MimeType, Data = System.Convert.ToBase64String(data.ToArray()) }); }
            }
            foreach (var part in mime.Attachments.OfType<MimePart>()) {
                using (var data = new MemoryStream()) { part.Content.DecodeTo(data); attachments.Add(new MailAttachment { Name = Path.GetFileName(part.FileName ?? "attachment"), Size = data.Length, Data = System.Convert.ToBase64String(data.ToArray()) }); }
            }
            foreach (var calendar in mime.BodyParts.OfType<MimePart>().Where(p => p.ContentType.MimeType.Equals("text/calendar", StringComparison.OrdinalIgnoreCase) && !p.IsAttachment)) using (var data = new MemoryStream()) { calendar.Content.DecodeTo(data); if (data.Length <= 5000000) attachments.Add(new MailAttachment { Name = "invitation.ics", Size = data.Length, Data = System.Convert.ToBase64String(data.ToArray()) }); }
            return new Message { Id = accountId + ":" + remoteFolder + ":" + validity + ":" + uid, ContentVersion = 2, HtmlBody = mime.HtmlBody, InlineImages = inlineImages, InternetMessageId = mime.MessageId, AccountId = accountId, RemoteFolder = remoteFolder, RemoteUid = uid, UidValidity = validity, Sender = from == null ? "Unknown sender" : (String.IsNullOrEmpty(from.Name) ? from.Address : from.Name), Address = from == null ? "" : from.Address, To = String.Join("; ", mime.To.Mailboxes.Select(m => m.Address)), Cc = String.Join("; ", mime.Cc.Mailboxes.Select(m => m.Address)), Subject = mime.Subject ?? "(No subject)", Body = body ?? "", Folder = localFolder, Date = mime.Date.LocalDateTime, Unread = (flags & MessageFlags.Seen) == 0, Starred = (flags & MessageFlags.Flagged) != 0, Attachments = attachments, Importance = mime.Importance.ToString() };
        }
        public static MimeMessage CreateMime(Message message) {
            var mime = new MimeMessage(); mime.From.Add(new MailboxAddress(message.Sender, message.Address));
            foreach (string value in Split(message.To)) mime.To.Add(MailboxAddress.Parse(value));
            foreach (string value in Split(message.Cc)) mime.Cc.Add(MailboxAddress.Parse(value));
            foreach (string value in Split(message.Bcc)) mime.Bcc.Add(MailboxAddress.Parse(value));
            mime.Subject = message.Subject; mime.MessageId = message.InternetMessageId ?? MimeKit.Utils.MimeUtils.GenerateMessageId();
            var body = new BodyBuilder { TextBody = message.Body, HtmlBody = message.HtmlBody };
            foreach (var image in message.InlineImages ?? new List<InlineMailImage>()) { if (String.IsNullOrEmpty(image.ContentId) || !new[] { "image/png", "image/jpeg", "image/gif", "image/webp" }.Contains(image.MimeType)) continue; var item = body.LinkedResources.Add("embedded." + image.MimeType.Substring(6).Replace("jpeg", "jpg"), System.Convert.FromBase64String(image.Data)); item.ContentId = image.ContentId.Trim('<', '>'); }
            if (!String.IsNullOrEmpty(body.HtmlBody)) body.HtmlBody = System.Text.RegularExpressions.Regex.Replace(body.HtmlBody, "data:image/png;base64,([A-Za-z0-9+/=]+)", delegate(System.Text.RegularExpressions.Match match) { var resource = body.LinkedResources.Add("signature.png", System.Convert.FromBase64String(match.Groups[1].Value)); resource.ContentId = MimeKit.Utils.MimeUtils.GenerateMessageId(); return "cid:" + resource.ContentId; });
            foreach (var attachment in message.Attachments ?? new List<MailAttachment>()) body.Attachments.Add(Path.GetFileName(attachment.Name), System.Convert.FromBase64String(attachment.Data));
            mime.Body = body.ToMessageBody();
            if (message.Importance == "High") mime.Importance = MessageImportance.High;
            if (message.Importance == "Low") mime.Importance = MessageImportance.Low;
            return mime;
        }
        private static IEnumerable<string> Split(string value) { return (value ?? "").Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()); }
        public static string PlainHtml(string html) {
            var text = new System.Text.StringBuilder();
            using (var reader = new StringReader(html)) {
                var tokenizer = new HtmlTokenizer(reader) { DecodeCharacterReferences = true }; HtmlToken token; bool hidden = false;
                while (tokenizer.ReadNextToken(out token)) {
                    var tag = token as HtmlTagToken; var data = token as HtmlDataToken;
                    if (tag != null) { if (tag.Id == HtmlTagId.Script || tag.Id == HtmlTagId.Style || tag.Id == HtmlTagId.Head) hidden = !tag.IsEndTag; if (!hidden && (tag.Id == HtmlTagId.Br || tag.Id == HtmlTagId.P || tag.Id == HtmlTagId.Div || tag.Name.Equals("tr", StringComparison.OrdinalIgnoreCase) || tag.Name.Equals("li", StringComparison.OrdinalIgnoreCase) || tag.Name.Equals("td", StringComparison.OrdinalIgnoreCase) || tag.Name.Equals("th", StringComparison.OrdinalIgnoreCase))) text.AppendLine(); }
                    else if (data != null && !hidden) text.Append(data.Data);
                }
            }
            return text.ToString().Trim();
        }
        // SMTP acceptance is the delivery boundary. A later Sent-copy failure must never cause a resend.
        public string Send(Message message) {
            var mime = CreateMime(message);
            using (var client = ConnectSmtp()) { client.Send(mime); try { client.Disconnect(true); } catch { } }
            try {
                using (var client = Connect()) { var sent = Folder(client, "Sent"); if (sent != null && account.Provider != "Gmail") sent.Append(mime, MessageFlags.Seen); client.Disconnect(true); }
                return null;
            } catch (Exception) { return "Mail was accepted by SMTP. The server Sent copy could not be saved; your local copy was kept. Do not resend."; }
        }
        public Dictionary<string, Message> Move(List<Message> messages, string target) {
            var moved = new Dictionary<string, Message>();
            using (var client = Connect()) {
                var destination = Folder(client, target); if (destination == null) throw new InvalidOperationException("The server does not advertise a " + target + " folder.");
                destination.Status(StatusItems.UidValidity);
                foreach (var group in messages.Where(m => m.RemoteUid != 0).GroupBy(m => m.RemoteFolder)) {
                    var source = client.GetFolder(group.Key); source.Open(FolderAccess.ReadWrite);
                    if (group.Any(m => m.UidValidity != source.UidValidity)) throw new InvalidOperationException("The server mailbox changed. Sync before moving messages.");
                    var mapping = source.MoveTo(group.Select(m => new UniqueId(m.RemoteUid)).ToList(), destination);
                    foreach (var message in group) { UniqueId uid; if (mapping != null && mapping.TryGetValue(new UniqueId(message.RemoteUid), out uid)) { var copy = message.CopyForSync(); copy.RemoteUid = uid.Id; copy.RemoteFolder = destination.FullName; copy.UidValidity = destination.UidValidity; copy.Folder = target; copy.Id = account.Id + ":" + destination.FullName + ":" + copy.UidValidity + ":" + copy.RemoteUid; moved[message.Id] = copy; } }
                    source.Close();
                }
                client.Disconnect(true);
            }
            return moved;
        }
        public void Flags(Message message) {
            using (var client = Connect()) {
                var folder = client.GetFolder(message.RemoteFolder); folder.Open(FolderAccess.ReadWrite);
                if (folder.UidValidity != message.UidValidity) throw new InvalidOperationException("Mailbox changed. Sync first.");
                var uid = new UniqueId(message.RemoteUid);
                folder.AddFlags(uid, (message.Unread ? MessageFlags.None : MessageFlags.Seen) | (message.Starred ? MessageFlags.Flagged : MessageFlags.None), true);
                folder.RemoveFlags(uid, (message.Unread ? MessageFlags.Seen : MessageFlags.None) | (message.Starred ? MessageFlags.None : MessageFlags.Flagged), true);
                client.Disconnect(true);
            }
        }
        public void MarkFolderRead(string path) {
            using (var client = Connect()) {
                var folder = client.GetFolder(path); folder.Open(FolderAccess.ReadWrite);
                var unread = folder.Search(SearchQuery.NotSeen); if (unread.Count > 0) folder.AddFlags(unread, MessageFlags.Seen, true);
                folder.Close(false); client.Disconnect(true);
            }
        }
        public void DeleteFolder(string path) {
            using (var client = Connect()) {
                var folder = client.GetFolder(path);
                var special = FolderAttributes.Inbox | FolderAttributes.Drafts | FolderAttributes.Sent | FolderAttributes.Trash | FolderAttributes.Junk | FolderAttributes.Archive | FolderAttributes.All;
                if ((folder.Attributes & special) != 0) throw new InvalidOperationException("Provider system folders cannot be deleted.");
                if (folder.GetSubfolders(false).Count > 0) throw new InvalidOperationException("Move or remove the subfolders before deleting this folder.");
                folder.Delete(); client.Disconnect(true);
            }
        }
    }
}
