using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace TMApps {
    public interface IAppProcessController {
        bool IsRunning(AppInfo app);
        bool IsDataInUse(AppInfo app);
        Task<bool> RequestClose(AppInfo app,CancellationToken token);
        Task<bool> ForceClose(AppInfo app,CancellationToken token);
    }
    public sealed class WindowsAppProcesses : IAppProcessController {
        readonly Func<AppInfo,string> root;
        public WindowsAppProcesses(Func<AppInfo,string> installRoot) { root=installRoot; }
        public static bool BelongsTo(string executable,string directory) {
            return Path.GetFullPath(executable).StartsWith(InstallationPaths.Normalize(directory)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase);
        }
        static string Executable(Process process) {
            // .NET Framework can return an empty ProcessModule while a process exits.
            try { var module=process.MainModule; return module==null ? null : module.FileName; }
            catch(NullReferenceException) { return null; }
        }
        public bool IsRunning(AppInfo app) {
            foreach(var process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(app.executable))) {
                using(process) { try { string executable=Executable(process); if(executable!=null && BelongsTo(executable,root(app))) return true; } catch(InvalidOperationException) { } catch(System.ComponentModel.Win32Exception) { return true; } }
            }
            return false;
        }
        public bool IsDataInUse(AppInfo app) {
            var processes=Process.GetProcessesByName(Path.GetFileNameWithoutExtension(app.executable)); bool running=processes.Length>0;
            foreach(var process in processes) process.Dispose(); return running;
        }
        sealed class Identity { public int Id; public DateTime Started; public string Executable; }
        List<Identity> Find(AppInfo app) {
            var found=new List<Identity>();
            foreach(var process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(app.executable))) {
                using(process) { try {
                    string executable=Executable(process);
                    if(executable!=null && BelongsTo(executable,root(app))) found.Add(new Identity { Id=process.Id,Started=process.StartTime,Executable=executable });
                } catch(InvalidOperationException) { } catch(System.ComponentModel.Win32Exception) { } }
            }
            return found;
        }
        async Task<bool> Close(AppInfo app,bool force,CancellationToken token) {
            var matches=Find(app);
            foreach(var match in matches) {
                token.ThrowIfCancellationRequested();
                try { using(var process=Process.GetProcessById(match.Id)) {
                    // Recheck identity and path before every signal, including forced exit.
                    if(process.StartTime!=match.Started || !String.Equals(Executable(process),match.Executable,StringComparison.OrdinalIgnoreCase) || !BelongsTo(match.Executable,root(app))) continue;
                    if(force) process.Kill(); else process.CloseMainWindow();
                } } catch(ArgumentException) { } catch(InvalidOperationException) { } catch(System.ComponentModel.Win32Exception) { }
            }
            var deadline=DateTime.UtcNow.AddSeconds(force ? 5 : 4);
            while(IsRunning(app) && DateTime.UtcNow<deadline) await Task.Delay(100,token);
            return !IsRunning(app);
        }
        public Task<bool> RequestClose(AppInfo app,CancellationToken token) { return Close(app,false,token); }
        public Task<bool> ForceClose(AppInfo app,CancellationToken token) { return Close(app,true,token); }
    }
    public interface IAppDataStore { string[] Locations(AppInfo app); void Delete(AppInfo app); }
    public sealed class WindowsAppData : IAppDataStore {
        readonly string local,roaming;
        public WindowsAppData(string localRoot=null,string roamingRoot=null) {
            local=InstallationPaths.Normalize(localRoot ?? Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
            roaming=InstallationPaths.Normalize(roamingRoot ?? Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData));
        }
        public string[] Locations(AppInfo app) {
            if(app.id=="tma-libraries" || app.id=="tma-cut" || app.id=="tma-socialsmanager" || app.id=="tma-safe" || app.id=="tma-padlock") return new string[0]; // User-chosen projects and vaults are never removed by the launcher.
            if(app.id=="tma-mail") return new[]{Path.Combine(local,"TMA-Mail")};
            if(app.id=="tma-agent-office") return new[]{Path.Combine(roaming,"agent-office"),Path.Combine(roaming,"Agent Office")};
            throw new InvalidDataException("Unknown application profile.");
        }
        static void DeleteFolder(string folder) {
            // Never traverse junctions/symbolic links into external work folders.
            foreach(var entry in Directory.GetFileSystemEntries(folder)) {
                var attributes=File.GetAttributes(entry);
                if((attributes&FileAttributes.ReparsePoint)!=0) { if((attributes&FileAttributes.Directory)!=0) Directory.Delete(entry,false); else File.Delete(entry); }
                else if((attributes&FileAttributes.Directory)!=0) { DeleteFolder(entry); Directory.Delete(entry,false); }
                else { if((attributes&FileAttributes.ReadOnly)!=0) File.SetAttributes(entry,attributes&~FileAttributes.ReadOnly); File.Delete(entry); }
            }
        }
        public void Delete(AppInfo app) {
            foreach(string folder in Locations(app)) {
                string normalized=InstallationPaths.Normalize(folder);
                string parent=app.id=="tma-mail" ? local : roaming;
                if(!String.Equals(Path.GetDirectoryName(normalized),parent,StringComparison.OrdinalIgnoreCase)) throw new IOException("Invalid application data folder.");
                if(!Directory.Exists(normalized)) continue;
                if((File.GetAttributes(normalized)&FileAttributes.ReparsePoint)!=0) throw new IOException("This app profile is a linked folder. Remove its data manually.");
                DeleteFolder(normalized); Directory.Delete(normalized,false);
            }
        }
    }
    public sealed class UninstallOptions { public bool deleteLocalData { get; set; } }
}
