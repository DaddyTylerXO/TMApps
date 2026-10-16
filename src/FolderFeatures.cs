using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace Postbox {
    public partial class App {
        public static string FolderAppearanceKey(string accountId, string path) { return accountId + ":" + path; }
        private void StyleServerFolder(Button button, MailAccount account, ServerFolder value) {
            FolderAppearance look; preferences.FolderAppearances.TryGetValue(FolderAppearanceKey(account.Id, value.Path), out look);
            string icon = look == null || String.IsNullOrWhiteSpace(look.Icon) ? "▱" : look.Icon;
            button.Content = icon + "   " + value.Name + (value.Unread > 0 ? "  " + value.Unread : "");
            button.FontSize = 13; button.FontWeight = FontWeights.Normal; button.Foreground = Brush("#C5D4EC");
            if (look != null && !String.IsNullOrEmpty(look.Colour)) { try { button.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString(look.Colour)); } catch (FormatException) { } }
            button.ToolTip = value.Path;
            var menu = new ContextMenu { Background = Brush("Surface"), Foreground = Brush("Text"), Padding = new Thickness(6) };
            menu.Template = (ControlTemplate)System.Windows.Markup.XamlReader.Parse("<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' TargetType='ContextMenu'><Border Background='{TemplateBinding Background}' BorderBrush='#555B68' BorderThickness='1' CornerRadius='14' Padding='6'><ItemsPresenter/></Border></ControlTemplate>");
            var read = new MenuItem { Header = "Mark all as read", IsEnabled = value.Selectable }; read.Click += async delegate { await UpdateServerFolder(account, value, false); }; menu.Items.Add(read);
            var appearance = new MenuItem { Header = "Change folder appearance…" }; appearance.Click += delegate { EditFolderAppearance(account, value); }; menu.Items.Add(appearance);
            var favourite = new MenuItem { Header = preferences.FavouriteFolders.Contains(value.LocalName) ? "Remove from favourites" : "Add to favourites" };
            favourite.Click += delegate { if (preferences.FavouriteFolders.Contains(value.LocalName)) preferences.FavouriteFolders.Remove(value.LocalName); else preferences.FavouriteFolders.Add(value.LocalName); SavePaneSizes(); ApplyNavigation(); }; menu.Items.Add(favourite);
            menu.Items.Add(new Separator()); var delete = new MenuItem { Header = "Delete folder…" }; delete.Click += async delegate { await UpdateServerFolder(account, value, true); }; menu.Items.Add(delete);
            foreach (var item in menu.Items.OfType<MenuItem>()) {
                item.Foreground = Brush("Text"); item.Background = Brush("Surface"); item.Padding = new Thickness(12, 8, 12, 8);
                item.Template = (ControlTemplate)System.Windows.Markup.XamlReader.Parse("<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' TargetType='MenuItem'><Border x:Name='b' CornerRadius='9' Background='{TemplateBinding Background}' Padding='{TemplateBinding Padding}'><ContentPresenter ContentSource='Header'/></Border><ControlTemplate.Triggers><Trigger Property='IsHighlighted' Value='True'><Setter TargetName='b' Property='Background' Value='#35415B'/></Trigger><Trigger Property='IsEnabled' Value='False'><Setter TargetName='b' Property='Opacity' Value='0.4'/></Trigger></ControlTemplate.Triggers></ControlTemplate>");
            }
            button.ContextMenu = menu;
        }
        private async Task UpdateServerFolder(MailAccount account, ServerFolder value, bool delete) {
            if (offlinePreview) { Status("Folder server actions are unavailable in offline preview."); return; }
            if (delete && MessageBox.Show(window, "Permanently delete \"" + value.Name + "\" from " + account.Email + " and all messages inside it? This affects the server and other mail apps. Folders with subfolders must be emptied of subfolders first.", "Delete server folder", MessageBoxButton.YesNo, MessageBoxImage.Warning, MessageBoxResult.No) != MessageBoxResult.Yes) return;
            Status((delete ? "Deleting " : "Marking all messages read in ") + value.Name + "…");
            await mailGate.WaitAsync();
            try {
                if (!mailAccounts.Any(a => Object.ReferenceEquals(a, account))) throw new InvalidOperationException("This account has changed. Open the folder again.");
                var service = new MailTransport(account, accountStore);
                await Task.Run(delegate { if (delete) service.DeleteFolder(value.Path); else service.MarkFolderRead(value.Path); });
                var mailbox = activeAccount != null && activeAccount.Id == account.Id ? store : new MailStore(Path.Combine(dataDirectory, "mail-" + account.Id + ".protected"), true, false);
                if (delete) {
                    mailbox.Messages.RemoveAll(m => m.RemoteFolder == value.Path); account.Folders.RemoveAll(f => f.Path == value.Path); accountStore.Save(account);
                    preferences.FolderAppearances.Remove(FolderAppearanceKey(account.Id, value.Path)); SavePaneSizes();
                    if (activeAccount != null && activeAccount.Id == account.Id && folder == value.LocalName) folder = "Inbox";
                } else { foreach (var message in mailbox.Messages.Where(m => m.RemoteFolder == value.Path)) message.Unread = false; value.Unread = 0; accountStore.Save(account); }
                mailbox.Save(); ApplyNavigation(); Refresh(selected == null ? null : selected.Id); Status(value.Name + (delete ? " deleted" : " · all messages marked read"));
            } catch (Exception ex) { Status("Folder action failed: " + ex.Message); MessageBox.Show(window, ex.Message, "Folder action could not finish"); }
            finally { mailGate.Release(); }
            QueueMailSync(account.Id);
        }
        private void EditFolderAppearance(MailAccount account, ServerFolder value) {
            FolderAppearance look; string key = FolderAppearanceKey(account.Id, value.Path); preferences.FolderAppearances.TryGetValue(key, out look);
            var dialog = Dialog("Folder appearance · TMA-Mail", 460, 430);
            var panel = new StackPanel { Margin = new Thickness(24) }; dialog.Content = panel; panel.Children.Add(Label(value.Name, 22, "Text"));
            string[] symbols = { "▱", "▣", "▤", "★", "♥", "●", "◆", "✉", "⚑", "☁" };
            var icon = Choice(panel, "Folder icon", look == null ? "▱" : look.Icon, symbols);
            var colour = TextField(panel, "Text colour (#RRGGBB)", look == null || String.IsNullOrEmpty(look.Colour) ? "#C5D4EC" : look.Colour, false);
            var palette = new WrapPanel { Margin = new Thickness(0, 6, 0, 10) }; panel.Children.Add(palette);
            foreach (var shade in new[] { "#C5D4EC", "#75D49B", "#8EC8FF", "#F1CC75", "#F09FAF", "#C6A6FF" }) { string captured = shade; var swatch = Action("●", false); swatch.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString(shade)); swatch.Padding = new Thickness(10, 4, 10, 4); swatch.Margin = new Thickness(0, 0, 6, 0); swatch.ToolTip = shade; swatch.Click += delegate { colour.Text = captured; }; palette.Children.Add(swatch); }
            var sample = Label("▱   " + value.Name, 15, "#C5D4EC"); panel.Children.Add(sample);
            Action preview = delegate { sample.Text = Value(icon) + "   " + value.Name; try { sample.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString(colour.Text)); } catch { } };
            icon.SelectionChanged += delegate { preview(); }; colour.TextChanged += delegate { preview(); }; preview();
            var actions = new WrapPanel { Margin = new Thickness(0, 16, 0, 0) }; panel.Children.Add(actions);
            var save = Action("Save", true); var reset = Action("Reset", false); var cancel = Action("Cancel", false); actions.Children.Add(save); actions.Children.Add(reset); actions.Children.Add(cancel);
            cancel.Click += delegate { dialog.Close(); }; reset.Click += delegate { preferences.FolderAppearances.Remove(key); SavePaneSizes(); ApplyNavigation(); dialog.Close(); };
            save.Click += delegate {
                if (!System.Text.RegularExpressions.Regex.IsMatch(colour.Text, "^#[0-9a-fA-F]{6}$")) { MessageBox.Show(dialog, "Enter a colour such as #C5D4EC or #75D49B.", "Folder colour"); return; }
                preferences.FolderAppearances[key] = new FolderAppearance { Icon = Value(icon), Colour = colour.Text }; SavePaneSizes(); ApplyNavigation(); dialog.Close();
            };
            dialog.ShowDialog();
        }
    }
}
