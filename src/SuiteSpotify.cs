using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace TMAppsShared {
    // Public OAuth identity for native clients. A client secret must never be added.
    public sealed class SpotifyApi : IDisposable {
        public const string ClientId="abc7cf7d00604cf7afd861e163c8be29", RedirectUri="http://127.0.0.1:43823/spotify/callback";
        readonly HttpClient http; readonly string file; readonly Func<string,Task> open; readonly JavaScriptSerializer json=new JavaScriptSerializer();
        string access,refresh;DateTime expires,retryAt;CancellationTokenSource pending;bool disposed;
        public SpotifyApi(string root,Func<string,Task> browser,HttpMessageHandler handler=null) {file=Path.Combine(root,"spotify-session.bin");open=browser;http=new HttpClient(handler??new HttpClientHandler {AllowAutoRedirect=false}) {Timeout=TimeSpan.FromSeconds(20)};}
        public bool Connected {get {return !String.IsNullOrEmpty(refresh)||File.Exists(file);}}
        static string RandomValue() {using(var rng=RandomNumberGenerator.Create()){var bytes=new byte[32];rng.GetBytes(bytes);return Base64(bytes);}}
        static string Base64(byte[] bytes) {return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+','-').Replace('/','_');}
        public static string Challenge(string verifier) {using(var sha=SHA256.Create())return Base64(sha.ComputeHash(Encoding.ASCII.GetBytes(verifier)));}
        public static Dictionary<string,string> Query(string query) {var result=new Dictionary<string,string>();foreach(string pair in query.TrimStart('?').Split('&')){if(String.IsNullOrEmpty(pair))continue;var parts=pair.Split(new[]{'='},2);result.Add(Uri.UnescapeDataString(parts[0]),parts.Length==1?"":Uri.UnescapeDataString(parts[1].Replace('+',' ')));}return result;}
        static string Text(Dictionary<string,object> item,string key) {object value;return item!=null&&item.TryGetValue(key,out value)?Convert.ToString(value):"";}
        async Task Token(Dictionary<string,string> values) {
            values["client_id"]=ClientId;
            using(var response=await http.PostAsync("https://accounts.spotify.com/api/token",new FormUrlEncodedContent(values)).ConfigureAwait(false)) {
                if(!response.IsSuccessStatusCode){if(response.StatusCode==HttpStatusCode.BadRequest||response.StatusCode==HttpStatusCode.Unauthorized)Disconnect();throw new InvalidOperationException("Spotify authorization failed. Reconnect and check the developer app settings.");}
                var token=json.Deserialize<Dictionary<string,object>>(await response.Content.ReadAsStringAsync().ConfigureAwait(false));if(disposed)throw new OperationCanceledException();
                access=Text(token,"access_token");int seconds;if(String.IsNullOrEmpty(access)||!Int32.TryParse(Text(token,"expires_in"),out seconds))throw new InvalidOperationException("Spotify returned an incomplete authorization response.");expires=DateTime.UtcNow.AddSeconds(seconds);
                refresh=String.IsNullOrEmpty(Text(token,"refresh_token"))?(values.ContainsKey("refresh_token")?values["refresh_token"]:null):Text(token,"refresh_token");
                if(!String.IsNullOrEmpty(refresh)){Directory.CreateDirectory(Path.GetDirectoryName(file));string temporary=file+".tmp";File.WriteAllBytes(temporary,ProtectedData.Protect(Encoding.UTF8.GetBytes(refresh),null,DataProtectionScope.CurrentUser));if(File.Exists(file))File.Replace(temporary,file,null);else File.Move(temporary,file);}
            }
        }
        public async Task Connect() {
            if(pending!=null)throw new InvalidOperationException("A Spotify sign-in is already open.");
            string verifier=RandomValue(),state=RandomValue(),code=null;var listener=new TcpListener(IPAddress.Loopback,43823);pending=new CancellationTokenSource(TimeSpan.FromMinutes(3));
            try {
                try{listener.Start(4);}catch(SocketException){throw new InvalidOperationException("Spotify sign-in port is busy. Finish sign-in in the other TMA app, then try again.");}
                using(pending.Token.Register(()=>listener.Stop())) {
                    string url="https://accounts.spotify.com/authorize?client_id="+ClientId+"&response_type=code&redirect_uri="+Uri.EscapeDataString(RedirectUri)+"&scope=user-read-playback-state%20user-modify-playback-state&code_challenge_method=S256&code_challenge="+Challenge(verifier)+"&state="+state;
                    await open(url).ConfigureAwait(false);
                    while(code==null) {
                        using(var client=await listener.AcceptTcpClientAsync().ConfigureAwait(false))using(var stream=client.GetStream()) {
                            // A bounded request header prevents a stalled local connection from keeping sign-in alive.
                            var header=new StringBuilder();var buffer=new byte[1];using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(pending.Token)){deadline.CancelAfter(3000);using(deadline.Token.Register(()=>client.Close()))try{while(header.Length<8192&&!header.ToString().EndsWith("\r\n\r\n")){if(await stream.ReadAsync(buffer,0,1,deadline.Token).ConfigureAwait(false)==0)break;header.Append((char)buffer[0]);}}catch(OperationCanceledException){continue;}catch(IOException){continue;}}
                            var line=header.ToString().Split('\n')[0].Trim().Split(' ');Uri target;Dictionary<string,string> parameters=null;
                            if(line.Length==3&&line[0]=="GET"&&Uri.TryCreate("http://127.0.0.1:43823"+line[1],UriKind.Absolute,out target)&&target.AbsolutePath=="/spotify/callback")try{parameters=Query(target.Query);}catch(ArgumentException){}
                            bool valid=parameters!=null&&parameters.ContainsKey("state")&&parameters["state"]==state;
                            string body=valid?"Return to your TMA application. You may close this tab.":"Sign-in state did not match. Return to TMApps.";
                            byte[] reply=Encoding.UTF8.GetBytes("HTTP/1.1 "+(valid?"200 OK":"400 Bad Request")+"\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\nContent-Length: "+Encoding.UTF8.GetByteCount(body)+"\r\n\r\n"+body);await stream.WriteAsync(reply,0,reply.Length).ConfigureAwait(false);
                            if(valid){if(parameters.ContainsKey("error"))throw new InvalidOperationException("Spotify sign-in was declined.");if(!parameters.TryGetValue("code",out code)||String.IsNullOrEmpty(code))throw new InvalidOperationException("Spotify did not return an authorization code.");}
                        }
                    }
                    await Token(new Dictionary<string,string>{{"grant_type","authorization_code"},{"code",code},{"redirect_uri",RedirectUri},{"code_verifier",verifier}}).ConfigureAwait(false);
                }
            } catch(ObjectDisposedException){throw new OperationCanceledException("Spotify sign-in cancelled or timed out.");}catch(SocketException){throw new OperationCanceledException("Spotify sign-in cancelled or timed out.");}
            finally{listener.Stop();pending.Dispose();pending=null;}
        }
        async Task<string> Access() {
            if(!String.IsNullOrEmpty(access)&&expires>DateTime.UtcNow.AddMinutes(1))return access;
            if(String.IsNullOrEmpty(refresh))try{refresh=Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(file),null,DataProtectionScope.CurrentUser));}catch{throw new InvalidOperationException("Connect Spotify first.");}
            await Token(new Dictionary<string,string>{{"grant_type","refresh_token"},{"refresh_token",refresh}}).ConfigureAwait(false);return access;
        }
        async Task<Dictionary<string,object>> Request(string suffix,string method) {
            if(DateTime.UtcNow<retryAt)throw new InvalidOperationException("Spotify is rate limiting requests. Please wait before refreshing.");
            using(var request=new HttpRequestMessage(new HttpMethod(method),"https://api.spotify.com/v1/me/player"+suffix)){request.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",await Access().ConfigureAwait(false));using(var response=await http.SendAsync(request).ConfigureAwait(false)) {
                if((int)response.StatusCode==429){var delay=response.Headers.RetryAfter;retryAt=DateTime.UtcNow.AddSeconds(delay!=null&&delay.Delta.HasValue?Math.Min(3600,Math.Max(30,delay.Delta.Value.TotalSeconds)):60);throw new InvalidOperationException("Spotify is busy. Refresh pauses until its retry period ends.");}
                if(response.StatusCode==HttpStatusCode.Unauthorized){access=null;throw new InvalidOperationException("Spotify session expired. Refresh once or reconnect.");}
                if(response.StatusCode==HttpStatusCode.Forbidden)throw new InvalidOperationException("Spotify denied access. Check Premium membership and developer-app user access.");
                if(response.StatusCode==HttpStatusCode.NotFound)throw new InvalidOperationException("No active Spotify device. Open Spotify or its web player and start a track.");
                if(!response.IsSuccessStatusCode)throw new InvalidOperationException("Spotify could not complete that request. Try again later.");
                return response.StatusCode==HttpStatusCode.NoContent?null:json.Deserialize<Dictionary<string,object>>(await response.Content.ReadAsStringAsync().ConfigureAwait(false));
            }}
        }
        public async Task<string[]> Playback() {var p=await Request("","GET").ConfigureAwait(false);var item=p!=null&&p.ContainsKey("item")?p["item"] as Dictionary<string,object>:null;var device=p!=null&&p.ContainsKey("device")?p["device"] as Dictionary<string,object>:null;string artist="";if(item!=null&&item.ContainsKey("artists")){var list=item["artists"] as System.Collections.IEnumerable;if(list!=null)artist=String.Join(", ",list.Cast<object>().Select(a=>Text(a as Dictionary<string,object>,"name")));}return new[]{String.IsNullOrEmpty(Text(item,"name"))?"No active track":Text(item,"name"),artist,String.IsNullOrEmpty(Text(device,"name"))?"Open Spotify and start playback":Text(device,"name")};}
        public async Task Control(string action) {if(!new[]{"play","pause","next","previous"}.Contains(action))throw new ArgumentException("Unknown playback action.");await Request("/"+action,action=="next"||action=="previous"?"POST":"PUT").ConfigureAwait(false);}
        public void Disconnect(){if(pending!=null)pending.Cancel();access=refresh=null;File.Delete(file);}
        public void Dispose(){disposed=true;if(pending!=null)pending.Cancel();http.Dispose();access=refresh=null;}
    }
    public static class SpotifyWindow {
        sealed class MusicButton : Button {
            protected override void OnPaintBackground(PaintEventArgs e) {e.Graphics.Clear(Parent.BackColor);}
            protected override void OnPaint(PaintEventArgs e) {e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;using(var shape=new GraphicsPath()){int r=30;shape.AddArc(0,0,r,r,180,90);shape.AddArc(Width-r-1,0,r,r,270,90);shape.AddArc(Width-r-1,Height-r-1,r,r,0,90);shape.AddArc(0,Height-r-1,r,r,90,90);shape.CloseFigure();using(var brush=new SolidBrush(Enabled?BackColor:Color.FromArgb(64,68,76)))e.Graphics.FillPath(brush,shape);if(Focused)using(var pen=new Pen(Color.White,2))e.Graphics.DrawPath(pen,shape);}TextRenderer.DrawText(e.Graphics,Text,Font,ClientRectangle,ForeColor,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);}
        }
        [System.Runtime.InteropServices.DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr handle,int attribute,ref int value,int size);
        public static void Show(string name,string root,string brand) {
            using(var form=new Form {Text=name+" · Spotify",Size=new Size(600,760),MinimumSize=new Size(520,700),StartPosition=FormStartPosition.CenterScreen,BackColor=ColorTranslator.FromHtml("#22252C"),ForeColor=Color.White,Font=new Font("Segoe UI",10)})
            using(var api=new SpotifyApi(root,url=>{System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url){UseShellExecute=true});return Task.FromResult(0);})) {
                var panel=new FlowLayoutPanel {Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new Padding(24)};form.Controls.Add(panel);
                Func<string,Label> label=text=>{var l=new Label {Text=text,Visible=!String.IsNullOrEmpty(text),AutoSize=true,MaximumSize=new Size(510,0),Margin=new Padding(0,8,0,10)};l.TextChanged+=(s,e)=>l.Visible=!String.IsNullOrEmpty(l.Text);panel.Controls.Add(l);return l;};
                label("Spotify").Font=new Font(form.Font.FontFamily,23,FontStyle.Bold);label("Sign in through Spotify to control your active app, speaker, phone or web player. Playback requires Spotify Premium and developer-app access.");label("Playback mode");
                string modeFile=Path.Combine(root,"spotify-mode.txt");int selectedMode=File.Exists(modeFile)&&File.ReadAllText(modeFile)=="Browser"?1:0;
                var modes=new FlowLayoutPanel {Width=510,Height=90,AccessibleName="Playback mode",WrapContents=true};panel.Controls.Add(modes);
                var connectMode=new MusicButton {Name="ConnectMode",Text="Spotify app / Connect device",Width=490,Height=38,ForeColor=Color.White,Margin=new Padding(0,0,0,6)};
                var browserMode=new MusicButton {Name="BrowserMode",Text="Browser streaming with in-app controls",Width=490,Height=38,ForeColor=Color.White,Margin=new Padding(0,0,0,6)};modes.Controls.Add(connectMode);modes.Controls.Add(browserMode);
                Action modeColours=()=>{connectMode.BackColor=ColorTranslator.FromHtml(selectedMode==0?brand:"#2D313B");browserMode.BackColor=ColorTranslator.FromHtml(selectedMode==1?brand:"#2D313B");connectMode.AccessibleName="Spotify app / Connect device"+(selectedMode==0?", selected":"");browserMode.AccessibleName="Browser streaming with in-app controls"+(selectedMode==1?", selected":"");connectMode.Invalidate();browserMode.Invalidate();};modeColours();
                var note=label("");Action modeNote=()=>note.Text=selectedMode==1?"Open the web player in your browser, sign in there, and start a track. Audio is streamed by your browser; these controls operate that active device.":"Start playback in Spotify on your computer, phone or speaker. These controls operate the active device.";modeNote();
                var title=label("Connect Spotify to get started");title.Font=new Font(form.Font.FontFamily,14,FontStyle.Bold);Label artist=label(""),device=label(""),notice=label("");notice.ForeColor=ColorTranslator.FromHtml("#FFC49D");bool busy=false;
                var actions=new FlowLayoutPanel {Width=510,MaximumSize=new Size(510,0),AutoSize=true,AutoSizeMode=AutoSizeMode.GrowAndShrink,WrapContents=true};panel.Controls.Add(actions);var buttons=new List<Button>();Func<string,Func<Task>,Button> button=(text,action)=>{var b=new MusicButton {Text=text,AutoSize=true,MinimumSize=new Size(120,38),FlatStyle=FlatStyle.Flat,BackColor=ColorTranslator.FromHtml(brand),ForeColor=Color.White,Margin=new Padding(0,4,8,4)};b.FlatAppearance.BorderSize=0;b.SizeChanged+=(s,e)=>{using(var path=new GraphicsPath()){int r=24;path.AddArc(0,0,r,r,180,90);path.AddArc(b.Width-r,0,r,r,270,90);path.AddArc(b.Width-r,b.Height-r,r,r,0,90);path.AddArc(0,b.Height-r,r,r,90,90);path.CloseFigure();var old=b.Region;b.Region=new Region(path);if(old!=null)old.Dispose();}};b.Click+=async(s,e)=>{if(busy)return;busy=true;buttons.ForEach(x=>x.Enabled=false);try{await action();if(!form.IsDisposed)notice.Text="";}catch(Exception ex){if(!form.IsDisposed)notice.Text=ex is OperationCanceledException?"Spotify sign-in cancelled or timed out.":ex.Message;}finally{busy=false;if(!form.IsDisposed)buttons.ForEach(x=>x.Enabled=true);}};actions.Controls.Add(b);buttons.Add(b);return b;};
                Func<Task> refresh=async()=>{if(!api.Connected)return;var p=await api.Playback();if(form.IsDisposed)return;title.Text=p[0];artist.Text=p[1];device.Text=p[2];};
                button("Open Spotify web player",()=>{System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("https://open.spotify.com/"){UseShellExecute=true});return Task.FromResult(0);});
                foreach(string command in new[]{"previous","play","pause","next"}){string value=command;button(Char.ToUpper(value[0])+value.Substring(1),async()=>{await api.Control(value);await refresh();});}
                button("Spotify setup guide",()=>{string relative=name=="TMA-Libraries"?"TMA-Libraries KB Library.docx":"KB Library.docx";string doc=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"docs",relative);System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(File.Exists(doc)?doc:"https://github.com/DaddyTylerXO/TMApps/blob/"+name+"/docs/"+Uri.EscapeDataString(relative)){UseShellExecute=true});return Task.FromResult(0);});
                button("Connect Spotify",async()=>{notice.Text="Complete sign-in in your browser. Close this window to cancel.";await api.Connect();await refresh();});button("Refresh",refresh);button("Disconnect",()=>{api.Disconnect();title.Text="Spotify disconnected";artist.Text=device.Text="";return Task.FromResult(0);});
                label("Authorization is encrypted for this Windows user. No client secret is used. Closing this window stops refresh requests; playback continues. Disconnect removes local authorization. Revoke access in your Spotify account to remove provider access.").Font=new Font(form.Font.FontFamily,9);
                Action<int> selectMode=index=>{try{Directory.CreateDirectory(root);File.WriteAllText(modeFile,index==1?"Browser":"Connect");selectedMode=index;modeColours();modeNote();}catch{notice.Text="Could not save playback mode.";}};connectMode.Click+=(s,e)=>selectMode(0);browserMode.Click+=(s,e)=>selectMode(1);
                var timer=new System.Windows.Forms.Timer {Interval=15000};timer.Tick+=async(s,e)=>{if(busy||!form.Visible||form.WindowState==FormWindowState.Minimized||!api.Connected)return;busy=true;try{await refresh();}catch(Exception ex){if(!form.IsDisposed)notice.Text=ex.Message;}finally{busy=false;}};
                form.Shown+=async(s,e)=>{int dark=1;try{DwmSetWindowAttribute(form.Handle,20,ref dark,4);}catch{}timer.Start();try{await refresh();}catch(Exception ex){if(!form.IsDisposed)notice.Text=ex.Message;}};form.FormClosing+=(s,e)=>{timer.Stop();api.Dispose();};form.ShowDialog();timer.Dispose();
            }
        }
    }
}
