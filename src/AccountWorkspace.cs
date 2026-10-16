using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Win32;

namespace Postbox {
    public sealed class ProfilePhotoEditor {
        public string Data { get; private set; }
        public event Action Changed;
        public ProfilePhotoEditor(Panel panel, Window owner, string data) {
            Data = data; var row = new WrapPanel { Margin = new Thickness(0, 12, 0, 18) }; panel.Children.Add(row);
            var choose = new Button { Content = "Choose profile photo", Margin = new Thickness(0, 0, 8, 0) }; row.Children.Add(choose);
            var remove = new Button { Content = "Remove photo" }; row.Children.Add(remove);
            choose.Click += delegate { try { var value = Choose(owner); if (value != null) { Data = value; if (Changed != null) Changed(); } } catch (Exception ex) { MessageBox.Show(owner, ex.Message, "Profile photo"); } };
            remove.Click += delegate { Data = null; if (Changed != null) Changed(); };
        }
        public static string Choose(Window owner) {
            var picker = new OpenFileDialog { Title = "Choose a profile photo", Filter = "Images|*.png;*.jpg;*.jpeg;*.bmp;*.gif" }; if (picker.ShowDialog(owner) != true) return null;
            if (new FileInfo(picker.FileName).Length > 5 * 1024 * 1024) throw new InvalidOperationException("Choose a photo smaller than 5 MB.");
            var image = new BitmapImage(); image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad; image.DecodePixelWidth = 256; image.UriSource = new Uri(picker.FileName); image.EndInit(); image.Freeze();
            using (var output = new MemoryStream()) { var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(image)); encoder.Save(output); return Convert.ToBase64String(output.ToArray()); }
        }
        public static FrameworkElement Avatar(Preferences preferences, double size) {
            Image photo = null;
            try { if (!String.IsNullOrEmpty(preferences.ProfilePhoto)) using (var stream = new MemoryStream(Convert.FromBase64String(preferences.ProfilePhoto))) { var image = new BitmapImage(); image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad; image.StreamSource = stream; image.EndInit(); image.Freeze(); photo = new Image { Source = image, Stretch = Stretch.UniformToFill, Width = size, Height = size, Clip = new EllipseGeometry(new Point(size / 2, size / 2), size / 2, size / 2) }; } } catch { }
            return photo != null ? (FrameworkElement)photo : new TextBlock { Text = String.IsNullOrEmpty(preferences.DisplayName) ? "?" : preferences.DisplayName.Substring(0, 1).ToUpperInvariant(), FontSize = size * 0.38, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center, Foreground = Theme.B("#5378B8") };
        }
    }
    public partial class App {
        private readonly Dictionary<string, bool> expandedMailboxes = new Dictionary<string, bool>();
        private readonly Dictionary<Button, string> customFolderButtons = new Dictionary<Button, string>();
        private FrameworkElement MailboxNavigation(bool horizontal, bool compact) {
            customFolderButtons.Clear();
            if (mailAccounts == null || mailAccounts.Count == 0) return navigationButtons;
            if (horizontal || compact) {
                var host = new StackPanel { Orientation = horizontal ? Orientation.Horizontal : Orientation.Vertical };
                foreach (var account in mailAccounts) {
                    var captured = account; var button = Action(compact ? "✉" : account.Email, false); button.ToolTip = account.Email; button.Foreground = System.Windows.Media.Brushes.White;
                    button.Click += delegate { var menu = new ContextMenu(); foreach (var item in MailboxFolders(captured)) { var target = item; var entry = new MenuItem { Header = item.Value }; entry.Click += delegate { SelectMailbox(captured, target.Key); }; menu.Items.Add(entry); } menu.PlacementTarget = button; menu.IsOpen = true; }; host.Children.Add(button);
                }
                host.Children.Add(navigationButtons); AddCustomFolders(navigationButtons, activeAccount); return host;
            }
            var groups = new StackPanel();
            foreach (var account in mailAccounts) {
                var captured = account; bool active = activeAccount != null && account.Id == activeAccount.Id;
                var group = new Expander { Header = new TextBlock { Text = account.Email, ToolTip = account.Email, TextTrimming = TextTrimming.CharacterEllipsis, MaxWidth = Math.Max(120, preferences.NavigationWidth - 40), FontWeight = FontWeights.SemiBold, FontSize = 12 }, Foreground = System.Windows.Media.Brushes.White, IsExpanded = expandedMailboxes.ContainsKey(account.Id) ? expandedMailboxes[account.Id] : active, Margin = new Thickness(4, 8, 4, 8) };
                group.Expanded += delegate { expandedMailboxes[captured.Id] = true; }; group.Collapsed += delegate { expandedMailboxes[captured.Id] = false; };
                if (active) { AddCustomFolders(navigationButtons, account); group.Content = navigationButtons; }
                else {
                    var entries = new StackPanel(); foreach (var item in MailboxFolders(account)) { var target = item; var button = FolderButton(item.Value, delegate { SelectMailbox(captured, target.Key); }); var serverFolder = (account.Folders ?? new List<ServerFolder>()).FirstOrDefault(f => f.LocalName == target.Key); if (serverFolder != null) StyleServerFolder(button, captured, serverFolder); entries.Children.Add(button); } group.Content = entries;
                }
                groups.Children.Add(group);
            }
            return groups;
        }
        private IEnumerable<KeyValuePair<string, string>> MailboxFolders(MailAccount account) {
            foreach (string name in folders) if (!favouritesTab || preferences.FavouriteFolders.Contains(name)) yield return new KeyValuePair<string, string>(name, name);
            foreach (var value in account.Folders ?? new List<ServerFolder>()) if (value.LocalName.StartsWith("Server:") && (!favouritesTab || preferences.FavouriteFolders.Contains(value.LocalName))) yield return new KeyValuePair<string, string>(value.LocalName, value.Name);
        }
        private Button FolderButton(string label, Action click) { var button = Action(label, false); button.HorizontalContentAlignment = HorizontalAlignment.Left; button.Foreground = Brush("#C5D4EC"); button.FontSize = 13; button.FontWeight = FontWeights.Normal; button.Background = System.Windows.Media.Brushes.Transparent; button.Margin = new Thickness(8, 3, 8, 3); button.Padding = new Thickness(10, 10, 10, 10); button.Click += delegate { click(); }; return button; }
        private void AddCustomFolders(Panel panel, MailAccount account) {
            if (account == null) return;
            foreach (var value in (account.Folders ?? new List<ServerFolder>()).Where(f => f.LocalName.StartsWith("Server:")).OrderBy(f => f.Path)) {
                if (favouritesTab && !preferences.FavouriteFolders.Contains(value.LocalName)) continue;
                var captured = value; var button = FolderButton("▱  " + value.Name + (value.Unread > 0 ? "  " + value.Unread : ""), delegate { folder = captured.LocalName; unreadOnly = false; Refresh(null); });
                button.IsEnabled = value.Selectable; button.ToolTip = value.Path; button.Margin = new Thickness(String.IsNullOrEmpty(value.ParentPath) ? 8 : 20, 3, 8, 3);
                StyleServerFolder(button, account, value);
                customFolderButtons[button] = value.LocalName; panel.Children.Add(button);
            }
        }
        private void UpdateCustomFolderSelection() { foreach (var value in customFolderButtons) value.Key.Background = value.Value == folder ? Theme.B("SidebarSelected") : System.Windows.Media.Brushes.Transparent; }
        private void ShowProfileMenu() {
            var menu = new ContextMenu { PlacementTarget = Find<Button>("AccountTop"), Placement = PlacementMode.Bottom, MinWidth = 270, Background = Theme.B("Surface"), Foreground = Theme.B("Text"), Padding = new Thickness(8), HasDropShadow = true };
            menu.Template = (ControlTemplate)System.Windows.Markup.XamlReader.Parse("<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' TargetType='ContextMenu'><Border CornerRadius='18' Background='{TemplateBinding Background}' Padding='8' BorderBrush='#555B68' BorderThickness='1'><ItemsPresenter/></Border></ControlTemplate>");
            var header = new StackPanel { Margin = new Thickness(10) }; header.Children.Add(new TextBlock { Text = preferences.DisplayName, FontSize = 17, FontWeight = FontWeights.SemiBold }); header.Children.Add(new TextBlock { Text = activeAccount == null ? "Explore mode" : activeAccount.Email, FontSize = 12, Foreground = Theme.B("Muted"), Margin = new Thickness(0, 6, 0, 0) });
            menu.Items.Add(new MenuItem { Header = header, IsHitTestVisible = false }); menu.Items.Add(new Separator());
            foreach (var choice in new[] { new[] { "Edit name", "Name" }, new[] { "Change signature", "Signature" }, new[] { "Add / change profile photo", "Photo" }, new[] { "Account settings", "Accounts" } }) { var section = choice[1]; var item = new MenuItem { Header = choice[0], Padding = new Thickness(12, 9, 12, 9) }; item.Click += delegate {
                if (section == "Photo") { try { var photo = ProfilePhotoEditor.Choose(window); if (photo != null) { var updated = settingsStore.Clone(preferences); updated.ProfilePhoto = photo; settingsStore.Save(updated); preferences = updated; ApplyPreferences(); } } catch (Exception ex) { MessageBox.Show(window, ex.Message, "Profile photo"); } }
                else ShowSettings(section);
            }; menu.Items.Add(item); }
            menu.IsOpen = true;
        }
        private StackPanel AccountsSettings(Window owner) {
            var section = SettingsSection("Email accounts", "Add mailboxes or choose the mailbox you want to view. Account connections take effect immediately.");
            var list = new StackPanel(); section.Children.Add(list);
            Action render = null; render = delegate {
                list.Children.Clear(); if (mailAccounts.Count == 0) list.Children.Add(Label("No mailboxes added yet.", 13, "Muted"));
                foreach (var account in mailAccounts.ToList()) {
                    var captured = account; var card = new StackPanel { Margin = new Thickness(0, 12, 0, 14) }; card.Children.Add(Label(account.Email, 16, "Text")); card.Children.Add(Label(account.Provider + (activeAccount != null && activeAccount.Id == account.Id ? " · selected mailbox" : ""), 12, "Muted"));
                    var row = new WrapPanel(); card.Children.Add(row);
                    var open = Action("Open mailbox", false); open.Click += delegate { SelectMailbox(captured, "Inbox"); render(); }; row.Children.Add(open);
                    var reconnect = Action("Reconnect", false); reconnect.Click += async delegate { var setup = new AccountSetupWindow(captured, ProviderConfiguration.Load(), ConnectAccount, delegate { RemoveMailAccount(captured.Id); }, captured.Provider) { Owner = owner }; setup.ShowDialog(); render(); if (setup.Connected) await SyncMail(); }; row.Children.Add(reconnect);
                    var remove = Action("Remove account", false); remove.Click += delegate { if (mailGate.CurrentCount == 0) { MessageBox.Show(owner, "Please wait for the current sync to finish.", "Accounts"); return; } if (MessageBox.Show(owner, "Disconnect " + captured.Email + "? Your encrypted local cache will remain on this PC.", "Remove account", MessageBoxButton.YesNo) == MessageBoxResult.Yes) { RemoveMailAccount(captured.Id); render(); } }; row.Children.Add(remove); list.Children.Add(card);
                }
            }; render();
            var add = Action("＋ Add email account", true); add.HorizontalAlignment = HorizontalAlignment.Left; add.Margin = new Thickness(0, 18, 0, 0);
            add.Click += async delegate { var setup = new AccountSetupWindow(null, ProviderConfiguration.Load(), ConnectAccount, delegate { }, null) { Owner = owner }; setup.ShowDialog(); render(); if (setup.Connected) await SyncMail(); }; section.Children.Add(add); return section;
        }
    }
}
