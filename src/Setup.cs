using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;

[assembly: AssemblyVersion("1.12.5.0")]
[assembly: AssemblyFileVersion("1.12.5.0")]
[assembly: AssemblyCompany("DaddyTylerXO")]
[assembly: AssemblyProduct("TMApps Launcher Setup")]

namespace TMApps {
    public class Setup : Application {
        public static void Install(string directory, string profile, Preferences preferences, bool integrate) {
            directory=InstallationPaths.Normalize(directory);
            string previousDirectory=integrate ? DesktopIntegration.RegisteredInstallDirectory : null;
            bool legacy=false;
            if(integrate && InstallationPaths.Same(directory,previousDirectory) && File.Exists(Path.Combine(directory,"TMApps-Launcher.exe"))) {
                var existing=FileVersionInfo.GetVersionInfo(Path.Combine(directory,"TMApps-Launcher.exe")); legacy=existing.CompanyName=="DaddyTylerXO" && existing.ProductName=="TMApps Launcher";
            }
            InstallationPaths.Prepare(directory,"launcher",legacy);
            string executable=Path.Combine(directory,"TMApps-Launcher.exe");
            foreach(var process in Process.GetProcessesByName("TMApps-Launcher")) {
                using(process) { try { if(integrate || String.Equals(process.MainModule.FileName,executable,StringComparison.OrdinalIgnoreCase)) throw new IOException("Close TMApps Launcher first, including older portable copies. If it is in the tray, right-click its rocket icon and choose Quit, then retry."); } catch(System.ComponentModel.Win32Exception) { throw new IOException("Close TMApps Launcher before installing an update."); } }
            }
            string temporary=executable+".new"; string backup=executable+".previous";
            using(var payload=typeof(Setup).Assembly.GetManifestResourceStream("TMApps.payload.exe")) {
                if(payload==null) throw new InvalidDataException("Installer payload is missing.");
                using(var output=File.Create(temporary)) payload.CopyTo(output);
            }
            bool replaced=File.Exists(executable);
            try {
                if(replaced) File.Replace(temporary,executable,backup); else File.Move(temporary,executable);
                string uninstaller=Path.Combine(directory,"Uninstall.exe");
                File.Copy(Assembly.GetExecutingAssembly().Location,uninstaller,true);
                DesktopIntegration.SavePreferences(profile,preferences);
                if(integrate) {
                    DesktopIntegration.RegisterInstall(directory);
                    DesktopIntegration.SetStartup(executable,preferences.runAtStartup);
                    DesktopIntegration.SetDesktopShortcut(executable,preferences.desktopShortcut);
                    try { if(!InstallationPaths.Same(previousDirectory,directory) && File.Exists(Path.Combine(previousDirectory,"TMApps-Launcher.exe"))) {
                        var old=FileVersionInfo.GetVersionInfo(Path.Combine(previousDirectory,"TMApps-Launcher.exe"));
                        if(old.CompanyName=="DaddyTylerXO" && old.ProductName=="TMApps Launcher") {
                            RemoveBinaries(previousDirectory); string oldUninstaller=Path.Combine(previousDirectory,"Uninstall.exe"); if(File.Exists(oldUninstaller)) File.Delete(oldUninstaller);
                            if(Directory.GetFileSystemEntries(previousDirectory).Length==0) Directory.Delete(previousDirectory);
                        }
                    } } catch(IOException) { } catch(UnauthorizedAccessException) { } // A locked old copy must not roll back the new registered install.
                }
                if(File.Exists(backup)) File.Delete(backup);
            } catch {
                if(File.Exists(backup)) File.Replace(backup,executable,null);
                throw;
            } finally { if(File.Exists(temporary)) File.Delete(temporary); }
        }
        public static void RemoveBinaries(string directory) {
            directory=Path.GetFullPath(directory);
            // Only launcher-owned files; application/profile data is deliberately separate.
            foreach(string name in new[]{"TMApps-Launcher.exe","TMApps-Launcher.exe.new","TMApps-Launcher.exe.previous"}) {
                string target=Path.Combine(directory,name); if(File.Exists(target)) File.Delete(target);
            }
            if(InstallationPaths.Owned(directory,"launcher")) File.Delete(InstallationPaths.Marker(directory));
        }
        [STAThread] public static void Main(string[] args) {
            if(args.Length==2 && args[0]=="--verify-install") {
                try {
                    string root=Path.GetFullPath(args[1]);
                    var preferences=new Preferences { runAtStartup=true,desktopShortcut=false,closeToTray=true };
                    Install(Path.Combine(root,"Custom Launcher Location"),Path.Combine(root,"profile"),preferences,false);
                    var saved=DesktopIntegration.LoadPreferences(Path.Combine(root,"profile"));
                    if(!saved.runAtStartup || saved.desktopShortcut || !saved.closeToTray) throw new Exception("Installer options were not saved.");
                    string launcher=Path.Combine(root,"Custom Launcher Location","TMApps-Launcher.exe");
                    var version=FileVersionInfo.GetVersionInfo(launcher);
                    if(version.FileVersion!="1.12.5.0") throw new Exception("Incorrect launcher payload version.");
                    string preserved=Path.Combine(root,"profile","keep.txt"); File.WriteAllText(preserved,"kept through update");
                    // Exercise the same atomic replacement used by an in-place self-update.
                    Install(Path.Combine(root,"Custom Launcher Location"),Path.Combine(root,"profile"),saved,false);
                    if(File.ReadAllText(preserved)!="kept through update" || DesktopIntegration.LoadPreferences(Path.Combine(root,"profile")).desktopShortcut) throw new Exception("Update did not preserve profile and preferences.");
                    string report=Path.Combine(root,"payload-report.txt");
                    using(var p=Process.Start(new ProcessStartInfo(launcher,"--verify-package \""+report+"\"") { UseShellExecute=false,CreateNoWindow=true })) { if(!p.WaitForExit(15000) || p.ExitCode!=0) throw new Exception("Installed launcher failed its startup check."); }
                    if(!File.ReadAllText(report).StartsWith("OK:")) throw new Exception("Payload validation failed.");
                    RemoveBinaries(Path.Combine(root,"Custom Launcher Location"));
                    if(!File.Exists(Path.Combine(root,"profile","settings.json"))) throw new Exception("Uninstall removed profile data.");
                    File.WriteAllText(Path.Combine(root,"installer-report.txt"),"OK: installer payload, options, launch, and uninstall data retention");
                } catch(Exception ex) { Directory.CreateDirectory(args[1]); File.WriteAllText(Path.Combine(args[1],"installer-report.txt"),"FAIL: "+ex); Environment.ExitCode=1; }
                return;
            }
            bool created;
            using(var mutex=new Mutex(true,"Local\\TMApps-Launcher-Setup",out created)) {
                if(!created) { MessageBox.Show("TMApps Launcher setup is already open.","TMApps Launcher"); return; }
                try {
                    if(args.Length==4 && args[0]=="--update") { ApplyUpdate(args); return; }
                    if(args.Contains("--uninstall") || String.Equals(Path.GetFileName(Assembly.GetExecutingAssembly().Location),"Uninstall.exe",StringComparison.OrdinalIgnoreCase)) { Uninstall(); return; }
                    new Setup().Run();
                } catch(Exception ex) { ThemedDialogs.Info(null,"TMApps Launcher Setup",ex.Message); Environment.ExitCode=1; }
            }
        }
        static void ApplyUpdate(string[] args) {
            string directory=DesktopIntegration.RegisteredInstallDirectory;
            string executable=Path.Combine(directory,"TMApps-Launcher.exe");
            if(!LauncherUpdates.IsInstalledCopy(executable,directory)) throw new IOException("The registered launcher installation could not be verified. Run Setup to repair it.");
            if(!System.Text.RegularExpressions.Regex.IsMatch(args[3],"^[a-f0-9]{32}$")) throw new IOException("Invalid update handoff.");
            using(var parent=LauncherUpdates.ValidateParent(Int32.Parse(args[1]),Int64.Parse(args[2]),executable)) {
                using(var ready=EventWaitHandle.OpenExisting("Local\\TMApps-Launcher-Update-"+args[3])) ready.Set();
                if(parent!=null && !parent.WaitForExit(60000)) throw new IOException("The launcher is still running. Quit it from the tray and retry the update.");
            }
            var preferences=DesktopIntegration.LoadPreferences(DesktopIntegration.ProfileDirectory);
            Install(directory,DesktopIntegration.ProfileDirectory,preferences,true);
            Process.Start(new ProcessStartInfo(executable) { WorkingDirectory=directory,UseShellExecute=true });
        }
        protected override void OnStartup(StartupEventArgs e) {
            base.OnStartup(e);
            var window=(Window)XamlReader.Parse(@"<Window xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' Title='Install TMApps Launcher' Width='640' Height='780' ResizeMode='NoResize' WindowStartupLocation='CenterScreen' Background='#17191F' Foreground='#ECEEF3' FontFamily='Segoe UI'>
              <Window.Resources><Style TargetType='Button'><Setter Property='Foreground' Value='White'/><Setter Property='Background' Value='#CC5500'/><Setter Property='Padding' Value='22,12'/><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='Button'><Border CornerRadius='18' Background='{TemplateBinding Background}' Padding='{TemplateBinding Padding}'><ContentPresenter HorizontalAlignment='Center'/></Border><ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter Property='Opacity' Value='0.8'/></Trigger><Trigger Property='IsEnabled' Value='False'><Setter Property='Opacity' Value='0.4'/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style><Style TargetType='CheckBox'><Setter Property='Foreground' Value='#ECEEF3'/><Setter Property='Margin' Value='0,11'/><Setter Property='FontSize' Value='13'/></Style></Window.Resources>
              <Grid Margin='30' Background='#17191F'><Grid.RowDefinitions><RowDefinition Height='*'/><RowDefinition Height='Auto'/></Grid.RowDefinitions><StackPanel>
                <StackPanel Orientation='Horizontal'><Image x:Name='Rocket' Width='56' Height='56' Margin='0,0,16,0'/><StackPanel><TextBlock Text='TMApps Launcher' FontSize='26' FontWeight='SemiBold'/><TextBlock Text='Setup · DaddyTylerXO · 1.12.5' Foreground='#A9B0C0' Margin='0,6,0,0'/></StackPanel></StackPanel>
                <TextBlock Text='Make it yours.' FontSize='23' Margin='0,27,0,8'/><TextBlock Text='Install once. Discover, install, and update your TMApps from one home.' TextWrapping='Wrap' Foreground='#A9B0C0' LineHeight='21'/>
                <Border Background='#22252C' CornerRadius='17' Padding='18' Margin='0,20,0,12'><StackPanel><CheckBox x:Name='Startup' Content='Open when I sign in to Windows'/><CheckBox x:Name='Desktop' Content='Create a desktop icon'/><CheckBox x:Name='Tray' Content='Stay in the tray when the window is closed'/><CheckBox x:Name='Launch' Content='Open TMApps Launcher after installation' IsChecked='True'/></StackPanel></Border>
                <TextBlock Text='Install location' FontWeight='SemiBold' Margin='0,0,0,8'/><DockPanel><Button x:Name='Browse' Content='Browse…' DockPanel.Dock='Right' Background='#2D313B' Padding='14,10' Margin='8,0,0,0'/><TextBox x:Name='Location' Padding='10' Background='#22252C' Foreground='#ECEEF3' BorderBrush='#393F4B'/></DockPanel><TextBlock Text='Choose an empty folder for the launcher. Your profile stays separate.' FontSize='11' Foreground='#A9B0C0' Margin='0,8,0,0'/><TextBlock x:Name='Status' Margin='0,12,0,0' Foreground='#FFC49D' TextWrapping='Wrap'/>
              </StackPanel><StackPanel Grid.Row='1' Orientation='Horizontal' HorizontalAlignment='Right'><Button x:Name='Cancel' Content='Cancel' Background='#2D313B' Margin='0,0,8,0'/><Button x:Name='Install' Content='Install launcher'/></StackPanel></Grid></Window>");
            MainWindow=window;
            using(var input=typeof(Setup).Assembly.GetManifestResourceStream("TMApps.launcher.ico")) window.Icon=System.Windows.Media.Imaging.BitmapDecoder.Create(input,System.Windows.Media.Imaging.BitmapCreateOptions.None,System.Windows.Media.Imaging.BitmapCacheOption.OnLoad).Frames.Last();
            ((Image)window.FindName("Rocket")).Source=window.Icon;
            var preferences=DesktopIntegration.LoadPreferences(DesktopIntegration.ProfileDirectory);
            ((CheckBox)window.FindName("Startup")).IsChecked=preferences.runAtStartup; ((CheckBox)window.FindName("Desktop")).IsChecked=preferences.desktopShortcut; ((CheckBox)window.FindName("Tray")).IsChecked=preferences.closeToTray;
            var location=(TextBox)window.FindName("Location"); location.Text=DesktopIntegration.RegisteredInstallDirectory;
            ((Button)window.FindName("Browse")).Click+=(s,ev)=> {
                using(var picker=new System.Windows.Forms.FolderBrowserDialog { Description="Choose the launcher installation folder",SelectedPath=Directory.Exists(location.Text) ? location.Text : Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),ShowNewFolderButton=true }) {
                    if(picker.ShowDialog()==System.Windows.Forms.DialogResult.OK) location.Text=picker.SelectedPath;
                }
            };
            ((Button)window.FindName("Cancel")).Click+=(s,ev)=>window.Close();
            ((Button)window.FindName("Install")).Click+=(s,ev)=> {
                try {
                    preferences.runAtStartup=((CheckBox)window.FindName("Startup")).IsChecked==true;
                    preferences.desktopShortcut=((CheckBox)window.FindName("Desktop")).IsChecked==true;
                    preferences.closeToTray=((CheckBox)window.FindName("Tray")).IsChecked==true;
                    Install(location.Text,DesktopIntegration.ProfileDirectory,preferences,true);
                    if(((CheckBox)window.FindName("Launch")).IsChecked==true) Process.Start(new ProcessStartInfo(Path.Combine(InstallationPaths.Normalize(location.Text),"TMApps-Launcher.exe")) { UseShellExecute=true });
                    window.Close();
                } catch(Exception ex) { ((TextBlock)window.FindName("Status")).Text=ex.Message; }
            };
            if(e.Args.Length==2 && e.Args[0]=="--render-preview") {
                var content=(FrameworkElement)window.Content; content.Measure(new Size(640,740)); content.Arrange(new Rect(0,0,640,740)); content.UpdateLayout();
                var bitmap=new System.Windows.Media.Imaging.RenderTargetBitmap(640,740,96,96,System.Windows.Media.PixelFormats.Pbgra32); bitmap.Render(content);
                var encoder=new System.Windows.Media.Imaging.PngBitmapEncoder(); encoder.Frames.Add(System.Windows.Media.Imaging.BitmapFrame.Create(bitmap));
                using(var output=File.Create(e.Args[1])) encoder.Save(output);
                Shutdown(); return;
            }
            window.Show();
        }
        static void Uninstall() {
            string directory=Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar);
            if(!InstallationPaths.Same(directory,DesktopIntegration.RegisteredInstallDirectory)) throw new IOException("Run Uninstall from the installed TMApps Launcher folder.");
            if(!ThemedDialogs.Confirm(null,"Uninstall TMApps Launcher","Your installed applications and their data will be kept.","Uninstall launcher")) return;
            RemoveBinaries(directory); DesktopIntegration.UnregisterInstall();
            string self=Assembly.GetExecutingAssembly().Location;
            // Wait for this uninstaller to exit, then remove only its own file and empty directory.
            string script="Wait-Process -Id "+Process.GetCurrentProcess().Id+" -ErrorAction SilentlyContinue; Remove-Item -LiteralPath '"+self.Replace("'","''")+"' -Force; if ((Get-ChildItem -LiteralPath '"+directory.Replace("'","''")+"' -Force | Measure-Object).Count -eq 0) { Remove-Item -LiteralPath '"+directory.Replace("'","''")+"' }";
            var cleanup=new ProcessStartInfo("powershell.exe","-NoProfile -NonInteractive -EncodedCommand "+Convert.ToBase64String(Encoding.Unicode.GetBytes(script))) { UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden };
            Process.Start(cleanup);
        }
    }
}
