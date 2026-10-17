using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
using MailKit;
using MimeKit;
namespace Postbox {
    public class MailSubscription { public string Key { get; set; } public string Name { get; set; } public string Sender { get; set; } public string Url { get; set; } public bool OneClick { get; set; } public bool Selected { get; set; } public string State { get; set; } public DateTimeOffset LastSeen { get; set; } }
    public static class SubscriptionHeaders {
        public static MailSubscription Parse(HeaderList headers, string sender, string name) {
            if (headers == null) return null; string raw = headers["List-Unsubscribe"]; if (String.IsNullOrWhiteSpace(raw)) return null;
            var links = Regex.Matches(raw, "<([^<>]+)>").Cast<Match>().Select(m => m.Groups[1].Value.Trim()).Where(v => { Uri uri; return Uri.TryCreate(v, UriKind.Absolute, out uri) && (uri.Scheme == "https" || uri.Scheme == "mailto") && (uri.Scheme == "mailto" || String.IsNullOrEmpty(uri.UserInfo)); }).ToList();
            string url = links.FirstOrDefault(v => v.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) ?? links.FirstOrDefault(); if (url == null) return null;
            string id = headers["List-Id"]; string key = String.IsNullOrWhiteSpace(id) ? (sender ?? "").ToLowerInvariant() : id.Trim().ToLowerInvariant(); if (String.IsNullOrWhiteSpace(key)) key = new Uri(url).Host;
            return new MailSubscription { Key = key, Name = String.IsNullOrWhiteSpace(name) ? sender : name, Sender = sender, Url = url, OneClick = url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && String.Equals((headers["List-Unsubscribe-Post"] ?? "").Trim(), "List-Unsubscribe=One-Click", StringComparison.OrdinalIgnoreCase), State = "Not requested" };
        }
        public static async Task Request(MailSubscription subscription, HttpMessageHandler testHandler = null) {
            if (!subscription.OneClick) throw new InvalidOperationException("This sender requires an unsubscribe page or email.");
            var uri = SafeWeb.Https(subscription.Url); if (testHandler == null) await SafeWeb.ValidateHost(uri);
            using (var client = new HttpClient(testHandler ?? new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false })) { client.Timeout = TimeSpan.FromSeconds(20); client.DefaultRequestHeaders.UserAgent.ParseAdd("TMA-Mail/0.15.4"); using (var content = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("List-Unsubscribe", "One-Click") })) using (var response = await client.PostAsync(uri, content)) { response.EnsureSuccessStatusCode(); } }
        }
    }
    public sealed partial class MailTransport {
        public List<MailSubscription> ScanSubscriptions(Action<string> progress, CancellationToken token) {
            var result = new Dictionary<string, MailSubscription>();
            using (var client = Connect(token)) {
                var all = new Dictionary<string, IMailFolder>(); foreach (var space in client.PersonalNamespaces) foreach (var folder in client.GetFolders(space, false, token)) all[folder.FullName] = folder; all[client.Inbox.FullName] = client.Inbox;
                foreach (var folder in all.Values.Where(f => (f.Attributes & (FolderAttributes.NoSelect | FolderAttributes.Drafts | FolderAttributes.Sent)) == 0)) {
                    token.ThrowIfCancellationRequested(); folder.Open(FolderAccess.ReadOnly, token);
                    int count = folder.Count; for (int start = 0; start < count; start += 250) {
                        token.ThrowIfCancellationRequested(); var summaries = folder.Fetch(start, Math.Min(count - 1, start + 249), MessageSummaryItems.Envelope | MessageSummaryItems.Headers, token);
                        foreach (var item in summaries) { var from = item.Envelope == null ? null : item.Envelope.From.Mailboxes.FirstOrDefault(); var subscription = SubscriptionHeaders.Parse(item.Headers, from == null ? "Unknown sender" : from.Address, from == null ? "Mailing list" : from.Name); if (subscription != null) { subscription.LastSeen = item.Envelope == null ? DateTimeOffset.MinValue : item.Envelope.Date ?? DateTimeOffset.MinValue; MailSubscription previous; if (!result.TryGetValue(subscription.Key, out previous) || subscription.LastSeen >= previous.LastSeen) result[subscription.Key] = subscription; } }
                        progress(folder.Name + " · " + Math.Min(start + 250, count) + " / " + count + " headers · " + result.Count + " lists found");
                    }
                    folder.Close(false, token);
                }
                client.Disconnect(true, token);
            }
            return result.Values.OrderBy(v => v.Name).ToList();
        }
    }
    public partial class App {
        private FrameworkElement CreateSubscriptionsPage(Window dialog, MailAccount account, CancellationTokenSource cancellation) {
            var layout = new DockPanel();
            var heading = new StackPanel(); DockPanel.SetDock(heading, Dock.Top); layout.Children.Add(heading); heading.Children.Add(Label("Mailbox Subscriptions", 24, "Text")); heading.Children.Add(Label(account == null ? "Connect a mailbox in Settings → Accounts first." : account.Email, 14, "Muted")); heading.Children.Add(Label("Subscriptions are discovered from List-Unsubscribe headers in received mail, not a provider-wide subscription register. Review the sender and destination before requesting removal. Some lists require a browser or email step.", 12, "Muted"));
            var controls = new WrapPanel(); heading.Children.Add(controls); var scan = Action("Scan Mailbox", true); var all = Action("Select All", false); var bulk = Action("Unsubscribe From Selected", false); controls.Children.Add(scan); controls.Children.Add(all); controls.Children.Add(bulk);
            var status = Label("", 12, "Muted"); heading.Children.Add(status);
            var scanProgress = new ProgressBar { Height = 6, Minimum = 0, Maximum = 100, Foreground = Brush("#3A8C5E"), Background = Brush("#143B29"), BorderThickness = new Thickness(0), Margin = new Thickness(0, 5, 0, 14), Visibility = Visibility.Collapsed };
            var track = new FrameworkElementFactory(typeof(Border)); track.SetValue(Border.BackgroundProperty, Brush("#143B29")); track.SetValue(Border.CornerRadiusProperty, new CornerRadius(3));
            var trackGrid = new FrameworkElementFactory(typeof(Grid), "PART_Track"); track.AppendChild(trackGrid); var indicator = new FrameworkElementFactory(typeof(Border), "PART_Indicator"); indicator.SetValue(Border.BackgroundProperty, Brush("#3A8C5E")); indicator.SetValue(Border.CornerRadiusProperty, new CornerRadius(3)); indicator.SetValue(FrameworkElement.HorizontalAlignmentProperty, HorizontalAlignment.Left); trackGrid.AppendChild(indicator); scanProgress.Template = new ControlTemplate(typeof(ProgressBar)) { VisualTree = track }; heading.Children.Add(scanProgress);
            var list = new StackPanel(); layout.Children.Add(new ScrollViewer { Content = list, VerticalScrollBarVisibility = ScrollBarVisibility.Auto });
            var rows = new List<MailSubscription>(); string cache = account == null ? null : Path.Combine(dataDirectory, "subscriptions-" + account.Id + ".protected");
            Action save = delegate { if (cache != null) ProtectedFile.Write(cache, new JavaScriptSerializer().Serialize(rows)); };
            Action render = null; Func<List<MailSubscription>, Task> unsubscribe = null;
            unsubscribe = async delegate(List<MailSubscription> chosen) {
                if (chosen.Count == 0) { status.Text = "Select at least one list."; return; }
                string review = String.Join("\n", chosen.Take(12).Select(s => s.Name + " → " + new Uri(s.Url).Host));
                if (MessageBox.Show(dialog, "Request unsubscribe for " + chosen.Count + " lists?\n\n" + review + (chosen.Count > 12 ? "\n…" : "") + "\n\nOne-click destinations will receive a request. Other senders need a manual step. These links are supplied by senders and have not been verified by TMA-Mail.", "Review unsubscribe requests", MessageBoxButton.YesNo, MessageBoxImage.Question, MessageBoxResult.No) != MessageBoxResult.Yes) return;
                bulk.IsEnabled = false; scan.IsEnabled = false; int accepted = 0;
                try { foreach (var subscription in chosen) { if (cancellation.IsCancellationRequested) break; try { if (subscription.OneClick) { await SubscriptionHeaders.Request(subscription); subscription.State = "Request accepted"; accepted++; } else { subscription.State = "Manual step required — open link"; } } catch (Exception ex) { subscription.State = "Request failed: " + ex.Message; } render(); } save(); status.Text = accepted + " requests accepted. This confirms the request, not final removal by the sender."; }
                finally { bulk.IsEnabled = true; scan.IsEnabled = account != null; }
            };
            render = delegate { list.Children.Clear(); foreach (var subscription in rows) { var captured = subscription; var row = new DockPanel { Margin = new Thickness(0, 8, 0, 8) }; var check = new CheckBox { IsChecked = captured.Selected, Margin = new Thickness(0, 10, 12, 0) }; check.Checked += delegate { captured.Selected = true; }; check.Unchecked += delegate { captured.Selected = false; }; DockPanel.SetDock(check, Dock.Left); row.Children.Add(check); var button = Action(captured.OneClick ? "Unsubscribe" : "Open unsubscribe link", false); button.Click += async delegate { if (captured.OneClick) await unsubscribe(new List<MailSubscription> { captured }); else { try { SafeWeb.Open(captured.Url); } catch (Exception ex) { status.Text = ex.Message; } } }; DockPanel.SetDock(button, Dock.Right); row.Children.Add(button); var info = new StackPanel(); info.Children.Add(Label(captured.Name, 15, "Text")); info.Children.Add(Label(captured.Sender + " · " + new Uri(captured.Url).Host + "\n" + captured.State, 11, "Muted")); row.Children.Add(info); list.Children.Add(row); } };
            all.Click += delegate { bool value = rows.Any(s => !s.Selected); foreach (var subscription in rows) subscription.Selected = value; render(); }; bulk.Click += async delegate { await unsubscribe(rows.Where(s => s.Selected).ToList()); };
            scan.IsEnabled = account != null && !offlinePreview; scan.Click += async delegate { scan.IsEnabled = false; scanProgress.Value = 0; scanProgress.Visibility = Visibility.Visible; try { status.Text = "Scanning subscription headers…"; var service = new MailTransport(account, accountStore); rows = await Task.Run(() => service.ScanSubscriptions(text => Dispatcher.BeginInvoke(new Action(delegate { if (cancellation.IsCancellationRequested) return; status.Text = text; var match = Regex.Match(text, @"· (\d+) / (\d+) headers"); if (match.Success) { double total = Double.Parse(match.Groups[2].Value); scanProgress.Value = total == 0 ? 100 : 100 * Double.Parse(match.Groups[1].Value) / total; } })), cancellation.Token)); save(); render(); scanProgress.Value = 100; status.Text = rows.Count + " mailing lists found. Scanning does not mark messages read."; } catch (OperationCanceledException) { scanProgress.Visibility = Visibility.Collapsed; } catch (Exception ex) { scanProgress.Visibility = Visibility.Collapsed; status.Text = "Scan failed: " + ex.Message; } finally { scan.IsEnabled = account != null && !offlinePreview; } };
            if (cache != null && File.Exists(cache)) { try { rows = new JavaScriptSerializer().Deserialize<List<MailSubscription>>(ProtectedFile.Read(cache)) ?? rows; } catch { status.Text = "Saved list could not be loaded. Scan again."; } } render(); return layout;
        }
    }
}
