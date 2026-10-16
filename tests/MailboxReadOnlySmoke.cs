using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using MailKit;
using MailKit.Net.Imap;
using Postbox;
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8")]
class MailboxReadOnlySmoke {
    static int Main() {
        try {
            string path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TMA-Mail");
            var accounts = new AccountStore(path); var account = accounts.Load(); if (account == null) { Console.WriteLine("No connected account available for a read-only check."); return 2; }
            var transport = new Postbox.MailTransport(account, accounts, false);
            using (var client = (ImapClient)typeof(Postbox.MailTransport).GetMethod("Connect", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(transport, new object[] { CancellationToken.None })) {
                int count = 0; foreach (var space in client.PersonalNamespaces) count += client.GetFolders(space, StatusItems.Count | StatusItems.Unread, false).Count;
                Console.WriteLine("Authenticated read-only check: " + count + " server folders discovered; IMAP IDLE supported=" + client.Capabilities.HasFlag(ImapCapabilities.Idle));
                client.Inbox.Open(FolderAccess.ReadOnly);
                if (client.Inbox.Count > 0) { var mime = client.Inbox.GetMessage(client.Inbox.Count - 1); var converted = Postbox.MailTransport.ConvertMessage(mime, account.Id, "Inbox", client.Inbox.FullName, client.Inbox.UidValidity, 1, MessageFlags.None); Console.WriteLine("Newest message HTML preserved=" + !String.IsNullOrEmpty(converted.HtmlBody) + "; embedded image count=" + converted.InlineImages.Count); }
                if (client.Capabilities.HasFlag(ImapCapabilities.Idle)) using (var done = new CancellationTokenSource(TimeSpan.FromSeconds(3))) { client.Idle(done.Token); Console.WriteLine("Server accepted IMAP IDLE."); }
                client.Disconnect(true);
            }
            Console.WriteLine("No message flags, credentials, or mailbox files were changed. No email was sent."); return 0;
        } catch (Exception error) { Console.Error.WriteLine(error.GetType().Name + ": " + error.Message); return 1; }
    }
}
