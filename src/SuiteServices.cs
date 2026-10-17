using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Win32;
namespace Postbox {
    public static class SafeWeb {
        public static Uri Https(string value) { Uri uri; if (!Uri.TryCreate(value, UriKind.Absolute, out uri) || uri.Scheme != "https" || !String.IsNullOrEmpty(uri.UserInfo) || uri.IsLoopback || !uri.IsDefaultPort) throw new ArgumentException("Use a public HTTPS address."); return uri; }
        public static async Task ValidateHost(Uri uri) {
            var addresses = await Dns.GetHostAddressesAsync(uri.DnsSafeHost);
            if (addresses.Length == 0 || addresses.Any(a => { if (IPAddress.IsLoopback(a)) return true; var ip = a.IsIPv4MappedToIPv6 ? a.MapToIPv4() : a; var bytes = ip.GetAddressBytes(); if (ip.AddressFamily == AddressFamily.InterNetwork) return bytes[0] == 0 || bytes[0] == 10 || bytes[0] == 127 || bytes[0] >= 224 || (bytes[0] == 169 && bytes[1] == 254) || (bytes[0] == 192 && bytes[1] == 168) || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) || (bytes[0] == 100 && bytes[1] >= 64 && bytes[1] <= 127); return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || bytes.All(b => b == 0) || (bytes[0] & 0xfe) == 0xfc; })) throw new ArgumentException("Private or local network addresses are not supported.");
        }
        public static async Task<string> GetText(string address, int limit) {
            var uri = Https(address); await ValidateHost(uri);
            using (var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false })) { client.Timeout = TimeSpan.FromSeconds(20); client.DefaultRequestHeaders.UserAgent.ParseAdd("TMA-Mail/0.15.1");
                using (var response = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead)) { response.EnsureSuccessStatusCode(); using (var input = await response.Content.ReadAsStreamAsync()) using (var output = new MemoryStream()) { var buffer = new byte[8192]; int read; while ((read = await input.ReadAsync(buffer, 0, buffer.Length)) > 0) { if (output.Length + read > limit) throw new InvalidDataException("The downloaded file is too large."); output.Write(buffer, 0, read); } return System.Text.Encoding.UTF8.GetString(output.ToArray()); } }
            }
        }
        public static void Open(string address) { Uri uri; if (!Uri.TryCreate(address, UriKind.Absolute, out uri) || (uri.Scheme != "https" && uri.Scheme != "mailto")) throw new ArgumentException("This link type is not supported."); Process.Start(uri.AbsoluteUri); }
    }
    public class WebPlugin { public string Id { get; set; } public string Name { get; set; } public string Version { get; set; } public string Url { get; set; } public bool Enabled { get; set; } }
    public static class PluginManifest {
        public static WebPlugin Parse(string json) {
            if (json.Length > 65536) throw new InvalidDataException("Plug-in manifest is too large."); var value = new JavaScriptSerializer().Deserialize<WebPlugin>(json);
            if (value == null || !System.Text.RegularExpressions.Regex.IsMatch(value.Id ?? "", "^[a-z0-9-]{1,64}$") || String.IsNullOrWhiteSpace(value.Name) || value.Name.Length > 100) throw new InvalidDataException("A plug-in needs an id and name.");
            SafeWeb.Https(value.Url); value.Enabled = true; return value;
        }
    }
    public class UpdateManifest { public string Version { get; set; } public string DownloadUrl { get; set; } public string ChangelogUrl { get; set; }
        public static UpdateManifest Parse(string json) { var value = new JavaScriptSerializer().Deserialize<UpdateManifest>(json); System.Version version; if (value == null || !System.Version.TryParse(value.Version, out version) || String.IsNullOrEmpty(value.DownloadUrl) || !value.DownloadUrl.StartsWith("https://github.com/DaddyTylerXO/TMApps/", StringComparison.Ordinal)) throw new InvalidDataException("GitHub returned invalid update information."); return value; }
    }
    public partial class App {
        private List<WebPlugin> webPlugins;
        private List<WebPlugin> LoadPlugins() { if (webPlugins != null) return webPlugins; string path = Path.Combine(dataDirectory, "plugins.protected"); webPlugins = File.Exists(path) ? new JavaScriptSerializer().Deserialize<List<WebPlugin>>(ProtectedFile.Read(path)) : new List<WebPlugin>(); return webPlugins ?? (webPlugins = new List<WebPlugin>()); }
        private void SavePlugins() { ProtectedFile.Write(Path.Combine(dataDirectory, "plugins.protected"), new JavaScriptSerializer().Serialize(LoadPlugins())); }
        private void ShowPluginMenu(Button anchor) { var menu = new ContextMenu { PlacementTarget = anchor }; foreach (var plugin in LoadPlugins().Where(p => p.Enabled)) { var captured = plugin; var item = new MenuItem { Header = plugin.Name }; item.Click += delegate { try { SafeWeb.Open(captured.Url); } catch (Exception ex) { Status(ex.Message); } }; menu.Items.Add(item); } var manage = new MenuItem { Header = "Manage add-ins / plug-ins…" }; manage.Click += delegate { ShowSettings("Plugins"); }; menu.Items.Add(manage); menu.IsOpen = true; }
        private StackPanel PluginSettings(Window owner) {
            var panel = SettingsSection("Add-ins / plug-ins", "Install TMA-Mail web-tool manifests (.tmaplugin.json). Tools open in your browser and receive no mail content. Outlook Office.js, COM and VSTO add-ins are not compatible with this release.");
            var install = Action("Install plug-in…", true); panel.Children.Add(install); var status = Label("", 12, "Muted"); panel.Children.Add(status); var list = new StackPanel(); panel.Children.Add(list);
            Action render = null; render = delegate { list.Children.Clear(); foreach (var plugin in LoadPlugins().ToList()) { var captured = plugin; var toggle = Toggle(list, plugin.Name + " · " + plugin.Version, plugin.Enabled); toggle.Checked += delegate { captured.Enabled = true; SavePlugins(); }; toggle.Unchecked += delegate { captured.Enabled = false; SavePlugins(); }; var remove = Action("Remove " + plugin.Name, false); remove.Click += delegate { LoadPlugins().Remove(captured); SavePlugins(); render(); }; list.Children.Add(remove); } };
            install.Click += delegate { var picker = new OpenFileDialog { Filter = "TMA-Mail plug-in (*.tmaplugin.json)|*.tmaplugin.json|JSON manifest (*.json)|*.json" }; if (picker.ShowDialog(owner) != true) return; try { if (new FileInfo(picker.FileName).Length > 65536) throw new InvalidDataException("Plug-in manifests must be at most 64 KB."); var plugin = PluginManifest.Parse(File.ReadAllText(picker.FileName)); if (MessageBox.Show(owner, "Install " + plugin.Name + "?\n\nOpens " + new Uri(plugin.Url).Host + " in your browser. No mailbox permissions are granted.", "Install web tool", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return; LoadPlugins().RemoveAll(p => p.Id == plugin.Id); LoadPlugins().Add(plugin); SavePlugins(); render(); status.Text = "Installed. Open this tool through Apps in the mailbox toolbar."; } catch (Exception ex) { status.Text = ex.Message; } };
            panel.Children.Add(Label("Installations and enable/disable changes take effect immediately. A sample manifest and format documentation ship with the app.", 11, "Muted")); render(); return panel;
        }
        private StackPanel AppInfoSettings() {
            var panel = SettingsSection("TMA-Mail", "A Windows mail and calendar workspace."); string version = typeof(App).Assembly.GetName().Version.ToString(3); panel.Children.Add(Label("Version " + version + " beta · Windows x64 · .NET Framework 4.8", 16, "Text"));
            var check = Action("Check for updates", true); panel.Children.Add(check); var status = Label("Updates are checked on demand from the TMA-Mail GitHub branch.", 12, "Muted"); panel.Children.Add(status);
            var download = Action("Open update download", false); download.Visibility = Visibility.Collapsed; panel.Children.Add(download); string address = null; download.Click += delegate { if (address != null) SafeWeb.Open(address); };
            check.Click += async delegate { check.IsEnabled = false; status.Text = "Checking GitHub…"; try { string json = await SafeWeb.GetText("https://raw.githubusercontent.com/DaddyTylerXO/TMApps/refs/heads/TMA-Mail/update.json", 65536); var update = UpdateManifest.Parse(json); bool newer = System.Version.Parse(update.Version) > typeof(App).Assembly.GetName().Version; status.Text = newer ? "Version " + update.Version + " is available." : "You have the latest published version."; address = newer ? update.DownloadUrl : null; download.Visibility = newer ? Visibility.Visible : Visibility.Collapsed; } catch (Exception ex) { status.Text = "Could not check for updates: " + ex.Message; } finally { check.IsEnabled = true; } };
            var project = Action("GitHub project and changelog", false); project.Click += delegate { SafeWeb.Open("https://github.com/DaddyTylerXO/TMApps/tree/TMA-Mail"); }; panel.Children.Add(project); return panel;
        }
    }
}
