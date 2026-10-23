using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Threading;
using Avalonia.VisualTree;
using MimeKit;
using Postbox;
using TmaMail.Core;
using TmaMail.Desktop;
using MailTransport = Postbox.MailTransport;

internal static class CoreChecks {
    private static int checks;
    private static void Check(bool condition, string message) { if (!condition) throw new Exception(message); checks++; }
    private sealed class MemoryKeys(byte[] key) : IProfileKeyProvider {
        public ValueTask<ReadOnlyMemory<byte>> GetKeyAsync(string profileId, CancellationToken cancellation) { cancellation.ThrowIfCancellationRequested(); return ValueTask.FromResult<ReadOnlyMemory<byte>>(key); }
    }
    private sealed class UnavailableKeys : IProfileKeyProvider {
        public ValueTask<ReadOnlyMemory<byte>> GetKeyAsync(string profileId, CancellationToken cancellation) => throw new InvalidOperationException("Synthetic locked vault");
    }
    [STAThread] public static void Main(string[] args) {
        var directory = Path.GetFullPath(args.Length == 0 ? Path.Combine(Path.GetTempPath(), "tma-portability-" + Guid.NewGuid().ToString("N")) : args[0]);
        Directory.CreateDirectory(directory);
        try { typeof(SyncFolderTests).GetMethod("Main", BindingFlags.Static | BindingFlags.NonPublic)!.Invoke(null, null); }
        catch (TargetInvocationException ex) { throw ex.InnerException!; }
        VerifyCore(); VerifyCache(directory).GetAwaiter().GetResult(); VerifyUi(directory);
        Console.WriteLine($"Passed {checks} portable model/MIME/cache/UI checks on {System.Runtime.InteropServices.RuntimeInformation.OSDescription}. Synthetic data only.");
    }
    private static void VerifyCore() {
        Check(MailAddressValidation.Validate("  sample@example.com  ") == "sample@example.com", "Shared email validation changed");
        try { MailAddressValidation.Validate("Name <sample@example.com>"); throw new Exception("Display name accepted as a bare login address"); } catch (FormatException) { checks++; }
        var account = new MailAccount { Email = "sample@example.com", Provider = "Gmail", Password = "synthetic-only", ImapHost = "imap.example.com", ImapPort = 993, SmtpHost = "smtp.example.com", SmtpPort = 465 };
        account.Validate(); Check(account.UserName == account.Email && !string.IsNullOrEmpty(account.Id), "Shared account initialization failed");
        Check(!new ProviderConfiguration().Ready("Gmail"), "Unconfigured Google login was enabled");
        var message = new Message { Sender = "Synthetic sender", Address = account.Email, To = "recipient@example.com", Subject = "Portable ✓", Body = "Plain body", HtmlBody = "<p>Portable body</p>", AccountId = account.Id, Folder = "Inbox" };
        using var stream = new MemoryStream(); MailTransport.CreateMime(message).WriteTo(stream); stream.Position = 0;
        var incoming = MailTransport.ConvertMessage(MimeMessage.Load(stream), account.Id, "Inbox", "INBOX", 9, 7, MailKit.MessageFlags.Seen);
        Check(incoming.Subject == message.Subject && incoming.RemoteUid == 7 && !incoming.Unread && incoming.Body == "Plain body", "Shared MIME conversion failed on modern .NET");
        Check(MailTransport.PlainHtml("<p>Readable &amp; safe</p><script>hidden()</script>").Contains("Readable & safe") && !MailTransport.PlainHtml("<script>hidden()</script>").Contains("hidden"), "HTML fallback exposed script text");
        string json = JsonSerializer.Serialize(incoming); Check(!json.Contains("StarLabel") && !json.Contains("Preview"), "UI-only computed properties leaked into portable storage");
        var uiTypes = typeof(Message).Assembly.GetReferencedAssemblies().Select(a => a.Name).ToArray();
        Check(!uiTypes.Any(n => n.StartsWith("Presentation") || n == "WindowsBase" || n == "System.Windows.Forms"), "Shared core still depends on Windows UI assemblies");
    }
    private static async Task VerifyCache(string directory) {
        var key = RandomNumberGenerator.GetBytes(32);
        var path = Path.Combine(directory, "synthetic-cache.enc");
        var cache = new EncryptedProfileFile(path, "synthetic-profile", new MemoryKeys(key));
        var value = new[] { new Message { Id = "cache", Folder = "Inbox", Subject = "private synthetic subject", Body = "private synthetic body", EditedSubject = "private synthetic subject" } };
        await cache.SaveAsync(value);
        var bytes = await File.ReadAllBytesAsync(path);
        Check(!Encoding.UTF8.GetString(bytes).Contains("private synthetic"), "Cache stored message content in plaintext");
        var loaded = await cache.LoadAsync<List<Message>>(); Check(loaded.Single().Body == value[0].Body && loaded[0].EditedSubject == value[0].EditedSubject, "Encrypted portable cache roundtrip failed");
        await cache.SaveAsync(value); Check(!Enumerable.SequenceEqual(bytes, await File.ReadAllBytesAsync(path)), "Encryption reused a nonce");
        var before = SHA256.HashData(await File.ReadAllBytesAsync(path));
        try { await new EncryptedProfileFile(path, "synthetic-profile", new MemoryKeys(RandomNumberGenerator.GetBytes(32))).LoadAsync<List<Message>>(); throw new Exception("Wrong key was accepted"); } catch (CryptographicException) { checks++; }
        Check(Enumerable.SequenceEqual(before, SHA256.HashData(await File.ReadAllBytesAsync(path))), "Failed decrypt overwrote the original cache");
        try { await new EncryptedProfileFile(path, "another-profile", new MemoryKeys(key)).LoadAsync<List<Message>>(); throw new Exception("A cache was accepted under another profile"); } catch (CryptographicException) { checks++; }
        string altered = Path.Combine(directory, "tampered.enc"); bytes = await File.ReadAllBytesAsync(path); bytes[^1] ^= 1; await File.WriteAllBytesAsync(altered, bytes);
        try { await new EncryptedProfileFile(altered, "synthetic-profile", new MemoryKeys(key)).LoadAsync<List<Message>>(); throw new Exception("Tampered cache was accepted"); } catch (CryptographicException) { checks++; }
        string locked = Path.Combine(directory, "locked.enc");
        try { await new EncryptedProfileFile(locked, "synthetic-profile", new UnavailableKeys()).SaveAsync(value); throw new Exception("Unavailable vault silently fell back"); } catch (InvalidOperationException error) when (error.Message == "Synthetic locked vault") { checks++; }
        Check(!File.Exists(locked), "Unavailable vault created a plaintext fallback");
        using (var stop = new CancellationTokenSource()) { stop.Cancel(); try { await cache.SaveAsync(value, stop.Token); throw new Exception("Cancelled save continued"); } catch (OperationCanceledException) { checks++; } }
        Check(Enumerable.SequenceEqual(before, SHA256.HashData(await File.ReadAllBytesAsync(path))), "Cancelled write replaced the committed file");
        await Task.WhenAll(cache.SaveAsync(new[] { new Message { Id = "first", Folder = "Inbox" } }), cache.SaveAsync(new[] { new Message { Id = "last", Folder = "Inbox" } }));
        Check((await cache.LoadAsync<List<Message>>()).Single().Id == "last", "Serialized cache writes finished out of order");
        Check(!Directory.GetFiles(directory, "*.tmp").Any(), "Atomic write left temporary files");
        if (!OperatingSystem.IsWindows()) Check((File.GetUnixFileMode(path) & (UnixFileMode.GroupRead | UnixFileMode.OtherRead | UnixFileMode.GroupWrite | UnixFileMode.OtherWrite)) == 0, "Cache permissions expose mail to other users");
        CryptographicOperations.ZeroMemory(key);
    }
    private static void VerifyUi(string directory) {
        AppBuilder.Configure<TmaMail.Desktop.App>().UseSkia().WithInterFont().UseHeadless(new AvaloniaHeadlessPlatformOptions { UseHeadlessDrawing = false }).SetupWithoutStarting();
        var model = new MailboxViewModel(); var window = new MainWindow { DataContext = model };
        window.Show(); Dispatcher.UIThread.RunJobs();
        Check(model.Messages.Count == 2 && model.Selected != null, "Sample mailbox failed to load");
        var search = window.GetVisualDescendants().OfType<TextBox>().Single(); search.Text = "familiar"; Dispatcher.UIThread.RunJobs();
        Check(model.Messages.Count == 1 && model.Selected.Subject.Contains("familiar"), "Search binding did not filter messages");
        search.Text = ""; Dispatcher.UIThread.RunJobs(); var id = model.Selected.Value.Id;
        model.DeleteCommand.Execute(null); Check(model.Messages.All(m => m.Value.Id != id), "Preview Delete did not update immediately");
        model.TrashCommand.Execute(null); Check(model.Messages.Single().Value.Id == id && model.DeleteLabel == "Restore", "Trash view lost deleted sample");
        model.DeleteCommand.Execute(null); model.InboxCommand.Execute(null); Check(model.Messages.Any(m => m.Value.Id == id), "Restore failed");
        bool unread = model.Selected.Value.Unread; model.ReadCommand.Execute(null); Check(model.Selected.Value.Unread != unread, "Mark read command failed");
        model.StarCommand.Execute(null); Check(model.Selected.Value.Starred && model.Selected.Subject.StartsWith("★"), "Star command failed");
        foreach (int width in new[] { 820, 1180, 1600 }) {
            window.Width = width; Dispatcher.UIThread.RunJobs();
            Check(window.ClientSize.Width == width && window.GetVisualDescendants().OfType<Button>().Where(b => b.Command == model.DeleteCommand).Single().Bounds.Height > 20, "Responsive layout clipped its actions");
            using var frame = window.CaptureRenderedFrame() ?? throw new Exception("Preview frame was not rendered"); frame.Save(Path.Combine(directory, $"preview-{width}.png"), Avalonia.Media.Imaging.PngBitmapEncoderOptions.Default);
        }
        window.Close();
    }
}
