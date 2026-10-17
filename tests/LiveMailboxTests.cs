using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Postbox;

class LiveMailboxTests {
    static int checks;
    static void Check(bool value, string name) { if (!value) throw new Exception(name); checks++; }
    static object Get(object value, string name) { return value.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic).GetValue(value); }
    static object Call(object value, string name, params object[] args) { return value.GetType().GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic).Invoke(value, args); }
    static IEnumerable<T> Children<T>(DependencyObject parent) where T : DependencyObject { foreach (var value in LogicalTreeHelper.GetChildren(parent)) { var child = value as DependencyObject; if (child == null) continue; if (child is T) yield return (T)child; foreach (var nested in Children<T>(child)) yield return nested; } }
    [STAThread] static void Main(string[] args) {
        string directory = args[1]; Directory.CreateDirectory(directory);
        var first = ProviderChoices.Account("iCloud"); first.Email = "one@example.com"; first.Password = "synthetic-only"; first.Validate();
        var second = ProviderChoices.Account("Gmail"); second.Email = "two@example.com"; second.Password = "synthetic-only"; second.Validate();
        string customKey = Postbox.MailTransport.FolderKey("Projects/Design & notes");
        second.Folders = new List<ServerFolder> { new ServerFolder { Name = "Design & notes", Path = "Projects/Design & notes", ParentPath = "Projects", LocalName = customKey, Selectable = true, Count = 1, Unread = 1 } };
        ProtectedFile.Write(Path.Combine(directory, "account.protected"), new JavaScriptSerializer().Serialize(first));
        var accounts = new AccountStore(directory); Check(accounts.LoadAll().Count == 1 && accounts.Load().Id == first.Id, "Legacy account did not migrate");
        accounts.Save(second, true); Check(accounts.LoadAll().Count == 2 && accounts.Load().Id == second.Id, "Adding an account replaced the old mailbox");
        var storedFirst = accounts.LoadAll().First(a => a.Id == first.Id); accounts.SaveTokens(storedFirst);
        Check(accounts.Load().Id == second.Id, "Background token save changed the selected mailbox");
        Check(accounts.LoadAll()[0].Id == first.Id, "Token save reordered mailboxes");
        var replacement = new MailAccount { Id = first.Id, Email = first.Email, Password = "updated-synthetic-password" }; accounts.Save(replacement);
        storedFirst.Password = "stale-password"; accounts.SaveTokens(storedFirst);
        Check(new AccountStore(directory).LoadAll().First(a => a.Id == first.Id).Password == "updated-synthetic-password", "A stale watcher overwrote a reconnected account");
        accounts.Activate(first.Id); Check(new AccountStore(directory).Load().Id == first.Id, "Mailbox selection did not persist"); accounts.Activate(second.Id);
        Check(Uri.UnescapeDataString(customKey.Substring(7)) == "Projects/Design & notes", "Custom folder key lost its server path");
        var cache1 = new MailStore(Path.Combine(directory, "mail-" + first.Id + ".protected"), true, false);
        cache1.Messages.Add(new Message { Id = "one", AccountId = first.Id, Folder = "Inbox", Subject = "First mailbox only", Body = "Synthetic" }); cache1.Save();
        var cache2 = new MailStore(Path.Combine(directory, "mail-" + second.Id + ".protected"), true, false);
        cache2.Messages.Add(new Message { Id = "two", AccountId = second.Id, Folder = customKey, Subject = "Custom folder", Body = "Synthetic" }); cache2.Save();
        // These harnesses initialize WPF without Application.Run; use its UI context explicitly.
        System.Threading.SynchronizationContext.SetSynchronizationContext(new System.Windows.Threading.DispatcherSynchronizationContext(System.Windows.Threading.Dispatcher.CurrentDispatcher));
        var app = new App(); Call(app, "Initialize"); var window = (Window)Get(app, "window");
        Check(((MailAccount)Get(app, "activeAccount")).Id == second.Id, "Wrong active account on startup");
        Check(Children<Expander>(window).Count(e => e.Header is TextBlock && ((TextBlock)e.Header).Text.Contains("@example.com")) == 2, "Mailbox group headers missing");
        var settings = (Button)Get(app, "settingsButton"); Check(settings.Content.ToString().Contains("Settings") && settings.Parent != null, "Bottom navigation does not show Settings");
        Check(((Button)window.FindName("AccountsButton")).Parent == null, "Obsolete account-settings footer still visible");
        Call(app, "SelectMailbox", second, customKey); Check(((Postbox.MailStore)Get(app, "store")).Query(customKey, "", false).Single().Id == "two", "Custom folder selection did not show its own mail");
        Call(app, "SelectMailbox", replacement, "Inbox"); Check(((Postbox.MailStore)Get(app, "store")).Messages.Single().Id == "one", "Mailbox switch mixed account caches");
        Check(((TextBlock)window.FindName("FolderHeading")).Text == "Inbox", "Mailbox switch retained a custom folder heading");
        Call(app, "Status", "Draft saved"); Check(((TextBlock)window.FindName("StatusText")).Text.StartsWith(replacement.Email + " · "), "Footer lost the connected mailbox name");
        var removedSend = (System.Threading.Tasks.Task<string>)Call(app, "SendMail", new Message(), new MailAccount { Id = "removed", Email = "removed@example.com" });
        Check(removedSend.IsFaulted, "Sending with a removed composing account was allowed");
        var remoteDraft = new Message { Id = "remote-draft", Folder = "Drafts", RemoteUid = 42, Subject = "Server draft", Body = "Original" }; cache1.Messages.Add(remoteDraft);
        var composer = new ComposerWindow(new Preferences(), cache1, remoteDraft, "", null); var localDraft = (Message)Call(composer, "SaveMessage", false);
        Check(localDraft.Id != remoteDraft.Id && localDraft.RemoteUid == 0 && cache1.Messages.Contains(remoteDraft), "Editing a server draft replaced its original cache entry"); composer.Close();
        var lamp = (System.Windows.Shapes.Ellipse)window.FindName("ConnectionLamp"); Check(((SolidColorBrush)lamp.Fill).Color == (Color)ColorConverter.ConvertFromString("#FF3B4D"), "Disconnected status was falsely green");
        var html = HtmlMessageView.PrepareHtml(new Message { HtmlBody = "<table><tr><td><b>Rich text</b><img src=\"cid:logo\"></td></tr></table><script>alert('x')</script>", InlineImages = new List<InlineMailImage> { new InlineMailImage { ContentId = "logo", MimeType = "image/png", Data = "AQID" } } });
        Check(html.Contains("<table") && html.Contains("<b>Rich text</b>") && html.Contains("data:image/png;base64,AQID"), "HTML formatting or inline graphics lost");
        Check(html.Contains("script-src 'none'") && html.Contains("form-action 'none'") && html.Contains("default-src 'none'"), "Reader content security policy missing");
        Check(!HtmlMessageView.AllowResource("https://example.com/pixel.png", true, false), "Remote images loaded before user consent");
        Check(HtmlMessageView.AllowResource("https://example.com/picture.png", true, true), "Approved external picture blocked");
        Check(!HtmlMessageView.AllowResource("file:///c:/private.txt", true, true) && !HtmlMessageView.AllowResource("https://example.com/script.js", false, true), "Reader allows local files or active resource requests");
        var preferences = new Preferences { ProfilePhoto = "AQID", FavouriteFolders = new List<string> { customKey } }; preferences.Normalize();
        var settingsStore = new SettingsStore(Path.Combine(directory, "photo-settings.json")); settingsStore.Save(preferences);
        Check(settingsStore.Load().ProfilePhoto == "AQID" && settingsStore.Load().FavouriteFolders.Contains(customKey), "Profile photo or custom favourite did not persist");
        var preview = new SettingsPreview(settingsStore, preferences); var edit = settingsStore.Clone(preferences); edit.ProfilePhoto = "BAUG"; preview.Apply(edit); Check(preview.Revert().ProfilePhoto == "AQID", "Cancel did not restore the profile photo");
        var panel = (StackPanel)Call(app, "AccountsSettings", window); Check(Children<TextBlock>(panel).Count(t => t.Text.EndsWith("@example.com")) == 2 && Children<Button>(panel).Any(b => b.Content.ToString().Contains("Add email account")), "Settings account list or add button missing");
        var prefs = (Preferences)Get(app, "preferences");
        Check(prefs.AutoLoadImages, "Email pictures do not load automatically by default");
        var imagePreview = new SettingsPreview(settingsStore, prefs); var changed = settingsStore.Clone(prefs); changed.AutoLoadImages = false; imagePreview.Apply(changed); Check(imagePreview.Revert().AutoLoadImages, "Cancel did not restore image loading policy");
        var messagePreview = new Message { Body = "To view this content open the following URL in your browser", HtmlBody = "<p>Actual newsletter headline</p>" }; Check(messagePreview.Preview.Contains("Actual newsletter headline") && !messagePreview.Preview.Contains("following URL"), "Preview prefers browser-link boilerplate over HTML content");
        prefs.NavigationEdge = "Left"; prefs.NavigationCollapsed = false; Call(app, "ApplyPreferences");
        var navGrip = (System.Windows.Controls.Primitives.Thumb)Get(app, "navigationResizer"); double oldWidth = prefs.NavigationWidth;
        navGrip.RaiseEvent(new System.Windows.Controls.Primitives.DragDeltaEventArgs(70, 0) { RoutedEvent = System.Windows.Controls.Primitives.Thumb.DragDeltaEvent });
        navGrip.RaiseEvent(new System.Windows.Controls.Primitives.DragCompletedEventArgs(70, 0, false) { RoutedEvent = System.Windows.Controls.Primitives.Thumb.DragCompletedEvent });
        Check(prefs.NavigationWidth > oldWidth && ((Border)Get(app, "navigation")).Width == prefs.NavigationWidth, "Folder pane drag did not resize");
        var actualSettings = new SettingsStore(Path.Combine(directory, "settings.json")); Check(Math.Abs(actualSettings.Load().NavigationWidth - prefs.NavigationWidth) < 1, "Pane width was not saved");
        foreach (string edge in new[] { "Left", "Right", "Top", "Bottom" }) {
            prefs.InboxEdge = edge; prefs.InboxWidth = 530; prefs.InboxHeight = 340; Call(app, "ApplyPreferences");
            var root = (FrameworkElement)window.Content; root.Measure(new Size(1400, 850)); root.Arrange(new Rect(0, 0, 1400, 850)); root.UpdateLayout();
            var grip = (GridSplitter)Get(app, "inboxSplitter"); var area = (Grid)Get(app, "mailArea");
            bool horizontal = edge == "Top" || edge == "Bottom"; int index = edge == "Right" || edge == "Bottom" ? 1 : 0;
            Check(grip.Parent == area && (horizontal ? area.RowDefinitions[index].ActualHeight >= 330 : area.ColumnDefinitions[index].ActualWidth >= 500), "Expanded inbox layout or divider missing: " + edge);
        }
        var appSecond = ((List<MailAccount>)Get(app, "mailAccounts")).First(a => a.Id == second.Id); Call(app, "SelectMailbox", appSecond, customKey);
        var folderButton = Children<Button>(window).First(b => b.Content != null && b.Content.ToString().Contains("Design & notes"));
        Check(folderButton.FontWeight == FontWeights.Normal && ((SolidColorBrush)folderButton.Foreground).Color == ((SolidColorBrush)Theme.B("#C5D4EC")).Color, "Imported folder typography differs from sidebar");
        Check(folderButton.ContextMenu.Items.OfType<MenuItem>().Any(m => m.Header.ToString() == "Mark all as read") && folderButton.ContextMenu.Items.OfType<MenuItem>().Any(m => m.Header.ToString() == "Delete folder…"), "Folder server action menu missing");
        prefs.FolderAppearances[App.FolderAppearanceKey(second.Id, "Projects/Design & notes")] = new FolderAppearance { Icon = "★", Colour = "#75D49B" }; actualSettings.Save(prefs); Call(app, "ApplyNavigation");
        folderButton = Children<Button>(window).First(b => b.Content != null && b.Content.ToString().Contains("Design & notes"));
        Check(folderButton.Content.ToString().StartsWith("★") && ((SolidColorBrush)folderButton.Foreground).Color == (Color)ColorConverter.ConvertFromString("#75D49B") && actualSettings.Load().FolderAppearances.Count == 1, "Folder appearance did not apply and persist");
        Check(App.FolderAppearanceKey(first.Id, "same") != App.FolderAppearanceKey(second.Id, "same"), "Folder appearance leaked between mailboxes");
        prefs.NavigationCollapsed = true; Call(app, "ApplyPreferences");
        var compactRoot = (FrameworkElement)window.Content; compactRoot.Measure(new Size(984, 760)); compactRoot.Arrange(new Rect(0, 0, 984, 760)); compactRoot.UpdateLayout();
        Check(Math.Abs(((Border)Get(app, "navigation")).ActualWidth - 88) < 1, "Compact sidebar does not have sufficient width");
        var inboxIcon = (Button)window.FindName("InboxNav"); Check(inboxIcon.ActualWidth >= 44 && inboxIcon.ActualHeight >= 44 && inboxIcon.Content.ToString() == "▣", "Compact folder icon is clipped or too small");
        Check(Children<Button>(window).Any(b => b.Content != null && b.Content.ToString() == "★" && b.ToolTip != null && b.ToolTip.ToString().Contains("Design & notes")), "Compact custom folder lost its icon or folder tooltip");
        window.Close(); app.Shutdown();
        accounts.Remove(first.Id); Check(accounts.LoadAll().Count == 1 && accounts.Load().Id == second.Id, "Removing one account removed another mailbox");
        Console.WriteLine("Passed " + checks + " live-mail workspace checks. Synthetic data only; no server contacted.");
    }
}
