using System;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;

namespace Postbox {
    public partial class App : Application {
        private Window window;
        private MailStore store;
        private string folder = "Inbox";
        private bool unreadOnly;
        private bool refreshing;
        private Message selected;

        [STAThread] public static void Main() {
            var app = new App();
            app.DispatcherUnhandledException += delegate(object sender, System.Windows.Threading.DispatcherUnhandledExceptionEventArgs e) {
                MessageBox.Show("TMA-Mail could not complete that action.\n\n" + e.Exception.Message, "TMA-Mail", MessageBoxButton.OK, MessageBoxImage.Error);
                e.Handled = true;
            };
            try { app.ShutdownMode = ShutdownMode.OnExplicitShutdown; app.Startup += app.StartDesktop; app.Run(); }
            catch (Exception ex) { MessageBox.Show("TMA-Mail could not start.\n\n" + ex.Message, "TMA-Mail", MessageBoxButton.OK, MessageBoxImage.Error); }
        }
        private T Find<T>(string name) where T : FrameworkElement { return (T)window.FindName(name); }
        private void Initialize() {
            using (var stream = File.OpenRead(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "MainWindow.xaml"))) window = (Window)XamlReader.Load(stream);
            InitializePreferences();
            InitializeConnection(); store = CurrentMailbox();
            folder = preferences.StartupFolder;
            Theme.SetMode(preferences.AppearanceMode); Theme.Install(window);
            InitializeWorkspace();
            InitializeMailboxFeatures(); InitializeHtmlReader(); InitializeSuiteUi(); InitializeInboxTools();
            foreach (string name in new[] { "Inbox", "Starred", "Drafts", "Sent", "Archive", "Trash" }) {
                Find<Button>(name + "Nav").Click += delegate(object sender, RoutedEventArgs e) {
                    ShowMailView(); folder = (string)((Button)sender).Tag;
                    unreadOnly = false;
                    refreshing = true; Find<TextBox>("SearchBox").Text = ""; refreshing = false;
                    selected = null; Refresh(null);
                };
            }
            Find<TextBox>("SearchBox").TextChanged += delegate { if (!refreshing) Refresh(selected == null ? null : selected.Id); };
            Find<ListBox>("MessageList").SelectionChanged += delegate {
                if (refreshing) return;
                selected = Find<ListBox>("MessageList").SelectedItem as Message;
                if (preferences.AutoMarkRead && selected != null && selected.Unread && SelectedMessages().Count == 1) {
                    SetUnreadLocal(selected, false); SaveMailboxInBackground(store); SaveServerFlags(selected);
                    // Preserve the current view while reading; explicit filtering refreshes it.
                    refreshing = true; Find<ListBox>("MessageList").Items.Refresh(); refreshing = false;
                    UpdateCounts();
                }
                RenderReader();
            };
            Find<ListBox>("MessageList").MouseDoubleClick += delegate { if (selected != null && selected.Folder == "Drafts") Compose(selected, ""); };
            Find<ListBox>("MessageList").PreviewMouseLeftButtonUp += delegate(object sender, MouseButtonEventArgs e) {
                var list = (ListBox)sender;
                if (!preferences.AutoMarkRead || selected == null || !selected.Unread || SelectedMessages().Count != 1 || ItemsControl.ContainerFromElement(list, e.OriginalSource as DependencyObject) == null) return;
                SetUnreadLocal(selected, false); SaveMailboxInBackground(store); SaveServerFlags(selected);
                refreshing = true; try { list.Items.Refresh(); } finally { refreshing = false; } UpdateCounts(); RenderReader();
            };
            Find<Button>("AllFilter").Click += delegate { unreadOnly = false; Refresh(null); };
            Find<Button>("UnreadFilter").Click += delegate { unreadOnly = true; Refresh(null); };
            Find<Button>("ComposeButton").Click += delegate { if (CalendarVisible) ShowAddCalendarEvent(); else Compose(null, ""); };
            Find<Button>("ArchiveButton").Click += delegate { MoveSelected("Archive"); };
            Find<Button>("DeleteButton").Click += delegate { MoveSelected(folder == "Trash" ? "Inbox" : "Trash"); };
            Find<Button>("StarButton").Click += delegate {
                ToggleSelectedStars();
            };
            Find<Button>("ReadButton").Click += delegate {
                ToggleSelectedRead();
            };
            Find<Button>("ReplyButton").Click += delegate { if (selected != null) Compose(selected.Folder == "Drafts" ? selected : null, selected.Folder == "Drafts" ? "" : "reply"); };
            Find<Button>("ForwardButton").Click += delegate { if (selected != null) Compose(null, "forward"); };
            Find<Button>("AccountsButton").Click += delegate { ShowSettings(); };
            Find<Button>("AccountTop").Click += delegate { ShowProfileMenu(); };
            window.PreviewKeyDown += delegate(object sender, KeyEventArgs e) {
                if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.N) { Compose(null, ""); e.Handled = true; }
                else if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.F) { Find<TextBox>("SearchBox").Focus(); e.Handled = true; }
                else if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.Z && !(Keyboard.FocusedElement is System.Windows.Controls.Primitives.TextBoxBase)) { UndoMove(); e.Handled = true; }
                else if (e.Key == Key.Delete && !(Keyboard.FocusedElement is System.Windows.Controls.Primitives.TextBoxBase)) { MoveSelected(folder == "Trash" ? "Inbox" : "Trash"); e.Handled = true; }
                else if (e.Key == Key.Escape) Find<TextBox>("SearchBox").Clear();
            };
            ApplyPreferences();
            Refresh(null);
            if (store.LoadWarning != null) window.Loaded += delegate { MessageBox.Show(window, store.LoadWarning, "Mailbox recovered"); };
        }
        private void UpdateCounts() {
            Find<TextBlock>("InboxCount").Text = store.Messages.Count(m => m.Folder == "Inbox" && m.Unread).ToString();
            int drafts = store.Messages.Count(m => m.Folder == "Drafts");
            Find<TextBlock>("DraftCount").Text = drafts == 0 ? "" : drafts.ToString();
            UpdateNavigationLabels();
        }
        private void Refresh(string keepId) {
            refreshing = true;
            try {
                var messages = FilterInbox(store.Query(folder, Find<TextBox>("SearchBox").Text, unreadOnly), preferencesInboxFilter, oldestFirst).ToList();
                var list = Find<ListBox>("MessageList");
                var keepSelection = keepId == null ? new string[0] : list.SelectedItems.Cast<Message>().Select(m => m.Id).ToArray();
                list.ItemsSource = messages;
                selected = messages.FirstOrDefault(m => m.Id == keepId) ?? messages.FirstOrDefault();
                list.SelectedItem = selected;
                foreach (var item in messages.Where(m => keepSelection.Contains(m.Id))) if (!list.SelectedItems.Contains(item)) list.SelectedItems.Add(item);
                Find<TextBlock>("FolderHeading").Text = FolderDisplayName(folder);
                Find<TextBlock>("FolderCount").Text = messages.Count + (messages.Count == 1 ? " message" : " messages");
                var serverFolder = activeAccount == null || activeAccount.Folders == null ? null : activeAccount.Folders.FirstOrDefault(f => f.LocalName == folder);
                if (serverFolder != null && serverFolder.Count > messages.Count) Find<TextBlock>("FolderCount").Text = messages.Count + " of " + serverFolder.Count + " messages cached";
                Find<TextBlock>("FolderSubtitle").Text = folder == "Inbox" ? "A fresh perspective on your day." : folder == "Drafts" ? "Pick up where you left off." : folder == "Sent" ? "Messages you have sent." : folder == "Trash" ? "Deleted messages can be restored." : folder == "Starred" ? "The conversations worth keeping close." : "A little order, a little more space.";
                Find<StackPanel>("EmptyList").Visibility = messages.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
                foreach (string name in new[] { "Inbox", "Starred", "Drafts", "Sent", "Archive", "Trash" }) {
                    var button = Find<Button>(name + "Nav");
                    button.Background = Brush(name == folder ? "SidebarSelected" : "#14243E");
                    button.Foreground = Brush(name == folder ? "#FFFFFF" : "#C5D4EC");
                }
                Find<Button>("AllFilter").Background = Brush(unreadOnly ? "Surface" : "#EDF3FF");
                Find<Button>("UnreadFilter").Background = Brush(unreadOnly ? "#EDF3FF" : "Surface");
                UpdateCounts(); RenderReader();
            } finally { refreshing = false; }
        }
        private void RenderReader() {
            Find<StackPanel>("Reader").Visibility = selected == null ? Visibility.Collapsed : Visibility.Visible;
            Find<StackPanel>("EmptyReader").Visibility = selected == null ? Visibility.Visible : Visibility.Collapsed;
            foreach (string name in new[] { "ArchiveButton", "DeleteButton", "ReadButton", "StarButton" }) Find<Button>(name).IsEnabled = selected != null;
            Find<Button>("DeleteButton").Content = folder == "Trash" ? "↶  Restore" : "♧  Delete";
            Find<Button>("DeleteButton").ToolTip = folder == "Trash" ? "Restore to Inbox" : "Move to Trash (Delete)";
            moveButton.IsEnabled = selected != null;
            if (selected == null) { if (htmlReader != null) htmlReader.Visibility = Visibility.Collapsed; return; }
            if (RenderMultipleSelection()) return;
            RenderRichMessage(selected);
            Find<Button>("ArchiveButton").IsEnabled = selected.Folder != "Archive" && selected.Folder != "Drafts";
            Find<TextBlock>("SubjectText").Text = selected.Subject;
            Find<TextBlock>("SenderInitials").Text = selected.Initials;
            Find<TextBlock>("SenderText").Text = selected.Sender;
            Find<TextBlock>("AddressText").Text = selected.Address + "\nTo: " + selected.To;
            Find<TextBlock>("DateText").Text = selected.Date.ToString("dddd, dd MMMM yyyy · HH:mm");
            Find<TextBox>("BodyText").Text = selected.Body;
            Find<Button>("StarButton").Content = "☆ Toggle Star";
            Find<Button>("StarButton").Foreground = Brushes.White;
            Find<Button>("ReadButton").Content = selected.Unread ? "Mark Read" : "Mark Unread";
            Find<Button>("ReplyButton").Content = selected.Folder == "Drafts" ? "✎   Edit draft" : "↶   Reply";
        }
        private void Status(string text) {
            if (activeAccount != null && !offlinePreview && !mailAccounts.Any(a => text.StartsWith(a.Email + " · ", StringComparison.OrdinalIgnoreCase))) text = activeAccount.Email + " · " + text;
            Find<TextBlock>("StatusText").Text = text; Find<TextBlock>("StatusText").ToolTip = text;
        }
        private static Brush Brush(string color) { return Theme.B(color); }
        private void SetUnreadLocal(Message message, bool unread) {
            if (message.Unread == unread) return;
            int delta = unread ? 1 : -1; message.Unread = unread;
            var account = mailAccounts.FirstOrDefault(a => a.Id == message.AccountId) ?? activeAccount;
            var metadata = account == null || account.Folders == null ? null : account.Folders.FirstOrDefault(f => f.Path == message.RemoteFolder || f.LocalName == message.Folder);
            if (metadata != null) metadata.Unread = Math.Max(0, Math.Min(metadata.Count, metadata.Unread + delta));
        }
        private Window Dialog(string title, double width, double height) {
            var dialog = new Window { Owner = window, Title = title, Width = width, Height = height, MinWidth = width, MinHeight = height, WindowStartupLocation = WindowStartupLocation.CenterOwner, Background = Brush("#FFFFFF"), FontFamily = new FontFamily("Segoe UI"), Foreground = Brush("#17243B"), ShowInTaskbar = false }; Theme.Install(dialog); return dialog;
        }
        private static TextBlock Label(string text, double size, string color) { return new TextBlock { Text = text, FontSize = size, Foreground = Brush(color), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 12) }; }
        private static Button Action(string text, bool primary) {
            var button = new Button { Content = text, Background = Brush(primary ? "SidebarAccent" : "SidebarSelected"), Foreground = Brush("#FFFFFF"), BorderThickness = new Thickness(0), Padding = new Thickness(18, 10, 18, 10), Margin = new Thickness(0, 0, 10, 0), Cursor = Cursors.Hand };
            button.Loaded += delegate { var owner = Window.GetWindow(button); if (owner != null && owner.Title.Contains("Settings")) UiPolish.SettingsButton(button); }; return button;
        }
        private void Compose(Message draft, string mode) {
            var composingAccount = activeAccount;
            var composer = new ComposerWindow(settingsStore.Clone(preferences), store, draft, mode, selected);
            composer.Owner = window; if (composingAccount != null) composer.Deliver = message => SendMail(message, composingAccount);
            composer.Saved += delegate(bool sent, string subject) { Refresh(selected == null ? null : selected.Id); Status(sent ? "Message accepted by your mail server" : "Draft saved on this PC"); if (sent) MailNotification(false, subject, composer.RecipientAddresses); };
            composer.ShowDialog();
        }
        private void ShowAccounts() { ShowConnectedAccounts(); }
    }
}
