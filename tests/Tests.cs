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
        class SpotifyHandler : HttpMessageHandler {
            public string Challenge;public int Calls;
            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token) {
                Calls++;string body;
                if(request.RequestUri.Host=="accounts.spotify.com") {var values=TMAppsShared.SpotifyApi.Query(await request.Content.ReadAsStringAsync());Check(!values.ContainsKey("client_secret"),"Windows Spotify authorization never uses a client secret");if(values.ContainsKey("code_verifier"))Check(TMAppsShared.SpotifyApi.Challenge(values["code_verifier"])==Challenge,"Windows loopback authorization exchanges the matching PKCE verifier");body="{\"access_token\":\"fixture-access\",\"refresh_token\":\"fixture-refresh\",\"expires_in\":3600}";}
                else {Check(request.RequestUri.Host=="api.spotify.com"&&request.Headers.Authorization.Parameter=="fixture-access","Spotify credentials are sent only to the fixed API origin");body="{\"item\":{\"name\":\"Example track\",\"artists\":[{\"name\":\"Example artist\"}]},\"device\":{\"name\":\"Example web player\"}}";}
                return new HttpResponseMessage(HttpStatusCode.OK) {Content=new StringContent(body)};
            }
        }
        class AuthHandler : HttpMessageHandler {
            public int Requests;
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token) {
                Requests++;string route=request.RequestUri.AbsolutePath;string body=route.EndsWith("/verify")?"{\"access_token\":\"private-access\",\"refresh_token\":\"private-refresh\",\"expires_in\":3600}":route.EndsWith("/user")?"{\"id\":\"user-1\",\"email\":\"verified@example.com\",\"email_confirmed_at\":\"2026-10-21\"}":route.EndsWith("/app_access")&&request.Method==HttpMethod.Get?"[{\"app_id\":\"tma-cut\",\"enabled\":true}]":"{}";
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=new StringContent(body)});
            }
        }
        class PackageHandler : HttpMessageHandler {
            public byte[] Bytes;
            public bool UsedAuth; public string LastUrl; public Catalog UpdateCatalog; public LauncherRelease Launcher; public int LauncherChecks;
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) {
                token.ThrowIfCancellationRequested();
                LastUrl = request.RequestUri.AbsoluteUri;
                if(request.RequestUri.AbsolutePath.EndsWith("/catalog.json") && UpdateCatalog!=null) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content=new StringContent(LauncherService.Json.Serialize(UpdateCatalog)) });
                if(request.RequestUri.AbsolutePath.EndsWith("/launcher-update.json")) { LauncherChecks++; return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content=new StringContent(LauncherService.Json.Serialize(Launcher)) }); }

                UsedAuth = request.Headers.Authorization != null;
                if (request.RequestUri.AbsolutePath.EndsWith("/releases/tags/tma-apps"))
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"assets\":[{\"name\":\"fixture.zip\",\"id\":123}]}") });
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(Bytes) });
            }
        }
        class LauncherUpdateHandler : HttpMessageHandler {
            public LauncherRelease Release; public byte[] Installer; public bool FailManifest; public int Downloads;
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token) {
                token.ThrowIfCancellationRequested(); string path=request.RequestUri.AbsolutePath;
                if(path.EndsWith("/releases/tags/tma-apps")) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content=new StringContent("{\"assets\":[{\"name\":\"launcher-update.json\",\"id\":10},{\"name\":\"TMApps-Launcher-Setup-1.15.1.exe\",\"id\":11}]}") });
                bool manifest=path.EndsWith("launcher-update.json") || path.EndsWith("/assets/10");
                if(manifest) return Task.FromResult(new HttpResponseMessage(FailManifest ? HttpStatusCode.ServiceUnavailable : HttpStatusCode.OK) { Content=new StringContent(LauncherService.Json.Serialize(Release)) });
                Downloads++;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content=new ByteArrayContent(Installer) });
            }
        }
        class QuietProgress : IProgress<string> { public void Report(string value) {} }
        class RecordingIntegration : IAppIntegration {
            public Installed Current; public string Executable; public int Removed;
            public void Apply(AppInfo app,Installed previous,Installed current,string previousExecutable,string executable) { Current=current; Executable=executable; }
            public void Remove(AppInfo app,Installed installed,string executable) { Removed++; }
        }
        class FakeProcesses : IAppProcessController {
            public bool Running,Foreign,Graceful=true,Forced=true; public int CloseCalls,ForceCalls;
            public bool IsRunning(AppInfo app) { return Running; }
            public bool IsDataInUse(AppInfo app) { return Running || Foreign; }
            public Task<bool> RequestClose(AppInfo app,CancellationToken token) { token.ThrowIfCancellationRequested(); CloseCalls++; if(Graceful) Running=false; return Task.FromResult(!Running); }
            public Task<bool> ForceClose(AppInfo app,CancellationToken token) { token.ThrowIfCancellationRequested(); ForceCalls++; if(Forced) Running=false; return Task.FromResult(!Running); }
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
        static System.Collections.Generic.IEnumerable<T> Descendants<T>(DependencyObject root) where T:DependencyObject {
            var found=root as T;if(found!=null)yield return found;
            for(int i=0;i<VisualTreeHelper.GetChildrenCount(root);i++)foreach(var child in Descendants<T>(VisualTreeHelper.GetChild(root,i)))yield return child;
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
        static void SaveDialog(ThemedDialog dialog,string file) {
            dialog.UpdateLayout(); var content=(FrameworkElement)dialog.Content;
            var bitmap=new RenderTargetBitmap((int)Math.Ceiling(content.ActualWidth),(int)Math.Ceiling(content.ActualHeight),96,96,PixelFormats.Pbgra32); bitmap.Render(content);
            var encoder=new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
            using(var output=File.Create(file)) encoder.Save(output);
        }
        static int count;
        static void Check(bool condition, string label) { if (!condition) throw new Exception(label); count++; Console.WriteLine("PASS " + label); }
        static void Reject(Action action, string label) { try { action(); } catch { count++; Console.WriteLine("PASS " + label); return; } throw new Exception("Expected rejection: " + label); }
        static void Zip(string path, string entry, string contents) { using(var zip = ZipFile.Open(path, ZipArchiveMode.Create)) using(var writer = new StreamWriter(zip.CreateEntry(entry).Open())) writer.Write(contents); }
        [STAThread] public static int Main(string[] args) {
            if(args.Length==2 && args[0]=="--handoff-fixture") {
                LauncherUpdates.StartInstaller(Path.Combine(args[1],"FixtureSetup.exe"),args[1],CancellationToken.None).GetAwaiter().GetResult(); return 0;
            }
            if(args.Length==4 && args[0]=="--update") {
                string fixtureRoot=AppDomain.CurrentDomain.BaseDirectory;
                using(var parent=LauncherUpdates.ValidateParent(Int32.Parse(args[1]),Int64.Parse(args[2]),Path.Combine(fixtureRoot,"TMApps-Launcher.exe"))) {
                    using(var ready=EventWaitHandle.OpenExisting("Local\\TMApps-Launcher-Update-"+args[3])) ready.Set();
                    if(parent!=null && !parent.WaitForExit(10000)) return 1;
                }
                File.WriteAllText(Path.Combine(fixtureRoot,"handoff-report.txt"),"OK: updater acknowledged readiness before launcher exit"); return 0;
            }
            if(args.Length==1 && args[0]=="--process-fixture") { Thread.Sleep(30000); return 0; }
            string root = Path.Combine(args[0], "build", "test-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
            try {
                Check(TMAppsShared.SpotifyApi.Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")=="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM","Windows Spotify PKCE matches RFC 7636");
                var spotifyHandler=new SpotifyHandler();Task callbackTask=null;var musicRoot=Path.Combine(root,"spotify");
                using(var music=new TMAppsShared.SpotifyApi(musicRoot,url=>{var query=TMAppsShared.SpotifyApi.Query(new Uri(url).Query);spotifyHandler.Challenge=query["code_challenge"];callbackTask=Task.Run(async()=>{using(var browser=new HttpClient {Timeout=TimeSpan.FromSeconds(8)}){Check((await browser.GetAsync(TMAppsShared.SpotifyApi.RedirectUri+"?state=wrong&code=fixture")).StatusCode==HttpStatusCode.BadRequest,"Windows Spotify callback rejects an unrelated sign-in state");(await browser.GetAsync(TMAppsShared.SpotifyApi.RedirectUri+"?state="+query["state"]+"&code=fixture")).EnsureSuccessStatusCode();}});return Task.FromResult(0);},spotifyHandler)) {
                    var connecting=music.Connect();Task.WhenAny(connecting,callbackTask).GetAwaiter().GetResult();if(callbackTask.IsFaulted)callbackTask.GetAwaiter().GetResult();connecting.GetAwaiter().GetResult();callbackTask.GetAwaiter().GetResult();Check(music.Connected,"Windows Spotify callback completes sign-in without exposing tokens to a renderer");
                    var stored=File.ReadAllBytes(Path.Combine(musicRoot,"spotify-session.bin"));Check(!System.Text.Encoding.UTF8.GetString(stored).Contains("fixture-refresh"),"Windows Spotify authorization is encrypted on disk");
                    var playback=music.Playback().GetAwaiter().GetResult();Check(playback[0]=="Example track"&&playback[1]=="Example artist"&&playback[2]=="Example web player","Windows Spotify displays active track, artist and device");Reject(()=>music.Control("unknown").GetAwaiter().GetResult(),"Spotify blocks arbitrary playback actions");music.Disconnect();Check(!music.Connected,"Disconnect removes local Spotify authorization");
                }
                var catalog = LauncherService.ParseCatalog(File.ReadAllText(Path.Combine(args[0], "tests", "catalog-fixture.json")));
                var socials = catalog.apps.First(a => a.id=="tma-socialsmanager");
                var socialsView = new AppView { Info=socials };
                Check(!socials.Available && socials.branch=="TMA-SocialsManager" && socialsView.Icon!=null && socialsView.IconVisibility==Visibility.Visible && socialsView.Accent=="#E5B92F" && socialsView.WindowsSupport==Visibility.Collapsed && socialsView.MacSupport==Visibility.Collapsed && socialsView.LinuxSupport==Visibility.Collapsed, "SocialsManager has a yellow chat icon, correct source, and no unverified installers");
                Check(catalog.apps.Count == 8 && catalog.apps.Take(2).All(a => a.Available) && catalog.apps[2].id=="tma-safe", "Both real app packages bundled in catalog");
                var ordered = AppView.OrderLibrary(catalog.apps.Select(a => new AppView { Info = a }));
                Check(ordered.Last().Id=="tma-agent-office" && ordered.Last().Number=="08 / YOUR AI TEAM" && ordered[1].Id=="tma-safe", "Agent Office follows Mail and Safe with a dynamic number");
                ordered = AppView.OrderLibrary(ordered.Concat(new[] { new AppView { Info = new AppInfo { id="future-app", category="Tools" } } }));
                Check(ordered.Last().Number=="09 / YOUR AI TEAM" && ordered[6].Id=="future-app" && ordered[7].Id=="tma-socialsmanager", "New apps move Agent Office down without changing other app order");
                var libraries = catalog.apps.First(a => a.id=="tma-libraries");
                var librariesView = new AppView {Info=libraries};
                Check(libraries.Available && libraries.version=="0.1.0" && libraries.branch=="TMA-Libraries" && libraries.executable=="TMA-Libraries.exe" && librariesView.Icon!=null && librariesView.Accent=="#DCA87D" && librariesView.WindowsSupport==Visibility.Visible && librariesView.MacSupport==Visibility.Collapsed && librariesView.LinuxSupport==Visibility.Collapsed,"Libraries has its brown folder icon and verified Windows development metadata");
                Check(catalog.apps.Select(a=>WindowsAppIntegration.ShortcutName(a.id)).Distinct().Count()==8 && WindowsAppIntegration.ShortcutName("tma-finance")=="TMA-Finance" && WindowsAppIntegration.ShortcutName("tma-libraries")=="TMA-Libraries" && WindowsAppIntegration.ShortcutName("tma-agent-office")=="TMA-Agent Office","Desktop shortcuts cannot overwrite another app's shortcut");
                var finance=catalog.apps.First(a=>a.id=="tma-finance");var financeView=new AppView{Info=finance};
                Check(finance.Available && finance.version=="0.1.0" && finance.branch=="TMA-Finance" && finance.executable=="TMA-Finance.exe" && financeView.Icon!=null && financeView.Accent=="#8FBD9E" && financeView.WindowsSupport==Visibility.Visible && financeView.MacSupport==Visibility.Collapsed && financeView.LinuxSupport==Visibility.Collapsed,"Finance has its green bills icon, correct source and Windows-only development support");
                Check(new WindowsAppData().Locations(libraries).Single().EndsWith(Path.Combine("TMApps","TMA-Libraries")) && new WindowsAppData().Locations(finance).Single().EndsWith("TMA-Finance"),"New app uninstall data choices use only each app's documented standard profile");
                var newAppData=new WindowsAppData(Path.Combine(root,"new-app-local"),Path.Combine(root,"new-app-roaming"));
                var librariesData=newAppData.Locations(libraries).Single();var financeData=newAppData.Locations(finance).Single();
                Directory.CreateDirectory(librariesData);Directory.CreateDirectory(financeData);File.WriteAllText(Path.Combine(librariesData,"synthetic.txt"),"fixture");File.WriteAllText(Path.Combine(financeData,"synthetic.txt"),"fixture");
                newAppData.Delete(libraries);Check(!Directory.Exists(librariesData) && File.Exists(Path.Combine(financeData,"synthetic.txt")),"Deleting synthetic Libraries data preserves Finance's separate profile");
                newAppData.Delete(finance);Check(!Directory.Exists(financeData),"Explicit Finance data deletion is limited to its synthetic standard profile");
                Reject(()=>LauncherService.ParseCatalog(File.ReadAllText(Path.Combine(args[0],"tests","catalog-fixture.json")).Replace("\"TMA-Libraries\"","\"TMA-Mail\"")),"Libraries rejects a mismatched application branch");
                var cut = catalog.apps.First(a => a.id=="tma-cut");
                Check(new WindowsAppData().Locations(cut).Length==0, "Cut projects are preserved when uninstalling the app");
                Check(cut.branch=="TMA-Cut" && cut.executable=="TMA-Cut.exe" && new AppView {Info=cut}.Icon!=null && new AppView {Info=cut}.Accent=="#F39AA5", "Cut has a red camera tile and its own application branch");

                Check(catalog.apps.Take(2).All(a=>new AppView {Info=a}.WindowsSupport==Visibility.Visible && new AppView {Info=a}.MacSupport==Visibility.Collapsed && new AppView {Info=a}.LinuxSupport==Visibility.Collapsed),"OS badges advertise only the published Windows app builds");
                Check(new AppView {Info=new AppInfo {downloadUrl="legacy"}}.WindowsSupport==Visibility.Visible,"Legacy catalogs retain Windows support without new metadata");
                var allPlatforms=new AppView {Info=new AppInfo {platforms=new[]{"windows","macos","linux"}}};
                Check(allPlatforms.WindowsSupport==Visibility.Visible && allPlatforms.MacSupport==Visibility.Visible && allPlatforms.LinuxSupport==Visibility.Visible,"Future macOS and Linux support icons follow explicit catalog metadata");
                Check(LauncherService.TrustedUrl(catalog.apps[0].downloadUrl), "Pinned Mail artifact URL");
                Check(!LauncherService.TrustedUrl("https://github.com/attacker/TMApps/releases/download/a/file.zip"), "Reject other repositories");
                Check(!LauncherService.TrustedUrl("https://github.com.evil.test/DaddyTylerXO/TMApps/releases/download/file"), "Reject lookalike host");
                Check(!LauncherService.TrustedUrl("http://github.com/DaddyTylerXO/TMApps/releases/download/file"), "Require HTTPS");
                Check(!LauncherService.TrustedUrl("https://user@github.com/DaddyTylerXO/TMApps/releases/download/file"), "Reject URL credentials");
                Reject(() => LauncherService.ParseCatalog("{}"), "Reject invalid catalog");
                string original = File.ReadAllText(Path.Combine(args[0], "tests", "catalog-fixture.json"));
                Reject(()=>LauncherService.ParseCatalog(original.Replace("\"windows\"","\"unknown-os\"")),"Catalog rejects unknown operating-system badges");
                Check(LauncherService.ParseCatalog(original.Replace("AI-Agent-Dashboard","TMA-AgentOffice")).apps.Count==8,"Renamed Agent Office source branch and legacy catalog alias are both supported");
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
                    LauncherService.AtomicWrite(Path.Combine(root,"updates","catalog.json"),staleCatalog);
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
                    LauncherService.AtomicWrite(Path.Combine(root,"branch-only","catalog.json"),staleCatalog);
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
                    Check(service.LoadCatalog(Path.Combine(args[0], "tests", "catalog-fixture.json")).apps.Count == 8, "Corrupt cache falls back to bundled catalog");
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
                var processFixture=new FakeProcesses();
                var localData=new WindowsAppData(Path.Combine(root,"Local"),Path.Combine(root,"Roaming"));
                var lifecycleApp=LauncherService.ParseCatalog(original).apps[0];
                using(var sha=SHA256.Create()) lifecycleApp.sha256=BitConverter.ToString(sha.ComputeHash(handler.Bytes)).Replace("-","").ToLowerInvariant();
                using(var lifecycle=new LauncherService(Path.Combine(root,"lifecycle"),new PackageHandler { Bytes=handler.Bytes },new RecordingIntegration(),processFixture,localData)) {
                    int prompts=0;
                    Check(lifecycle.EnsureClosed(lifecycleApp,force=>{ prompts++; return true; },CancellationToken.None).Result && prompts==0,"Closed apps need no close permission");
                    processFixture.Running=true;
                    Check(!lifecycle.EnsureClosed(lifecycleApp,force=>false,CancellationToken.None).Result && processFixture.CloseCalls==0,"Declining close leaves running app untouched");
                    Reject(()=>lifecycle.Install(lifecycleApp,new QuietProgress(),CancellationToken.None).GetAwaiter().GetResult(),"Install engine refuses a still-running app");
                    Check(lifecycle.EnsureClosed(lifecycleApp,force=>true,CancellationToken.None).Result && processFixture.CloseCalls==1 && processFixture.ForceCalls==0,"Approved graceful close needs no forced exit");
                    processFixture.Running=true; processFixture.Graceful=false;
                    Check(!lifecycle.EnsureClosed(lifecycleApp,force=>!force,CancellationToken.None).Result && processFixture.Running && processFixture.ForceCalls==0,"Tray app that ignores close is never killed without separate consent");
                    prompts=0;
                    Check(lifecycle.EnsureClosed(lifecycleApp,force=>{ prompts++; return true; },CancellationToken.None).Result && prompts==2 && processFixture.ForceCalls==1,"Tray app exits after both close and force-close permissions");
                    processFixture.Running=true; processFixture.Forced=false;
                    Reject(()=>lifecycle.EnsureClosed(lifecycleApp,force=>true,CancellationToken.None).GetAwaiter().GetResult(),"Failed forced close blocks the operation");
                    processFixture.Running=false;
                    string profile=localData.Locations(lifecycleApp)[0]; Directory.CreateDirectory(profile); File.WriteAllText(Path.Combine(profile,"accounts.txt"),"fixture");
                    lifecycle.Install(lifecycleApp,new QuietProgress(),CancellationToken.None).GetAwaiter().GetResult();
                    processFixture.Running=true;
                    Reject(()=>lifecycle.Uninstall(lifecycleApp,true),"Uninstall engine refuses a running app before touching data");
                    processFixture.Running=false;
                    lifecycle.Uninstall(lifecycleApp);
                    Check(File.Exists(Path.Combine(profile,"accounts.txt")),"Default uninstall retains app accounts and local profile");
                    lifecycle.Install(lifecycleApp,new QuietProgress(),CancellationToken.None).GetAwaiter().GetResult();
                    processFixture.Foreign=true;
                    Reject(()=>lifecycle.Uninstall(lifecycleApp,true),"Other running app copies block shared profile deletion");
                    Check(lifecycle.GetInstalled(lifecycleApp)!=null && File.Exists(Path.Combine(profile,"accounts.txt")),"Blocked data deletion preserves installed app and data");
                    processFixture.Foreign=false;
                    string external=Path.Combine(root,"external-work"); Directory.CreateDirectory(external); File.WriteAllText(Path.Combine(external,"keep.txt"),"keep");
                    lifecycle.Uninstall(lifecycleApp,true);
                    Check(!Directory.Exists(profile) && lifecycle.GetInstalled(lifecycleApp)==null && File.Exists(Path.Combine(external,"keep.txt")),"Explicit delete removes only selected standard profile and binaries");
                    lifecycle.Install(lifecycleApp,new QuietProgress(),CancellationToken.None,profile).GetAwaiter().GetResult();
                    Reject(()=>lifecycle.Uninstall(lifecycleApp,true),"Overlapping installation and profile folders cannot delete installation state unexpectedly");
                    lifecycle.Uninstall(lifecycleApp);
                    var office=LauncherService.ParseCatalog(original).apps[1];
                    foreach(string folder in localData.Locations(office)) { Directory.CreateDirectory(folder); File.WriteAllText(Path.Combine(folder,"project.txt"),"fixture"); }
                    localData.Delete(office);
                    Check(localData.Locations(office).All(folder=>!Directory.Exists(folder)),"Agent Office profile-contained projects are removed only by explicit delete");
                    Reject(()=>localData.Delete(new AppInfo { id="unknown" }),"Unknown app IDs cannot select data deletion paths");
                    Check(WindowsAppProcesses.BelongsTo(Path.Combine(root,"managed","version","app.exe"),Path.Combine(root,"managed")) && !WindowsAppProcesses.BelongsTo(Path.Combine(root,"managed-other","app.exe"),Path.Combine(root,"managed")),"Close signals are scoped to the selected managed installation");
                }
                string managedProcessRoot=Path.Combine(root,"process-managed"),foreignProcessRoot=Path.Combine(root,"process-foreign");
                Directory.CreateDirectory(managedProcessRoot); Directory.CreateDirectory(foreignProcessRoot);
                string fixtureName="TMAppsFixture"+Guid.NewGuid().ToString("N").Substring(0,8)+".exe";
                string self=System.Reflection.Assembly.GetExecutingAssembly().Location;
                File.Copy(self,Path.Combine(managedProcessRoot,fixtureName)); File.Copy(self,Path.Combine(foreignProcessRoot,fixtureName));
                using(var managed=System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Path.Combine(managedProcessRoot,fixtureName),"--process-fixture") { UseShellExecute=false,CreateNoWindow=true }))
                using(var foreign=System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Path.Combine(foreignProcessRoot,fixtureName),"--process-fixture") { UseShellExecute=false,CreateNoWindow=true })) {
                    try {
                        var controller=new WindowsAppProcesses(app=>managedProcessRoot); var fixtureApp=new AppInfo { executable=fixtureName };
                        Check(controller.IsRunning(fixtureApp),"Real windowless process is detected, including tray-style background activity");
                        Check(!controller.RequestClose(fixtureApp,CancellationToken.None).GetAwaiter().GetResult(),"Graceful close cannot silently force a background process");
                        Check(controller.ForceClose(fixtureApp,CancellationToken.None).GetAwaiter().GetResult() && !foreign.HasExited,"Forced close terminates only the managed copy and preserves same-name external process");
                    } finally { if(!managed.HasExited) managed.Kill(); if(!foreign.HasExited) foreign.Kill(); managed.WaitForExit(); foreign.WaitForExit(); }
                }
                string exe = Path.Combine(standalone,"TMApps-Launcher.exe"); File.Copy(Path.Combine(args[0],"build","TMApps-Launcher.exe"),exe);
                string report = Path.Combine(standalone,"verification.txt");
                var start = new System.Diagnostics.ProcessStartInfo(exe, "--verify-package \"" + report + "\"") { WorkingDirectory = standalone, UseShellExecute = false, CreateNoWindow = true };
                using (var process = System.Diagnostics.Process.Start(start)) { if (!process.WaitForExit(15000)) { process.Kill(); throw new Exception("Standalone startup timed out"); } Check(process.ExitCode == 0 && File.ReadAllText(report).StartsWith("OK:"), "EXE loads UI and catalog alone in empty folder"); }
                Check(Directory.GetFiles(standalone).Length == 2, "Standalone startup needs no config, XAML, JSON, or DLL sidecars");
                string shortcut=Path.Combine(standalone,"Launcher.lnk"); DesktopIntegration.CreateShortcut(shortcut,exe);
                Check(File.Exists(shortcut) && BitConverter.ToInt32(File.ReadAllBytes(shortcut),0)==76,"Windows desktop/Start menu shortcut helper creates a real shell link");
                Check(DesktopIntegration.ShortcutTargets(shortcut,exe),"Desktop shortcut target can be verified before removing a launcher-managed icon");
                Check(new AppView { Info = new AppInfo { updatedAt="2026-10-16T22:53:40Z" } }.UpdatedLabel == "Oct 16, 2026", "App update date displayed from metadata");
                using (var embedded = new LauncherService(Path.Combine(root,"embedded-profile"))) Check(embedded.LoadCatalog().apps.Count == 8, "Embedded catalog fallback works without source files");
                string installerRoot=Path.Combine(root,"installer");
                var installStart=new System.Diagnostics.ProcessStartInfo(Path.Combine(args[0],"build","TMApps-Launcher-Setup.exe"),"--verify-install \""+installerRoot+"\"") { UseShellExecute=false,CreateNoWindow=true };
                using(var process=System.Diagnostics.Process.Start(installStart)) { if(!process.WaitForExit(20000)) { process.Kill(); throw new Exception("Installer verification timed out"); } Check(process.ExitCode==0 && File.ReadAllText(Path.Combine(installerRoot,"installer-report.txt")).StartsWith("OK:"),"Real installer writes payload, saves options, launches installed EXE, and preserves data on uninstall"); }
                byte[] installerBytes=File.ReadAllBytes(Path.Combine(args[0],"build","TMApps-Launcher-Setup.exe"));
                string setupHash; using(var sha=SHA256.Create()) setupHash=BitConverter.ToString(sha.ComputeHash(installerBytes)).Replace("-","").ToLowerInvariant();
                var release=new LauncherRelease { schemaVersion=1,version="1.15.1",downloadUrl="https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMApps-Launcher-Setup-1.15.1.exe",sha256=setupHash };
                var launcherHandler=new LauncherUpdateHandler { Release=release,Installer=installerBytes };
                using(var updater=new LauncherService(Path.Combine(root,"launcher-updates"),launcherHandler)) {
                    Check(updater.CheckLauncherUpdate("1.6.0",CancellationToken.None).GetAwaiter().GetResult().version=="1.15.1","Launcher check discovers a newer launcher independently of app catalog");
                    Check(updater.CheckLauncherUpdate("1.15.1",CancellationToken.None).GetAwaiter().GetResult()==null && updater.CheckLauncherUpdate("2.0.0",CancellationToken.None).GetAwaiter().GetResult()==null,"Launcher check skips current versions and never downgrades");
                    string downloaded=updater.DownloadLauncherUpdate(release,new QuietProgress(),CancellationToken.None).GetAwaiter().GetResult();
                    Check(File.Exists(downloaded) && System.Diagnostics.FileVersionInfo.GetVersionInfo(downloaded).FileVersion=="1.15.1.0","Launcher installer download verifies checksum and embedded product version");
                    File.Delete(downloaded);
                    launcherHandler.Installer=new byte[]{1,2,3};
                    Reject(()=>updater.DownloadLauncherUpdate(release,new QuietProgress(),CancellationToken.None).GetAwaiter().GetResult(),"Corrupted launcher installer cannot be executed");
                    Check(Directory.GetFiles(Path.Combine(updater.Root,"updates")).Length==0,"Rejected launcher download is cleaned up");
                    using(var sha=SHA256.Create()) release.sha256=BitConverter.ToString(sha.ComputeHash(launcherHandler.Installer)).Replace("-","").ToLowerInvariant();
                    Reject(()=>updater.DownloadLauncherUpdate(release,new QuietProgress(),CancellationToken.None).GetAwaiter().GetResult(),"Correctly hashed non-installer payload is rejected by product metadata validation");
                    release.sha256=setupHash; launcherHandler.Installer=installerBytes;
                    using(var updateCancellation=new CancellationTokenSource()) { updateCancellation.Cancel(); Reject(()=>updater.DownloadLauncherUpdate(release,new QuietProgress(),updateCancellation.Token).GetAwaiter().GetResult(),"Cancelled launcher download never starts setup"); }
                    launcherHandler.FailManifest=true;
                    Reject(()=>updater.CheckLauncherUpdate("1.6.0",CancellationToken.None).GetAwaiter().GetResult(),"Failed launcher checks report failure instead of claiming up to date");
                    launcherHandler.FailManifest=false; updater.SaveToken(new string('a',25));
                    Check(updater.CheckLauncherUpdate("1.6.0",CancellationToken.None).GetAwaiter().GetResult()!=null,"Authenticated launcher manifest uses GitHub release assets API");
                    downloaded=updater.DownloadLauncherUpdate(release,new QuietProgress(),CancellationToken.None).GetAwaiter().GetResult();
                    Check(File.Exists(downloaded),"Authenticated launcher installer uses release assets API");
                }
                var invalid=LauncherService.Json.Deserialize<LauncherRelease>(LauncherService.Json.Serialize(release)); invalid.downloadUrl="https://example.com/setup.exe";
                Reject(()=>LauncherUpdates.Parse(LauncherService.Json.Serialize(invalid)),"Launcher updates reject external download hosts");
                invalid.downloadUrl=release.downloadUrl+"?redirect=1";
                Reject(()=>LauncherUpdates.Parse(LauncherService.Json.Serialize(invalid)),"Launcher updates require the exact versioned installer asset");
                invalid.downloadUrl=release.downloadUrl; invalid.sha256="missing";
                Reject(()=>LauncherUpdates.Parse(LauncherService.Json.Serialize(invalid)),"Launcher update manifest requires a SHA-256 checksum");
                using(var own=System.Diagnostics.Process.GetCurrentProcess()) {
                    using(var validated=LauncherUpdates.ValidateParent(own.Id,own.StartTime.ToUniversalTime().Ticks,own.MainModule.FileName)) Check(validated.Id==own.Id,"Update handoff verifies the exact running parent process");
                    Reject(()=>LauncherUpdates.ValidateParent(own.Id,own.StartTime.ToUniversalTime().Ticks+1,own.MainModule.FileName),"Update handoff rejects a reused process identity");
                    Reject(()=>LauncherUpdates.ValidateParent(own.Id,own.StartTime.ToUniversalTime().Ticks,Path.Combine(root,"wrong.exe")),"Update handoff rejects another executable");
                }
                Check(!LauncherUpdates.IsInstalledCopy(Path.Combine(root,"portable.exe"),root),"Portable copies cannot overwrite an unrelated registered launcher");
                string handoffRoot=Path.Combine(root,"handoff"); InstallationPaths.Prepare(handoffRoot,"launcher",false);
                File.Copy(System.Reflection.Assembly.GetExecutingAssembly().Location,Path.Combine(handoffRoot,"TMApps-Launcher.exe"));
                File.Copy(System.Reflection.Assembly.GetExecutingAssembly().Location,Path.Combine(handoffRoot,"FixtureSetup.exe"));
                Check(LauncherUpdates.IsInstalledCopy(Path.Combine(handoffRoot,"TMApps-Launcher.exe"),handoffRoot),"Owned installed launcher path qualifies for in-place update");
                using(var parentFixture=System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Path.Combine(handoffRoot,"TMApps-Launcher.exe"),"--handoff-fixture \""+handoffRoot+"\"") { UseShellExecute=false,CreateNoWindow=true })) {
                    if(!parentFixture.WaitForExit(15000)) { parentFixture.Kill(); throw new Exception("Updater handoff timed out"); }
                    Check(parentFixture.ExitCode==0,"Real launcher-to-installer handoff waits for updater readiness");
                    var end=DateTime.UtcNow.AddSeconds(10); while(!File.Exists(Path.Combine(handoffRoot,"handoff-report.txt")) && DateTime.UtcNow<end) Thread.Sleep(50);
                    Check(File.Exists(Path.Combine(handoffRoot,"handoff-report.txt")),"Updater waits for parent launcher exit before applying changes");
                }
                string sharedPath=Path.Combine(root,"shared-suite","profile.json");
                Check(TMAppsShared.SuiteProfileStore.Load(sharedPath).emails.Count==0,"Optional profile starts empty without creating a shared file");
                var suiteFixture=TMAppsShared.SuiteProfileStore.Save(sharedPath,new TMAppsShared.SuiteProfile { displayName="  Example User  ",emails=new System.Collections.Generic.List<string> { "first@example.com","FIRST@example.com","second@example.org" },shareWithMail=true });
                Check(suiteFixture.displayName=="Example User" && suiteFixture.emails.Count==2 && suiteFixture.revision.Length==32,"Suite profile normalizes name, deduplicates addresses, and generates a sync revision");
                var loadedProfile=TMAppsShared.SuiteProfileStore.Load(sharedPath);
                Check(loadedProfile.shareWithMail && loadedProfile.emails[1]=="second@example.org","Shared suite profile saves and reloads multiple addresses");
                Reject(()=>TMAppsShared.SuiteProfileStore.Save(sharedPath,new TMAppsShared.SuiteProfile { emails=new System.Collections.Generic.List<string> { "invalid address" } }),"Profile rejects invalid emails before writing");
                Check(TMAppsShared.SuiteProfileStore.Load(sharedPath).revision==suiteFixture.revision,"Rejected profile edit retains the previous saved profile");
                Reject(()=>TMAppsShared.SuiteProfileStore.Validate(new TMAppsShared.SuiteProfile { displayName="Bad\nName" }),"Profile rejects control characters in names");
                Check(!File.ReadAllText(sharedPath).Contains("password") && !File.ReadAllText(sharedPath).Contains("token"),"Shared profile contract contains no passwords or auth tokens");
                var application = new LauncherApplication();
                SynchronizationContext.SetSynchronizationContext(new System.Windows.Threading.DispatcherSynchronizationContext(System.Windows.Threading.Dispatcher.CurrentDispatcher));
                Check(TMAppsShared.SuiteProfileStore.Validate(new TMAppsShared.SuiteProfile()).socialAccounts.Count==0 && !new TMAppsShared.SuiteProfile().shareWithSocialApps,"Legacy profiles have no social entries and sharing defaults off");
                var disabledProfile=TMAppsShared.SuiteProfileStore.Validate(new TMAppsShared.SuiteProfile {shareWithApps=false,shareWithMail=true,shareWithSocialApps=true});Check(!disabledProfile.shareWithMail&&!disabledProfile.shareWithSocialApps,"Global profile sharing opt-out also protects older Mail and social readers");
                var socialFixture=new TMAppsShared.SuiteProfile { socialAccounts=new System.Collections.Generic.List<TMAppsShared.SocialAccount> { new TMAppsShared.SocialAccount { platform=" Instagram ",account=" @example " },new TMAppsShared.SocialAccount { platform="instagram",account="@EXAMPLE" },new TMAppsShared.SocialAccount { platform="YouTube",account="https://www.youtube.com/@example" } },shareWithSocialApps=true };
                var socialPath=Path.Combine(root,"social-profile.json"); TMAppsShared.SuiteProfileStore.Save(socialPath,socialFixture);
                var socialReload=TMAppsShared.SuiteProfileStore.Load(socialPath);
                Check(socialReload.socialAccounts.Count==2 && socialReload.socialAccounts[0].platform=="Instagram" && socialReload.socialAccounts[0].account=="@example" && socialReload.shareWithSocialApps,"Social account sharing round-trips, trims values, and deduplicates accounts");
                foreach(var invalidSocial in new[]{"http://example.com/user","https://user:secret@example.com/user","https://example.com/user?token=secret","https://example.com/user#secret","bad\nname"}) Reject(()=>TMAppsShared.SuiteProfileStore.Save(socialPath,new TMAppsShared.SuiteProfile { socialAccounts=new System.Collections.Generic.List<TMAppsShared.SocialAccount> { new TMAppsShared.SocialAccount { platform="Example",account=invalidSocial } } }),"Invalid or credential-bearing social entry is rejected before writing");
                Check(TMAppsShared.SuiteProfileStore.Load(socialPath).revision==socialReload.revision,"Rejected social edits preserve the last saved profile");
                var authRoot=Path.Combine(root,"auth-test");Directory.CreateDirectory(authRoot);File.WriteAllText(Path.Combine(authRoot,"auth-config.json"),"{\"url\":\"https://auth.example.test\",\"publicKey\":\"sb_publishable_test\"}");
                var authHandler=new AuthHandler();using(var auth=new SuiteSignIn(authRoot,authHandler)) {
                    Check(auth.Configured,"Prepared sign-in accepts only explicit public service configuration");
                    Reject(()=>auth.Send("not an email").GetAwaiter().GetResult(),"Sign-in validates an email before making a request");
                    Check(auth.Verify("verified@example.com","123456").GetAwaiter().GetResult().Contains("tma-cut") && auth.Email=="verified@example.com","Email code verification returns verified identity and selected app access");
                    Check(!System.Text.Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(authRoot,"auth-session.bin"))).Contains("private-refresh"),"Windows session persistence uses OS protection instead of plaintext");
                    auth.Access(new[]{"tma-cut"}).GetAwaiter().GetResult();Reject(()=>auth.Access(new[]{"unknown"}).GetAwaiter().GetResult(),"Sign-in cannot grant access to an unknown app");auth.Logout().GetAwaiter().GetResult();Check(!File.Exists(Path.Combine(authRoot,"auth-session.bin")),"Sign-out removes the protected local session");
                }
                Check(ExperienceContent.Current.articles.Count==17 && ExperienceContent.Current.apps.Values.All(a=>a.screenshots.Count<=10 && a.screenshots.All(m=>ExperienceContent.Media(m.url))),"Knowledge articles and app galleries have trusted bounded content");
                var redacted=LauncherDiagnostics.Redact("token=secret Bearer access user@example.com\nC:\\Users\\Person\\private.txt");Check(!redacted.Contains("secret")&&!redacted.Contains("user@example.com")&&!redacted.Contains("Person"),"Crash reports redact tokens, emails and local paths");
                Check(LauncherDiagnostics.Issue("bug",redacted).StartsWith("https://github.com/DaddyTylerXO/TMApps/issues/new?") && LauncherDiagnostics.Issue("feature",null).Contains("Requested"),"Support actions use prefilled matching GitHub issue forms");
                string uiRoot=Path.Combine(root,"ui-profile"); Directory.CreateDirectory(uiRoot);
                var uiCatalog=LauncherService.ParseCatalog(original);
                using(var sha=SHA256.Create()) uiCatalog.apps[0].sha256=BitConverter.ToString(sha.ComputeHash(handler.Bytes)).Replace("-","").ToLowerInvariant();
                LauncherService.AtomicWrite(Path.Combine(uiRoot,"catalog.json"),LauncherService.Json.Serialize(uiCatalog));
                int locationPrompts=0;
                string chosenAppFolder=Path.Combine(root,"Chosen Application Folder");
                var uiIntegration=new RecordingIntegration();
                var uiHandler=new PackageHandler { Bytes=handler.Bytes,UpdateCatalog=uiCatalog,Launcher=new LauncherRelease { schemaVersion=1,version="9.0.0",downloadUrl="https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMApps-Launcher-Setup-9.0.0.exe",sha256=setupHash } };
                var window=application.Initialize(uiRoot,uiHandler,false,app=>{ locationPrompts++; return locationPrompts==1 ? null : new AppInstallOptions { directory=chosenAppFolder,runAtStartup=true,desktopShortcut=true }; },uiIntegration);
                using (var icon = typeof(Bundled).Assembly.GetManifestResourceStream("TMApps.launcher.ico")) {
                    var decoder = BitmapDecoder.Create(icon, BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
                    Check(decoder.Frames.Count == 7, "Embedded rocket icon has seven Windows display sizes");
                    ((Image)window.FindName("BrandIcon")).Source = decoder.Frames.Last();
                }
                Check(System.Diagnostics.FileVersionInfo.GetVersionInfo(Path.Combine(args[0],"build","TMApps-Launcher.exe")).CompanyName == "DaddyTylerXO", "Executable company metadata uses GitHub username");
                int trayOpen=0,trayUpdates=0,trayQuit=0;
                var trayMenu=LauncherApplication.CreateTrayMenu(()=>trayOpen++,()=>trayUpdates++,()=>trayQuit++);
                trayMenu.Placement=System.Windows.Controls.Primitives.PlacementMode.AbsolutePoint; trayMenu.HorizontalOffset=100; trayMenu.VerticalOffset=100; trayMenu.IsOpen=true; trayMenu.UpdateLayout();
                var trayChrome=System.Windows.Media.VisualTreeHelper.GetChild(trayMenu,0) as Border;
                Check(trayChrome!=null && trayChrome.CornerRadius.TopLeft==14 && trayChrome.Background.ToString()=="#FF412313", "Tray menu matches Mail rounded shell in launcher orange");
                foreach(MenuItem item in trayMenu.Items) {
                    item.ApplyTemplate(); var bubble=item.Template.FindName("bubble",item) as Border;
                    Check(bubble!=null && bubble.CornerRadius.TopLeft==19 && item.Background.ToString()=="#FFCC5500", "Tray action uses rounded burnt-orange bubble");
                }
                var trayBitmap=new RenderTargetBitmap((int)Math.Ceiling(trayMenu.ActualWidth),(int)Math.Ceiling(trayMenu.ActualHeight),96,96,PixelFormats.Pbgra32); trayBitmap.Render(trayMenu);
                var trayEncoder=new PngBitmapEncoder(); trayEncoder.Frames.Add(BitmapFrame.Create(trayBitmap)); using(var output=File.Create(Path.Combine(args[0],"build","tray-menu-preview.png"))) trayEncoder.Save(output);
                foreach(MenuItem item in trayMenu.Items) { trayMenu.IsOpen=true; item.RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent,item)); Check(!trayMenu.IsOpen,"Tray command dismisses its popup before invoking its action"); }
                Check(trayOpen==1 && trayUpdates==1 && trayQuit==1,"Tray commands invoke Open, Check updates, and Quit exactly once");
                var cards = (ItemsControl)window.FindName("Cards");

                var content = (FrameworkElement)window.Content;
                content.Measure(new Size(1180,800)); content.Arrange(new Rect(0,0,1180,800)); content.UpdateLayout();
                var bitmap = new RenderTargetBitmap(1180,800,96,96,PixelFormats.Pbgra32); bitmap.Render(content);
                byte[] pixels = new byte[1180*800*4]; bitmap.CopyPixels(pixels,1180*4,0);
                Check(pixels.Any(p => p > 0), "WPF preview has rendered pixels");
                var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
                using (var output = File.Create(Path.Combine(args[0], "build", "launcher-preview.png"))) encoder.Save(output);
                Check(cards.Items.Count == 8, "Render real WPF templates for both apps");
                var librariesSearch=(TextBox)window.FindName("Search");
                librariesSearch.Text="TMA-Libraries"; window.UpdateLayout();
                window.Dispatcher.Invoke(new Action(()=>{}),System.Windows.Threading.DispatcherPriority.ApplicationIdle);
                var librariesCard=((System.Collections.IEnumerable)cards.ItemsSource).Cast<AppView>().Single();
                Check(librariesCard.Id=="tma-libraries" && librariesCard.Status=="READY TO INSTALL" && librariesCard.CanAct && librariesCard.VersionLabel=="v0.1.0" && librariesCard.Number=="05 / LIBRARIES", "Libraries search keeps its position and enables the published Windows install");
                var librariesBitmap=new RenderTargetBitmap(1180,800,96,96,PixelFormats.Pbgra32);librariesBitmap.Render(content);
                var librariesEncoder=new PngBitmapEncoder();librariesEncoder.Frames.Add(BitmapFrame.Create(librariesBitmap));using(var output=File.Create(Path.Combine(args[0],"build","libraries-preview.png")))librariesEncoder.Save(output);
                librariesSearch.Text="TMA-Finance";window.UpdateLayout();window.Dispatcher.Invoke(new Action(()=>{}),System.Windows.Threading.DispatcherPriority.ApplicationIdle);
                var financeCard=((System.Collections.IEnumerable)cards.ItemsSource).Cast<AppView>().Single();
                Check(financeCard.Id=="tma-finance" && financeCard.CanAct && financeCard.Number=="06 / FINANCE","Finance search keeps its full library position and enables installation");
                var financeBitmap=new RenderTargetBitmap(1180,800,96,96,PixelFormats.Pbgra32);financeBitmap.Render(content);var financeEncoder=new PngBitmapEncoder();financeEncoder.Frames.Add(BitmapFrame.Create(financeBitmap));using(var output=File.Create(Path.Combine(args[0],"build","finance-preview.png")))financeEncoder.Save(output);
                librariesSearch.Text="";window.UpdateLayout();

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
                Check(cards.ActualWidth>0 && cards.Items.Count==8,"Grid template loads at minimum supported width");
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=> {
                    var dialog=application.Windows.OfType<ThemedDialog>().Single();
                    SaveDialog(dialog,Path.Combine(args[0],"build","uninstall-preview.png"));
                    Check(dialog.Body.Children.OfType<RadioButton>().First().IsChecked==true,"Themed uninstall defaults to keeping local data");
                    dialog.Body.Children.OfType<RadioButton>().Last().IsChecked=true;
                    dialog.Actions.Children.OfType<Button>().Last().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                }));
                var uninstallChoice=ThemedDialogs.Uninstall(window,uiCatalog.apps[0],new[]{"Fixture profile"});
                Check(uninstallChoice!=null && uninstallChoice.deleteLocalData,"Themed uninstall returns explicit delete selection");
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=> {
                    var dialog=application.Windows.OfType<ThemedDialog>().Single();
                    dialog.Body.Children.OfType<DockPanel>().Single().Children.OfType<TextBox>().Single().Text=@"C:\TMApps\TMA-Mail";
                    SaveDialog(dialog,Path.Combine(args[0],"build","install-preview.png"));
                    Check(((Border)dialog.Content).CornerRadius.TopLeft==20 && dialog.Actions.Children.OfType<Button>().All(b=>b.Template!=null),"Orange-grey modal renders rounded shell and bubble button templates");
                    dialog.Close();
                }));
                Check(application.PromptInstallLocation(uiCatalog.apps[0])==null,"Themed install cancellation starts no operation");
                bool launcherPromptSeen=false;
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=> {
                    var popup=application.Windows.OfType<ThemedDialog>().Single(); launcherPromptSeen=popup.Title=="Update TMApps Launcher?";
                    popup.Actions.Children.OfType<Button>().First().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                }));
                var checkUpdates=(Button)window.FindName("RefreshButton"); checkUpdates.RaiseEvent(new RoutedEventArgs(Button.ClickEvent,checkUpdates));
                PumpUntil(()=>uiHandler.LauncherChecks>0 && checkUpdates.IsEnabled);
                Check(launcherPromptSeen,"Real Check for updates button offers a newer launcher in a themed popup");
                Check(!Directory.Exists(Path.Combine(uiRoot,"updates")),"Declining launcher update performs no installer download");
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=> {
                    var popup=application.Windows.OfType<ThemedDialog>().Single();
                    popup.Body.Children.OfType<TextBox>().First().Text="Example User";
                    var emailRows=popup.Body.Children.OfType<StackPanel>().First(p=>p.Children.OfType<DockPanel>().Any());
                    emailRows.Children.OfType<DockPanel>().First().Children.OfType<TextBox>().Single().Text="first@example.com";
                    popup.Body.Children.OfType<Button>().Single(b=>b.Name=="AddEmailAddress").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                    emailRows.Children.OfType<DockPanel>().Last().Children.OfType<TextBox>().Single().Text="second@example.org";
                    var socialShare=popup.Body.Children.OfType<CheckBox>().Single(c=>c.Name=="ShareWithSocialApps"); Check(socialShare.IsChecked==false,"Social app sharing requires explicit opt-in");
                    popup.Body.Children.OfType<Button>().Single(b=>b.Name=="AddSocialAccount").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                    var socialRows=popup.Body.Children.OfType<StackPanel>().Single(p=>p.Name=="SocialAccounts");
                    var socialRow=(StackPanel)socialRows.Children[0]; socialRow.Children.OfType<TextBox>().First().Text="Instagram"; socialRow.Children.OfType<TextBox>().Last().Text="@example"; socialShare.IsChecked=true;
                    SaveDialog(popup,Path.Combine(args[0],"build","profile-preview.png"));
                    var sharingScroll=popup.Body.Parent as ScrollViewer;if(sharingScroll!=null){sharingScroll.ScrollToVerticalOffset(300);popup.UpdateLayout();SaveDialog(popup,Path.Combine(args[0],"build","profile-sharing-preview.png"));}
                    var profileScroll=popup.Body.Parent as ScrollViewer;
                    if(profileScroll!=null) { profileScroll.ScrollToEnd(); popup.UpdateLayout(); SaveDialog(popup,Path.Combine(args[0],"build","social-profile-preview.png")); }

                    popup.Actions.Children.OfType<Button>().Last().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                }));
                var profileButton=(Button)window.FindName("ProfileButton"); profileButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent,profileButton));
                var savedProfile=TMAppsShared.SuiteProfileStore.Load(Path.Combine(uiRoot,"shared-profile.json"));
                Check(savedProfile.displayName=="Example User" && savedProfile.emails.Count==2 && savedProfile.shareWithMail,"Real profile icon opens optional editor and saves the shared profile");
                Check(savedProfile.socialAccounts.Count==1 && savedProfile.socialAccounts[0].account=="@example" && savedProfile.shareWithSocialApps,"Real profile editor saves optional social accounts and sharing consent");
                Check(((TextBlock)window.FindName("ProfileInitial")).Text=="E","Top-right profile avatar shows the saved name initial");
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=> {
                    var popup=application.Windows.OfType<ThemedDialog>().Single(); popup.Body.Children.OfType<TextBox>().First().Text="Cancelled edit";
                    var socialRows=popup.Body.Children.OfType<StackPanel>().Single(p=>p.Name=="SocialAccounts");
                    ((StackPanel)socialRows.Children[0]).Children.OfType<Button>().Single().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                    Check(socialRows.Children.Count==0,"Social account Remove control updates the editor");
                    popup.Actions.Children.OfType<Button>().First().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                }));
                profileButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent,profileButton));
                Check(TMAppsShared.SuiteProfileStore.Load(Path.Combine(uiRoot,"shared-profile.json")).revision==savedProfile.revision && TMAppsShared.SuiteProfileStore.Load(Path.Combine(uiRoot,"shared-profile.json")).socialAccounts.Count==1,"Cancelling profile edits leaves sync state unchanged");
                var neutralPreference=new Preferences {theme="Grey",includeKbSearch=false};neutralPreference.Normalize();Check(neutralPreference.theme=="Grey"&&!neutralPreference.includeKbSearch,"Preference normalization preserves the chosen theme and KB search opt-out");
                string originalBackground=window.Background.ToString();
                LauncherThemes.Apply(window,"Grey");Check(window.Background.ToString()=="#FF25272B","Grey palette updates the rendered launcher");LauncherThemes.Apply(window,"Black");Check(window.Background.ToString()=="#FF08090B","Black palette updates the rendered launcher");LauncherThemes.Apply(window,"Orange");Check(window.Background.ToString()==originalBackground,"Returning to Orange restores the original palette");
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=>{
                    var popup=application.Windows.OfType<ThemedDialog>().Single();var search=popup.Body.Children.OfType<TextBox>().Single();var body=popup.Body.Children.OfType<StackPanel>().Single();popup.UpdateLayout();Descendants<ComboBox>(body).First().SelectedItem="Grey";Check(((Border)((StackPanel)((Border)popup.Content).Child).Children[0]).Background.ToString()=="#FF202226","Grey palette updates the modal header as well as the window background");SaveDialog(popup,Path.Combine(args[0],"build","settings-preview.png"));
                    var compact=Descendants<CheckBox>(body).Single();compact.ApplyTemplate();Check(compact.Template.FindName("Box",compact) is Border,"Compact Navigation Bar uses the rounded keyboard-accessible checkbox");
                    Buttons(popup).Single(b=>Convert.ToString(b.Tag)=="Startup and performance").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));popup.UpdateLayout();Check(Descendants<CheckBox>(body).Count()==4,"Startup tab exposes the four persisted startup and performance options");SaveDialog(popup,Path.Combine(args[0],"build","startup-settings-preview.png"));
                    Buttons(popup).Single(b=>Convert.ToString(b.Tag)=="Help and KB Library").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));popup.UpdateLayout();Check(Descendants<TextBox>(body).Any(),"Help tab has a dedicated KB search field");SaveDialog(popup,Path.Combine(args[0],"build","help-settings-preview.png"));
                    search.Text="Launcher-KB6";Check(body.Children.OfType<Button>().Any(b=>Convert.ToString(b.Content).Contains("Launcher-KB6")),"Settings search locates KB numbers");SaveDialog(popup,Path.Combine(args[0],"build","settings-search-preview.png"));popup.Actions.Children.OfType<Button>().First().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                }));
                ((Button)window.FindName("SettingsButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=>{var popup=application.Windows.OfType<ThemedDialog>().Single();var mode=popup.Body.Children.OfType<ComboBox>().Single();Check(mode.SelectedIndex==0,"Spotify defaults to controlling a Connect device");mode.SelectedIndex=1;Check(File.ReadAllText(Path.Combine(uiRoot,"spotify-mode.txt"))=="Browser","Spotify browser-streaming preference is persisted without credentials");SaveDialog(popup,Path.Combine(args[0],"build","spotify-preview.png"));popup.Actions.Children.OfType<Button>().Last().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));}));
                ((Button)window.FindName("SpotifyButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=>{var popup=application.Windows.OfType<ThemedDialog>().Single();Check(popup.Body.Children.OfType<Button>().Any(b=>Convert.ToString(b.Content)=="Bug report"),"Help exposes feature, bug, issue, and crash-report actions");SaveDialog(popup,Path.Combine(args[0],"build","help-preview.png"));popup.Actions.Children.OfType<Button>().Last().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));}));
                ((Button)window.FindName("HelpButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=>{var popup=application.Windows.OfType<ThemedDialog>().Single();Check(popup.Title.Contains("TMA-Mail") && popup.Body.Children.OfType<Grid>().Any(),"App details displays its versioned hero, features and bounded media gallery");SaveDialog(popup,Path.Combine(args[0],"build","details-preview.png"));popup.Actions.Children.OfType<Button>().Last().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));}));
                Buttons(cards).First(b=>Convert.ToString(b.Content)=="Details" && Convert.ToString(b.Tag)=="tma-mail").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                System.Windows.Threading.Dispatcher.CurrentDispatcher.BeginInvoke(new Action(()=>{var popup=application.Windows.OfType<ThemedDialog>().Single();Check(popup.Title=="Service Status" && popup.Body.Children.OfType<TextBlock>().Any(x=>x.Text=="API Checkers"),"Service Status exposes manual credential-free API checks");SaveDialog(popup,Path.Combine(args[0],"build","service-status-preview.png"));popup.Actions.Children.OfType<Button>().Last().RaiseEvent(new RoutedEventArgs(Button.ClickEvent));}));
                ((Button)window.FindName("StatusButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                Console.WriteLine(count + " checks passed. Preview: build/launcher-preview.png");
                window.Close(); application.Shutdown(); return 0;
            } catch(Exception ex) { Console.Error.WriteLine(ex); return 1; }
            finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
        }
    }
}
