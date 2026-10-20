using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Windows.Media;

[assembly: System.Reflection.AssemblyVersion("1.12.2.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.12.2.0")]
[assembly: System.Reflection.AssemblyProduct("TMApps Launcher")]
[assembly: System.Reflection.AssemblyCompany("DaddyTylerXO")]
[assembly: System.Reflection.AssemblyCopyright("Copyright © DaddyTylerXO 2026")]

namespace TMApps {
    public class AppView : INotifyPropertyChanged {
        public AppInfo Info;
        public string Id { get { return Info.id; } } public string Name { get { return Info.name; } }
        public string Category { get { return Info.category; } } public string Description { get { return Info.description; } }
        public string Accent { get { return Id == "tma-mail" ? "#BEF18A" : Id == "tma-padlock" ? "#F09CBB" : Id == "tma-safe" ? "#CBA6F4" : "#BBA6F4"; } }
        public string PreviewBackground { get { return Id == "tma-mail" ? "Transparent" : Id == "tma-padlock" ? "#39232F" : "#2B253A"; } }
        public string Glyph { get { return Id == "tma-socialsmanager" ? "?" : Id == "tma-mail" ? "\uE715" : Id == "tma-padlock" ? "\uE72E" : Id == "tma-safe" ? "\uE8D7" : "\uE902"; } }
        public string GlyphFont { get { return Id == "tma-socialsmanager" ? "Segoe UI" : "Segoe MDL2 Assets"; } }
        public int Position { get; set; }
        public string Number { get { return Position.ToString("00") + " / " + (Id == "tma-mail" ? "MAIL & COMMUNICATION" : Id == "tma-socialsmanager" ? "COMING SOON" : Id == "tma-padlock" ? "YOUR AUTHENTICATORS" : Id == "tma-safe" ? "YOUR PRIVATE SPACE" : Id == "tma-agent-office" ? "YOUR AI TEAM" : Category.ToUpperInvariant()); } }
        static readonly ImageSource mailIcon = LoadMailIcon();
        static ImageSource LoadMailIcon() {
            using (var stream = typeof(AppView).Assembly.GetManifestResourceStream("TMApps.mail.png")) {
                var image = new System.Windows.Media.Imaging.BitmapImage();
                image.BeginInit(); image.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad; image.StreamSource = stream; image.EndInit(); image.Freeze(); return image;
            }
        }
        public ImageSource Icon { get { return Id == "tma-mail" ? mailIcon : null; } }
        public Visibility IconVisibility { get { return Id == "tma-mail" ? Visibility.Visible : Visibility.Collapsed; } }
        public Visibility GlyphVisibility { get { return Id == "tma-mail" ? Visibility.Collapsed : Visibility.Visible; } }
        internal static List<AppView> OrderLibrary(IEnumerable<AppView> library) {
            var ordered = library.OrderBy(a => a.Id == "tma-agent-office" ? 2 : a.Id == "tma-socialsmanager" ? 1 : 0).ToList();
            for (int i = 0; i < ordered.Count; i++) ordered[i].Position = i + 1;
            return ordered;
        }
        public string UpdatedLabel { get { DateTimeOffset date; return DateTimeOffset.TryParse(Info.updatedAt, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out date) ? date.ToString("MMM d, yyyy", System.Globalization.CultureInfo.InvariantCulture) : "Date not published"; } }
        bool Supports(string platform) { return Info.platforms==null ? platform=="windows" && Info.Available : Info.platforms.Contains(platform); }
        public Visibility WindowsSupport { get { return Supports("windows") ? Visibility.Visible : Visibility.Collapsed; } }
        public Visibility MacSupport { get { return Supports("macos") ? Visibility.Visible : Visibility.Collapsed; } }
        public Visibility LinuxSupport { get { return Supports("linux") ? Visibility.Visible : Visibility.Collapsed; } }
        public string VersionLabel { get; set; } public string Status { get; set; } public string Detail { get; set; }
        public string Action { get; set; } public bool CanAct { get; set; } public bool Busy; public bool Removing;
        public CancellationTokenSource Cancellation;
        public Visibility CancelVisibility { get { return Busy && !Removing ? Visibility.Visible : Visibility.Collapsed; } }
        public event PropertyChangedEventHandler PropertyChanged;
        public void Changed() { if (PropertyChanged != null) PropertyChanged(this, new PropertyChangedEventArgs(null)); }
    }
    public class LauncherApplication : Application {
        LauncherService service; Window window; List<AppView> apps; Preferences preferences;
        System.Windows.Controls.ContextMenu trayMenu;
        System.Windows.Forms.NotifyIcon tray; bool quitting; bool trayNoticeShown;
        EventWaitHandle showEvent; RegisteredWaitHandle showRegistration;
        Func<AppInfo,AppInstallOptions> chooseInstallLocation;
        string suiteProfilePath; TMAppsShared.SuiteProfile suiteProfile; string suiteProfileWarning;
        string filter = "all"; bool listView = true; bool refreshing; bool selfUpdating; readonly CancellationTokenSource lifetime = new CancellationTokenSource();
        T Find<T>(string name) where T : FrameworkElement { return (T)window.FindName(name); }
        [STAThread] public static void Main(string[] args) {
            if (args.Length == 2 && args[0] == "--verify-package") {
                try {
                    var app = new Application();
                    var check = (Window)XamlReader.Parse(CleanXaml(Bundled.Read("MainWindow.xaml")));
                    var catalog = LauncherService.ParseCatalog(Bundled.Read("catalog.json"));
                    if (check.FindName("Cards") == null || catalog.apps.Count < 2) throw new InvalidDataException("Invalid embedded library.");
                    File.WriteAllText(args[1], "OK: standalone UI and catalog loaded; " + catalog.apps.Count + " applications"); check.Close(); app.Shutdown();
                } catch (Exception ex) { File.WriteAllText(args[1], "FAIL: " + ex.Message); Environment.ExitCode = 1; }
                return;
            }
            bool created;
            using (var mutex = new Mutex(true, "Local\\TMApps-Launcher", out created)) {
                if (!created) { try { using(var show=EventWaitHandle.OpenExisting("Local\\TMApps-Launcher-Show")) show.Set(); } catch { } return; }
                try { new LauncherApplication().Run(); }
                catch (Exception ex) { MessageBox.Show("TMApps Launcher could not start.\n\n" + ex.Message, "TMApps", MessageBoxButton.OK, MessageBoxImage.Error); }
            }
        }
        protected override void OnStartup(StartupEventArgs e) {
            base.OnStartup(e);
            if (window != null) return; // An explicitly initialized verification window already owns this Application.
            ShutdownMode = ShutdownMode.OnExplicitShutdown;
            Initialize(DesktopIntegration.ProfileDirectory, null, true);
            window.Show();
            if (preferences.checkOnStartup) RefreshCatalog();
        }
        internal Window Initialize(string root, System.Net.Http.HttpMessageHandler handler, bool desktop, Func<AppInfo,AppInstallOptions> locationPicker = null, IAppIntegration appIntegration = null) {
            service = new LauncherService(root, handler,appIntegration);
            chooseInstallLocation=locationPicker ?? new Func<AppInfo,AppInstallOptions>(PromptInstallLocation);
            suiteProfilePath=desktop ? TMAppsShared.SuiteProfileStore.DefaultPath : Path.Combine(root,"shared-profile.json");
            try { suiteProfile=TMAppsShared.SuiteProfileStore.Load(suiteProfilePath); } catch { suiteProfile=new TMAppsShared.SuiteProfile(); suiteProfileWarning="The saved profile could not be read. You can replace it by saving a new profile."; }
            preferences = DesktopIntegration.LoadPreferences(root);
            window = (Window)XamlReader.Parse(CleanXaml(Bundled.Read("MainWindow.xaml"))); MainWindow = window;
            using (var icon = typeof(Bundled).Assembly.GetManifestResourceStream("TMApps.launcher.ico")) {
                window.Icon = System.Windows.Media.Imaging.BitmapDecoder.Create(icon, System.Windows.Media.Imaging.BitmapCreateOptions.None, System.Windows.Media.Imaging.BitmapCacheOption.OnLoad).Frames.Last();
            }
            Find<System.Windows.Controls.Image>("BrandIcon").Source = window.Icon;
            window.AddHandler(System.Windows.Controls.Primitives.ButtonBase.ClickEvent, new RoutedEventHandler(HandleButton), true);
            Find<TextBox>("Search").TextChanged += (s, ev) => Render();
            apps = AppView.OrderLibrary(service.LoadCatalog().apps.Select(a => new AppView { Info = a }));
            ApplyNavigation(window, preferences); ApplyView(window, preferences.libraryView); listView = preferences.libraryView == "List";
            UpdateProfileAvatar();
            Render(); Notice("Choose an application to install. Downloads and installation happen here.");
            if (desktop) {
                SetupTray();
                showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\TMApps-Launcher-Show");
                showRegistration = ThreadPool.RegisterWaitForSingleObject(showEvent, (state,timedOut) => Dispatcher.BeginInvoke(new Action(Restore)), null, Timeout.Infinite, false);
                window.Closing += (s,ev) => {
                    if (!quitting && preferences.closeToTray && tray != null) {
                        ev.Cancel = true; window.Hide();
                        if (!trayNoticeShown) { tray.ShowBalloonTip(3000,"TMApps Launcher","Still running in the tray. Right-click the rocket icon to open or quit.",System.Windows.Forms.ToolTipIcon.Info); trayNoticeShown = true; }
                        return;
                    }
                    if (!quitting && !ConfirmExit()) { ev.Cancel = true; return; }
                    quitting = true; Shutdown();
                };
            }
            return window;
        }
        void SetupTray() {
            using (var input = typeof(Bundled).Assembly.GetManifestResourceStream("TMApps.launcher.ico")) using (var icon = new System.Drawing.Icon(input)) {
                tray = new System.Windows.Forms.NotifyIcon { Text = "TMApps Launcher", Icon = (System.Drawing.Icon)icon.Clone(), Visible = true };
            }
            trayMenu = CreateTrayMenu(Restore, () => { Restore(); RefreshCatalog(); }, () => { if (ConfirmExit()) { quitting = true; Shutdown(); } });
            tray.MouseUp += (s,e) => { if (e.Button == System.Windows.Forms.MouseButtons.Right) Dispatcher.BeginInvoke(new Action(ShowTrayMenu)); };
            tray.DoubleClick += (s,e) => Dispatcher.BeginInvoke(new Action(Restore));
        }
        internal static ContextMenu CreateTrayMenu(Action open, Action checkUpdates, Action quit) {
            var menu = (ContextMenu)XamlReader.Parse("<ContextMenu xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' HasDropShadow='False' MinWidth='208'><ContextMenu.Template><ControlTemplate TargetType='ContextMenu'><Border Background='#412313' BorderBrush='#CC5500' BorderThickness='1' CornerRadius='14' Padding='8'><ItemsPresenter KeyboardNavigation.DirectionalNavigation='Cycle'/></Border></ControlTemplate></ContextMenu.Template><ContextMenu.Resources><Style TargetType='MenuItem'><Setter Property='Background' Value='#CC5500'/><Setter Property='Foreground' Value='White'/><Setter Property='FontSize' Value='12'/><Setter Property='Height' Value='38'/><Setter Property='Margin' Value='0,4'/><Setter Property='Cursor' Value='Hand'/><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='MenuItem'><Border x:Name='bubble' CornerRadius='19' Background='{TemplateBinding Background}' Padding='16,8'><ContentPresenter ContentSource='Header' VerticalAlignment='Center' RecognizesAccessKey='True'/></Border><ControlTemplate.Triggers><Trigger Property='IsHighlighted' Value='True'><Setter TargetName='bubble' Property='Background' Value='#5B321E'/></Trigger><Trigger Property='IsEnabled' Value='False'><Setter TargetName='bubble' Property='Opacity' Value='0.4'/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style></ContextMenu.Resources></ContextMenu>");
            string[] labels = { "Open launcher", "Check for updates", "Quit" };
            Action[] actions = { open, checkUpdates, quit };
            for (int i = 0; i < labels.Length; i++) {
                var action = actions[i]; var item = new MenuItem { Header = labels[i] };
                item.Click += (s,e) => { menu.IsOpen = false; action(); }; menu.Items.Add(item);
            }
            return menu;
        }
        void ShowTrayMenu() {
            trayMenu.Placement = System.Windows.Controls.Primitives.PlacementMode.MousePoint;
            trayMenu.IsOpen = true;
        }
        void Restore() { window.Show(); window.WindowState = WindowState.Normal; window.Activate(); }
        bool ConfirmExit() {
            if(selfUpdating) { ThemedDialogs.Info(window,"Launcher update in progress","Wait for the launcher update, or cancel it in the update window."); return false; }
            if(apps.Any(a=>a.Removing)) { ThemedDialogs.Info(window,"Uninstall in progress","Please wait until the application has been removed before quitting."); return false; }
            return !apps.Any(a=>a.Busy) || ThemedDialogs.Confirm(window,"Quit TMApps Launcher","An installation is in progress. Cancel it and quit?","Cancel install and quit");
        }
        protected override void OnExit(ExitEventArgs e) {
            lifetime.Cancel(); if (apps != null) foreach(var a in apps) if(a.Cancellation != null) a.Cancellation.Cancel();
            if(showRegistration != null) showRegistration.Unregister(null); if(showEvent != null) showEvent.Dispose();
            if(trayMenu != null) trayMenu.IsOpen = false;
            if(tray != null) { tray.Visible = false; var icon=tray.Icon; tray.Dispose(); if(icon != null) icon.Dispose(); }
            if(service != null) service.Dispose(); base.OnExit(e);
        }
        internal static void ApplyView(Window target, string view) {
            bool list = view != "Grid";
            var cards=(ItemsControl)target.FindName("Cards"); cards.ItemTemplate=(DataTemplate)target.Resources[list ? "AppList" : "AppCard"];
            var factory=new FrameworkElementFactory(typeof(System.Windows.Controls.Primitives.UniformGrid)); factory.SetValue(System.Windows.Controls.Primitives.UniformGrid.ColumnsProperty,list ? 1 : 2); cards.ItemsPanel=new ItemsPanelTemplate(factory);
            foreach(string name in new[]{"ListViewButton","GridViewButton"}) {
                var b=(Button)target.FindName(name); b.Background=(Brush)new BrushConverter().ConvertFromString((name=="ListViewButton")==list ? "#CC5500" : "#2D313B");
            }
        }
        internal static void ApplyNavigation(Window target, Preferences p) {
            p.Normalize(); bool side=p.navigationEdge=="Left" || p.navigationEdge=="Right";
            var panel=(Border)target.FindName("NavigationPanel"); DockPanel.SetDock(panel,(Dock)Enum.Parse(typeof(Dock),p.navigationEdge));
            panel.Width=side ? (p.compactNavigation ? 76 : 214) : Double.NaN;
            ((WrapPanel)target.FindName("NavigationLayout")).Orientation=side ? Orientation.Vertical : Orientation.Horizontal;
            foreach(string name in new[]{"NavActions","NavUtilities"}) ((StackPanel)target.FindName(name)).Orientation=side ? Orientation.Vertical : Orientation.Horizontal;
            ((StackPanel)target.FindName("BrandTitle")).Visibility=p.compactNavigation ? Visibility.Collapsed : Visibility.Visible;
            ((StackPanel)target.FindName("BrandBlock")).Margin=side ? new Thickness(8,7,8,24) : new Thickness(8,7,20,7);
            ((StackPanel)target.FindName("NavUtilities")).Margin=side ? new Thickness(0,22,0,0) : new Thickness(8,0,0,0);
            foreach(string name in new[]{"AllFilter","InstalledFilter","UpdatesFilter","NotInstalledFilter","CompactButton","RefreshButton","SettingsButton","GitHubButton"}) {
                var b=(Button)target.FindName(name); b.Margin=side ? new Thickness(0,0,0,8) : new Thickness(4,3,4,3);
                b.Padding=side && p.compactNavigation ? new Thickness(9,12,9,12) : new Thickness(13,10,13,10);
            }
            var compact=(Button)target.FindName("CompactButton"); compact.Content=p.compactNavigation ? "☰" : "☰  Navigation"; compact.ToolTip="Collapse or expand navigation";
            ((Button)target.FindName("RefreshButton")).Content=p.compactNavigation ? "↻" : "↻  Check updates";
            ((Button)target.FindName("SettingsButton")).Content=p.compactNavigation ? "⚙" : "⚙  Settings";
            ((Button)target.FindName("SettingsButton")).ToolTip="Settings";
            ((TextBlock)target.FindName("GitHubLabel")).Visibility=p.compactNavigation ? Visibility.Collapsed : Visibility.Visible;
        }
        static string CleanXaml(string xaml) { return System.Text.RegularExpressions.Regex.Replace(xaml, " (Click|TextChanged)=\"[^\"]+\"", ""); }
        void Notice(string value) { Find<TextBlock>("Notice").Text = value; }
        void Render() {
            if (apps == null) return;
            foreach (var app in apps) {
                var installed = service.GetInstalled(app.Info);
                if (!app.Busy) {
                    bool update = installed != null && LauncherService.IsNewer(app.Info.version, installed.version);
                    app.Status = installed == null ? (app.Info.Available ? "READY TO INSTALL" : "COMING SOON") : update ? "UPDATE AVAILABLE" : "INSTALLED · UP TO DATE";
                    app.Action = installed == null ? (app.Info.Available ? "↓  Install app" : "Coming soon") : update ? "↓  Update app" : "↗  Open app";
                    app.CanAct = !refreshing && (app.Info.Available || installed != null);
                    app.VersionLabel = app.Id == "tma-socialsmanager" && !app.Info.Available ? "Version not published" : "v" + app.Info.version;
                    if (String.IsNullOrEmpty(app.Detail)) app.Detail = installed != null ? "Installed v" + installed.version : app.Info.Available ? "Windows x64 · Beta" : "In development · Coming soon";
                }
                app.Changed();
            }
            string query = Find<TextBox>("Search").Text.Trim();
            var visible = apps.Where(a => (a.Name + " " + a.Category + " " + a.Description).IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0).Where(a => { var installed = service.GetInstalled(a.Info); return filter == "all" || (filter == "notinstalled" ? installed == null : installed != null && (filter == "installed" || LauncherService.IsNewer(a.Info.version, installed.version))); }).ToList();
            Find<ItemsControl>("Cards").ItemsSource = visible;
            Find<TextBlock>("Empty").Visibility = visible.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            Find<TextBlock>("LibraryLabel").Text = "APPLICATION LIBRARY / " + visible.Count.ToString("00");
            Find<Button>("InstalledFilter").Content = "Installed  " + apps.Count(a => service.GetInstalled(a.Info) != null);
            Find<Button>("UpdatesFilter").Content = "Updates  " + apps.Count(a => { var i = service.GetInstalled(a.Info); return i != null && LauncherService.IsNewer(a.Info.version, i.version); });
            Find<Button>("NotInstalledFilter").Content = "Not installed  " + apps.Count(a => service.GetInstalled(a.Info) == null);
            Find<Button>("AllFilter").Content="All applications  " + apps.Count;
            foreach (string key in new[] { "all", "installed", "updates", "notinstalled" }) {
                var button = Find<Button>(key == "all" ? "AllFilter" : key == "installed" ? "InstalledFilter" : key == "updates" ? "UpdatesFilter" : "NotInstalledFilter");
                button.ToolTip=Convert.ToString(button.Content);
                if(preferences.compactNavigation) button.Content=key=="all" ? "▦" : key=="installed" ? "✓" : key=="updates" ? "↓" : "+";
                button.Background = (Brush)new BrushConverter().ConvertFromString(filter == key ? "#CC5500" : "#5B321E");
                button.Foreground = (Brush)new BrushConverter().ConvertFromString(filter == key ? "#FFFFFF" : "#ECEEF3");
            }
        }
        async void RefreshCatalog() {
            if (refreshing || selfUpdating || apps.Any(a => a.Busy)) return;
            refreshing = true; Render(); Find<Button>("RefreshButton").IsEnabled = false; Notice("Checking applications and launcher for updates...");
            string appNotice;
            try {
                try {
                    var catalog = await service.Refresh(lifetime.Token);
                    apps = AppView.OrderLibrary(catalog.apps.Select(info => { var existing = apps.FirstOrDefault(a => a.Id == info.id); if (existing == null) existing = new AppView(); existing.Info = info; existing.Detail = null; return existing; }));
                    appNotice=service.LastRefreshNotice;
                } catch(Exception) { appNotice="Application update check could not complete. Your saved library is still available."; }
                try {
                    var update=await service.CheckLauncherUpdate(LauncherUpdates.CurrentVersion,lifetime.Token);
                    Notice(appNotice+" "+(update==null ? "Launcher is up to date." : "Launcher v"+update.version+" is available.")+" Last checked "+DateTime.Now.ToString("HH:mm")+".");
                    if(update!=null && ThemedDialogs.Confirm(window,"Update TMApps Launcher?","Launcher v"+update.version+" is available. Download, update, and restart now? Your install location, settings, and applications will be kept.","Update and restart")) UpdateLauncher(update);
                } catch(OperationCanceledException) { if(!lifetime.IsCancellationRequested) Notice(appNotice+" Launcher update check timed out."); }
                catch(Exception) { Notice(appNotice+" Launcher update check could not complete. Try again shortly."); }
            } finally { if(!quitting) { refreshing = false; Render(); Find<Button>("RefreshButton").IsEnabled = !apps.Any(a => a.Busy); } }
        }
        void UpdateLauncher(LauncherRelease release) {
            string directory=DesktopIntegration.RegisteredInstallDirectory;
            if(!LauncherUpdates.IsInstalledCopy(System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName,directory)) {
                ThemedDialogs.Info(window,"Launcher installation required","Run the launcher from its installed Start menu or desktop shortcut to update it in place. A portable copy must first be installed using Setup."); return;
            }
            using(var cancellation=CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token)) {
                selfUpdating=true; bool finished=false;
                var dialog=new ThemedDialog(window,"Updating TMApps Launcher","Downloading and verifying v"+release.version+". The launcher will reopen after the update.");
                var status=new TextBlock { Text="Preparing download...",TextWrapping=TextWrapping.Wrap }; dialog.Body.Children.Add(status);
                var cancel=dialog.AddAction("Cancel",false,()=>cancellation.Cancel(),"CancelAction");
                dialog.Closing+=(sender,e)=>{ if(!finished) { e.Cancel=true; cancellation.Cancel(); } };
                dialog.Loaded+=async (sender,e)=> {
                    try {
                        string installer=await service.DownloadLauncherUpdate(release,new Progress<string>(text=>status.Text=text),cancellation.Token);
                        cancellation.Token.ThrowIfCancellationRequested(); cancel.IsEnabled=false; status.Text="Starting verified updater. Waiting for Windows and setup...";
                        await LauncherUpdates.StartInstaller(installer,directory,cancellation.Token);
                        finished=true; dialog.Close(); quitting=true; Shutdown();
                    } catch(OperationCanceledException) { finished=true; dialog.Close(); Notice("Launcher update cancelled. Your current version is unchanged."); }
                    catch(Exception ex) { finished=true; dialog.Close(); ThemedDialogs.Info(window,"Launcher update could not complete",ex.Message); Notice("Launcher update failed. Your current version is still available."); }
                };
                try { dialog.ShowDialog(); } finally { selfUpdating=false; }
            }
        }
        async void Install(AppView app) {
            AppInstallOptions options=null;
            if(service.GetInstalled(app.Info)==null) {
                options=chooseInstallLocation(app.Info);
                if(options==null) return;
            }
            string destination=options==null ? null : options.directory;
            app.Busy = true; app.CanAct = false; app.Action = "Please wait…"; app.Status = "INSTALLING"; app.Cancellation = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
            Render(); Find<Button>("RefreshButton").IsEnabled = false;
            try {
                if(!await CloseSelectedApp(app, service.GetInstalled(app.Info)==null ? "installing" : "updating")) { app.Detail="Update cancelled."; return; }
                await service.Install(app.Info, new Progress<string>(value => { app.Detail = value; app.Changed(); }), app.Cancellation.Token,destination,options);
                app.Detail = "Installed v" + app.Info.version; Notice(service.LastIntegrationWarning ?? (app.Name+" is ready. Select Open app to launch it."));
            } catch (OperationCanceledException) { app.Detail = "Installation cancelled. Your previous version is unchanged."; }
            catch (Exception ex) { app.Detail = "Installation failed. See the message above, then retry."; Notice(app.Name + ": " + ex.Message); }
            finally { app.Busy = false; app.Cancellation.Dispose(); app.Cancellation = null; Render(); Find<Button>("RefreshButton").IsEnabled = !apps.Any(a => a.Busy) && !refreshing; }
        }
        internal AppInstallOptions PromptInstallLocation(AppInfo app) {
            var dialog=new ThemedDialog(window,"Install "+app.name,"Choose an empty application folder. Future updates will use this location.");
            var panel=dialog.Body;
            var line=new DockPanel(); panel.Children.Add(line);
            var location=new TextBox { Text=service.DefaultAppInstallDirectory(app),MinHeight=40 };
            var browse=new Button { Content="Browse…",Margin=new Thickness(8,0,0,0) }; DockPanel.SetDock(browse,Dock.Right); line.Children.Add(browse); line.Children.Add(location);
            browse.Click+=(s,e)=> {
                using(var picker=new System.Windows.Forms.FolderBrowserDialog { Description="Choose the installation folder for "+app.name,SelectedPath=Directory.Exists(location.Text) ? location.Text : Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),ShowNewFolderButton=true }) {
                    if(picker.ShowDialog()==System.Windows.Forms.DialogResult.OK) location.Text=picker.SelectedPath;
                }
            };
            var startup=new CheckBox { Content="Open app on Windows start-up",Foreground=window.Foreground,Margin=new Thickness(0,15,0,7) }; panel.Children.Add(startup);
            var desktop=new CheckBox { Content="Create desktop icon",IsChecked=true,Foreground=window.Foreground,Margin=new Thickness(0,4,0,0) }; panel.Children.Add(desktop);
            var error=new TextBlock { Foreground=Brushes.LightSalmon,TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,10,0,0),MinHeight=35 }; panel.Children.Add(error);
            AppInstallOptions selected=null;
            dialog.AddAction("Cancel",false,()=>dialog.Close(),"CancelAction").IsCancel=true;
            dialog.AddAction("Install",true,()=> { try { selected=new AppInstallOptions { directory=service.ValidateInstallDirectory(app,location.Text),runAtStartup=startup.IsChecked==true,desktopShortcut=desktop.IsChecked==true }; dialog.DialogResult=true; } catch(Exception ex) { error.Text=ex.Message; } },"ConfirmAction").IsDefault=true;
            dialog.ShowDialog(); return selected;
        }
        internal static Button ResolveButton(object source) {
            var item=source as DependencyObject;
            while(item != null) {
                var button=item as Button; if(button != null) return button;
                var content=item as FrameworkContentElement;
                item=content != null ? content.Parent : VisualTreeHelper.GetParent(item);
            }
            return null;
        }
        void HandleButton(object sender, RoutedEventArgs e) {
            if(selfUpdating) return;
            // Source can be retargeted to ItemsControl across a DataTemplate boundary.
            var b = ResolveButton(e.OriginalSource); if (b == null) return;
            e.Handled=true;
            string name = b.Name; string tag = b.Tag as string;
            if(name=="CompactButton") { preferences.compactNavigation=!preferences.compactNavigation; ApplyNavigation(window,preferences); Render(); DesktopIntegration.SavePreferences(service.Root,preferences); return; }
            if(name=="ProfileButton") { ShowProfile(); return; }
            if(name=="SettingsButton") { Settings(); return; }
            if(name=="GitHubButton") { Browse("https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher"); return; }
            if (name == "RefreshButton") { RefreshCatalog(); return; }
            if (name.EndsWith("Filter")) { filter = tag; Render(); return; }
            if (name == "GridViewButton" || name == "ListViewButton") {
                preferences.libraryView=name=="GridViewButton" ? "Grid" : "List";
                listView=preferences.libraryView=="List"; ApplyView(window,preferences.libraryView); DesktopIntegration.SavePreferences(service.Root,preferences); return;
            }
            var app = apps.FirstOrDefault(a => a.Id == tag);
            if (app != null) {
                if ((string)b.Content == "Cancel") { if (app.Cancellation != null) app.Cancellation.Cancel(); return; }
                if ((string)b.Content == "•••") { ShowAppMenu(b, app); return; }
                if (app.Busy) return;
                try {
                    var installed = service.GetInstalled(app.Info);
                    if (installed == null || LauncherService.IsNewer(app.Info.version, installed.version)) Install(app); else service.Open(app.Info);
                } catch (Exception ex) { Notice(ex.Message); }
                return;
            }
            if (Convert.ToString(b.Content) == "GITHUB ↗") Browse("https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher");
            else if (Convert.ToString(b.Content) == "⚙") Settings();
        }
        void ShowAppMenu(Button target, AppView app) {
            var menu = new ContextMenu();
            menu.Resources = window.Resources;
            Action<string, Action, bool> add = (title, action, enabled) => { var item = new MenuItem { Header = title, IsEnabled = enabled }; item.Click += (s, e) => { try { action(); } catch (Exception ex) { Notice(ex.Message); } }; menu.Items.Add(item); };
            var installed = service.GetInstalled(app.Info);
            add("Open application", () => service.Open(app.Info), installed != null && !app.Busy && !refreshing);
            add("View source on GitHub ↗", () => Browse("https://github.com/DaddyTylerXO/TMApps/tree/" + (app.Id=="tma-agent-office" ? "TMA-AgentOffice" : app.Info.branch)), true);
            add("Open installation folder", () => { if (installed != null) System.Diagnostics.Process.Start("explorer.exe", service.InstalledFolder(app.Info, installed)); }, installed != null && !app.Busy && !refreshing);
            add("Uninstall…", () => Uninstall(app), installed != null && !app.Busy && !refreshing);
            target.ContextMenu = menu; menu.PlacementTarget=target; menu.IsOpen = true;
        }
        Task<bool> CloseSelectedApp(AppView app,string operation) {
            return service.EnsureClosed(app.Info,force=>ThemedDialogs.Confirm(window,
                force ? "Force close "+app.Name+"?" : "Close "+app.Name+"?",
                force ? "The app is still running, possibly in the tray. Force closing may lose unsaved work. Allow the launcher to force close it before "+operation+"?" : app.Name+" is running, including possibly in the tray. Save your work first. Allow the launcher to close it before "+operation+"?",
                force ? "Force close" : "Close app"),app.Cancellation.Token);
        }
        async void Uninstall(AppView app) {
            if(app.Busy) return;
            var options=ThemedDialogs.Uninstall(window,app.Info,service.DataLocations(app.Info));
            if(options==null) return;
            app.Busy=true; app.Removing=true; app.CanAct=false; app.Action="Please wait"; app.Status="UNINSTALLING"; app.Cancellation=CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token); Render();
            try {
                if(!await CloseSelectedApp(app,"uninstalling")) { Notice("Uninstall cancelled."); return; }
                app.Cancellation.Token.ThrowIfCancellationRequested();
                await Task.Run(()=>service.Uninstall(app.Info,options.deleteLocalData));
                app.Detail=null;
                Notice(service.LastIntegrationWarning ?? (app.Name+" was uninstalled. Local data was "+(options.deleteLocalData ? "deleted." : "kept.")));
            } catch(OperationCanceledException) { Notice("Uninstall cancelled."); }
            catch(Exception ex) { ThemedDialogs.Info(window,"Could not uninstall "+app.Name,ex.Message); Notice(ex.Message); }
            finally { app.Busy=false; app.Removing=false; app.Cancellation.Dispose(); app.Cancellation=null; Render(); }
        }
        void UpdateProfileAvatar() {
            string value=!String.IsNullOrWhiteSpace(suiteProfile.displayName) ? suiteProfile.displayName : suiteProfile.emails.FirstOrDefault();
            var initial=Find<TextBlock>("ProfileInitial");
            initial.Text=String.IsNullOrEmpty(value) ? "\uE77B" : System.Globalization.StringInfo.GetNextTextElement(value).ToUpperInvariant();
            initial.FontFamily=new FontFamily(String.IsNullOrEmpty(value) ? "Segoe MDL2 Assets" : "Segoe UI");
            Find<Button>("ProfileButton").ToolTip=String.IsNullOrEmpty(value) ? "Set up your optional profile" : value+" - Your profile";
        }
        internal void ShowProfile() {
            var dialog=new ThemedDialog(window,"Your TMApps profile","Optional. Save your name and email addresses for your apps on this PC. The first email address is your primary suggestion.");
            Action<string> label=text=>dialog.Body.Children.Add(new TextBlock { Text=text,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,10,0,7) });
            label("Your name"); var name=new TextBox { Name="ProfileName",Text=suiteProfile.displayName,MaxLength=100 }; dialog.Body.Children.Add(name);
            label("Email addresses (one per line)"); var emails=new TextBox { Name="ProfileEmails",Text=String.Join("\r\n",suiteProfile.emails),AcceptsReturn=true,Height=100,VerticalScrollBarVisibility=ScrollBarVisibility.Auto }; dialog.Body.Children.Add(emails);
            var share=new CheckBox { Name="ShareWithMail",Content="Sync this profile to TMA-Mail on this PC",IsChecked=suiteProfile.revision==null || suiteProfile.shareWithMail,Margin=new Thickness(0,18,0,12) }; dialog.Body.Children.Add(share);
            dialog.Body.Children.Add(new TextBlock { Text="This shares only your name and email addresses with TMA-Mail for this Windows user. It does not sign in or connect accounts. TMA-Mail still requires an app-specific password/key for providers such as iCloud, or the provider's own sign-in. Enter those credentials in TMA-Mail, never here.",TextWrapping=TextWrapping.Wrap,Foreground=Brushes.LightGray,FontSize=12 });
            dialog.Body.Children.Add(new TextBlock { Text="Requires TMA-Mail 0.14.1 or later. Changes appear when Mail opens or shortly afterward while it is running. Disabling sync stops future sharing; it does not disconnect mail accounts or erase an existing Mail profile.",TextWrapping=TextWrapping.Wrap,Foreground=Brushes.LightGray,FontSize=11,Margin=new Thickness(0,10,0,0) });
            var error=new TextBlock { Text=suiteProfileWarning,TextWrapping=TextWrapping.Wrap,Foreground=Brushes.LightSalmon,Margin=new Thickness(0,8,0,0) }; dialog.Body.Children.Add(error);
            dialog.AddAction("Cancel",false,()=>dialog.Close(),"CancelAction").IsCancel=true;
            dialog.AddAction("Save profile",true,()=> {
                try {
                    var selected=new TMAppsShared.SuiteProfile { displayName=name.Text,emails=emails.Text.Split(new[]{'\r','\n'},StringSplitOptions.RemoveEmptyEntries).ToList(),shareWithMail=share.IsChecked==true };
                    suiteProfile=TMAppsShared.SuiteProfileStore.Save(suiteProfilePath,selected); suiteProfileWarning=null; UpdateProfileAvatar(); dialog.DialogResult=true;
                    Notice(suiteProfile.shareWithMail ? "Profile saved. Compatible TMA-Mail versions will sync your name and account suggestions. Credentials are still required in Mail." : "Profile saved. Sync to TMA-Mail is off.");
                } catch(Exception ex) { error.Text=ex.Message; }
            },"ConfirmAction");
            dialog.ShowDialog();
        }
        void Settings() {
            var original=LauncherService.Json.Deserialize<Preferences>(LauncherService.Json.Serialize(preferences));
            bool saved=false;
            var dialog=new Window { Owner=window,Title="TMApps Launcher / Settings",Width=820,Height=650,MinWidth=740,MinHeight=570,WindowStartupLocation=WindowStartupLocation.CenterOwner,Background=window.Background,Foreground=window.Foreground,Resources=window.Resources,Icon=window.Icon };
            var root=new DockPanel(); dialog.Content=root;
            var heading=new TextBlock { Text="TMApps Launcher / Settings",FontSize=23,Margin=new Thickness(24) }; DockPanel.SetDock(heading,Dock.Top); root.Children.Add(heading);
            var footer=new StackPanel { Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right,Margin=new Thickness(20) }; DockPanel.SetDock(footer,Dock.Bottom); root.Children.Add(footer);
            var navigation=new StackPanel { Width=168,Margin=new Thickness(10) }; DockPanel.SetDock(navigation,Dock.Left); root.Children.Add(navigation);
            var body=new StackPanel { Margin=new Thickness(20,16,26,10) }; root.Children.Add(new ScrollViewer { Content=body,VerticalScrollBarVisibility=ScrollBarVisibility.Auto });
            var token=new PasswordBox { Padding=new Thickness(10),Margin=new Thickness(0,8,0,12) };
            Action preview=() => { ApplyNavigation(window,preferences); ApplyView(window,preferences.libraryView); listView=preferences.libraryView=="List"; Render(); };
            Action<string> label=text => body.Children.Add(new TextBlock { Text=text,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,16,0,8) });
            Action<string, bool, Action<bool>> checkbox=(text,value,set) => { var c=new CheckBox { Content=text,IsChecked=value,Foreground=window.Foreground,Margin=new Thickness(0,12,0,5) }; c.Checked+=(s,e)=>set(true); c.Unchecked+=(s,e)=>set(false); body.Children.Add(c); };
            Action<string> page=null;
            page=section => {
                body.Children.Clear(); body.Children.Add(new TextBlock { Text=section=="Appearance" ? "Your workspace" : section=="Startup" ? "Startup and closing" : "Downloads and storage",FontSize=23,Margin=new Thickness(0,0,0,8) });
                body.Children.Add(new TextBlock { Text="Preview changes immediately. Save keeps them; Cancel restores your previous settings.",Foreground=Brushes.LightGray,TextWrapping=TextWrapping.Wrap,FontSize=11 });
                if(section=="Appearance") {
                    label("Navigation position"); var edge=new ComboBox { ItemsSource=new[]{"Left","Top","Right","Bottom"},SelectedItem=preferences.navigationEdge,MinHeight=38 }; edge.SelectionChanged+=(s,e)=>{ preferences.navigationEdge=Convert.ToString(edge.SelectedItem); preview(); }; body.Children.Add(edge);
                    label("Application display"); var view=new ComboBox { ItemsSource=new[]{"List","Grid"},SelectedItem=preferences.libraryView,MinHeight=38 }; view.SelectionChanged+=(s,e)=>{ preferences.libraryView=Convert.ToString(view.SelectedItem); preview(); }; body.Children.Add(view);
                    checkbox("Use a compact icon ribbon",preferences.compactNavigation,value=>{ preferences.compactNavigation=value; preview(); });
                    body.Children.Add(new TextBlock { Text="Use the ☰ button to collapse or expand navigation at any time. Hover an icon to see its name.",TextWrapping=TextWrapping.Wrap,Foreground=Brushes.LightGray,FontSize=11,Margin=new Thickness(0,8,0,0) });
                } else if(section=="Startup") {
                    checkbox("Open TMApps Launcher when I sign in to Windows",preferences.runAtStartup,value=>preferences.runAtStartup=value);
                    checkbox("Create a desktop shortcut",preferences.desktopShortcut,value=>preferences.desktopShortcut=value);
                    checkbox("Keep running in the tray when the window is closed",preferences.closeToTray,value=>preferences.closeToTray=value);
                    checkbox("Check for application updates when the launcher opens",preferences.checkOnStartup,value=>preferences.checkOnStartup=value);
                    body.Children.Add(new TextBlock { Text="Double-click the rocket in the Windows tray to reopen the launcher. Right-click it and choose Quit to exit completely.",Foreground=Brushes.LightGray,TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,18,0,0) });
                } else {
                    body.Children.Add(new TextBlock { Text="Public downloads need no GitHub token. Application updates are installed only when you choose Update.",TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,18,0,12) });
                    var folder=new Button { Content="Open launcher storage",HorizontalAlignment=HorizontalAlignment.Left }; folder.Click+=(s,e)=>System.Diagnostics.Process.Start("explorer.exe",service.Root); body.Children.Add(folder);
                    label("Optional GitHub token"); body.Children.Add(token);
                    var disconnect=new Button { Content="Disconnect GitHub",HorizontalAlignment=HorizontalAlignment.Left }; disconnect.Click+=(s,e)=>{ service.SaveToken(""); token.Clear(); }; body.Children.Add(disconnect);
                }
            };
            foreach(string section in new[]{"Appearance","Startup","Downloads"}) { string selected=section; var b=new Button { Content=section,Margin=new Thickness(0,0,0,7),Padding=new Thickness(15,18,15,18) }; b.Click+=(s,e)=>page(selected); navigation.Children.Add(b); }
            var cancel=new Button { Content="Cancel",Margin=new Thickness(0,0,8,0) }; cancel.Click+=(s,e)=>dialog.Close(); footer.Children.Add(cancel);
            var save=new Button { Content="Save changes",Background=(Brush)new BrushConverter().ConvertFromString("#CC5500") }; save.Click+=(s,e)=> {
                try {
                    if(!String.IsNullOrWhiteSpace(token.Password)) service.SaveToken(token.Password);
                    string exe=System.Reflection.Assembly.GetExecutingAssembly().Location;
                    DesktopIntegration.SetStartup(exe,preferences.runAtStartup); DesktopIntegration.SetDesktopShortcut(exe,preferences.desktopShortcut);
                    DesktopIntegration.SavePreferences(service.Root,preferences); saved=true; dialog.Close();
                } catch(Exception ex) { MessageBox.Show(dialog,ex.Message,"Could not save settings"); }
            }; footer.Children.Add(save);
            dialog.Closed+=(s,e)=>{ if(!saved) { preferences=original; preview(); } };
            page("Appearance"); dialog.ShowDialog();
        }
        void Browse(string url) { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true }); } catch (Exception ex) { Notice("Could not open your browser: " + ex.Message); } }
    }
}
