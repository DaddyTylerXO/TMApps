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
        class RecordingIntegration : IAppIntegration {
            public Installed Current; public string Executable; public int Removed;
            public void Apply(AppInfo app,Installed previous,Installed current,string previousExecutable,string executable) { Current=current; Executable=executable; }
            public void Remove(AppInfo app,Installed installed,string executable) { Removed++; }
        }
        class CatalogHandler : HttpMessageHandler {
            public string Shared; public bool FailShared,FailBranch,MissingHash; public string ManifestUrl="https://github.com/DaddyTylerXO/TMApps/raw/refs/heads/TMA-Mail/dist/TMA-Mail-0.10.0-beta-windows.zip";
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token) {
                string path=request.RequestUri.AbsolutePath; string body=null;
                if(path.EndsWith("/catalog.json") && !FailShared) body=Shared;
                else if(path.EndsWith("/commits/TMA-Mail") && !FailBranch) body="{\"sha\":\""+new string('a',40)+"\",\"commit\":{\"committer\":{\"date\":\"2026-10-16T22:53:40Z\"}}}";
                else if(path.EndsWith("/update.json")) body="{\"Version\":\"0.10.0\",\"DownloadUrl\":\""+ManifestUrl+"\"}";
                else if(path.EndsWith(".sha256") && !MissingHash) body=new string('b',64)+"  TMA-Mail-0.10.0-beta-windows.zip";
                return Task.FromResult(new HttpResponseMessage(body==null ? HttpStatusCode.NotFound : HttpStatusCode.OK) { Content=new StringContent(body ?? "not found") });
            }
        }
        static System.Collections.Generic.IEnumerable<Button> Buttons(DependencyObject root) {
            var button=root as Button; if(button!=null) yield return button;
            for(int i=0;i<VisualTreeHelper.GetChildrenCount(root);i++) foreach(var child in Buttons(VisualTreeHelper.GetChild(root,i))) yield return child;
        }
        static void PumpUntil(Func<bool> ready) {
            var end=DateTime.UtcNow.AddSeconds(15);
            while(!ready() && DateTime.UtcNow<end) {
                var frame=new System.Windows.Threading.DispatcherFrame();
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Background,new Action(()=>frame.Continue=false));
                System.Windows.Threading.Dispatcher.PushFrame(frame); Thread.Sleep(5);
            }
            if(!ready()) throw new Exception("UI operation timed out");
        }
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
                Check(LauncherService.ParseCatalog(original.Replace("AI-Agent-Dashboard","TMA-AgentOffice")).apps.Count==2,"Renamed Agent Office source branch and legacy catalog alias are both supported");
                Reject(() => LauncherService.ParseCatalog(original.Replace("Agent Office.exe", "..\\\\evil.exe")), "Reject arbitrary executable");
                Reject(() => LauncherService.ParseCatalog(original.Replace("tma-agent-office", "tma-mail")), "Reject duplicate app");
                Reject(() => LauncherService.ParseCatalog(original.Replace(catalog.apps[0].sha256, "bad")), "Require checksum");
                Check(LauncherService.IsNewer("0.10.0", "0.9.0"), "Numeric version comparison");
                Check(LauncherService.IsNewer("1.0.0", "1.0.0-beta"), "Stable version follows beta");
                Check(!LauncherService.IsNewer("1.0.0-beta", "1.0.0"), "Never downgrade stable to beta");
                Check(!LauncherService.IsNewer("1.0.0", "1.0.0"), "Equal version is not update");
                Check(LauncherService.IsNewer("0.10.0-beta","0.9.2-beta"),"Mail 0.10 correctly follows 0.9.2");
                string staleCatalog=original.Replace(catalog.apps[0].version,"0.9.2-beta");
                var updateHandler=new CatalogHandler { Shared=staleCatalog };
                using(var updates=new LauncherService(Path.Combine(root,"updates"),updateHandler)) {
                    var refreshed=updates.Refresh(CancellationToken.None).GetAwaiter().GetResult(); var mail=refreshed.apps.First(a=>a.id=="tma-mail");
                    Check(mail.version=="0.10.0-beta" && mail.sha256==new string('b',64) && mail.downloadUrl.Contains(new string('a',40)),"Branch manifest discovers Mail 0.10 with commit-pinned archive and checksum despite stale shared catalog");
                    updateHandler.Shared=staleCatalog.Replace("0.9.2-beta","9.0.0");
                    Check(updates.Refresh(CancellationToken.None).GetAwaiter().GetResult().apps[0].version=="9.0.0","Branch discovery never downgrades a newer published catalog");
                    updateHandler.Shared=staleCatalog; updateHandler.FailBranch=true;
                    Check(updates.Refresh(CancellationToken.None).GetAwaiter().GetResult().apps[0].version=="9.0.0","A temporarily unavailable branch cannot regress a newer cached release to a stale shared catalog");
                    updateHandler.FailBranch=false;
                    LauncherService.AtomicWrite(Path.Combine(root,"updates","catalog.json"),staleCatalog);
                    updateHandler.Shared=staleCatalog; updateHandler.MissingHash=true;
                    Check(updates.Refresh(CancellationToken.None).GetAwaiter().GetResult().apps[0].version=="0.9.2-beta" && updates.LastRefreshNotice.Contains("Could not verify"),"Unverified branch package is not advertised and incomplete check is reported");
                    updateHandler.MissingHash=false; updateHandler.ManifestUrl="https://attacker.test/package.zip";
                    Check(updates.Refresh(CancellationToken.None).GetAwaiter().GetResult().apps[0].version=="0.9.2-beta","Branch manifest cannot redirect packages outside the approved repository");
                }
                var branchOnly=new CatalogHandler { FailShared=true,Shared=staleCatalog };
                using(var updates=new LauncherService(Path.Combine(root,"branch-only"),branchOnly)) {
                    Check(updates.Refresh(CancellationToken.None).GetAwaiter().GetResult().apps[0].version=="0.10.0-beta","Mail branch can refresh when shared release catalog is unavailable");
                    branchOnly.FailBranch=true; Reject(()=>updates.Refresh(CancellationToken.None).GetAwaiter().GetResult(),"Failed update sources never report a successful check");
                }
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
                Reject(()=>InstallationPaths.Normalize(Path.GetPathRoot(root)),"Reject a drive root as an installation folder");
                Reject(()=>InstallationPaths.Normalize("C:relative"),"Reject drive-relative installation paths");
                string unrelated=Path.Combine(root,"unrelated"); Directory.CreateDirectory(unrelated); File.WriteAllText(Path.Combine(unrelated,"keep.txt"),"keep");
                var integration=new RecordingIntegration();
                using(var custom=new LauncherService(Path.Combine(root,"custom-profile"),new PackageHandler { Bytes=handler.Bytes },integration)) {
                    var selected=LauncherService.ParseCatalog(original).apps[0];
                    using(var sha=SHA256.Create()) selected.sha256=BitConverter.ToString(sha.ComputeHash(handler.Bytes)).Replace("-","").ToLowerInvariant();
                    Reject(()=>custom.ValidateInstallDirectory(selected,unrelated),"Reject unrelated nonempty application folders");
                    string destination=Path.Combine(root,"Another Drive","Custom Mail");
                    custom.Install(selected,new QuietProgress(),CancellationToken.None,destination,new AppInstallOptions { runAtStartup=true,desktopShortcut=true }).GetAwaiter().GetResult();
                    var first=custom.GetInstalled(selected); Check(InstallationPaths.Same(first.installRoot,destination) && File.Exists(Path.Combine(custom.InstalledFolder(selected,first),selected.executable)),"Custom application path is recorded and used for executable lookup");
                    Check(first.runAtStartup && first.desktopShortcut && integration.Executable==Path.Combine(custom.InstalledFolder(selected,first),selected.executable),"App startup and desktop selections are saved and applied to the installed executable");
                    string other=Path.Combine(destination,"other-folder"); Directory.CreateDirectory(other); File.WriteAllText(Path.Combine(other,"keep.txt"),"keep");
                    selected.version="9.0.0";
                    custom.Install(selected,new QuietProgress(),CancellationToken.None).GetAwaiter().GetResult();
                    var updated=custom.GetInstalled(selected);
                    Check(InstallationPaths.Same(updated.installRoot,destination) && updated.folder!=first.folder,"Updates automatically reuse the custom application location");
                    Check(updated.runAtStartup && updated.desktopShortcut && integration.Executable==Path.Combine(custom.InstalledFolder(selected,updated),selected.executable),"Updating an app retains choices and retargets startup/desktop integration to the new executable");
                    Check(!Directory.Exists(custom.InstalledFolder(selected,first)) && File.Exists(Path.Combine(other,"keep.txt")),"Custom-path update removes only the previous version");
                    custom.Uninstall(selected); Check(File.Exists(Path.Combine(other,"keep.txt")) && custom.GetInstalled(selected)==null,"Custom-path uninstall preserves unrelated folders and clears installation state");
                    Check(integration.Removed==1,"App uninstall removes its startup and desktop integration");
                }
                string exe = Path.Combine(standalone,"TMApps-Launcher.exe"); File.Copy(Path.Combine(args[0],"build","TMApps-Launcher.exe"),exe);
                string report = Path.Combine(standalone,"verification.txt");
                var start = new System.Diagnostics.ProcessStartInfo(exe, "--verify-package \"" + report + "\"") { WorkingDirectory = standalone, UseShellExecute = false, CreateNoWindow = true };
                using (var process = System.Diagnostics.Process.Start(start)) { if (!process.WaitForExit(15000)) { process.Kill(); throw new Exception("Standalone startup timed out"); } Check(process.ExitCode == 0 && File.ReadAllText(report).StartsWith("OK:"), "EXE loads UI and catalog alone in empty folder"); }
                Check(Directory.GetFiles(standalone).Length == 2, "Standalone startup needs no config, XAML, JSON, or DLL sidecars");
                string shortcut=Path.Combine(standalone,"Launcher.lnk"); DesktopIntegration.CreateShortcut(shortcut,exe);
                Check(File.Exists(shortcut) && BitConverter.ToInt32(File.ReadAllBytes(shortcut),0)==76,"Windows desktop/Start menu shortcut helper creates a real shell link");
                Check(DesktopIntegration.ShortcutTargets(shortcut,exe),"Desktop shortcut target can be verified before removing a launcher-managed icon");
                Check(new AppView { Info = catalog.apps[0] }.UpdatedLabel == "Oct 16, 2026", "App update date displayed from metadata");
                using (var embedded = new LauncherService(Path.Combine(root,"embedded-profile"))) Check(embedded.LoadCatalog().apps.Count == 2, "Embedded catalog fallback works without source files");
                string installerRoot=Path.Combine(root,"installer");
                var installStart=new System.Diagnostics.ProcessStartInfo(Path.Combine(args[0],"build","TMApps-Launcher-Setup.exe"),"--verify-install \""+installerRoot+"\"") { UseShellExecute=false,CreateNoWindow=true };
                using(var process=System.Diagnostics.Process.Start(installStart)) { if(!process.WaitForExit(20000)) { process.Kill(); throw new Exception("Installer verification timed out"); } Check(process.ExitCode==0 && File.ReadAllText(Path.Combine(installerRoot,"installer-report.txt")).StartsWith("OK:"),"Real installer writes payload, saves options, launches installed EXE, and preserves data on uninstall"); }
                var application = new LauncherApplication();
                SynchronizationContext.SetSynchronizationContext(new System.Windows.Threading.DispatcherSynchronizationContext(System.Windows.Threading.Dispatcher.CurrentDispatcher));
                string uiRoot=Path.Combine(root,"ui-profile"); Directory.CreateDirectory(uiRoot);
                var uiCatalog=LauncherService.ParseCatalog(original);
                using(var sha=SHA256.Create()) uiCatalog.apps[0].sha256=BitConverter.ToString(sha.ComputeHash(handler.Bytes)).Replace("-","").ToLowerInvariant();
                LauncherService.AtomicWrite(Path.Combine(uiRoot,"catalog.json"),LauncherService.Json.Serialize(uiCatalog));
                int locationPrompts=0;
                string chosenAppFolder=Path.Combine(root,"Chosen Application Folder");
                var uiIntegration=new RecordingIntegration();
                var window=application.Initialize(uiRoot,new PackageHandler { Bytes=handler.Bytes },false,app=>{ locationPrompts++; return locationPrompts==1 ? null : new AppInstallOptions { directory=chosenAppFolder,runAtStartup=true,desktopShortcut=true }; },uiIntegration);
                using (var icon = typeof(Bundled).Assembly.GetManifestResourceStream("TMApps.launcher.ico")) {
                    var decoder = BitmapDecoder.Create(icon, BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
                    Check(decoder.Frames.Count == 7, "Embedded rocket icon has seven Windows display sizes");
                    ((Image)window.FindName("BrandIcon")).Source = decoder.Frames.Last();
                }
                Check(System.Diagnostics.FileVersionInfo.GetVersionInfo(Path.Combine(args[0],"build","TMApps-Launcher.exe")).CompanyName == "DaddyTylerXO", "Executable company metadata uses GitHub username");
                var cards = (ItemsControl)window.FindName("Cards");

                var content = (FrameworkElement)window.Content;
                content.Measure(new Size(1180,800)); content.Arrange(new Rect(0,0,1180,800)); content.UpdateLayout();
                var bitmap = new RenderTargetBitmap(1180,800,96,96,PixelFormats.Pbgra32); bitmap.Render(content);
                byte[] pixels = new byte[1180*800*4]; bitmap.CopyPixels(pixels,1180*4,0);
                Check(pixels.Any(p => p > 0), "WPF preview has rendered pixels");
                var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
                using (var output = File.Create(Path.Combine(args[0], "build", "launcher-preview.png"))) encoder.Save(output);
                Check(cards.Items.Count == 2, "Render real WPF templates for both apps");
                var mailButton=Buttons(cards).First(b=>Convert.ToString(b.Tag)=="tma-mail" && Convert.ToString(b.Content).Contains("Install"));
                var text=new TextBlock { Text="nested content" }; var nestedButton=new Button { Content=text }; nestedButton.ApplyTemplate();
                Check(LauncherApplication.ResolveButton(mailButton)==mailButton,"Click resolver uses original button across item-template boundaries");
                mailButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent,mailButton));
                var mailView=((System.Collections.IEnumerable)cards.ItemsSource).Cast<AppView>().First(a=>a.Id=="tma-mail");
                using(var uiService=new LauncherService(uiRoot,null,uiIntegration)) {
                    Check(!mailView.Busy && !Directory.Exists(chosenAppFolder),"Cancelling the install-location prompt starts no installation");
                    mailButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent,mailButton));
                    PumpUntil(()=>!mailView.Busy && uiService.GetInstalled(uiCatalog.apps[0])!=null);
                    Check(uiService.GetInstalled(uiCatalog.apps[0])!=null,"Real Install button click performs a verified installation through the UI");
                    Check(locationPrompts==2 && InstallationPaths.Same(uiService.GetInstalled(uiCatalog.apps[0]).installRoot,chosenAppFolder),"Install button prompts and saves the selected application folder");
                    Check(uiIntegration.Current.runAtStartup && uiIntegration.Current.desktopShortcut,"UI installation forwards startup and desktop options to the installation engine");
                    var menuButton=Buttons(cards).First(b=>Convert.ToString(b.Tag)=="tma-mail" && Convert.ToString(b.Content)=="•••");
                    menuButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent,menuButton));
                    Check(menuButton.ContextMenu!=null && menuButton.ContextMenu.Items.Count==4,"Real three-dot click creates application options menu");
                    menuButton.ContextMenu.IsOpen=false;
                    uiService.Uninstall(uiCatalog.apps[0]);
                }
                ((Button)window.FindName("GridViewButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent,(Button)window.FindName("GridViewButton")));
                Check(cards.ItemTemplate==(DataTemplate)window.Resources["AppCard"] && DesktopIntegration.LoadPreferences(uiRoot).libraryView=="Grid","Grid button switches the real template and saves display preference");
                ((Button)window.FindName("ListViewButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent,(Button)window.FindName("ListViewButton")));
                Check(cards.ItemTemplate==(DataTemplate)window.Resources["AppList"],"List button restores the list template");
                foreach(string edge in new[]{"Left","Right","Top","Bottom"}) {
                    LauncherApplication.ApplyNavigation(window,new Preferences { navigationEdge=edge });
                    Check(DockPanel.GetDock((Border)window.FindName("NavigationPanel")).ToString()==edge,"Navigation can dock "+edge);
                }
                LauncherApplication.ApplyNavigation(window,new Preferences { compactNavigation=true });
                Check(((Border)window.FindName("NavigationPanel")).Width==76,"Compact navigation ribbon collapses");
                LauncherApplication.ApplyNavigation(window,new Preferences());
                LauncherApplication.ApplyView(window,"Grid");
                content.Measure(new Size(1000,640)); content.Arrange(new Rect(0,0,1000,640)); content.UpdateLayout();
                Check(cards.ActualWidth>0 && cards.Items.Count==2,"Grid template loads at minimum supported width");
                Console.WriteLine(count + " checks passed. Preview: build/launcher-preview.png");
                window.Close(); application.Shutdown(); return 0;
            } catch(Exception ex) { Console.Error.WriteLine(ex); return 1; }
            finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
        }
    }
}
