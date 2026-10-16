using System;
using System.IO;
using System.Linq;
using Postbox;

class MailStoreTests {
    static int checks;
    static void Check(bool condition, string message) { if (!condition) throw new Exception(message); checks++; }
    static void Main(string[] args) {
        string path = Path.Combine(args[0], Guid.NewGuid().ToString(), "mailbox.json");
        var store = new MailStore(path);
        Check(store.Query("Inbox", "", false).Count() == 7, "Seed inbox");
        Check(store.Query("Inbox", "SOPHIE", false).Count() == 1, "Case insensitive search");
        Check(store.Query("Inbox", "room to think", false).Count() == 1, "Body search");
        Check(store.Query("Inbox", "", true).Count() == 3, "Unread filter");
        var message = store.Query("Inbox", "Sophie", false).Single();
        store.Move(message, "Trash");
        Check(!store.Query("Starred", "Sophie", false).Any(), "Trash excluded from stars");
        Check(store.Query("Trash", "Sophie", false).Count() == 1, "Move to trash");
        store.Move(message, "Inbox");
        Check(store.Query("Starred", "Sophie", false).Count() == 1, "Restore retains star");
        var draft = store.SaveDraft(null, "test@example.com", "Draft", "Hello\n世界", false);
        string id = draft.Id;
        int count = store.Messages.Count;
        store.SaveDraft(id, "updated@example.com", "Updated", "Unicode ✓", false);
        Check(store.Messages.Count == count, "Draft updates do not duplicate");
        store.SaveDraft(id, "updated@example.com", "", "Unicode ✓", true);
        Check(store.Messages.Single(m => m.Id == id).Folder == "Sent", "Send moves draft to sent");
        Check(store.Messages.Single(m => m.Id == id).Subject == "(No subject)", "Empty subject fallback");
        Check(!store.Query("Drafts", "updated@example.com", false).Any(), "Sent draft removed from drafts");
        var reload = new MailStore(path);
        Check(reload.Messages.Count == count, "Reload preserves count");
        Check(reload.Messages.Single(m => m.Id == id).Body == "Unicode ✓", "Unicode persistence");
        Check(reload.Query("Sent", "UPDATED@EXAMPLE.COM", false).Count() == 1, "Search recipients");
        Check(!File.Exists(path + ".tmp"), "Atomic save temp removed");
        var bulk = reload.Query("Inbox", "", false).Take(3).ToList();
        reload.MoveMany(bulk, "Archive"); Check(bulk.All(m => m.Folder == "Archive"), "Bulk archive");
        try { reload.MoveMany(bulk, "invalid"); throw new Exception("Invalid folder accepted"); } catch (ArgumentException) { Check(bulk.All(m => m.Folder == "Archive"), "Invalid bulk move leaves mail unchanged"); }
        var rich = reload.Messages.Single(m => m.Id == id); rich.RichBody = "sample"; rich.Cc = "cc@example.com"; rich.Bcc = "bcc@example.com"; rich.Importance = "High"; rich.FollowUp = true;
        rich.Attachments = new System.Collections.Generic.List<MailAttachment> { new MailAttachment { Name = "large.bin", Data = Convert.ToBase64String(new byte[2200000]), Size = 2200000 } }; reload.Save();
        var richReload = new MailStore(path).Messages.Single(m => m.Id == id);
        Check(richReload.Attachments.Single().Size == 2200000 && richReload.RichBody == "sample" && richReload.Cc == "cc@example.com" && richReload.FollowUp, "Rich metadata and large attachment persistence");
        File.WriteAllText(path, "broken json");
        var recovered = new MailStore(path);
        Check(recovered.LoadWarning != null, "Recovery warning");
        Check(Directory.GetFiles(Path.GetDirectoryName(path), "*.recovery-*").Length == 1, "Corrupt data preserved");
        Check(recovered.Messages.Count == 8, "Recovery seed");
        Console.WriteLine("Passed " + checks + " mailbox checks.");
    }
}
