using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Threading;
using Postbox;
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8")]
class ResponsivenessTests {
    static object Get(object value, string field) { return value.GetType().GetField(field, BindingFlags.NonPublic | BindingFlags.Instance).GetValue(value); }
    static object Call(object value, string method, params object[] args) { return value.GetType().GetMethod(method, BindingFlags.NonPublic | BindingFlags.Instance).Invoke(value, args); }
    static void Check(bool value, string message) { if (!value) throw new Exception(message); }
    [STAThread] static int Main(string[] args) {
        var app = new App(); Call(app, "Initialize"); var window = (Window)Get(app, "window"); window.Title = "TMA-Mail responsiveness verification · synthetic content";
        var root = (Grid)window.Content;
        var vertical = new ScrollBar { Orientation = Orientation.Vertical, Maximum = 100000, ViewportSize = 1, Height = 300, HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Center };
        var horizontal = new ScrollBar { Orientation = Orientation.Horizontal, Maximum = 100000, ViewportSize = 1, Width = 300, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Bottom };
        root.Children.Add(vertical); root.Children.Add(horizontal);
        window.Loaded += async delegate {
            try {
                window.UpdateLayout(); vertical.ApplyTemplate(); horizontal.ApplyTemplate();
                var vTrack = (Track)vertical.Template.FindName("PART_Track", vertical); var hTrack = (Track)horizontal.Template.FindName("PART_Track", horizontal);
                Check(vTrack.Thumb.ActualHeight >= 43 && hTrack.Thumb.ActualWidth >= 43, "Scrollbar thumbs became smaller than the 44px minimum");
                var mailbox = new MailStore(Path.Combine(args[1], "large-cache.protected"), true, false);
                string body = new string('x', 8192), html = "<p>" + body + "</p>";
                for (int i = 0; i < 2400; i++) mailbox.Messages.Add(new Message { Id = "message-" + i, Subject = "Synthetic " + i, Body = body, HtmlBody = html, Folder = "Inbox", RemoteFolder = "INBOX", RemoteUid = (uint)i + 1, UidValidity = 1, ContentVersion = 2, Unread = true });
                var original = mailbox.Messages[0]; var clone = original.CopyForSync(); clone.Unread = false;
                Check(original.Unread && Object.ReferenceEquals(original.HtmlBody, clone.HtmlBody), "Sync copied large bodies or mutated live flags");
                var same = mailbox.Messages.Select(m => m.CopyForSync()).ToList();
                Check(!mailbox.ApplyFolderBatch(new ServerFolder { Path = "INBOX", LocalName = "Inbox" }, same) && Object.ReferenceEquals(mailbox.Messages[0], original), "Unchanged folder rebuilt live rows");
                same[0].Unread = false;
                Check(mailbox.ApplyFolderBatch(new ServerFolder { Path = "INBOX", LocalName = "Inbox" }, same) && !mailbox.Messages[0].Unread, "Changed flags were not merged");
                int pulses = 0; var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(20) }; timer.Tick += delegate { pulses++; }; timer.Start();
                var stopwatch = Stopwatch.StartNew(); var write = mailbox.SaveAsync(); long captureMs = stopwatch.ElapsedMilliseconds;
                Check(captureMs < 300, "Cache serialization blocked the UI before returning a task");
                window.WindowState = WindowState.Minimized; await Task.Delay(50); Call(app, "RestoreWindow");
                Check(window.IsVisible && window.WindowState == WindowState.Normal, "Window could not restore during background cache writing");
                await write; timer.Stop(); Check(pulses > 0, "Dispatcher stopped processing while encrypted cache was written");
                mailbox.Messages[0].Subject = "earlier"; var first = mailbox.SaveAsync(); mailbox.Messages[0].Subject = "latest"; var last = mailbox.SaveAsync(); await Task.WhenAll(first, last);
                var reloaded = await Task.Run(() => new MailStore(Path.Combine(args[1], "large-cache.protected"), true, false));
                Check(reloaded.Messages[0].Subject == "latest", "An older cache write overwrote newer mail");
                string json = await Task.Run(() => ProtectedFile.Read(Path.Combine(args[1], "large-cache.protected")));
                Check(!json.Contains("\"Preview\":") && !json.Contains("\"Initials\":"), "Display-only properties were serialized into the cache");
                Console.WriteLine("Passed large-cache responsiveness: 2400 synthetic messages, " + pulses + " UI timer ticks, " + captureMs + "ms snapshot capture; minimize/restore, write ordering, unchanged-folder reuse, and 44px scrollbar thumbs passed. No server contacted.");
                app.Shutdown(0);
            } catch (Exception error) { Console.WriteLine(error); app.Shutdown(1); }
        };
        window.Show(); return app.Run();
    }
}
