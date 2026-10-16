using System;
using System.Collections.Generic;
using System.IO;
using Postbox;
class WorkspacePreviewData {
    static void Main(string[] args) {
        string directory = args[0]; Directory.CreateDirectory(directory); var accounts = new AccountStore(directory);
        foreach (string name in new[] { "alex@work.example", "alex@home.example" }) {
            var account = ProviderChoices.Account("Other IMAP"); account.Email = name; account.Password = "synthetic-preview-only"; account.ImapHost = "127.0.0.1"; account.SmtpHost = "127.0.0.1"; account.Validate();
            var project = Postbox.MailTransport.FolderKey("Projects/Design");
            account.Folders = new List<ServerFolder> { new ServerFolder { Name = "Inbox", Path = "INBOX", LocalName = "Inbox", Count = 1, Unread = 1, Selectable = true }, new ServerFolder { Name = "Design", Path = "Projects/Design", ParentPath = "Projects", LocalName = project, Count = 1, Unread = 1, Selectable = true } };
            accounts.Save(account, name.Contains("work"));
            var store = new MailStore(Path.Combine(directory, "mail-" + account.Id + ".protected"), true, false);
            store.Messages.Add(new Message { Id = account.Id + "-inbox", AccountId = account.Id, Folder = "Inbox", Date = DateTime.Now, Sender = "Studio team", Address = "studio@example.com", To = name, Subject = "A more colourful inbox", Body = "Welcome to your workspace. This sample checks formatted text, tables and an embedded logo.", HtmlBody = "<div style='max-width:620px;margin:auto;padding:32px;background:#f1f8f3;border-radius:16px'><img src='cid:mail-logo' width='70' height='70'><h1 style='font: bold 32px Segoe UI;color:#174b31'>A more colourful inbox</h1><p style='font:16px Segoe UI;line-height:1.7'>Your message can keep its <b>formatting</b>, <i>images</i> and original layout.</p><table style='width:100%;border-collapse:collapse'><tr><td style='padding:20px;background:#fff;color:#2e6545'>Embedded graphics</td><td style='padding:20px;background:#dceee2;color:#174b31'>Clear layouts</td></tr></table><p style='margin-top:24px;color:#4b6355'>A native desktop workspace with your mail at the centre.</p></div>", InlineImages = new List<InlineMailImage> { new InlineMailImage { ContentId = "mail-logo", MimeType = "image/png", Data = Convert.ToBase64String(File.ReadAllBytes(args[1])) } } });
            store.Messages.Add(new Message { Id = account.Id + "-project", AccountId = account.Id, Folder = project, Date = DateTime.Now, Sender = "Project team", Address = "projects@example.com", To = name, Subject = "Design notes", Body = "A sample message in a nested server folder.", Unread = true }); store.Save();
        }
        new SettingsStore(Path.Combine(directory, "settings.json")).Save(new Preferences { SetupCompleted = true, DisplayName = "Alex Rivers" });
    }
}
