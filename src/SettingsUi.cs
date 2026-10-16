using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Media;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Threading;
using Microsoft.Win32;
using Forms = System.Windows.Forms;

namespace Postbox {
    public partial class App {
        private Preferences preferences;
        private SettingsStore settingsStore;
        private string dataDirectory;
        private Grid workspace, mailArea;
        private Border navigation;
        private StackPanel navigationButtons;
        private Button collapseButton, settingsButton;
        private Forms.NotifyIcon tray;
        private bool exiting;
        private SoundPlayer soundPlayer;
        private readonly List<Window> banners = new List<Window>();
        private readonly string[] folders = { "Inbox", "Starred", "Drafts", "Sent", "Archive", "Trash" };
        private readonly string[] icons = { "▣", "☆", "▱", "↗", "▤", "♧" };
        private void InitializePreferences() {
            string[] args = Environment.GetCommandLineArgs();
            int dataArg = Array.IndexOf(args, "--data-dir");
            dataDirectory = dataArg >= 0 && args.Length > dataArg + 1 ? Path.GetFullPath(args[dataArg + 1]) : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TMA-Mail");
            Directory.CreateDirectory(dataDirectory);
            string oldMailbox = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Postbox", "mailbox.json");
            string mailbox = Path.Combine(dataDirectory, "mailbox.json");
            if (dataArg < 0 && !File.Exists(mailbox) && File.Exists(oldMailbox)) File.Copy(oldMailbox, mailbox);
            string settingsPath = Path.Combine(dataDirectory, "settings.json");
            bool hadSettings = File.Exists(settingsPath);
            settingsStore = new SettingsStore(settingsPath);
            preferences = settingsStore.Load();
            if (!hadSettings) { preferences.SetupCompleted = File.Exists(mailbox); settingsStore.Save(preferences); }
        }
        private static void Detach(FrameworkElement element) {
            var panel = element.Parent as Panel; if (panel != null) { panel.Children.Remove(element); return; }
            var border = element.Parent as Decorator; if (border != null) { border.Child = null; return; }
            var control = element.Parent as ContentControl; if (control != null) control.Content = null;
        }
        private void InitializeWorkspace() {
            // Retain the original controls and namescope while allowing the navigation to move.
            var root = (Grid)window.Content;
            var header = root.Children.OfType<Border>().First(e => Grid.GetRow(e) == 0 && Grid.GetColumn(e) == 1);
            var messagePanel = root.Children.OfType<Border>().First(e => Grid.GetRow(e) == 1 && Grid.GetColumn(e) == 1);
            var readerPanel = root.Children.OfType<Grid>().First(e => Grid.GetRow(e) == 1 && Grid.GetColumn(e) == 2);
            var statusPanel = root.Children.OfType<Border>().First(e => Grid.GetRow(e) == 2);
            var brand = (StackPanel)Find<TextBlock>("BrandLabel").Parent;
            ((Border)brand.Children[0]).Background = Theme.B("SidebarAccent");
            foreach (FrameworkElement element in new FrameworkElement[] { header, messagePanel, readerPanel, statusPanel, brand }) Detach(element);
            workspace = new Grid();
            workspace.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            workspace.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            workspace.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            workspace.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            workspace.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            workspace.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            inboxPanel = messagePanel; previewPanel = readerPanel;
            var center = new Grid();
            center.RowDefinitions.Add(new RowDefinition { Height = new GridLength(68) });
            center.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            center.RowDefinitions.Add(new RowDefinition { Height = new GridLength(30) });
            centerHost = new DockPanel(); Grid.SetColumn(centerHost, 1); Grid.SetRow(centerHost, 1); workspace.Children.Add(centerHost); centerHost.Children.Add(center);
            Grid.SetColumn(header, 0); Grid.SetColumnSpan(header, 1); Grid.SetRow(header, 0); center.Children.Add(header);
            mailArea = new Grid();
            mailArea.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(0.5, GridUnitType.Star), MinWidth = 290, MaxWidth = 365 });
            mailArea.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star), MinWidth = 420 });
            Grid.SetRow(mailArea, 1); center.Children.Add(mailArea);
            Grid.SetRow(messagePanel, 0); Grid.SetColumn(messagePanel, 0); mailArea.Children.Add(messagePanel);
            Grid.SetRow(readerPanel, 0); Grid.SetColumn(readerPanel, 1); mailArea.Children.Add(readerPanel);
            Grid.SetColumn(statusPanel, 0); Grid.SetColumnSpan(statusPanel, 1); Grid.SetRow(statusPanel, 2); center.Children.Add(statusPanel);
            navigation = new Border { Background = Brush("#14243E") }; workspace.Children.Add(navigation);
            // Keep the XAML root attached so FindName continues to resolve its controls.
            root.Children.Clear(); root.RowDefinitions.Clear(); root.ColumnDefinitions.Clear(); root.Children.Add(workspace);
            foreach (string name in folders) Detach(Find<Button>(name + "Nav"));
            Detach(Find<Button>("ComposeButton")); Detach(Find<Button>("AccountsButton"));
            collapseButton = Action("☰", false); collapseButton.ToolTip = "Collapse or expand navigation (Ctrl+Shift+B)";
            collapseButton.Click += delegate { var updated = settingsStore.Clone(preferences); updated.NavigationCollapsed = !updated.NavigationCollapsed; settingsStore.Save(updated); preferences = updated; ApplyNavigation(); };
            settingsButton = Action("⚙  Settings", false); settingsButton.ToolTip = "Settings (Ctrl+,)"; settingsButton.Click += delegate { ShowSettings(); };
            tray = new Forms.NotifyIcon { Text = "TMA-Mail", Icon = AppBrand.TrayIcon(), Visible = false };
            var menu = new Forms.ContextMenuStrip();
            menu.Items.Add("Open TMA-Mail", null, delegate { Dispatcher.Invoke(new Action(RestoreWindow)); });
            menu.Items.Add("Settings", null, delegate { Dispatcher.Invoke(new Action(delegate { RestoreWindow(); ShowSettings(); })); });
            menu.Items.Add("Exit TMA-Mail", null, delegate { Dispatcher.Invoke(new Action(delegate { exiting = true; window.Close(); })); });
            tray.ContextMenuStrip = menu; tray.DoubleClick += delegate { Dispatcher.Invoke(new Action(RestoreWindow)); };
            window.Closing += delegate(object sender, System.ComponentModel.CancelEventArgs e) {
                if (preferences.CloseToTray && !exiting) { e.Cancel = true; HideToTray(); Status("Still running in the notification area"); }
            };
            window.Closed += delegate { if (spotify != null) spotify.Dispose(); tray.Dispose(); if (soundPlayer != null) soundPlayer.Dispose(); foreach (var banner in banners.ToArray()) banner.Close(); };
            window.Loaded += delegate {
                if (preferences.StartMaximized) window.WindowState = WindowState.Maximized;
                if (preferences.StartMinimized && !showAfterWelcome) { window.WindowState = WindowState.Minimized; HideToTray(); }
                if (settingsStore.RecoveryPath != null) MessageBox.Show(window, "Settings were reset because the file could not be read. A copy was preserved at:\n" + settingsStore.RecoveryPath, "Settings recovered");
            };
            window.PreviewKeyDown += delegate(object sender, KeyEventArgs e) {
                if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.OemComma) { ShowSettings(); e.Handled = true; }
                if (Keyboard.Modifiers == (ModifierKeys.Control | ModifierKeys.Shift) && e.Key == Key.B) { collapseButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); e.Handled = true; }
            };
            // Reuse the brand control within the movable navigation.
            navigation.Tag = brand;
        }
        private void ApplyPreferences() {
            Theme.SetMode(preferences.AppearanceMode);
            window.Title = "TMA-Mail";
            Find<TextBlock>("WorkspaceBadge").Text = activeAccount == null ? "EXPLORE MODE" : "CONNECTED MAIL";
            Find<TextBox>("BodyText").FontSize = preferences.TextSize;
            var avatar = (TextBlock)((Border)Find<Button>("AccountTop").Content).Child;
            avatar.Text = preferences.DisplayName.Substring(0, 1).ToUpperInvariant();
            Find<Button>("AccountTop").ToolTip = preferences.DisplayName + " · Account connections";
            ApplyNavigation();
            ApplyInboxLayout();
            if (richReader != null) richReader.FontSize = preferences.TextSize;
        }
        private void ApplyNavigation() {
            bool horizontal = preferences.NavigationEdge == "Top" || preferences.NavigationEdge == "Bottom";
            bool compact = preferences.NavigationCollapsed;
            navigation.Child = null;
            foreach (string name in folders) Detach(Find<Button>(name + "Nav"));
            foreach (var button in new[] { Find<Button>("ComposeButton"), Find<Button>("AccountsButton"), collapseButton, settingsButton }) Detach(button);
            var brand = (StackPanel)navigation.Tag; Detach(brand);
            navigation.Width = horizontal ? Double.NaN : compact ? 66 : 224;
            navigation.Height = Double.NaN;
            Grid.SetColumn(navigation, preferences.NavigationEdge == "Right" ? 2 : preferences.NavigationEdge == "Left" ? 0 : 1);
            Grid.SetRow(navigation, preferences.NavigationEdge == "Top" ? 0 : preferences.NavigationEdge == "Bottom" ? 2 : 1);
            var layout = new DockPanel { LastChildFill = true, Margin = new Thickness(horizontal ? 8 : 0) }; navigation.Child = layout;
            collapseButton.Content = "☰"; collapseButton.HorizontalAlignment = HorizontalAlignment.Right; collapseButton.Background = Brushes.Transparent; collapseButton.Foreground = Brush("#C5D4EC"); collapseButton.Margin = new Thickness(0, 4, 4, 0); collapseButton.Padding = new Thickness(10, 9, 10, 9);
            DockPanel.SetDock(collapseButton, horizontal ? Dock.Right : Dock.Top); layout.Children.Add(collapseButton);
            if (!horizontal && !compact) { brand.Margin = new Thickness(24, 17, 16, 18); DockPanel.SetDock(brand, Dock.Top); layout.Children.Add(brand); }
            var compose = Find<Button>("ComposeButton"); compose.Content = compact ? "＋" : horizontal ? "＋ New" : "＋   New message";
            compose.Background = Theme.B("SidebarAccent"); compose.ToolTip = "New message (Ctrl+N)"; compose.Margin = new Thickness(8, horizontal ? 4 : 8, 8, horizontal ? 4 : 24); compose.Padding = new Thickness(compact ? 12 : 14, 10, compact ? 12 : 14, 10);
            DockPanel.SetDock(compose, horizontal ? Dock.Left : Dock.Top); layout.Children.Add(compose);
            var footer = new StackPanel { Orientation = horizontal ? Orientation.Horizontal : Orientation.Vertical }; navigationFooter = footer;
            settingsButton.Content = "⚙"; settingsButton.HorizontalAlignment = HorizontalAlignment.Right;
            var accounts = Find<Button>("AccountsButton"); accounts.Content = compact ? "⊕" : horizontal ? "⊕ Accounts" : activeAccount == null ? "＋  Connect an account" : "⊕  Account settings";
            accounts.ToolTip = "Account connections";
            foreach (var button in new[] { settingsButton, accounts }) { button.Margin = new Thickness(8, 4, 8, 8); button.Padding = new Thickness(10, 10, 10, 10); button.Background = Brushes.Transparent; button.Foreground = Brush("#C5D4EC"); footer.Children.Add(button); }
            DockPanel.SetDock(footer, horizontal ? Dock.Right : Dock.Bottom); layout.Children.Add(footer);
            navigationButtons = new StackPanel { Orientation = horizontal ? Orientation.Horizontal : Orientation.Vertical, VerticalAlignment = horizontal ? VerticalAlignment.Center : VerticalAlignment.Top };
            foreach (string name in folders) {
                var button = Find<Button>(name + "Nav"); button.ToolTip = name; button.Margin = new Thickness(horizontal ? 2 : 8, 3, horizontal ? 2 : 8, 3); button.Padding = new Thickness(compact ? 12 : 10, 11, compact ? 12 : 10, 11); button.FontSize = compact ? 18 : 13; navigationButtons.Children.Add(button);
            }
            var navContent = new DockPanel();
            var navTabs = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(3) };
            var allTab = Action(compact ? "▤" : "Folders", false); var favTab = Action(compact ? "★" : "Favourites", false);
            allTab.ToolTip = "All folders"; favTab.ToolTip = "Favourite folders";
            foreach (var tabButton in new[] { allTab, favTab }) { tabButton.Padding = new Thickness(6); tabButton.Margin = new Thickness(1); tabButton.FontSize = 11; tabButton.Foreground = Brushes.White; }
            allTab.Background = Brush(favouritesTab ? "#14243E" : "SidebarSelected"); favTab.Background = Brush(favouritesTab ? "SidebarSelected" : "#14243E");
            allTab.Click += delegate { favouritesTab = false; ApplyNavigation(); }; favTab.Click += delegate { favouritesTab = true; ApplyNavigation(); };
            navTabs.Children.Add(allTab); navTabs.Children.Add(favTab); DockPanel.SetDock(navTabs, horizontal ? Dock.Left : Dock.Top); navContent.Children.Add(navTabs);
            foreach (string name in folders) Find<Button>(name + "Nav").Visibility = !favouritesTab || preferences.FavouriteFolders.Contains(name) ? Visibility.Visible : Visibility.Collapsed;
            if (favouritesTab && preferences.FavouriteFolders.Count == 0) navigationButtons.Children.Add(new TextBlock { Text = "Add favourites in Settings", Foreground = Brushes.White, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(10), FontSize = 11 });
            var scroll = new ScrollViewer { Content = navigationButtons, VerticalScrollBarVisibility = horizontal ? ScrollBarVisibility.Disabled : ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = horizontal ? ScrollBarVisibility.Auto : ScrollBarVisibility.Disabled };
            navContent.Children.Add(scroll); layout.Children.Add(navContent);
            UpdateNavigationLabels();
            ApplySpotifyPlacement();
            Status("Navigation: " + preferences.NavigationEdge.ToLowerInvariant() + (compact ? " · compact ribbon" : ""));
        }
        private void UpdateNavigationLabels() {
            if (navigationButtons == null || store == null) return;
            for (int i = 0; i < folders.Length; i++) {
                int count = folders[i] == "Inbox" ? store.Messages.Count(m => m.Folder == "Inbox" && m.Unread) : folders[i] == "Drafts" ? store.Messages.Count(m => m.Folder == "Drafts") : 0;
                Find<Button>(folders[i] + "Nav").Content = icons[i] + (preferences.NavigationCollapsed ? "" : "   " + folders[i] + (count > 0 ? "  " + count : ""));
            }
        }
        private void ApplySpellCheck(TextBox input) {
            input.Language = XmlLanguage.GetLanguage(preferences.SpellLanguage);
            SpellCheck.SetIsEnabled(input, preferences.SpellCheckEnabled);
        }
        private bool IsOwnMessage(Message message) { return message.Address == "you@postbox.local" || message.Address == "you@tma-mail.local" || (!String.IsNullOrEmpty(preferences.EmailAddress) && String.Equals(message.Address, preferences.EmailAddress, StringComparison.OrdinalIgnoreCase)); }
        private void HideToTray() { tray.Visible = true; window.Hide(); }
        private void RestoreWindow() { window.Show(); window.WindowState = preferences.StartMaximized ? WindowState.Maximized : WindowState.Normal; tray.Visible = false; window.Activate(); }
        private void PlaySound(string choice, string file) {
            try {
                if (choice == "Custom WAV") { if (soundPlayer != null) soundPlayer.Dispose(); soundPlayer = new SoundPlayer(file); soundPlayer.Load(); soundPlayer.Play(); }
                else if (choice == "Notification") SystemSounds.Asterisk.Play();
                else if (choice == "Chime") SystemSounds.Beep.Play();
                else if (choice == "Exclamation") SystemSounds.Exclamation.Play();
            } catch (Exception ex) { Status("Sound could not be played: " + ex.Message); }
        }
        private void MailNotification(bool received, string subject) {
            PlaySound(received ? preferences.ReceiveSound : preferences.SendSound, received ? preferences.ReceiveWavePath : preferences.SendWavePath);
            if (received ? !preferences.NotifyReceived : !preferences.NotifySent) return;
            ShowNotification(received ? "New mail" : "Message sent", subject);
        }
        private void ShowNotification(string title, string message) {
            if (banners.Count >= 3) banners[0].Close();
            var notification = new Window { Title = "TMA-Mail notification", Width = 340, Height = 140, WindowStyle = WindowStyle.None, ResizeMode = ResizeMode.NoResize, ShowInTaskbar = false, ShowActivated = false, Topmost = true, Background = Theme.B("Surface"), FontFamily = new FontFamily("Segoe UI") };
            var panel = new StackPanel { Margin = new Thickness(20) }; notification.Content = panel;
            panel.Children.Add(Label("TMA-Mail  ·  " + title, 14, "Text"));
            var detail = Label(message, 12, "#B7C6DF"); detail.MaxHeight = 50; panel.Children.Add(detail);
            notification.MouseLeftButtonUp += delegate { RestoreWindow(); notification.Close(); };
            banners.Add(notification);
            var bounds = SystemParameters.WorkArea;
            notification.Left = bounds.Right - notification.Width - 18; notification.Top = bounds.Bottom - notification.Height - 18 - (banners.Count - 1) * 150;
            var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(6) }; timer.Tick += delegate { timer.Stop(); notification.Close(); };
            notification.Closed += delegate { timer.Stop(); banners.Remove(notification); };
            notification.Show(); timer.Start();
        }
        private static void SetWindowsStartup(bool enabled) {
            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")) {
                if (enabled) key.SetValue("TMA-Mail", "\"" + System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName + "\" --startup");
                else key.DeleteValue("TMA-Mail", false);
            }
        }
        private static StackPanel SettingsSection(string title, string description) {
            var panel = new StackPanel { Margin = new Thickness(26, 22, 26, 22) }; panel.Children.Add(Label(title, 24, "#17243B")); panel.Children.Add(Label(description, 12, "#79879D")); return panel;
        }
        private static void FieldLabel(StackPanel panel, string text) { var label = Label(text, 12, "#41516B"); label.FontWeight = FontWeights.SemiBold; label.Margin = new Thickness(0, 16, 0, 7); panel.Children.Add(label); }
        private static TextBox TextField(StackPanel panel, string label, string value, bool multiline) {
            FieldLabel(panel, label); var input = new TextBox { Text = value, Padding = new Thickness(10), FontSize = 14, BorderBrush = Brush("#DDE4EF"), AcceptsReturn = multiline, TextWrapping = multiline ? TextWrapping.Wrap : TextWrapping.NoWrap };
            if (multiline) { input.Height = 140; input.VerticalScrollBarVisibility = ScrollBarVisibility.Auto; }
            panel.Children.Add(input); return input;
        }
        private static CheckBox Toggle(StackPanel panel, string label, bool value) { var toggle = new CheckBox { Content = label, IsChecked = value, Margin = new Thickness(0, 12, 0, 4), FontSize = 13 }; panel.Children.Add(toggle); return toggle; }
        private static ComboBox Choice(StackPanel panel, string label, string value, string[] options) {
            FieldLabel(panel, label); var choice = new ComboBox { ItemsSource = options, SelectedItem = value, Padding = new Thickness(8), FontSize = 13, MinHeight = 34 }; panel.Children.Add(choice); return choice;
        }
        private static string Value(ComboBox combo) { return combo.SelectedItem as string; }
        private static void Tab(TabControl tabs, string title, StackPanel content) { tabs.Items.Add(new TabItem { Header = new TextBlock { Text = title, Margin = new Thickness(12, 14, 12, 14), Width = 130 }, Content = new ScrollViewer { Content = content, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled } }); }

        private void ShowSettings() {
            var previewSession = new SettingsPreview(settingsStore, preferences);
            var editing = settingsStore.Clone(preferences); editing.Normalize();
            bool committed = false;
            var dialog = Dialog("Settings · TMA-Mail", 900, 760); dialog.MinWidth = 780; dialog.MinHeight = 620;
            var layout = new Grid(); dialog.Content = layout;
            layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            var heading = new Border { Background = Theme.B("Surface"), Padding = new Thickness(26, 20, 26, 10) }; var headingText = Label("TMA-Mail  /  Settings", 23, "Text"); heading.Child = headingText; layout.Children.Add(heading);
            var tabs = new TabControl { TabStripPlacement = Dock.Left, BorderThickness = new Thickness(0), Background = Theme.B("Surface") }; Grid.SetRow(tabs, 1); layout.Children.Add(tabs);
            var profile = SettingsSection("Make it yours", "Set the name and signature used for messages you compose.");
            var name = TextField(profile, "Display name", preferences.DisplayName, false);
            var email = TextField(profile, "Email address (saved locally)", preferences.EmailAddress, false);
            if (activeAccount != null) { email.Text = activeAccount.Email; email.IsReadOnly = true; email.ToolTip = "Change connected accounts in Accounts."; }
            var signatureProfile = new SignatureProfile(profile, editing, dialog);
            var signNew = Toggle(profile, "Add signature to new messages", preferences.SignatureOnNew);
            var signReply = Toggle(profile, "Add signature to replies and forwards", preferences.SignatureOnReplies);
            profile.Children.Add(Label("Existing drafts keep their content. Your signature is inserted above quoted messages.", 11, "#8793A7")); Tab(tabs, "Profile & signature", profile);
            var appearance = SettingsSection("Your workspace", "Preview changes immediately. Save keeps them; Cancel restores your previous settings.");
            var mode = Choice(appearance, "Colour mode", preferences.AppearanceMode, new[] { "Dark", "Light" });
            var edge = Choice(appearance, "Navigation position", preferences.NavigationEdge, new[] { "Left", "Top", "Right", "Bottom" });
            var inboxEdge = Choice(appearance, "Inbox / message list position", preferences.InboxEdge, new[] { "Left", "Top", "Right", "Bottom" });
            var spotifyPlacement = Choice(appearance, "Spotify player position", preferences.SpotifyPlacement, new[] { "Off", "Top", "Bottom", "Sidebar" });
            appearance.Children.Add(Label("Uses the Spotify desktop session on this PC. Playback controls depend on what Spotify makes available to Windows. Expand a compact ribbon to see a sidebar player.", 11, "#8793A7"));
            var collapsed = Toggle(appearance, "Use a compact icon ribbon", preferences.NavigationCollapsed);
            appearance.Children.Add(Label("Use the ☰ button to collapse or expand the ribbon at any time. Hover an icon to see its folder name.", 12, "#8793A7"));
            var textSize = Choice(appearance, "Message and composing text size", preferences.TextSize.ToString(), new[] { "12", "13", "14", "15", "16", "18", "20" });
            FieldLabel(appearance, "Favourite folders");
            var favouriteChecks = new Dictionary<string, CheckBox>();
            foreach (string mailFolder in folders) favouriteChecks[mailFolder] = Toggle(appearance, mailFolder, preferences.FavouriteFolders.Contains(mailFolder));
            appearance.Children.Add(Label("Favourites appear in their own navigation tab. Right-click any folder to pin or unpin it.", 11, "#8793A7"));
            Tab(tabs, "Appearance", appearance);
            var startup = SettingsSection("Start your day", "Choose how TMA-Mail opens and behaves in the notification area.");
            var login = Toggle(startup, "Launch TMA-Mail when I sign in to Windows", preferences.LaunchWithWindows);
            var minimized = Toggle(startup, "Start minimized in the notification area", preferences.StartMinimized);
            var maximized = Toggle(startup, "Open the main window maximized", preferences.StartMaximized);
            var closeTray = Toggle(startup, "Keep running in the notification area when I close the window", preferences.CloseToTray);
            var startupFolder = Choice(startup, "Folder to open on startup", preferences.StartupFolder, new[] { "Inbox", "Starred", "Drafts", "Sent", "Archive" });
            startup.Children.Add(Label("Startup choices apply on the next launch. If minimized, double-click the tray icon to reopen. Choose Exit TMA-Mail from its menu to quit.", 12, "#8793A7")); Tab(tabs, "Startup", startup);
            var notifications = SettingsSection("Stay in the loop", "Banners and sounds work while the app is running. Live mail isn't connected yet.");
            var received = Toggle(notifications, "Show a desktop banner for incoming mail", preferences.NotifyReceived);
            var sent = Toggle(notifications, "Show a desktop banner for sent mail", preferences.NotifySent);
            string[] sounds = { "None", "Notification", "Chime", "Exclamation", "Custom WAV" };
            var receiveSound = Choice(notifications, "Incoming mail sound", preferences.ReceiveSound, sounds);
            var receivePath = SoundFileField(notifications, preferences.ReceiveWavePath);
            var receivePreview = Action("▶  Preview incoming sound", false); receivePreview.Margin = new Thickness(0, 8, 0, 4); receivePreview.HorizontalAlignment = HorizontalAlignment.Left; receivePreview.Click += delegate { PlaySound(Value(receiveSound), receivePath.Text); }; notifications.Children.Add(receivePreview);
            var sendSound = Choice(notifications, "Sending mail sound", preferences.SendSound, sounds);
            var sendPath = SoundFileField(notifications, preferences.SendWavePath);
            var sendPreview = Action("▶  Preview sending sound", false); sendPreview.Margin = new Thickness(0, 8, 0, 10); sendPreview.HorizontalAlignment = HorizontalAlignment.Left; sendPreview.Click += delegate { PlaySound(Value(sendSound), sendPath.Text); }; notifications.Children.Add(sendPreview);
            var testBanner = Action("Preview desktop banner", false); testBanner.HorizontalAlignment = HorizontalAlignment.Left; testBanner.Click += delegate { ShowNotification("Notification preview", "This is how your mail notifications will look."); }; notifications.Children.Add(testBanner);
            var demoReceive = Action(activeAccount == null ? "Receive a sample message" : "Test incoming notification", false); demoReceive.Margin = new Thickness(0, 12, 0, 12); demoReceive.HorizontalAlignment = HorizontalAlignment.Left;
            demoReceive.Click += delegate {
                if (activeAccount != null) { ShowNotification("Notification preview", "Your incoming mail notification is ready."); return; }
                var message = new Message { Id = Guid.NewGuid().ToString(), Sender = "TMA-Mail Demo", Address = "demo@example.com", To = "you@tma-mail.local", Subject = "Your notification test", Body = "This local sample message tests your saved incoming mail notification settings. No mail server was contacted.", Date = DateTime.Now, Folder = "Inbox", Unread = true };
                store.Messages.Add(message); store.Save(); Refresh(selected == null ? null : selected.Id); MailNotification(true, message.Subject); Status("Demo mail received · uses your saved notification preferences");
            }; notifications.Children.Add(demoReceive);
            notifications.Children.Add(Label("Sounds are independent of banners. Choose None for silence. The demo receive action uses the current preview choices.", 11, "#8793A7")); Tab(tabs, "Notifications", notifications);
            var writing = SettingsSection("A little help writing", "Built-in Windows spellchecking underlines misspelled words as you type.");
            var composeFont = Choice(writing, "Default composing font", preferences.ComposeFont, new[] { "Segoe UI", "Arial", "Calibri", "Georgia", "Consolas", "Times New Roman" });
            var composeSize = Choice(writing, "Default composing font size", preferences.ComposeFontSize.ToString(), new[] { "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "28", "36", "48" });
            var spell = Toggle(writing, "Check spelling in the subject and message body", preferences.SpellCheckEnabled);
            var language = Choice(writing, "Spelling language", preferences.SpellLanguage, new[] { "en-GB", "en-US", "fr-FR", "de-DE", "es-ES" });
            writing.Children.Add(Label("Right-click an underlined word for suggestions or Ignore All. Language support depends on the dictionaries installed in Windows. New composing windows use your saved choices.", 12, "#8793A7")); Tab(tabs, "Writing", writing);
            var footer = new Grid { Margin = new Thickness(24, 16, 24, 20) }; footer.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); footer.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto }); Grid.SetRow(footer, 2); layout.Children.Add(footer);
            var status = Label("Previewing live. Save keeps your changes; Cancel restores them.", 11, "#8793A7"); status.VerticalAlignment = VerticalAlignment.Center; footer.Children.Add(status);
            var actions = new StackPanel { Orientation = Orientation.Horizontal }; Grid.SetColumn(actions, 1); footer.Children.Add(actions);
            var cancel = Action("Cancel", false); var save = Action("Save changes", true); actions.Children.Add(cancel); actions.Children.Add(save); cancel.Click += delegate { dialog.Close(); };
            Func<Preferences> readControls = delegate {
                var updated = settingsStore.Clone(editing);
                updated.DisplayName = name.Text; updated.EmailAddress = email.Text.Trim(); signatureProfile.ReadInto(updated); updated.SignatureOnNew = signNew.IsChecked == true; updated.SignatureOnReplies = signReply.IsChecked == true;
                updated.AppearanceMode = Value(mode); updated.InboxEdge = Value(inboxEdge); updated.SpotifyPlacement = Value(spotifyPlacement); updated.FavouriteFolders = favouriteChecks.Where(entry => entry.Value.IsChecked == true).Select(entry => entry.Key).ToList();
                updated.ComposeFont = Value(composeFont); updated.ComposeFontSize = Int32.Parse(Value(composeSize));
                updated.NavigationEdge = Value(edge); updated.NavigationCollapsed = collapsed.IsChecked == true; updated.TextSize = Int32.Parse(Value(textSize));
                updated.LaunchWithWindows = login.IsChecked == true; updated.StartMinimized = minimized.IsChecked == true; updated.StartMaximized = maximized.IsChecked == true; updated.CloseToTray = closeTray.IsChecked == true; updated.StartupFolder = Value(startupFolder);
                updated.NotifyReceived = received.IsChecked == true; updated.NotifySent = sent.IsChecked == true; updated.ReceiveSound = Value(receiveSound); updated.SendSound = Value(sendSound); updated.ReceiveWavePath = receivePath.Text; updated.SendWavePath = sendPath.Text;
                updated.SpellCheckEnabled = spell.IsChecked == true; updated.SpellLanguage = Value(language); updated.Normalize();
                editing.DisplayName = updated.DisplayName; editing.ComposeFont = updated.ComposeFont; editing.ComposeFontSize = updated.ComposeFontSize; editing.SpellCheckEnabled = updated.SpellCheckEnabled; editing.SpellLanguage = updated.SpellLanguage;
                return updated;
            };
            Action updatePreview = delegate {
                if (signatureProfile.IsUpdating || committed) return;
                preferences = previewSession.Apply(readControls()); ApplyPreferences();
            };
            dialog.AddHandler(TextBox.TextChangedEvent, new TextChangedEventHandler(delegate { updatePreview(); }));
            dialog.AddHandler(System.Windows.Controls.Primitives.Selector.SelectionChangedEvent, new SelectionChangedEventHandler(delegate { updatePreview(); }));
            dialog.AddHandler(System.Windows.Controls.Primitives.ToggleButton.CheckedEvent, new RoutedEventHandler(delegate { updatePreview(); }));
            dialog.AddHandler(System.Windows.Controls.Primitives.ToggleButton.UncheckedEvent, new RoutedEventHandler(delegate { updatePreview(); }));
            signatureProfile.Changed += updatePreview;
            dialog.Closed += delegate { if (!committed) { preferences = previewSession.Revert(); ApplyPreferences(); Status("Settings preview cancelled · previous preferences restored"); } };
            save.Click += delegate {
                var updated = readControls();
                if (!String.IsNullOrWhiteSpace(updated.EmailAddress)) { try { updated.EmailAddress = WelcomeFlow.ValidateEmail(updated.EmailAddress); } catch (FormatException) { status.Text = "Enter a valid email address, or leave it empty for demo mode."; status.Foreground = Brush("#BC4343"); return; } }
                if ((updated.ReceiveSound == "Custom WAV" && !ValidWave(updated.ReceiveWavePath)) || (updated.SendSound == "Custom WAV" && !ValidWave(updated.SendWavePath))) { status.Text = "Select an existing, playable WAV file for each custom sound."; status.Foreground = Brush("#BC4343"); return; }
                bool startupChanged = updated.LaunchWithWindows != previewSession.Original.LaunchWithWindows;
                try {
                    if (startupChanged || updated.LaunchWithWindows) SetWindowsStartup(updated.LaunchWithWindows);
                    try { settingsStore.Save(updated); } catch { if (startupChanged) SetWindowsStartup(previewSession.Original.LaunchWithWindows); throw; }
                    preferences = updated; committed = true; ApplyPreferences(); dialog.Close(); Status("Settings saved · startup choices apply on next launch");
                } catch (Exception ex) { status.Text = "Could not save: " + ex.Message; status.Foreground = Brush("#BC4343"); }
            };
            dialog.ShowDialog();
        }
        private static bool ValidWave(string file) {
            try { if (!File.Exists(file) || !String.Equals(Path.GetExtension(file), ".wav", StringComparison.OrdinalIgnoreCase)) return false; using (var player = new SoundPlayer(file)) player.Load(); return true; } catch { return false; }
        }
        private static TextBox SoundFileField(StackPanel panel, string value) {
            var row = new DockPanel { Margin = new Thickness(0, 8, 0, 0) };
            var browse = Action("Browse WAV…", false); browse.Margin = new Thickness(8, 0, 0, 0); DockPanel.SetDock(browse, Dock.Right); row.Children.Add(browse);
            var path = new TextBox { Text = value, Padding = new Thickness(8), FontSize = 12, BorderBrush = Brush("#DDE4EF"), ToolTip = "Used when Custom WAV is selected" }; row.Children.Add(path);
            browse.Click += delegate { var picker = new OpenFileDialog { Filter = "WAV audio (*.wav)|*.wav", CheckFileExists = true, Title = "Choose a mail sound" }; if (picker.ShowDialog() == true) path.Text = picker.FileName; };
            panel.Children.Add(row); return path;
        }
    }
}
