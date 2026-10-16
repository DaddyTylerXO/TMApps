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

[assembly: System.Reflection.AssemblyVersion("1.5.0.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.5.0.0")]
[assembly: System.Reflection.AssemblyProduct("TMApps Launcher")]
[assembly: System.Reflection.AssemblyCompany("DaddyTylerXO")]
[assembly: System.Reflection.AssemblyCopyright("Copyright © DaddyTylerXO 2026")]

namespace TMApps {
    public class AppView : INotifyPropertyChanged {
        public AppInfo Info;
        public string Id { get { return Info.id; } } public string Name { get { return Info.name; } }
        public string Category { get { return Info.category; } } public string Description { get { return Info.description; } }
        public string Accent { get { return Id == "tma-mail" ? "#BEF18A" : "#BBA6F4"; } }
        public string PreviewBackground { get { return Id == "tma-mail" ? "#203425" : "#2B253A"; } }
        public string Glyph { get { return Id == "tma-mail" ? "\uE715" : "\uE902"; } }
        public string Number { get { return Id == "tma-mail" ? "01 / MAIL & COMMUNICATION" : "02 / YOUR AI TEAM"; } }
        public string UpdatedLabel { get { DateTimeOffset date; return DateTimeOffset.TryParse(Info.updatedAt, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out date) ? date.ToString("MMM d, yyyy", System.Globalization.CultureInfo.InvariantCulture) : "Date not published"; } }
        public string VersionLabel { get; set; } public string Status { get; set; } public string Detail { get; set; }
        public string Action { get; set; } public bool CanAct { get; set; } public bool Busy;
        public CancellationTokenSource Cancellation;
        public Visibility CancelVisibility { get { return Busy ? Visibility.Visible : Visibility.Collapsed; } }
        public event PropertyChangedEventHandler PropertyChanged;
        public void Changed() { if (PropertyChanged != null) PropertyChanged(this, new PropertyChangedEventArgs(null)); }
    }
    public class LauncherApplication : Application {
        LauncherService service; Window window; List<AppView> apps; Preferences preferences;
        System.Windows.Forms.NotifyIcon tray; bool quitting; bool trayNoticeShown;
        EventWaitHandle showEvent; RegisteredWaitHandle showRegistration;
        Func<AppInfo,AppInstallOptions> chooseInstallLocation;
        string filter = "all"; bool listView = true; bool refreshing; readonly CancellationTokenSource lifetime = new CancellationTokenSource();
        T Find<T>(string name) where T : FrameworkElement { return (T)window.FindName(name); }
        [STAThread] public static void Main(string[] args) {
            if (args.Length == 2 && args[0] == "--verify-package") {
                try {
                    var app = new Application();
                    var check = (Window)XamlReader.Parse(CleanXaml(Bundled.Read("MainWindow.xaml")));
                    var catalog = LauncherService.ParseCatalog(Bundled.Read("catalog.json"));
                    if (check.FindName("Cards") == null || catalog.apps.Count != 2) throw new InvalidDataException("Invalid embedded library.");
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
            preferences = DesktopIntegration.LoadPreferences(root);
            window = (Window)XamlReader.Parse(CleanXaml(Bundled.Read("MainWindow.xaml"))); MainWindow = window;
            using (var icon = typeof(Bundled).Assembly.GetManifestResourceStream("TMApps.launcher.ico")) {
                window.Icon = System.Windows.Media.Imaging.BitmapDecoder.Create(icon, System.Windows.Media.Imaging.BitmapCreateOptions.None, System.Windows.Media.Imaging.BitmapCacheOption.OnLoad).Frames.Last();
            }
            Find<System.Windows.Controls.Image>("BrandIcon").Source = window.Icon;
            window.AddHandler(System.Windows.Controls.Primitives.ButtonBase.ClickEvent, new RoutedEventHandler(HandleButton), true);
            Find<TextBox>("Search").TextChanged += (s, ev) => Render();
            apps = service.LoadCatalog().apps.Select(a => new AppView { Info = a }).ToList();
            ApplyNavigation(window, preferences); ApplyView(window, preferences.libraryView); listView = preferences.libraryView == "List";
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
            var menu = new System.Windows.Forms.ContextMenuStrip();
            menu.Items.Add("Open launcher",null,(s,e) => Dispatcher.BeginInvoke(new Action(Restore)));
            menu.Items.Add("Check for updates",null,(s,e) => Dispatcher.BeginInvoke(new Action(() => { Restore(); RefreshCatalog(); })));
            menu.Items.Add("Quit",null,(s,e) => Dispatcher.BeginInvoke(new Action(() => { if (ConfirmExit()) { quitting = true; Shutdown(); } })));
            tray.ContextMenuStrip = menu; tray.DoubleClick += (s,e) => Dispatcher.BeginInvoke(new Action(Restore));
        }
        void Restore() { window.Show(); window.WindowState = WindowState.Normal; window.Activate(); }
        bool ConfirmExit() { return !apps.Any(a => a.Busy) || MessageBox.Show(window,"An installation is in progress. Cancel it and quit?","Quit TMApps Launcher",MessageBoxButton.YesNo) == MessageBoxResult.Yes; }
        protected override void OnExit(ExitEventArgs e) {
            lifetime.Cancel(); if (apps != null) foreach(var a in apps) if(a.Cancellation != null) a.Cancellation.Cancel();
            if(showRegistration != null) showRegistration.Unregister(null); if(showEvent != null) showEvent.Dispose();
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
                    app.Status = installed == null ? (app.Info.Available ? "READY TO INSTALL" : "AWAITING FIRST RELEASE") : update ? "UPDATE AVAILABLE" : "INSTALLED · UP TO DATE";
                    app.Action = installed == null ? (app.Info.Available ? "↓  Install app" : "Coming soon") : update ? "↓  Update app" : "↗  Open app";
                    app.CanAct = !refreshing && (app.Info.Available || installed != null);
                    app.VersionLabel = "v" + app.Info.version;
                    if (String.IsNullOrEmpty(app.Detail)) app.Detail = installed != null ? "Installed v" + installed.version : app.Info.Available ? "Windows x64 · Beta" : "The publisher is preparing a Windows build.";
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
            if (refreshing || apps.Any(a => a.Busy)) return;
            refreshing = true; Render(); Find<Button>("RefreshButton").IsEnabled = false; Notice("Checking for new releases…");
            try {
                var catalog = await service.Refresh(lifetime.Token);
                foreach (var a in apps) { a.Info = catalog.apps.First(i => i.id == a.Id); a.Detail = null; }
                Render(); Notice(service.LastRefreshNotice+" Last checked "+DateTime.Now.ToString("HH:mm")+".");
            } catch (OperationCanceledException) { if (!lifetime.IsCancellationRequested) Notice("The release check timed out. Your saved library is still available. Try again shortly."); }
            catch (Exception) { Notice("Could not reach the release catalog. Check your connection and try again. Your saved library is still available."); }
            finally { refreshing = false; Render(); Find<Button>("RefreshButton").IsEnabled = !apps.Any(a => a.Busy); }
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
                await service.Install(app.Info, new Progress<string>(value => { app.Detail = value; app.Changed(); }), app.Cancellation.Token,destination,options);
                app.Detail = "Installed v" + app.Info.version; Notice(service.LastIntegrationWarning ?? (app.Name+" is ready. Select Open app to launch it."));
            } catch (OperationCanceledException) { app.Detail = "Installation cancelled. Your previous version is unchanged."; }
            catch (Exception ex) { app.Detail = "Installation failed. See the message above, then retry."; Notice(app.Name + ": " + ex.Message); }
            finally { app.Busy = false; app.Cancellation.Dispose(); app.Cancellation = null; Render(); Find<Button>("RefreshButton").IsEnabled = !apps.Any(a => a.Busy) && !refreshing; }
        }
        AppInstallOptions PromptInstallLocation(AppInfo app) {
            var dialog=new Window { Owner=window,Title="Install "+app.name,Width=620,Height=410,ResizeMode=ResizeMode.NoResize,WindowStartupLocation=WindowStartupLocation.CenterOwner,Background=window.Background,Foreground=window.Foreground,Resources=window.Resources,Icon=window.Icon };
            var panel=new StackPanel { Margin=new Thickness(24) }; dialog.Content=panel;
            panel.Children.Add(new TextBlock { Text="Install "+app.name,FontSize=23,Margin=new Thickness(0,0,0,12) });
            panel.Children.Add(new TextBlock { Text="Choose an empty application folder. Future updates will use this location.",TextWrapping=TextWrapping.Wrap,Foreground=Brushes.LightGray,Margin=new Thickness(0,0,0,15) });
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
            var actions=new StackPanel { Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right,Margin=new Thickness(0,12,0,0) }; panel.Children.Add(actions);
            AppInstallOptions selected=null;
            var cancel=new Button { Content="Cancel",Margin=new Thickness(0,0,8,0),IsCancel=true }; cancel.Click+=(s,e)=>dialog.Close(); actions.Children.Add(cancel);
            var install=new Button { Content="Install",Background=(Brush)new BrushConverter().ConvertFromString("#CC5500"),IsDefault=true }; install.Click+=(s,e)=> { try { selected=new AppInstallOptions { directory=service.ValidateInstallDirectory(app,location.Text),runAtStartup=startup.IsChecked==true,desktopShortcut=desktop.IsChecked==true }; dialog.Close(); } catch(Exception ex) { error.Text=ex.Message; } }; actions.Children.Add(install);
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
            // Source can be retargeted to ItemsControl across a DataTemplate boundary.
            var b = ResolveButton(e.OriginalSource); if (b == null) return;
            e.Handled=true;
            string name = b.Name; string tag = b.Tag as string;
            if(name=="CompactButton") { preferences.compactNavigation=!preferences.compactNavigation; ApplyNavigation(window,preferences); Render(); DesktopIntegration.SavePreferences(service.Root,preferences); return; }
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
            add("Open application", () => service.Open(app.Info), installed != null && !app.Busy);
            add("View source on GitHub ↗", () => Browse("https://github.com/DaddyTylerXO/TMApps/tree/" + app.Info.branch), true);
            add("Open installation folder", () => { if (installed != null) System.Diagnostics.Process.Start("explorer.exe", service.InstalledFolder(app.Info, installed)); }, installed != null && !app.Busy);
            add("Uninstall…", () => {
                if (MessageBox.Show(window, "Remove " + app.Name + " from this launcher?\n\nYour application accounts, settings, and workspace data will be kept.", "Uninstall application", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes) {
                    service.Uninstall(app.Info); app.Detail = null; Render(); Notice(service.LastIntegrationWarning ?? (app.Name+" was uninstalled. Application data was kept."));
                }
            }, installed != null && !app.Busy);
            target.ContextMenu = menu; menu.PlacementTarget=target; menu.IsOpen = true;
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
