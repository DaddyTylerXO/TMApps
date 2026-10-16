using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace TMApps {
    public class Tests {
        class PackageHandler : HttpMessageHandler {
            public byte[] Bytes;
            public bool UsedAuth; public string LastUrl;
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) {
                token.ThrowIfCancellationRequested();
                LastUrl = request.RequestUri.AbsoluteUri;
                UsedAuth = request.Headers.Authorization != null;
                if (request.RequestUri.AbsolutePath.EndsWith("/releases/tags/tma-apps"))
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"assets\":[{\"name\":\"fixture.zip\",\"id\":123}]}") });
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(Bytes) });
            }
        }
        class QuietProgress : IProgress<string> { public void Report(string value) {} }
        static int count;
        static void Check(bool condition, string label) { if (!condition) throw new Exception(label); count++; Console.WriteLine("PASS " + label); }
        static void Reject(Action action, string label) { try { action(); } catch { count++; Console.WriteLine("PASS " + label); return; } throw new Exception("Expected rejection: " + label); }
        static void Zip(string path, string entry, string contents) { using(var zip = ZipFile.Open(path, ZipArchiveMode.Create)) using(var writer = new StreamWriter(zip.CreateEntry(entry).Open())) writer.Write(contents); }
        [STAThread] public static int Main(string[] args) {
            string root = Path.Combine(args[0], "build", "test-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
            try {
                var catalog = LauncherService.ParseCatalog(File.ReadAllText(Path.Combine(args[0], "catalog.json")));
                Check(catalog.apps.Count == 2 && catalog.apps.All(a => a.Available), "Both real app packages bundled in catalog");
                Check(LauncherService.TrustedUrl(catalog.apps[0].downloadUrl), "Pinned Mail artifact URL");
                Check(!LauncherService.TrustedUrl("https://github.com/attacker/TMApps/releases/download/a/file.zip"), "Reject other repositories");
                Check(!LauncherService.TrustedUrl("https://github.com.evil.test/DaddyTylerXO/TMApps/releases/download/file"), "Reject lookalike host");
                Check(!LauncherService.TrustedUrl("http://github.com/DaddyTylerXO/TMApps/releases/download/file"), "Require HTTPS");
                Check(!LauncherService.TrustedUrl("https://user@github.com/DaddyTylerXO/TMApps/releases/download/file"), "Reject URL credentials");
                Reject(() => LauncherService.ParseCatalog("{}"), "Reject invalid catalog");
                string original = File.ReadAllText(Path.Combine(args[0], "catalog.json"));
                Reject(() => LauncherService.ParseCatalog(original.Replace("Agent Office.exe", "..\\\\evil.exe")), "Reject arbitrary executable");
                Reject(() => LauncherService.ParseCatalog(original.Replace("tma-agent-office", "tma-mail")), "Reject duplicate app");
                Reject(() => LauncherService.ParseCatalog(original.Replace(catalog.apps[0].sha256, "bad")), "Require checksum");
                Check(LauncherService.IsNewer("0.10.0", "0.9.0"), "Numeric version comparison");
                Check(LauncherService.IsNewer("1.0.0", "1.0.0-beta"), "Stable version follows beta");
                Check(!LauncherService.IsNewer("1.0.0-beta", "1.0.0"), "Never downgrade stable to beta");
                Check(!LauncherService.IsNewer("1.0.0", "1.0.0"), "Equal version is not update");
                string zip = Path.Combine(root, "app.zip"); Zip(zip, "nested/file.txt", "verified content");
                LauncherService.Extract(zip, Path.Combine(root, "safe"), CancellationToken.None);
                Check(File.ReadAllText(Path.Combine(root, "safe", "nested", "file.txt")) == "verified content", "Extract nested package");
                Reject(() => LauncherService.VerifyHash(zip, new string('0',64)), "Reject corrupted download");
                string bad = Path.Combine(root, "bad.zip"); Zip(bad, "../outside.txt", "bad");
                Reject(() => LauncherService.Extract(bad, Path.Combine(root, "unsafe"), CancellationToken.None), "Reject archive traversal");
                Check(!File.Exists(Path.Combine(root, "outside.txt")), "Traversal writes no outside file");
                var cancel = new CancellationTokenSource(); cancel.Cancel();
                Reject(() => LauncherService.Extract(zip, Path.Combine(root, "cancelled"), cancel.Token), "Extraction cancellation");
                string state = Path.Combine(root, "atomic.json"); LauncherService.AtomicWrite(state, "old"); LauncherService.AtomicWrite(state, "new");
                Check(File.ReadAllText(state) == "new" && !File.Exists(state + ".tmp"), "Atomic state replacement");
                using (var service = new LauncherService(Path.Combine(root, "profile"))) {
                    var app = catalog.apps[0]; Check(service.GetInstalled(app) == null, "Fresh library is empty");
                    string appRoot = Path.Combine(service.Root, "apps", app.id); Directory.CreateDirectory(appRoot);
                    File.WriteAllText(Path.Combine(appRoot, "installed.json"), "{\"folder\":\"../../elsewhere\",\"version\":\"1.0.0\",\"executable\":\"TMA-Mail.exe\"}");
                    Check(service.GetInstalled(app) == null, "Reject tampered installation folder");
                    string folder = Guid.NewGuid().ToString("N"); Directory.CreateDirectory(Path.Combine(appRoot, folder)); File.WriteAllText(Path.Combine(appRoot, folder, app.executable), "fixture");
                    LauncherService.AtomicWrite(Path.Combine(appRoot, "installed.json"), LauncherService.Json.Serialize(new Installed { folder = folder, version = "0.7.0-beta", executable = app.executable }));
                    Check(service.GetInstalled(app).version == "0.7.0-beta", "Detect installed app");
                    string userData = Path.Combine(service.Root, "user-data.txt"); File.WriteAllText(userData, "keep"); service.Uninstall(app);
                    Check(service.GetInstalled(app) == null && File.Exists(userData), "Uninstall removes binaries and preserves other data");
                    File.WriteAllText(Path.Combine(service.Root,"catalog.json"), "broken");
                    Check(service.LoadCatalog(Path.Combine(args[0], "catalog.json")).apps.Count == 2, "Corrupt cache falls back to bundled catalog");
                }
                string package = Path.Combine(root, "valid.zip"); Zip(package, "TMA-Mail.exe", "first application fixture");
                var handler = new PackageHandler { Bytes = File.ReadAllBytes(package) };
                var candidate = LauncherService.ParseCatalog(original).apps[0];
                candidate.version = "0.8.0-beta";
                using (var sha = SHA256.Create()) candidate.sha256 = BitConverter.ToString(sha.ComputeHash(handler.Bytes)).Replace("-", "").ToLowerInvariant();
                using (var service = new LauncherService(Path.Combine(root, "install-profile"), handler)) {
                    service.Install(candidate, new QuietProgress(), CancellationToken.None).GetAwaiter().GetResult();
                    var initial = service.GetInstalled(candidate);
                    Check(initial != null && initial.version == "0.8.0-beta", "Install downloads, verifies, and activates package");
                    candidate.version = "0.9.0-beta";
                    service.Install(candidate, new QuietProgress(), CancellationToken.None).GetAwaiter().GetResult();
                    var updated = service.GetInstalled(candidate);
                    Check(updated.version == "0.9.0-beta" && updated.folder != initial.folder, "Update switches to staged version");
                    Check(!Directory.Exists(service.InstalledFolder(candidate, initial)), "Successful update removes old binaries");
                    candidate.sha256 = new string('0',64);
                    Reject(() => service.Install(candidate, new QuietProgress(), CancellationToken.None).GetAwaiter().GetResult(), "Reject checksum mismatch during update");
                    Check(service.GetInstalled(candidate).folder == updated.folder, "Failed update preserves current installation");
                    Reject(() => service.Install(candidate, new QuietProgress(), cancel.Token).GetAwaiter().GetResult(), "Cancel package download");
                    Check(service.GetInstalled(candidate).folder == updated.folder, "Cancelled update preserves installation");
                    Check(Directory.GetFiles(Path.Combine(service.Root,"apps",candidate.id), "*.zip").Length == 0, "Failed and cancelled downloads are cleaned up");
                    service.Uninstall(candidate);
                    string fixtureToken = new string('a',40);
                    service.SaveToken(fixtureToken);
                    Check(service.HasToken, "Private GitHub connection saved");
                    Check(!System.Text.Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(service.Root,"github-token.dat"))).Contains(fixtureToken), "GitHub token is encrypted on disk");
                    using (var second = new LauncherService(service.Root)) Check(second.HasToken, "Windows user can reload encrypted token");
                    using (var sha = SHA256.Create()) candidate.sha256 = BitConverter.ToString(sha.ComputeHash(handler.Bytes)).Replace("-", "").ToLowerInvariant();
                    candidate.downloadUrl = "https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/fixture.zip";
                    service.Install(candidate, new QuietProgress(), CancellationToken.None).GetAwaiter().GetResult();
                    Check(handler.UsedAuth && handler.LastUrl == "https://api.github.com/repos/DaddyTylerXO/TMApps/releases/assets/123", "Private release uses authenticated asset API");
                    candidate.downloadUrl = "https://raw.githubusercontent.com/DaddyTylerXO/TMApps/a9625524f2717e948285eabfd19d958c556f2d4a/dist/TMA-Mail-0.8.0-beta-windows.zip";
                    service.Install(candidate, new QuietProgress(), CancellationToken.None).GetAwaiter().GetResult();
                    Check(handler.UsedAuth && handler.LastUrl.Contains("/contents/dist/") && handler.LastUrl.Contains("?ref="), "Private source artifact uses contents API");
                    service.SaveToken(""); Check(!service.HasToken && !File.Exists(Path.Combine(service.Root,"github-token.dat")), "Disconnect removes GitHub token");
                    Reject(() => service.SaveToken("invalid\r\ntoken"), "Reject malformed token");
                }
                string standalone = Path.Combine(root,"standalone"); Directory.CreateDirectory(standalone);
                string exe = Path.Combine(standalone,"TMApps-Launcher.exe"); File.Copy(Path.Combine(args[0],"build","TMApps-Launcher.exe"),exe);
                string report = Path.Combine(standalone,"verification.txt");
                var start = new System.Diagnostics.ProcessStartInfo(exe, "--verify-package \"" + report + "\"") { WorkingDirectory = standalone, UseShellExecute = false, CreateNoWindow = true };
                using (var process = System.Diagnostics.Process.Start(start)) { if (!process.WaitForExit(15000)) { process.Kill(); throw new Exception("Standalone startup timed out"); } Check(process.ExitCode == 0 && File.ReadAllText(report).StartsWith("OK:"), "EXE loads UI and catalog alone in empty folder"); }
                Check(Directory.GetFiles(standalone).Length == 2, "Standalone startup needs no config, XAML, JSON, or DLL sidecars");
                Check(new AppView { Info = catalog.apps[0] }.UpdatedLabel == "Oct 16, 2026", "App update date displayed from metadata");
                using (var embedded = new LauncherService(Path.Combine(root,"embedded-profile"))) Check(embedded.LoadCatalog().apps.Count == 2, "Embedded catalog fallback works without source files");
                var application = new Application();
                string xaml = File.ReadAllText(Path.Combine(args[0], "src", "MainWindow.xaml"));
                xaml = System.Text.RegularExpressions.Regex.Replace(xaml, " (Click|TextChanged)=\"[^\"]+\"", "");
                var window = (Window)XamlReader.Parse(xaml);
                using (var icon = typeof(Bundled).Assembly.GetManifestResourceStream("TMApps.launcher.ico")) {
                    var decoder = BitmapDecoder.Create(icon, BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
                    Check(decoder.Frames.Count == 7, "Embedded rocket icon has seven Windows display sizes");
                    ((Image)window.FindName("BrandIcon")).Source = decoder.Frames.Last();
                }
                Check(System.Diagnostics.FileVersionInfo.GetVersionInfo(Path.Combine(args[0],"build","TMApps-Launcher.exe")).CompanyName == "DaddyTylerXO", "Executable company metadata uses GitHub username");
                var cards = (ItemsControl)window.FindName("Cards");
                cards.ItemsSource = catalog.apps.Select(a => new AppView { Info = a, Action = a.Available ? "↓  Install app" : "Coming soon", CanAct = a.Available, Status = a.Available ? "READY TO INSTALL" : "AWAITING FIRST RELEASE", VersionLabel = "v" + a.version, Detail = "Windows x64 · Beta" }).ToList();
                var content = (FrameworkElement)window.Content;
                content.Measure(new Size(1180,800)); content.Arrange(new Rect(0,0,1180,800)); content.UpdateLayout();
                var bitmap = new RenderTargetBitmap(1180,800,96,96,PixelFormats.Pbgra32); bitmap.Render(content);
                byte[] pixels = new byte[1180*800*4]; bitmap.CopyPixels(pixels,1180*4,0);
                Check(pixels.Any(p => p > 0), "WPF preview has rendered pixels");
                var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
                using (var output = File.Create(Path.Combine(args[0], "build", "launcher-preview.png"))) encoder.Save(output);
                Check(cards.Items.Count == 2, "Render real WPF templates for both apps");
                cards.ItemTemplate = (DataTemplate)window.Resources["AppCard"];
                var gridFactory = new FrameworkElementFactory(typeof(System.Windows.Controls.Primitives.UniformGrid)); gridFactory.SetValue(System.Windows.Controls.Primitives.UniformGrid.ColumnsProperty, 2);
                cards.ItemsPanel = new ItemsPanelTemplate(gridFactory);
                content.Measure(new Size(900,600)); content.Arrange(new Rect(0,0,900,600)); content.UpdateLayout();
                Check(cards.ActualWidth > 0 && cards.Items.Count == 2, "Grid template loads at minimum supported width");
                Console.WriteLine(count + " checks passed. Preview: build/launcher-preview.png");
                window.Close(); application.Shutdown(); return 0;
            } catch(Exception ex) { Console.Error.WriteLine(ex); return 1; }
            finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
        }
    }
}
