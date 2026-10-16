using System;
using System.Reflection;
using System.IO;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows;
using Postbox;
using Microsoft.Web.WebView2.Wpf;
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8")]
class HtmlReaderSmoke {
    [STAThread] static int Main(string[] args) {
        var app = new Application(); var view = new HtmlMessageView(args[0]) { Visibility = Visibility.Visible };
        var window = new Window { Title = "TMA-Mail HTML verification · synthetic content", Content = view, Width = 700, Height = 650 }; app.MainWindow = window;
        window.Loaded += async delegate {
            try {
                view.ShowMessage(new Message { Id = "html-smoke", Body = "Synthetic reader check", HtmlBody = "<h1 id='check'>Formatted message check</h1><p><b>Bold content</b></p><img id='inline' src='cid:logo' width='80'><img id='remote' src='https://reader.example.test/image.png' width='80'><script>window.messageScriptExecuted=true</script>", InlineImages = new List<InlineMailImage> { new InlineMailImage { ContentId = "logo", MimeType = "image/png", Data = Convert.ToBase64String(File.ReadAllBytes(args[1])) } } });
                var task = (Task)typeof(HtmlMessageView).GetField("initialization", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(view); await task;
                var browser = (WebView2)typeof(HtmlMessageView).GetField("browser", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(view);
                int allowed = 0, blocked = 0;
                browser.CoreWebView2.WebResourceRequested += delegate(object sender, Microsoft.Web.WebView2.Core.CoreWebView2WebResourceRequestedEventArgs resource) {
                    if (resource.Request.Uri != "https://reader.example.test/image.png") return;
                    if (resource.Response != null) { blocked++; return; }
                    allowed++; resource.Response = browser.CoreWebView2.Environment.CreateWebResourceResponse(new MemoryStream(File.ReadAllBytes(args[1])), 200, "OK", "Content-Type: image/png");
                };
                browser.CoreWebView2.NavigationStarting += delegate(object sender, Microsoft.Web.WebView2.Core.CoreWebView2NavigationStartingEventArgs eventArgs) { Console.WriteLine("Navigation starting: " + eventArgs.Uri.Substring(0, Math.Min(30, eventArgs.Uri.Length)) + " cancelled=" + eventArgs.Cancel); };
                browser.CoreWebView2.WebResourceRequested += delegate(object sender, Microsoft.Web.WebView2.Core.CoreWebView2WebResourceRequestedEventArgs eventArgs) { Console.WriteLine("Resource: " + eventArgs.ResourceContext + " " + eventArgs.Request.Uri.Substring(0, Math.Min(60, eventArgs.Request.Uri.Length)) + " blocked=" + (eventArgs.Response != null)); };
                browser.CoreWebView2.NavigationCompleted += delegate(object sender, Microsoft.Web.WebView2.Core.CoreWebView2NavigationCompletedEventArgs eventArgs) { Console.WriteLine("Navigation: success=" + eventArgs.IsSuccess + " status=" + eventArgs.WebErrorStatus); };
                for (int i = 0; i < 10; i++) {
                    await Task.Delay(500); string result = await browser.ExecuteScriptAsync("JSON.stringify({text:document.body?document.body.innerText:'',url:location.href,ready:document.readyState})");
                    string verified = await browser.ExecuteScriptAsync("!!document.getElementById('check') && !!document.getElementById('inline') && document.getElementById('inline').naturalWidth > 0 && window.messageScriptExecuted !== true");
                    if (result.Contains("Formatted message check") && verified == "true" && allowed > 0) {
                        view.SetImagePolicy(false);
                        for (int wait = 0; wait < 20 && blocked == 0; wait++) await Task.Delay(100);
                        if (blocked == 0) throw new Exception("Turning off automatic pictures did not block the image request.");
                        view.SetImagePolicy(true);
                        for (int wait = 0; wait < 20 && allowed < 2; wait++) await Task.Delay(100);
                        if (allowed < 2) throw new Exception("Turning on automatic pictures did not reload the message image.");
                        Console.WriteLine("HTML and embedded images rendered; automatic/blocked external picture policies passed with a synthetic response; message scripts stayed disabled. No external server contacted."); app.Shutdown(0); return;
                    }
                    if (i == 9) Console.WriteLine("Document did not render: " + result);
                }
                app.Shutdown(1);
            } catch (Exception error) { Console.WriteLine(error); app.Shutdown(1); }
        };
        window.Show(); return app.Run();
    }
}
