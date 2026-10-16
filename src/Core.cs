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
        public string updatedAt { get; set; }
        public bool Available { get { return !String.IsNullOrEmpty(downloadUrl); } }
    }
    public class Installed { public string version { get; set; } public string folder { get; set; } public string executable { get; set; } }
    public class Preferences { public bool checkOnStartup { get; set; } public Preferences() { checkOnStartup = true; } }
    public sealed class LauncherService : IDisposable {
        public const string CatalogUrl = "https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/catalog.json";
        public readonly string Root;
        readonly HttpClient http;
        string githubToken;
        public bool HasToken { get { return !String.IsNullOrEmpty(githubToken); } }
        public static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        public LauncherService(string root, HttpMessageHandler handler = null) {
            Root = Path.GetFullPath(root); Directory.CreateDirectory(Root);
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            http = handler == null ? new HttpClient() : new HttpClient(handler); http.Timeout = TimeSpan.FromMinutes(30);
            http.DefaultRequestHeaders.UserAgent.ParseAdd("TMApps-Launcher/1.0");
            try { githubToken = Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(Path.Combine(Root, "github-token.dat")), null, DataProtectionScope.CurrentUser)); } catch { }
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
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", githubToken);
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
            if (c == null || c.schemaVersion != 1 || c.apps == null || c.apps.Count != 2) throw new InvalidDataException("Unsupported application catalog.");
            var ids = new HashSet<string>();
            foreach (var a in c.apps) {
                if (a == null || (a.id != "tma-mail" && a.id != "tma-agent-office") || !ids.Add(a.id)) throw new InvalidDataException("Unknown or duplicate application.");
                if (String.IsNullOrWhiteSpace(a.name) || String.IsNullOrWhiteSpace(a.description) || !Regex.IsMatch(a.version ?? "", @"^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$") || a.branch != (a.id == "tma-mail" ? "TMA-Mail" : "AI-Agent-Dashboard") || a.executable != (a.id == "tma-mail" ? "TMA-Mail.exe" : "Agent Office.exe")) throw new InvalidDataException("Invalid application metadata.");
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
        public async Task<Catalog> Refresh(CancellationToken token) {
            using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(token)) {
                timeout.CancelAfter(TimeSpan.FromSeconds(25));
                var response = await Download(CatalogUrl, timeout.Token);
                using (response) {
                    response.EnsureSuccessStatusCode();
                    using (var input = await response.Content.ReadAsStreamAsync())
                    using (var output = new MemoryStream()) {
                        var buffer = new byte[8192]; int n;
                        while ((n = await input.ReadAsync(buffer, 0, buffer.Length, timeout.Token)) > 0) {
                            if (output.Length + n > 1024 * 1024) throw new InvalidDataException("Catalog is too large.");
                            output.Write(buffer, 0, n);
                        }
                        string json = System.Text.Encoding.UTF8.GetString(output.ToArray()).TrimStart('\uFEFF');
                        var catalog = ParseCatalog(json); AtomicWrite(Path.Combine(Root, "catalog.json"), json); return catalog;
                    }
                }
            }
        }
        public static void AtomicWrite(string path, string content) {
            string temp = path + ".tmp"; File.WriteAllText(temp, content);
            if (File.Exists(path)) File.Replace(temp, path, null); else File.Move(temp, path);
        }
        string AppRoot(AppInfo app) { return Path.Combine(Root, "apps", app.id); }
        public Installed GetInstalled(AppInfo app) {
            string state = Path.Combine(AppRoot(app), "installed.json");
            if (!File.Exists(state)) return null;
            try {
                var installed = Json.Deserialize<Installed>(File.ReadAllText(state));
                if (installed == null || !Regex.IsMatch(installed.folder ?? "", "^[a-f0-9]{32}$") || installed.executable != app.executable) return null;
                Version.Parse(installed.version.Split('-')[0]);
                return File.Exists(Path.Combine(AppRoot(app), installed.folder, installed.executable)) ? installed : null;
            } catch { return null; }
        }
        public string InstalledFolder(AppInfo app, Installed installed) { return Path.Combine(AppRoot(app), installed.folder); }
        public bool IsRunning(AppInfo app) {
            string prefix = AppRoot(app) + Path.DirectorySeparatorChar;
            foreach (var process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(app.executable))) {
                using (process) { try { if (process.MainModule.FileName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return true; } catch { return true; } }
            }
            return false;
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
        public async Task Install(AppInfo app, IProgress<string> progress, CancellationToken token) {
            if (!app.Available || !TrustedUrl(app.downloadUrl)) throw new InvalidOperationException("This application has not been published yet.");
            if (IsRunning(app)) throw new IOException("Close " + app.name + " before updating it.");
            string root = AppRoot(app); Directory.CreateDirectory(root);
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
                AtomicWrite(Path.Combine(root, "installed.json"), Json.Serialize(new Installed { version = app.version, folder = folder, executable = app.executable }));
                committed = true;
                foreach (string old in Directory.GetDirectories(root)) if (old != stage) { try { Directory.Delete(old, true); } catch { } }
            } finally {
                if (File.Exists(archive)) File.Delete(archive);
                if (!committed && Directory.Exists(stage)) Directory.Delete(stage, true);
            }
        }
        public void Uninstall(AppInfo app) {
            if (IsRunning(app)) throw new IOException("Close " + app.name + " before uninstalling it.");
            string root = AppRoot(app); if (!Directory.Exists(root)) return;
            // Remove binaries first; retain the record if Windows reports a locked file.
            foreach (var folder in Directory.GetDirectories(root)) Directory.Delete(folder, true);
            File.Delete(Path.Combine(root, "installed.json"));
        }
        public void Dispose() { http.Dispose(); }
    }
}
