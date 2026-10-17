using System;
using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace TMApps {
    public sealed class LauncherRelease {
        public int schemaVersion { get; set; }
        public string version { get; set; }
        public string downloadUrl { get; set; }
        public string sha256 { get; set; }
        public string updatedAt { get; set; }
    }
    public static class LauncherUpdates {
        public const string ManifestUrl="https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/launcher-update.json";
        public static string CurrentVersion { get { return typeof(LauncherUpdates).Assembly.GetName().Version.ToString(3); } }
        public static LauncherRelease Parse(string json) {
            var release=LauncherService.Json.Deserialize<LauncherRelease>(json);
            if(release==null || release.schemaVersion!=1 || !Regex.IsMatch(release.version ?? "","^\\d+\\.\\d+\\.\\d+$") || !Regex.IsMatch(release.sha256 ?? "","^[a-fA-F0-9]{64}$")) throw new InvalidDataException("Invalid launcher update metadata.");
            Version.Parse(release.version);
            string expected="https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMApps-Launcher-Setup-"+release.version+".exe";
            if(release.downloadUrl!=expected) throw new InvalidDataException("Invalid launcher installer location.");
            return release;
        }
        public static bool IsInstalledCopy(string executable,string registeredDirectory) {
            return !String.IsNullOrEmpty(registeredDirectory) && String.Equals(Path.GetFullPath(executable),Path.GetFullPath(Path.Combine(registeredDirectory,"TMApps-Launcher.exe")),StringComparison.OrdinalIgnoreCase) && InstallationPaths.Owned(registeredDirectory,"launcher");
        }
        public static Process ValidateParent(int pid,long started,string executable) {
            Process parent;
            try { parent=Process.GetProcessById(pid); } catch(ArgumentException) { return null; }
            try {
                if(parent.StartTime.ToUniversalTime().Ticks!=started || !String.Equals(Path.GetFullPath(parent.MainModule.FileName),Path.GetFullPath(executable),StringComparison.OrdinalIgnoreCase)) throw new IOException("The launcher update process identity changed. Retry from the launcher.");
                return parent;
            } catch { parent.Dispose(); throw; }
        }
        public static async Task StartInstaller(string installer,string directory,CancellationToken token) {
            string executable=Process.GetCurrentProcess().MainModule.FileName;
            if(!IsInstalledCopy(executable,directory)) throw new IOException("Install this launcher using Setup first to enable in-app launcher updates.");
            string handshake=Guid.NewGuid().ToString("N");
            using(var ready=new EventWaitHandle(false,EventResetMode.ManualReset,"Local\\TMApps-Launcher-Update-"+handshake))
            using(var current=Process.GetCurrentProcess())
            using(var setup=Process.Start(new ProcessStartInfo(installer,"--update "+current.Id+" "+current.StartTime.ToUniversalTime().Ticks+" "+handshake) { UseShellExecute=true })) {
                var deadline=DateTime.UtcNow.AddSeconds(60);
                while(!ready.WaitOne(0)) {
                    token.ThrowIfCancellationRequested();
                    if(setup==null || setup.HasExited || DateTime.UtcNow>deadline) throw new IOException("The updater did not start. Close any other setup window and try again. The launcher has not been changed.");
                    await Task.Delay(100,token);
                }
            }
        }
    }
}
