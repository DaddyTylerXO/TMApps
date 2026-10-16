using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace Postbox {
    public sealed class HtmlMessageView : DockPanel, IDisposable {
        private WebView2 browser;
        private readonly string cacheDirectory;
        private readonly TextBlock notice;
        private readonly Button images;
        private Message current;
        private bool allowImages;
        private bool automaticImages = true;
        private Task initialization;
        private int generation;
        private string suppliedDocument;
        public void SetImagePolicy(bool automatic) {
            if (automaticImages == automatic) return;
            automaticImages = automatic;
            if (current != null) { var message = current; current = null; ShowMessage(message); }
        }
        public HtmlMessageView(string dataDirectory) {
            cacheDirectory = Path.Combine(dataDirectory, "WebView2-Mail");
            var toolbar = new DockPanel { Margin = new Thickness(0, 0, 0, 8) }; SetDock(toolbar, Dock.Top); Children.Add(toolbar);
            images = new Button { Content = "Load images", Padding = new Thickness(12, 6, 12, 6), Margin = new Thickness(8, 0, 0, 0) }; SetDock(images, Dock.Right); toolbar.Children.Add(images);
            notice = new TextBlock { Text = "External pictures are hidden", Foreground = Theme.B("Muted"), FontSize = 11, VerticalAlignment = VerticalAlignment.Center }; toolbar.Children.Add(notice);
            images.Click += delegate { allowImages = true; images.IsEnabled = false; notice.Text = "Showing external pictures for this message"; if (browser != null && browser.CoreWebView2 != null && current != null) NavigateDocument(PrepareHtml(current)); };
            Height = 560; Visibility = Visibility.Collapsed;
        }
        public static string PrepareHtml(Message message) {
            string html = message.HtmlBody ?? "";
            foreach (var image in message.InlineImages ?? new System.Collections.Generic.List<InlineMailImage>()) {
                if (String.IsNullOrEmpty(image.ContentId) || !new[] { "image/png", "image/jpeg", "image/gif", "image/webp" }.Contains((image.MimeType ?? "").ToLowerInvariant())) continue;
                html = Regex.Replace(html, Regex.Escape("cid:" + image.ContentId.Trim('<', '>')), "data:" + image.MimeType + ";base64," + image.Data, RegexOptions.IgnoreCase);
            }
            // Scripts/host objects are disabled in the engine. CSP plus the resource/navigation
            // handlers below enforce the boundary for this untrusted HTML.
            var filter = new MimeKit.Text.HtmlToHtml(); html = filter.Convert(html);
            return "<!doctype html><html><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'none'; connect-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'\"><style>html{overflow-wrap:anywhere}body{margin:16px;font-family:Segoe UI,sans-serif;color:#222;background:#fff}img{max-width:100%;height:auto}table{max-width:100%}input,button,select,textarea{pointer-events:none}::-webkit-scrollbar{width:11px;height:11px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#3a8c5e;border:2px solid transparent;background-clip:padding-box;border-radius:8px}::-webkit-scrollbar-thumb:hover{background-color:#55ad7d}</style></head><body>" + html + "</body></html>";
        }
        public static bool AllowResource(string url, bool imageContext, bool externalImages) {
            if (!imageContext) return false;
            if (new[] { "data:image/png;base64,", "data:image/jpeg;base64,", "data:image/gif;base64,", "data:image/webp;base64," }.Any(prefix => url.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))) return true;
            Uri uri; return externalImages && Uri.TryCreate(url, UriKind.Absolute, out uri) && uri.Scheme == "https";
        }
        private async Task Initialize() {
            browser = new WebView2 { DefaultBackgroundColor = System.Drawing.Color.White }; Children.Add(browser);
            var environment = await CoreWebView2Environment.CreateAsync(null, cacheDirectory);
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2; var settings = core.Settings;
            settings.IsScriptEnabled = false; settings.AreHostObjectsAllowed = false; settings.IsWebMessageEnabled = false; settings.AreDefaultContextMenusEnabled = false; settings.AreDevToolsEnabled = false; settings.IsStatusBarEnabled = false; settings.IsGeneralAutofillEnabled = false; settings.IsPasswordAutosaveEnabled = false;
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += delegate(object sender, CoreWebView2WebResourceRequestedEventArgs args) {
                if (args.ResourceContext == CoreWebView2WebResourceContext.Document && (args.Request.Uri == suppliedDocument || args.Request.Uri == "about:blank")) return;
                if (!AllowResource(args.Request.Uri, args.ResourceContext == CoreWebView2WebResourceContext.Image, allowImages)) args.Response = core.Environment.CreateWebResourceResponse(new MemoryStream(new byte[0]), 403, "Blocked", "Content-Type: text/plain");
            };
            core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs args) { if (args.Uri == "about:blank" || (!args.IsUserInitiated && args.Uri == suppliedDocument)) return; args.Cancel = true; if (args.IsUserInitiated) OpenLink(args.Uri); };
            core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args) { args.Handled = true; if (args.IsUserInitiated) OpenLink(args.Uri); };
            core.DownloadStarting += delegate(object sender, CoreWebView2DownloadStartingEventArgs args) { args.Cancel = true; };
            core.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs args) { args.State = CoreWebView2PermissionState.Deny; };
        }
        private static void OpenLink(string value) { Uri uri; if (Uri.TryCreate(value, UriKind.Absolute, out uri) && new[] { "https", "http", "mailto" }.Contains(uri.Scheme)) { try { Process.Start(uri.AbsoluteUri); } catch { } } }
        private void NavigateDocument(string html) { suppliedDocument = "data:text/html;charset=utf-8;base64," + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(html)); browser.NavigateToString(html); }
        public async void ShowMessage(Message message) {
            if (current != null && current.Id == message.Id && current.HtmlBody == message.HtmlBody && browser != null && browser.CoreWebView2 != null) return;
            current = message; int request = ++generation; allowImages = automaticImages; images.IsEnabled = !automaticImages; images.Visibility = automaticImages ? Visibility.Collapsed : Visibility.Visible; notice.Text = automaticImages ? "Loading formatted message and pictures…" : "External pictures are hidden";
            try {
                if (initialization == null) initialization = Initialize(); await initialization;
                if (request != generation || current == null) return;
                string html = PrepareHtml(current); if (html.Length > 1500000) throw new InvalidOperationException("This large message is shown as text.");
                browser.Visibility = Visibility.Visible; foreach (var fallback in Children.OfType<TextBox>()) fallback.Visibility = Visibility.Collapsed; NavigateDocument(html);
                if (automaticImages) notice.Text = "Pictures load automatically · change in Appearance settings";
            } catch (Exception) {
                notice.Text = "HTML reader unavailable. Showing message text; check that Microsoft Edge WebView2 Runtime is installed.";
                if (browser != null) browser.Visibility = Visibility.Collapsed;
                var fallback = Children.OfType<TextBox>().FirstOrDefault(); if (fallback == null) { fallback = new TextBox { IsReadOnly = true, TextWrapping = TextWrapping.Wrap, VerticalScrollBarVisibility = ScrollBarVisibility.Auto }; Children.Add(fallback); } fallback.Text = message.Body;
            }
        }
        public void Dispose() { generation++; if (browser != null) browser.Dispose(); }
    }
    public partial class App {
        private HtmlMessageView htmlReader;
        private void InitializeHtmlReader() {
            var body = Find<TextBox>("BodyText"); var parent = (StackPanel)body.Parent;
            htmlReader = new HtmlMessageView(dataDirectory); parent.Children.Insert(parent.Children.IndexOf(body), htmlReader);
            window.Closed += delegate { htmlReader.Dispose(); };
        }
    }
}
