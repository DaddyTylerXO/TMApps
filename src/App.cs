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

namespace TMApps {
    public class AppView : INotifyPropertyChanged {
        public AppInfo Info;
        public string Id { get { return Info.id; } } public string Name { get { return Info.name; } }
        public string Category { get { return Info.category; } } public string Description { get { return Info.description; } }
        public string Accent { get { return Id == "tma-mail" ? "#BEF18A" : "#BBA6F4"; } }
        public string PreviewBackground { get { return Id == "tma-mail" ? "#203425" : "#2B253A"; } }
        public string Glyph { get { return Id == "tma-mail" ? "\uE715" : "\uE902"; } }
        public string Number { get { return Id == "tma-mail" ? "01 / MAIL & COMMUNICATION" : "02 / YOUR AI TEAM"; } }
        public string VersionLabel { get; set; } public string Status { get; set; } public string Detail { get; set; }
        public string Action { get; set; } public bool CanAct { get; set; } public bool Busy;
        public CancellationTokenSource Cancellation;
        public Visibility CancelVisibility { get { return Busy ? Visibility.Visible : Visibility.Collapsed; } }
        public event PropertyChangedEventHandler PropertyChanged;
        public void Changed() { if (PropertyChanged != null) PropertyChanged(this, new PropertyChangedEventArgs(null)); }
    }
    public class LauncherApplication : Application {
        LauncherService service; Window window; List<AppView> apps; Preferences preferences;
        string filter = "all"; bool listView; bool refreshing; readonly CancellationTokenSource lifetime = new CancellationTokenSource();
        string BasePath { get { return AppDomain.CurrentDomain.BaseDirectory; } }
        T Find<T>(string name) where T : FrameworkElement { return (T)window.FindName(name); }
        [STAThread] public static void Main(string[] args) {
            bool created;
            using (var mutex = new Mutex(true, "Local\\TMApps-Launcher", out created)) {
                if (!created) { MessageBox.Show("TMApps Launcher is already open.", "TMApps"); return; }
                try { new LauncherApplication().Run(); }
                catch (Exception ex) { MessageBox.Show("TMApps Launcher could not start.\n\n" + ex.Message, "TMApps", MessageBoxButton.OK, MessageBoxImage.Error); }
            }
        }
        protected override void OnStartup(StartupEventArgs e) {
            base.OnStartup(e);
            service = new LauncherService(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TMApps", "Launcher"));
            preferences = new Preferences();
            try { preferences = LauncherService.Json.Deserialize<Preferences>(File.ReadAllText(Path.Combine(service.Root, "settings.json"))) ?? preferences; } catch { }
            // XAML is packaged locally; event hooks are attached here, never from downloaded content.
            string xaml = File.ReadAllText(Path.Combine(BasePath, "MainWindow.xaml"));
            xaml = System.Text.RegularExpressions.Regex.Replace(xaml, " (Click|TextChanged)=\"[^\"]+\"", "");
            window = (Window)XamlReader.Parse(xaml); MainWindow = window;
            window.AddHandler(Button.ClickEvent, new RoutedEventHandler(HandleButton));
            Find<TextBox>("Search").TextChanged += (s, ev) => Render();
            apps = service.LoadCatalog(Path.Combine(BasePath, "catalog.json")).apps.Select(a => new AppView { Info = a }).ToList();
            Render();
            Notice("Install an app to get started. Downloads are verified before installation.");
            window.Closing += (s, ev) => {
                if (apps.Any(a => a.Busy) && MessageBox.Show(window, "A download or installation is in progress. Cancel it and close the launcher?", "Close launcher", MessageBoxButton.YesNo) != MessageBoxResult.Yes) { ev.Cancel = true; return; }
                lifetime.Cancel(); foreach (var app in apps) if (app.Cancellation != null) app.Cancellation.Cancel();
            };
            window.Show();
            if (preferences.checkOnStartup) RefreshCatalog();
        }
        void Notice(string value) { Find<TextBlock>("Notice").Text = value; }
        void Render() {
            if (apps == null) return;
            foreach (var app in apps) {
                var installed = service.GetInstalled(app.Info);
                if (!app.Busy) {
                    bool update = installed != null && LauncherService.IsNewer(app.Info.version, installed.version);
                    app.Status = installed == null ? (app.Info.Available ? "READY TO INSTALL" : "AWAITING FIRST RELEASE") : update ? "UPDATE AVAILABLE" : "INSTALLED · UP TO DATE";
                    app.Action = installed == null ? (app.Info.Available ? "↓  Install app" : "Coming soon") : update ? "↓  Update app" : "↗  Open app";
                    app.CanAct = app.Info.Available || installed != null;
                    app.VersionLabel = "v" + app.Info.version;
                    if (String.IsNullOrEmpty(app.Detail)) app.Detail = installed != null ? "Installed v" + installed.version : app.Info.Available ? "Windows x64 · Beta" : "The publisher is preparing a Windows build.";
                }
                app.Changed();
            }
            string query = Find<TextBox>("Search").Text.Trim();
            var visible = apps.Where(a => (a.Name + " " + a.Category + " " + a.Description).IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0).Where(a => filter == "all" || (service.GetInstalled(a.Info) != null && (filter == "installed" || LauncherService.IsNewer(a.Info.version, service.GetInstalled(a.Info).version)))).ToList();
            Find<ItemsControl>("Cards").ItemsSource = visible;
            Find<TextBlock>("Empty").Visibility = visible.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            Find<TextBlock>("LibraryLabel").Text = "APPLICATION LIBRARY / " + visible.Count.ToString("00");
            Find<Button>("InstalledFilter").Content = "Installed  " + apps.Count(a => service.GetInstalled(a.Info) != null);
            Find<Button>("UpdatesFilter").Content = "Updates  " + apps.Count(a => { var i = service.GetInstalled(a.Info); return i != null && LauncherService.IsNewer(a.Info.version, i.version); });
            foreach (string key in new[] { "all", "installed", "updates" }) {
                var button = Find<Button>(key == "all" ? "AllFilter" : key == "installed" ? "InstalledFilter" : "UpdatesFilter");
                button.Background = (Brush)new BrushConverter().ConvertFromString(filter == key ? "#BEF18A" : "#202725");
                button.Foreground = (Brush)new BrushConverter().ConvertFromString(filter == key ? "#142015" : "#D9DFDB");
            }
        }
        async void RefreshCatalog() {
            if (refreshing || apps.Any(a => a.Busy)) return;
            refreshing = true; Find<Button>("RefreshButton").IsEnabled = false; Notice("Checking for new releases…");
            try {
                var catalog = await service.Refresh(lifetime.Token);
                foreach (var a in apps) { a.Info = catalog.apps.First(i => i.id == a.Id); a.Detail = null; }
                Render(); Notice("You're up to date with the latest published catalog. Last checked " + DateTime.Now.ToString("HH:mm") + ".");
            } catch (OperationCanceledException) { if (!lifetime.IsCancellationRequested) Notice("The release check timed out. Your saved library is still available. Try again shortly."); }
            catch (Exception) { Notice("The release service is unavailable or has no catalog yet. Showing the last saved library; you can retry with Check for updates."); }
            finally { refreshing = false; Find<Button>("RefreshButton").IsEnabled = true; }
        }
        async void Install(AppView app) {
            app.Busy = true; app.CanAct = false; app.Action = "Please wait…"; app.Status = "INSTALLING"; app.Cancellation = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
            Render(); Find<Button>("RefreshButton").IsEnabled = false;
            try {
                await service.Install(app.Info, new Progress<string>(value => { app.Detail = value; app.Changed(); }), app.Cancellation.Token);
                app.Detail = "Installed v" + app.Info.version; Notice(app.Name + " is ready. Select Open app to launch it.");
            } catch (OperationCanceledException) { app.Detail = "Installation cancelled. Your previous version is unchanged."; }
            catch (Exception ex) { app.Detail = "Installation failed. Use the options menu for details."; Notice(app.Name + ": " + ex.Message); }
            finally { app.Busy = false; app.Cancellation.Dispose(); app.Cancellation = null; Render(); Find<Button>("RefreshButton").IsEnabled = !apps.Any(a => a.Busy) && !refreshing; }
        }
        void HandleButton(object sender, RoutedEventArgs e) {
            var b = e.Source as Button; if (b == null) return;
            string name = b.Name; string tag = b.Tag as string;
            if (name == "RefreshButton") { RefreshCatalog(); return; }
            if (name.EndsWith("Filter")) { filter = tag; Render(); return; }
            if (name == "ViewButton") {
                listView = !listView; b.Content = listView ? "▦  Grid" : "☷  List";
                var factory = new FrameworkElementFactory(typeof(System.Windows.Controls.Primitives.UniformGrid)); factory.SetValue(System.Windows.Controls.Primitives.UniformGrid.ColumnsProperty, listView ? 1 : 2);
                Find<ItemsControl>("Cards").ItemsPanel = new ItemsPanelTemplate(factory); return;
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
            Action<string, Action, bool> add = (title, action, enabled) => { var item = new MenuItem { Header = title, IsEnabled = enabled }; item.Click += (s, e) => { try { action(); } catch (Exception ex) { Notice(ex.Message); } }; menu.Items.Add(item); };
            var installed = service.GetInstalled(app.Info);
            add("Open application", () => service.Open(app.Info), installed != null && !app.Busy);
            add("View source on GitHub ↗", () => Browse("https://github.com/DaddyTylerXO/TMApps/tree/" + app.Info.branch), true);
            add("Open installation folder", () => { if (installed != null) System.Diagnostics.Process.Start("explorer.exe", service.InstalledFolder(app.Info, installed)); }, installed != null && !app.Busy);
            add("Uninstall…", () => {
                if (MessageBox.Show(window, "Remove " + app.Name + " from this launcher?\n\nYour application accounts, settings, and workspace data will be kept.", "Uninstall application", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes) {
                    service.Uninstall(app.Info); app.Detail = null; Render(); Notice(app.Name + " was uninstalled. Application data was kept.");
                }
            }, installed != null && !app.Busy);
            target.ContextMenu = menu; menu.IsOpen = true;
        }
        void Settings() {
            var dialog = new Window { Owner = window, Title = "Launcher settings", Width = 540, Height = 310, ResizeMode = ResizeMode.NoResize, WindowStartupLocation = WindowStartupLocation.CenterOwner, Background = window.Background, Foreground = window.Foreground };
            var panel = new StackPanel { Margin = new Thickness(24) }; dialog.Content = panel;
            panel.Children.Add(new TextBlock { Text = "Make yourself at home.", FontSize = 23, Margin = new Thickness(0,0,0,18) });
            var check = new CheckBox { Content = "Check for application updates when the launcher opens", IsChecked = preferences.checkOnStartup, Foreground = window.Foreground }; panel.Children.Add(check);
            panel.Children.Add(new TextBlock { Text = "Applications are installed for your Windows user. Updates are downloaded only when you choose Update app.", TextWrapping = TextWrapping.Wrap, Foreground = Brushes.LightGray, Margin = new Thickness(0,18,0,12) });
            var folder = new Button { Content = "Open launcher storage", HorizontalAlignment = HorizontalAlignment.Left }; folder.Click += (s,e) => System.Diagnostics.Process.Start("explorer.exe", service.Root); panel.Children.Add(folder);
            var save = new Button { Content = "Save settings", HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0,12,0,0) };
            save.Click += (s,e) => { try { preferences.checkOnStartup = check.IsChecked == true; LauncherService.AtomicWrite(Path.Combine(service.Root, "settings.json"), LauncherService.Json.Serialize(preferences)); dialog.Close(); } catch (Exception ex) { MessageBox.Show(dialog, ex.Message, "Could not save settings"); } }; panel.Children.Add(save); dialog.ShowDialog();
        }
        void Browse(string url) { try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true }); } catch (Exception ex) { Notice("Could not open your browser: " + ex.Message); } }
    }
}
