using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using MailKit;
using MailKit.Net.Imap;

namespace Postbox {
    public sealed class SyncProgress { public string Folder { get; set; } public int Completed { get; set; } public int Total { get; set; } public string Phase { get; set; } }
    public sealed class SyncSnapshot { public List<Message> Messages = new List<Message>(); public List<ServerFolder> Folders = new List<ServerFolder>(); }
    public sealed partial class MailTransport {
        public static string FolderKey(string path) { return "Server:" + Uri.EscapeDataString(path); }
        public SyncSnapshot Synchronize(List<Message> cached, Action<SyncProgress> progress, Action<List<ServerFolder>> discovered, Action<ServerFolder, List<Message>> folderComplete, CancellationToken cancellation) {
            var snapshot = new SyncSnapshot();
            var copies = new System.Web.Script.Serialization.JavaScriptSerializer { MaxJsonLength = 268435456 };
            cached = copies.Deserialize<List<Message>>(copies.Serialize(cached));
            Action<string, string, int, int> report = delegate(string phase, string name, int done, int total) { if (progress != null) progress(new SyncProgress { Phase = phase, Folder = name, Completed = done, Total = total }); };
            report("Connecting securely", "", 0, 0);
            using (var client = Connect(cancellation)) {
                report("Discovering folders", "", 0, 0);
                var folders = new Dictionary<string, IMailFolder>();
                foreach (var space in client.PersonalNamespaces) foreach (var value in client.GetFolders(space, StatusItems.Count | StatusItems.Unread, false, cancellation)) folders[value.FullName] = value;
                folders[client.Inbox.FullName] = client.Inbox;
                var mapped = new Dictionary<string, string> { { client.Inbox.FullName, "Inbox" } };
                foreach (string name in new[] { "Drafts", "Sent", "Archive", "Trash" }) { try { var value = Folder(client, name); if (value != null) { mapped[value.FullName] = name; folders[value.FullName] = value; } } catch (NotSupportedException) { } }
                foreach (var value in folders.Values.OrderBy(f => f.FullName == client.Inbox.FullName ? 0 : 1).ThenBy(f => f.FullName)) {
                    int separator = value.DirectorySeparator == '\0' ? -1 : value.FullName.LastIndexOf(value.DirectorySeparator);
                    snapshot.Folders.Add(new ServerFolder { Name = value.Name, Path = value.FullName, ParentPath = separator < 0 ? "" : value.FullName.Substring(0, separator), LocalName = mapped.ContainsKey(value.FullName) ? mapped[value.FullName] : FolderKey(value.FullName), Count = value.Count, Unread = value.Unread, Selectable = (value.Attributes & FolderAttributes.NoSelect) == 0 });
                }
                if (discovered != null) discovered(snapshot.Folders);
                int completed = 0, total = snapshot.Folders.Where(f => f.Selectable).Sum(f => Math.Min(f.Count, 200));
                foreach (var item in snapshot.Folders.Where(f => f.Selectable)) {
                    cancellation.ThrowIfCancellationRequested(); var folder = folders[item.Path]; var batch = new List<Message>();
                    report("Checking folder", item.Name, completed, total); folder.Open(FolderAccess.ReadOnly, cancellation); item.Count = folder.Count; item.Unread = folder.Unread;
                    if (folder.Count > 0) {
                        var summaries = folder.Fetch(Math.Max(0, folder.Count - 200), -1, MessageSummaryItems.UniqueId | MessageSummaryItems.Flags | MessageSummaryItems.Size, cancellation);
                        foreach (var summary in summaries) {
                            cancellation.ThrowIfCancellationRequested();
                            var existing = cached.FirstOrDefault(m => m.RemoteFolder == folder.FullName && m.UidValidity == folder.UidValidity && m.RemoteUid == summary.UniqueId.Id && m.ContentVersion >= 2);
                            if (existing != null) { existing.Folder = item.LocalName; existing.Unread = (summary.Flags & MessageFlags.Seen) == 0; existing.Starred = (summary.Flags & MessageFlags.Flagged) != 0; batch.Add(existing); }
                            else if (summary.Size <= 25 * 1024 * 1024) batch.Add(ConvertMessage(folder.GetMessage(summary.UniqueId, cancellation), account.Id, item.LocalName, folder.FullName, folder.UidValidity, summary.UniqueId.Id, summary.Flags ?? MessageFlags.None));
                            report("Syncing", item.Name, ++completed, Math.Max(total, completed));
                        }
                    }
                    folder.Close(false, cancellation); snapshot.Messages.AddRange(batch); if (folderComplete != null) folderComplete(item, batch);
                }
                client.Disconnect(true, cancellation);
            }
            return snapshot;
        }
        public void WatchInbox(Action changed, Action<bool, string> connection, CancellationToken cancellation) {
            int retry = 2;
            while (!cancellation.IsCancellationRequested) {
                try {
                    using (var client = Connect(cancellation)) {
                        client.Inbox.Open(FolderAccess.ReadOnly, cancellation); connection(true, "Listening for new mail"); retry = 2;
                        while (!cancellation.IsCancellationRequested && client.IsConnected) {
                            bool dirty = false;
                            using (var done = CancellationTokenSource.CreateLinkedTokenSource(cancellation)) {
                                EventHandler<EventArgs> handler = delegate { dirty = true; if (!done.IsCancellationRequested) done.Cancel(); };
                                EventHandler<MessageFlagsChangedEventArgs> flags = delegate { dirty = true; if (!done.IsCancellationRequested) done.Cancel(); };
                                client.Inbox.CountChanged += handler; client.Inbox.MessageFlagsChanged += flags;
                                try {
                                    if (client.Capabilities.HasFlag(ImapCapabilities.Idle)) { done.CancelAfter(TimeSpan.FromMinutes(8)); client.Idle(done.Token, cancellation); }
                                    else { if (cancellation.WaitHandle.WaitOne(10000)) break; client.NoOp(cancellation); }
                                } finally { client.Inbox.CountChanged -= handler; client.Inbox.MessageFlagsChanged -= flags; }
                            }
                            if (dirty) changed();
                        }
                    }
                } catch (OperationCanceledException) { if (cancellation.IsCancellationRequested) break; }
                catch (Exception) { connection(false, "Connection interrupted · reconnecting"); }
                if (cancellation.WaitHandle.WaitOne(retry * 1000)) break; retry = Math.Min(60, retry * 2);
            }
        }
    }
}
