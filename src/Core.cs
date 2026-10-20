using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace TMApps {
    public static class Bundled {
        public static string Read(string name) {
            using (var input = typeof(Bundled).Assembly.GetManifestResourceStream("TMApps." + name)) {
                if (input == null) throw new InvalidDataException("Missing embedded launcher resource: " + name);
                using (var reader = new StreamReader(input)) return reader.ReadToEnd();
            }
        }
    }
    public class Catalog { public int schemaVersion { get; set; } public List<AppInfo> apps { get; set; } }
    public class AppInfo {
        public string id { get; set; } public string name { get; set; } public string category { get; set; }
        public string description { get; set; } public string version { get; set; } public string branch { get; set; }
        public string executable { get; set; } public string downloadUrl { get; set; } public string sha256 { get; set; }
        public string updatedAt { get; set; } public string[] platforms { get; set; }
        public bool Available { get { return !String.IsNullOrEmpty(downloadUrl); } }
    }
    public class Installed { public string version { get; set; } public string folder { get; set; } public string executable { get; set; } public string installRoot { get; set; } public bool runAtStartup { get; set; } public bool desktopShortcut { get; set; } }
    public class AppInstallOptions { public string directory { get; set; } public bool runAtStartup { get; set; } public bool desktopShortcut { get; set; } public AppInstallOptions() { desktopShortcut=true; } }
    public static class InstallationPaths {
        public static string Normalize(string directory) {
            if(String.IsNullOrWhiteSpace(directory)) throw new IOException("Choose an installation folder.");
            directory=Environment.ExpandEnvironmentVariables(directory.Trim());
            if(!Regex.IsMatch(directory,@"^(?:[A-Za-z]:[\\/]|\\\\)") || directory.StartsWith(@"\\?\") || directory.StartsWith(@"\\.\")) throw new IOException("Choose a full folder path, such as D:\\TMApps\\TMA-Mail.");
            string full=Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar);
            if(String.Equals(full,Path.GetPathRoot(full).TrimEnd(Path.DirectorySeparatorChar),StringComparison.OrdinalIgnoreCase) || File.Exists(full)) throw new IOException("Choose an application folder, not a drive root or an existing file.");
            return full;
        }
        public static bool Same(string a,string b) { return String.Equals(Normalize(a),Normalize(b),StringComparison.OrdinalIgnoreCase); }
        public static string Marker(string root) { return Path.Combine(root,".tmapps-install-owner"); }
        public static bool Owned(string root,string owner) { try { return File.ReadAllText(Marker(root))==owner; } catch { return false; } }
        public static void Validate(string directory,string owner,bool allowLegacy) {
            string root=Normalize(directory);
            if(Directory.Exists(root) && Directory.GetFileSystemEntries(root).Length>0 && !Owned(root,owner) && !allowLegacy) throw new IOException("This folder already contains other files. Choose an empty folder dedicated to this application.");
        }
        public static void Prepare(string directory,string owner,bool allowLegacy) {
            Validate(directory,owner,allowLegacy); Directory.CreateDirectory(directory);
            if(!Owned(directory,owner)) File.WriteAllText(Marker(directory),owner);
        }
    }
    public class Preferences {
        public bool checkOnStartup { get; set; } public bool runAtStartup { get; set; } public bool desktopShortcut { get; set; }
        public bool closeToTray { get; set; } public string navigationEdge { get; set; } public bool compactNavigation { get; set; }
        public string libraryView { get; set; }
        public Preferences() { checkOnStartup = true; closeToTray = true; desktopShortcut = true; navigationEdge = "Left"; libraryView = "List"; }
        public void Normalize() { if (!new[] { "Left", "Right", "Top", "Bottom" }.Contains(navigationEdge)) navigationEdge = "Left"; if (libraryView != "Grid") libraryView = "List"; }
    }
    public sealed class LauncherService : IDisposable {
        public const string CatalogUrl = "https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/catalog.json";
        public readonly string Root;
        readonly HttpClient http;
        readonly IAppIntegration integration;
        readonly IAppProcessController processes;
        readonly IAppDataStore data;
        public string LastIntegrationWarning { get; private set; }
        public string LastRefreshNotice { get; private set; }
        string githubToken;
        public bool HasToken { get { return !String.IsNullOrEmpty(githubToken); } }
        public static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        public LauncherService(string root, HttpMessageHandler handler = null, IAppIntegration appIntegration = null, IAppProcessController appProcesses = null, IAppDataStore appData = null) {
            Root = Path.GetFullPath(root); Directory.CreateDirectory(Root);
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            http = handler == null ? new HttpClient() : new HttpClient(handler); http.Timeout = TimeSpan.FromMinutes(30);
            integration=appIntegration ?? new WindowsAppIntegration();
            processes=appProcesses ?? new WindowsAppProcesses(app=>InstallRoot(app,GetInstalled(app)));
            data=appData ?? new WindowsAppData();
            http.DefaultRequestHeaders.UserAgent.ParseAdd("TMApps-Launcher/1.9");
            try { githubToken = Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(Path.Combine(Root, "github-token.dat")), null, DataProtectionScope.CurrentUser)); } catch { }
        }
        public async Task<LauncherRelease> CheckLauncherUpdate(string currentVersion,CancellationToken token) {
            var release=LauncherUpdates.Parse(await ReadText(await Download(LauncherUpdates.ManifestUrl+"?check="+DateTime.UtcNow.Ticks,token),token));
            return IsNewer(release.version,currentVersion) ? release : null;
        }
        public async Task<string> DownloadLauncherUpdate(LauncherRelease release,IProgress<string> progress,CancellationToken token) {
            release=LauncherUpdates.Parse(Json.Serialize(release));
            string directory=Path.Combine(Root,"updates"); Directory.CreateDirectory(directory);
            string installer=Path.Combine(directory,"TMApps-Launcher-Setup-"+release.version+"-"+Guid.NewGuid().ToString("N")+".exe");
            bool verified=false;
            try {
                using(var response=await Download(release.downloadUrl,token)) {
                    response.EnsureSuccessStatusCode();
                    using(var input=await response.Content.ReadAsStreamAsync()) using(var output=File.Create(installer)) {
                        byte[] buffer=new byte[81920]; int n; long total=0;
                        while((n=await input.ReadAsync(buffer,0,buffer.Length,token))>0) {
                            total+=n; if(total>32L*1024*1024) throw new InvalidDataException("Launcher installer is too large.");
                            await output.WriteAsync(buffer,0,n,token); progress.Report("Downloading launcher update: "+(total/1024)+" KB");
                        }
                    }
                }
                token.ThrowIfCancellationRequested(); VerifyHash(installer,release.sha256);
                var info=FileVersionInfo.GetVersionInfo(installer);
                if(info.ProductName!="TMApps Launcher Setup" || info.CompanyName!="DaddyTylerXO" || info.FileVersion!=release.version+".0") throw new InvalidDataException("The installer version does not match the launcher update.");
                verified=true; return installer;
            } finally { if(!verified && File.Exists(installer)) File.Delete(installer); }
        }
        public void SaveToken(string token) {
            token = (token ?? "").Trim();
            if (token.Length > 0 && !Regex.IsMatch(token, "^[A-Za-z0-9_]{20,255}$")) throw new ArgumentException("Enter a valid GitHub personal access token.");
            string path = Path.Combine(Root, "github-token.dat");
            if (token.Length == 0) { if (File.Exists(path)) File.Delete(path); }
            else {
                string temp = path + ".tmp";
                File.WriteAllBytes(temp, ProtectedData.Protect(Encoding.UTF8.GetBytes(token), null, DataProtectionScope.CurrentUser));
                if (File.Exists(path)) File.Replace(temp, path, null); else File.Move(temp, path);
            }
            githubToken = token;
        }
        async Task<HttpResponseMessage> ApiGet(string url, string accept, CancellationToken cancellation) {
            using (var request = new HttpRequestMessage(HttpMethod.Get, url)) {
                request.Headers.Accept.ParseAdd(accept);
                if(HasToken) request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", githubToken);
                request.Headers.CacheControl=new System.Net.Http.Headers.CacheControlHeaderValue { NoCache=true };
                return await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellation);
            }
        }
        async Task<HttpResponseMessage> Download(string url, CancellationToken cancellation) {
            if (!HasToken) return await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellation);
            var uri = new Uri(url);
            if (uri.Host == "raw.githubusercontent.com") {
                var parts = uri.AbsolutePath.Split(new[]{'/'}, StringSplitOptions.RemoveEmptyEntries);
                string path = String.Join("/", parts.Skip(3).ToArray());
                return await ApiGet("https://api.github.com/repos/DaddyTylerXO/TMApps/contents/" + path + "?ref=" + Uri.EscapeDataString(parts[2]), "application/vnd.github.raw+json", cancellation);
            }
            var segments = uri.AbsolutePath.Split(new[]{'/'}, StringSplitOptions.RemoveEmptyEntries);
            string tag = segments[4]; string filename = Uri.UnescapeDataString(segments[5]);
            using (var metadata = await ApiGet("https://api.github.com/repos/DaddyTylerXO/TMApps/releases/tags/" + tag, "application/vnd.github+json", cancellation)) {
                metadata.EnsureSuccessStatusCode();
                string json = await metadata.Content.ReadAsStringAsync();
                var release = Json.Deserialize<Dictionary<string, object>>(json);
                var assets = (System.Collections.IEnumerable)release["assets"];
                foreach (Dictionary<string,object> asset in assets) {
                    if (Convert.ToString(asset["name"]) == filename) {
                        long id = Convert.ToInt64(asset["id"]);
                        return await ApiGet("https://api.github.com/repos/DaddyTylerXO/TMApps/releases/assets/" + id, "application/octet-stream", cancellation);
                    }
                }
                throw new IOException("This application package has not been published yet.");
            }
        }
        public static bool TrustedUrl(string value) {
            Uri u; if (!Uri.TryCreate(value, UriKind.Absolute, out u) || u.Scheme != "https" || !String.IsNullOrEmpty(u.UserInfo) || !u.IsDefaultPort) return false;
            return (u.Host == "github.com" && u.AbsolutePath.StartsWith("/DaddyTylerXO/TMApps/releases/download/", StringComparison.Ordinal)) ||
                (u.Host == "raw.githubusercontent.com" && u.AbsolutePath.StartsWith("/DaddyTylerXO/TMApps/", StringComparison.Ordinal));
        }
        public static Catalog ParseCatalog(string json) {
            var c = Json.Deserialize<Catalog>(json);
            if (c == null || c.schemaVersion != 1 || c.apps == null || (c.apps.Count < 2 || c.apps.Count > 4)) throw new InvalidDataException("Unsupported application catalog.");
            var ids = new HashSet<string>();
            foreach (var a in c.apps) {
                if (a == null || (a.id != "tma-mail" && a.id != "tma-agent-office" && a.id != "tma-safe" && a.id != "tma-padlock") || !ids.Add(a.id)) throw new InvalidDataException("Unknown or duplicate application.");
                bool validBranch=a.id=="tma-mail" ? a.branch=="TMA-Mail" : a.id=="tma-padlock" ? a.branch=="TMA-Padlock" : a.id=="tma-safe" ? a.branch=="TMA-Safe" : a.branch=="AI-Agent-Dashboard" || a.branch=="TMA-AgentOffice";
                if (String.IsNullOrWhiteSpace(a.name) || String.IsNullOrWhiteSpace(a.description) || !Regex.IsMatch(a.version ?? "", @"^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$") || !validBranch || a.executable != (a.id == "tma-mail" ? "TMA-Mail.exe" : a.id == "tma-padlock" ? "TMA-Padlock.exe" : a.id == "tma-safe" ? "TMA-Safe.exe" : "Agent Office.exe")) throw new InvalidDataException("Invalid application metadata.");
                if(a.platforms!=null && (a.platforms.Distinct().Count()!=a.platforms.Length || a.platforms.Any(platform=>!new[]{"windows","macos","linux"}.Contains(platform)) || (a.Available && !a.platforms.Contains("windows")))) throw new InvalidDataException("Invalid OS support metadata.");
                if (a.Available && (!TrustedUrl(a.downloadUrl) || !Regex.IsMatch(a.sha256 ?? "", "^[a-fA-F0-9]{64}$"))) throw new InvalidDataException("Invalid download location or checksum.");
            }
            return c;
        }
        public static bool IsNewer(string candidate, string installed) {
            var a = candidate.Split(new[]{'-'}, 2); var b = installed.Split(new[]{'-'}, 2);
            int n = Version.Parse(a[0]).CompareTo(Version.Parse(b[0]));
            if (n != 0) return n > 0;
            if (a.Length != b.Length) return a.Length == 1;
            return a.Length > 1 && String.CompareOrdinal(a[1], b[1]) > 0;
        }
        public Catalog LoadCatalog(string bundled = null) {
            string cache = Path.Combine(Root, "catalog.json");
            if (File.Exists(cache)) { try { return ParseCatalog(File.ReadAllText(cache)); } catch { } }
            return ParseCatalog(bundled == null ? Bundled.Read("catalog.json") : File.ReadAllText(bundled));
        }
        async Task<string> ReadText(HttpResponseMessage response,CancellationToken token) {
            using(response) {
                response.EnsureSuccessStatusCode();
                using(var input=await response.Content.ReadAsStreamAsync()) using(var output=new MemoryStream()) {
                    var buffer=new byte[8192]; int n;
                    while((n=await input.ReadAsync(buffer,0,buffer.Length,token))>0) {
                        if(output.Length+n>1024*1024) throw new InvalidDataException("Update metadata is too large."); output.Write(buffer,0,n);
                    }
                    return Encoding.UTF8.GetString(output.ToArray()).TrimStart('\uFEFF');
                }
            }
        }
        async Task<AppInfo> LatestMail(AppInfo current,CancellationToken token) {
            var commit=Json.Deserialize<Dictionary<string,object>>(await ReadText(await ApiGet("https://api.github.com/repos/DaddyTylerXO/TMApps/commits/TMA-Mail?check="+DateTime.UtcNow.Ticks,"application/vnd.github+json",token),token));
            string sha=Convert.ToString(commit["sha"]); if(!Regex.IsMatch(sha,"^[a-fA-F0-9]{40}$")) throw new InvalidDataException("Invalid source commit.");
            string source="https://raw.githubusercontent.com/DaddyTylerXO/TMApps/"+sha+"/";
            var update=Json.Deserialize<Dictionary<string,object>>(await ReadText(await Download(source+"update.json",token),token));
            string url=Convert.ToString(update["DownloadUrl"]);
            const string githubPrefix="https://github.com/DaddyTylerXO/TMApps/raw/refs/heads/TMA-Mail/dist/";
            const string rawPrefix="https://raw.githubusercontent.com/DaddyTylerXO/TMApps/TMA-Mail/dist/";
            string filename=url.StartsWith(githubPrefix,StringComparison.Ordinal) ? url.Substring(githubPrefix.Length) : url.StartsWith(rawPrefix,StringComparison.Ordinal) ? url.Substring(rawPrefix.Length) : "";
            var match=Regex.Match(filename,@"^TMA-Mail-(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)-windows\.zip$");
            if(!match.Success) throw new InvalidDataException("Unrecognised Mail package location.");
            string version=match.Groups[1].Value; string declared=Convert.ToString(update["Version"]);
            if(declared!=version && declared!=version.Split('-')[0]) throw new InvalidDataException("Mail version and package do not match.");
            string sidecar=(await ReadText(await Download(source+"dist/"+filename+".sha256",token),token)).Trim();
            var hash=Regex.Match(sidecar,@"^([a-fA-F0-9]{64})(?:\s+\*?(.+))?$");
            if(!hash.Success || (hash.Groups[2].Success && hash.Groups[2].Value!=filename)) throw new InvalidDataException("Invalid Mail package checksum.");
            var result=Json.Deserialize<AppInfo>(Json.Serialize(current)); result.version=version; result.downloadUrl=source+"dist/"+filename; result.sha256=hash.Groups[1].Value.ToLowerInvariant();
            var details=(Dictionary<string,object>)commit["commit"]; var committer=(Dictionary<string,object>)details["committer"]; result.updatedAt=Convert.ToString(committer["date"]);
            return result;
        }
        public async Task<Catalog> Refresh(CancellationToken token) {
            using(var timeout=CancellationTokenSource.CreateLinkedTokenSource(token)) {
                timeout.CancelAfter(TimeSpan.FromSeconds(35));
                Catalog catalog=null; bool shared=false,mailChecked=false;
                try {
                    catalog=ParseCatalog(await ReadText(await Download(CatalogUrl+"?check="+DateTime.UtcNow.Ticks,timeout.Token),timeout.Token)); shared=true;
                    var saved=LoadCatalog();
                    for(int i=0;i<catalog.apps.Count;i++) { var known=saved.apps.FirstOrDefault(a=>a.id==catalog.apps[i].id); if(known!=null && IsNewer(known.version,catalog.apps[i].version)) catalog.apps[i]=known; }
                }
                catch(OperationCanceledException) { throw; } catch { catalog=LoadCatalog(); }
                try {
                    var old=catalog.apps.First(a=>a.id=="tma-mail"); var latest=await LatestMail(old,timeout.Token);
                    if(IsNewer(latest.version,old.version) || latest.version==old.version) catalog.apps[catalog.apps.IndexOf(old)]=latest;
                    mailChecked=true;
                } catch(OperationCanceledException) { throw; } catch { }
                if(!shared && !mailChecked) throw new IOException("Neither release catalog nor Mail branch updates could be checked.");
                LastRefreshNotice=mailChecked ? (shared ? "Release catalog and latest TMA-Mail branch checked." : "Latest TMA-Mail branch checked; other apps use the saved catalog.") : "Release catalog checked. Could not verify newer TMA-Mail branch packages; try again shortly.";
                ParseCatalog(Json.Serialize(catalog)); AtomicWrite(Path.Combine(Root,"catalog.json"),Json.Serialize(catalog)); return catalog;
            }
        }
        public static void AtomicWrite(string path, string content) {
            string temp = path + ".tmp"; File.WriteAllText(temp, content);
            if (File.Exists(path)) File.Replace(temp, path, null); else File.Move(temp, path);
        }
        string AppRoot(AppInfo app) { return Path.Combine(Root, "apps", app.id); }
        public string DefaultAppInstallDirectory(AppInfo app) { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs",app.name); }
        public string ValidateInstallDirectory(AppInfo app,string directory) {
            string full=InstallationPaths.Normalize(directory);
            InstallationPaths.Validate(full,app.id,InstallationPaths.Same(full,AppRoot(app)));
            return full;
        }
        string InstallRoot(AppInfo app, Installed installed) {
            if(installed==null || String.IsNullOrEmpty(installed.installRoot)) return AppRoot(app);
            string root=InstallationPaths.Normalize(installed.installRoot);
            if(!InstallationPaths.Same(root,AppRoot(app)) && !InstallationPaths.Owned(root,app.id)) throw new InvalidDataException("The application installation folder is no longer registered to this app.");
            return root;
        }
        public Installed GetInstalled(AppInfo app) {
            string state = Path.Combine(AppRoot(app), "installed.json");
            if (!File.Exists(state)) return null;
            try {
                var installed = Json.Deserialize<Installed>(File.ReadAllText(state));
                if (installed == null || !Regex.IsMatch(installed.folder ?? "", "^[a-f0-9]{32}$") || installed.executable != app.executable) return null;
                Version.Parse(installed.version.Split('-')[0]);
                return File.Exists(Path.Combine(InstallRoot(app,installed), installed.folder, installed.executable)) ? installed : null;
            } catch { return null; }
        }
        public string InstalledFolder(AppInfo app, Installed installed) { return Path.Combine(InstallRoot(app,installed), installed.folder); }
        public bool IsRunning(AppInfo app) { return processes.IsRunning(app); }
        public string[] DataLocations(AppInfo app) { return data.Locations(app); }
        public async Task<bool> EnsureClosed(AppInfo app, Func<bool,bool> confirm, CancellationToken token) {
            if(!IsRunning(app)) return true;
            if(!confirm(false)) return false;
            if(await processes.RequestClose(app,token)) return true;
            if(!confirm(true)) return false;
            if(await processes.ForceClose(app,token)) return true;
            throw new IOException("The app could not be closed. Close it manually, including its tray icon, and retry.");
        }
        public void Open(AppInfo app) {
            var installed = GetInstalled(app); if (installed == null) throw new IOException("This app is no longer installed. Install it again.");
            string folder = InstalledFolder(app, installed);
            Process.Start(new ProcessStartInfo(Path.Combine(folder, installed.executable)) { WorkingDirectory = folder, UseShellExecute = true });
        }
        public static void VerifyHash(string archive, string expected) {
            using (var stream = File.OpenRead(archive)) using (var sha = SHA256.Create()) {
                string actual = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
                if (!String.Equals(actual, expected, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Download verification failed. The application has not been changed. Please retry.");
            }
        }
        public static void Extract(string archive, string destination, CancellationToken token) {
            Directory.CreateDirectory(destination); string prefix = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
            using (var zip = ZipFile.OpenRead(archive)) {
                long total = 0;
                if (zip.Entries.Count > 30000) throw new InvalidDataException("Archive contains too many files.");
                foreach (var entry in zip.Entries) {
                    token.ThrowIfCancellationRequested();
                    string name = entry.FullName.Replace('/', '\\');
                    string target = Path.GetFullPath(Path.Combine(destination, name));
                    if (!target.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) || name.Contains(":") || ((entry.ExternalAttributes >> 16) & 0xF000) == 0xA000) throw new InvalidDataException("Unsafe archive path.");
                    total = checked(total + entry.Length); if (total > 4L * 1024 * 1024 * 1024) throw new InvalidDataException("Archive is too large.");
                    if (String.IsNullOrEmpty(entry.Name)) Directory.CreateDirectory(target);
                    else { Directory.CreateDirectory(Path.GetDirectoryName(target)); entry.ExtractToFile(target, false); }
                }
            }
        }
        public async Task Install(AppInfo app, IProgress<string> progress, CancellationToken token, string installationDirectory = null, AppInstallOptions options = null) {
            if (!app.Available || !TrustedUrl(app.downloadUrl)) throw new InvalidOperationException("This application has not been published yet.");
            if (IsRunning(app)) throw new IOException("Close " + app.name + " before updating it.");
            LastIntegrationWarning=null;
            var previous=GetInstalled(app);
            string root=ValidateInstallDirectory(app,installationDirectory ?? InstallRoot(app,previous));
            InstallationPaths.Prepare(root,app.id,InstallationPaths.Same(root,AppRoot(app)));
            Directory.CreateDirectory(AppRoot(app));
            string folder = Guid.NewGuid().ToString("N"); string stage = Path.Combine(root, folder); string archive = Path.Combine(root, folder + ".zip");
            bool committed = false;
            try {
                using (var response = await Download(app.downloadUrl, token)) {
                    response.EnsureSuccessStatusCode(); long? length = response.Content.Headers.ContentLength;
                    using (var input = await response.Content.ReadAsStreamAsync()) using (var output = File.Create(archive)) {
                        byte[] buffer = new byte[81920]; long total = 0; int n; var last = DateTime.MinValue;
                        while ((n = await input.ReadAsync(buffer, 0, buffer.Length, token)) > 0) {
                            total += n; if (total > 2L * 1024 * 1024 * 1024) throw new InvalidDataException("Download is too large.");
                            await output.WriteAsync(buffer, 0, n, token);
                            if ((DateTime.UtcNow - last).TotalMilliseconds > 150) { progress.Report(length > 0 ? "Downloading · " + (total * 100 / length.Value) + "%" : "Downloading · " + (total / 1048576) + " MB"); last = DateTime.UtcNow; }
                        }
                    }
                }
                progress.Report("Verifying download…");
                await Task.Run(() => { token.ThrowIfCancellationRequested(); VerifyHash(archive, app.sha256); progress.Report("Installing…"); Extract(archive, stage, token); }, token);
                if (!File.Exists(Path.Combine(stage, app.executable))) throw new InvalidDataException("The package does not contain the expected application.");
                token.ThrowIfCancellationRequested();
                if (IsRunning(app)) throw new IOException("Close " + app.name + " and retry the update.");
                var installed=new Installed { version=app.version,folder=folder,executable=app.executable,installRoot=root,
                    runAtStartup=options!=null ? options.runAtStartup : previous!=null && previous.runAtStartup,
                    desktopShortcut=options!=null ? options.desktopShortcut : previous!=null && previous.desktopShortcut };
                AtomicWrite(Path.Combine(AppRoot(app),"installed.json"),Json.Serialize(installed));
                committed=true;
                try { integration.Apply(app,previous,installed,previous==null ? null : Path.Combine(InstalledFolder(app,previous),app.executable),Path.Combine(stage,app.executable)); }
                catch(Exception ex) { LastIntegrationWarning="The app installed, but its startup/desktop options could not be fully applied: "+ex.Message; }
                if(previous!=null) { string old=InstalledFolder(app,previous); if(!String.Equals(old,stage,StringComparison.OrdinalIgnoreCase)) { try { Directory.Delete(old,true); } catch { } } }
            } finally {
                if (File.Exists(archive)) File.Delete(archive);
                if (!committed && Directory.Exists(stage)) Directory.Delete(stage, true);
            }
        }
        public void Uninstall(AppInfo app, bool deleteLocalData = false) {
            if (IsRunning(app)) throw new IOException("Close " + app.name + " before uninstalling it.");
            var installed=GetInstalled(app); if(installed==null) return;
            if(deleteLocalData) {
                if(processes.IsDataInUse(app)) throw new IOException("Another copy of "+app.name+" is running. Close all copies, including tray icons, before deleting local data.");
                string installation=InstallRoot(app,installed);
                if(data.Locations(app).Any(folder=>InstallationPaths.Same(folder,installation) || WindowsAppProcesses.BelongsTo(installation,folder) || WindowsAppProcesses.BelongsTo(folder,installation)))
                    throw new IOException("The installation and data folders overlap. Keep local data during uninstall, then review that folder manually.");
                data.Delete(app);
            }
            // Delete only the recorded version folder, never the user-selected parent or unrelated files.
            string executable=Path.Combine(InstalledFolder(app,installed),app.executable);
            Directory.Delete(InstalledFolder(app,installed),true);
            LastIntegrationWarning=null;
            try { integration.Remove(app,installed,executable); } catch(Exception ex) { LastIntegrationWarning="App removed, but startup/shortcut cleanup needs attention: "+ex.Message; }
            File.Delete(Path.Combine(AppRoot(app), "installed.json"));
        }
        public void Dispose() { http.Dispose(); }
    }
}
