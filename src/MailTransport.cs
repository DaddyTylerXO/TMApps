using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Search;
using MailKit.Security;
using MimeKit;
using MimeKit.Text;

namespace Postbox {
    public sealed class MailTransport {
        private readonly MailAccount account;
        private readonly AccountStore accounts;
        private readonly bool persistTokens;
        public MailTransport(MailAccount value, AccountStore storage, bool persist = true) { account = value; accounts = storage; persistTokens = persist; }
        private void Authenticate(IMailService client) {
            if (ProviderLogin.UsesOAuth(account)) { ProviderLogin.Refresh(account); if (persistTokens) accounts.Save(account); client.Authenticate(new SaslMechanismOAuth2(account.Email, account.AccessToken)); }
            else { client.AuthenticationMechanisms.Remove("XOAUTH2"); client.Authenticate(account.UserName, account.Password); }
        }
        internal static ImapClient CreateImapClient() { return new ImapClient { Timeout = 30000, SslProtocols = System.Security.Authentication.SslProtocols.None, CheckCertificateRevocation = true }; }
        internal static SmtpClient CreateSmtpClient() { return new SmtpClient { Timeout = 30000, SslProtocols = System.Security.Authentication.SslProtocols.None, CheckCertificateRevocation = true }; }
        private ImapClient Connect() {
            var client = CreateImapClient();
            try { client.Connect(account.ImapHost, account.ImapPort, account.ImapPort == 993 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls); Authenticate(client); return client; }
            catch { client.Dispose(); throw; }
        }
        private SmtpClient ConnectSmtp() {
            var client = CreateSmtpClient();
            try { client.Connect(account.SmtpHost, account.SmtpPort, account.SmtpSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls); Authenticate(client); return client; }
            catch { client.Dispose(); throw; }
        }
        public void Test() { using (var client = Connect()) client.Disconnect(true); using (var client = ConnectSmtp()) client.Disconnect(true); }
        private static IMailFolder Folder(ImapClient client, string name) {
            if (name == "Inbox") return client.Inbox;
            if (name == "Drafts") return client.GetFolder(SpecialFolder.Drafts);
            if (name == "Sent") return client.GetFolder(SpecialFolder.Sent);
            if (name == "Trash") return client.GetFolder(SpecialFolder.Trash);
            if (name == "Archive") return client.GetFolder(SpecialFolder.Archive);
            return null;
        }
        public List<Message> Synchronize(List<Message> cached) {
            var messages = new List<Message>();
            var copies = new System.Web.Script.Serialization.JavaScriptSerializer { MaxJsonLength = 67108864 };
            cached = copies.Deserialize<List<Message>>(copies.Serialize(cached));
            using (var client = Connect()) {
                foreach (string name in new[] { "Inbox", "Sent", "Archive", "Trash" }) {
                    IMailFolder folder; try { folder = Folder(client, name); } catch (NotSupportedException) { continue; } if (folder == null) continue;
                    folder.Open(FolderAccess.ReadOnly);
                    if (folder.Count > 0) {
                        var summaries = folder.Fetch(Math.Max(0, folder.Count - 200), -1, MessageSummaryItems.UniqueId | MessageSummaryItems.Flags | MessageSummaryItems.Size);
                        foreach (var summary in summaries) {
                            var existing = cached.FirstOrDefault(m => m.RemoteFolder == folder.FullName && m.UidValidity == folder.UidValidity && m.RemoteUid == summary.UniqueId.Id);
                            if (existing != null) { existing.Folder = name; existing.Unread = (summary.Flags & MessageFlags.Seen) == 0; existing.Starred = (summary.Flags & MessageFlags.Flagged) != 0; messages.Add(existing); continue; }
                            if (summary.Size > 25 * 1024 * 1024) continue;
                            var mime = folder.GetMessage(summary.UniqueId);
                            messages.Add(ConvertMessage(mime, account.Id, name, folder.FullName, folder.UidValidity, summary.UniqueId.Id, summary.Flags ?? MessageFlags.None));
                        }
                    }
                    folder.Close();
                }
                client.Disconnect(true);
            }
            return messages;
        }
        public static Message ConvertMessage(MimeMessage mime, string accountId, string localFolder, string remoteFolder, uint validity, uint uid, MessageFlags flags) {
            var from = mime.From.Mailboxes.FirstOrDefault();
            string body = mime.TextBody;
            if (String.IsNullOrEmpty(body) && !String.IsNullOrEmpty(mime.HtmlBody)) body = PlainHtml(mime.HtmlBody);
            var attachments = new List<MailAttachment>();
            foreach (var part in mime.Attachments.OfType<MimePart>()) {
                using (var data = new MemoryStream()) { part.Content.DecodeTo(data); attachments.Add(new MailAttachment { Name = Path.GetFileName(part.FileName ?? "attachment"), Size = data.Length, Data = System.Convert.ToBase64String(data.ToArray()) }); }
            }
            return new Message { Id = accountId + ":" + remoteFolder + ":" + validity + ":" + uid, InternetMessageId = mime.MessageId, AccountId = accountId, RemoteFolder = remoteFolder, RemoteUid = uid, UidValidity = validity, Sender = from == null ? "Unknown sender" : (String.IsNullOrEmpty(from.Name) ? from.Address : from.Name), Address = from == null ? "" : from.Address, To = String.Join("; ", mime.To.Mailboxes.Select(m => m.Address)), Cc = String.Join("; ", mime.Cc.Mailboxes.Select(m => m.Address)), Subject = mime.Subject ?? "(No subject)", Body = body ?? "", Folder = localFolder, Date = mime.Date.LocalDateTime, Unread = (flags & MessageFlags.Seen) == 0, Starred = (flags & MessageFlags.Flagged) != 0, Attachments = attachments, Importance = mime.Importance.ToString() };
        }
        public static MimeMessage CreateMime(Message message) {
            var mime = new MimeMessage(); mime.From.Add(new MailboxAddress(message.Sender, message.Address));
            foreach (string value in Split(message.To)) mime.To.Add(MailboxAddress.Parse(value));
            foreach (string value in Split(message.Cc)) mime.Cc.Add(MailboxAddress.Parse(value));
            foreach (string value in Split(message.Bcc)) mime.Bcc.Add(MailboxAddress.Parse(value));
            mime.Subject = message.Subject; mime.MessageId = message.InternetMessageId ?? MimeKit.Utils.MimeUtils.GenerateMessageId();
            var body = new BodyBuilder { TextBody = message.Body, HtmlBody = message.HtmlBody };
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
                    if (tag != null) { if (tag.Id == HtmlTagId.Script || tag.Id == HtmlTagId.Style || tag.Id == HtmlTagId.Head) hidden = !tag.IsEndTag; if (!hidden && (tag.Id == HtmlTagId.Br || tag.Id == HtmlTagId.P || tag.Id == HtmlTagId.Div || tag.Name.Equals("tr", StringComparison.OrdinalIgnoreCase) || tag.Name.Equals("li", StringComparison.OrdinalIgnoreCase))) text.AppendLine(); }
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
        public void Move(List<Message> messages, string target) {
            using (var client = Connect()) {
                var destination = Folder(client, target); if (destination == null) throw new InvalidOperationException("The server does not advertise a " + target + " folder.");
                foreach (var group in messages.Where(m => m.RemoteUid != 0).GroupBy(m => m.RemoteFolder)) {
                    var source = client.GetFolder(group.Key); source.Open(FolderAccess.ReadWrite);
                    if (group.Any(m => m.UidValidity != source.UidValidity)) throw new InvalidOperationException("The server mailbox changed. Sync before moving messages.");
                    source.MoveTo(group.Select(m => new UniqueId(m.RemoteUid)).ToList(), destination); source.Close();
                }
                client.Disconnect(true);
            }
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
    }
}
