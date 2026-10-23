using System;
using System.Collections.Generic;
using System.Linq;
#if NET10_0_OR_GREATER
using ScriptIgnore = System.Text.Json.Serialization.JsonIgnoreAttribute;
#else
using System.Web.Script.Serialization;
#endif

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
        public string Category { get; set; }
        public string Subject { get; set; }
        public string EditedSubject { get; set; }
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
        [ScriptIgnore] public string FollowUpLabel { get { return FollowUp ? "⚑ Follow up" : ""; } }
    }

}
