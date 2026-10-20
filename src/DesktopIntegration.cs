using System;
using System.IO;
using System.Reflection;
using Microsoft.Win32;

namespace TMApps {
    public interface IAppIntegration {
        void Apply(AppInfo app,Installed previous,Installed current,string previousExecutable,string executable);
        void Remove(AppInfo app,Installed installed,string executable);
    }
    public sealed class WindowsAppIntegration : IAppIntegration {
        public void Apply(AppInfo app,Installed previous,Installed current,string previousExecutable,string executable) {
            string name="TMApps-"+app.id;
            if(current.runAtStartup) {
                using(var key=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")) key.SetValue(name,"\""+executable+"\"");
            } else if(previous!=null && previous.runAtStartup) {
                using(var key=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run",true)) {
                    if(key!=null && Convert.ToString(key.GetValue(name))=="\""+previousExecutable+"\"") key.DeleteValue(name,false);
                }
            }
            string shortcut=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),(app.id=="tma-mail" ? "TMA-Mail" : "TMA-Agent Office")+".lnk");
            if(current.desktopShortcut) DesktopIntegration.CreateShortcut(shortcut,executable,app.name);
            else if(previous!=null && previous.desktopShortcut && DesktopIntegration.ShortcutTargets(shortcut,previousExecutable)) File.Delete(shortcut);
        }
        public void Remove(AppInfo app,Installed installed,string executable) { Apply(app,installed,new Installed(),executable,executable); }
    }
    public static class DesktopIntegration {
        public static string DefaultInstallDirectory { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "TMApps Launcher"); } }
        public static string ProfileDirectory { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TMApps", "Launcher"); } }
        public static string StartMenuDirectory { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "TMApps Launcher"); } }
        public static string RegisteredInstallDirectory {
            get { try { using(var key=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\TMAppsLauncher")) { var path=key==null ? null : key.GetValue("InstallLocation") as string; return String.IsNullOrWhiteSpace(path) ? DefaultInstallDirectory : InstallationPaths.Normalize(path); } } catch { return DefaultInstallDirectory; } }
        }
        public static Preferences LoadPreferences(string root) {
            try { var p = LauncherService.Json.Deserialize<Preferences>(File.ReadAllText(Path.Combine(root,"settings.json"))); p.Normalize(); return p; } catch { return new Preferences(); }
        }
        public static void SavePreferences(string root, Preferences preferences) { preferences.Normalize(); Directory.CreateDirectory(root); LauncherService.AtomicWrite(Path.Combine(root,"settings.json"),LauncherService.Json.Serialize(preferences)); }
        public static void SetStartup(string executable, bool enabled) {
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")) {
                if (enabled) key.SetValue("TMAppsLauncher", "\"" + executable + "\""); else key.DeleteValue("TMAppsLauncher", false);
            }
        }
        public static bool ShortcutTargets(string shortcutPath,string executable) {
            if(!File.Exists(shortcutPath)) return false;
            object shell=null,link=null;
            try {
                shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                link=shell.GetType().InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{shortcutPath});
                string target=Convert.ToString(link.GetType().InvokeMember("TargetPath",BindingFlags.GetProperty,null,link,null));
                return String.Equals(target,executable,StringComparison.OrdinalIgnoreCase);
            } catch { return false; }
            finally { if(link!=null) System.Runtime.InteropServices.Marshal.FinalReleaseComObject(link); if(shell!=null) System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell); }
        }
        public static void CreateShortcut(string shortcutPath, string executable, string description = "TMApps Launcher") {
            Directory.CreateDirectory(Path.GetDirectoryName(shortcutPath));
            object shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell")); object link = null;
            try {
                link = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                var type = link.GetType();
                type.InvokeMember("TargetPath", BindingFlags.SetProperty,null,link,new object[]{executable});
                type.InvokeMember("WorkingDirectory", BindingFlags.SetProperty,null,link,new object[]{Path.GetDirectoryName(executable)});
                type.InvokeMember("IconLocation", BindingFlags.SetProperty,null,link,new object[]{executable + ",0"});
                type.InvokeMember("Description", BindingFlags.SetProperty,null,link,new object[]{description});
                type.InvokeMember("Save",BindingFlags.InvokeMethod,null,link,null);
            } finally { if(link != null) System.Runtime.InteropServices.Marshal.FinalReleaseComObject(link); System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell); }
        }
        public static void SetDesktopShortcut(string executable, bool enabled) {
            string path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"TMApps Launcher.lnk");
            if (enabled) CreateShortcut(path,executable); else if(File.Exists(path)) File.Delete(path);
        }
        public static void RegisterInstall(string directory) {
            string exe = Path.Combine(directory,"TMApps-Launcher.exe");
            CreateShortcut(Path.Combine(StartMenuDirectory,"TMApps Launcher.lnk"),exe);
            using(var key=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\TMAppsLauncher")) {
                key.SetValue("DisplayName","TMApps Launcher"); key.SetValue("DisplayVersion","1.11.1"); key.SetValue("Publisher","DaddyTylerXO");
                key.SetValue("InstallLocation",directory); key.SetValue("DisplayIcon",exe);
                key.SetValue("UninstallString","\""+Path.Combine(directory,"Uninstall.exe")+"\" --uninstall");
                key.SetValue("NoModify",1); key.SetValue("NoRepair",1);
            }
        }
        public static void UnregisterInstall() {
            SetStartup("",false); SetDesktopShortcut("",false);
            string shortcut=Path.Combine(StartMenuDirectory,"TMApps Launcher.lnk"); if(File.Exists(shortcut)) File.Delete(shortcut);
            if(Directory.Exists(StartMenuDirectory) && Directory.GetFileSystemEntries(StartMenuDirectory).Length==0) Directory.Delete(StartMenuDirectory);
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\TMAppsLauncher",false);
        }
    }
}
