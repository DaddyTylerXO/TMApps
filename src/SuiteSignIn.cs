using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace TMApps {
    public class SignInConfiguration { public string url {get;set;} public string publicKey {get;set;} }
    public sealed class SuiteSignIn : IDisposable {
        readonly string root; readonly HttpClient http; readonly SignInConfiguration config;
        Dictionary<string,object> session,user; static readonly string[] Ids={"tma-mail","tma-safe","tma-padlock","tma-cut","tma-socialsmanager","tma-agent-office"};
        public bool Configured {get {return config!=null;}} public string Email {get {return user==null?null:Convert.ToString(user["email"]);}}
        public SuiteSignIn(string directory,HttpMessageHandler handler=null) {
            http=new HttpClient(handler ?? new HttpClientHandler {AllowAutoRedirect=false});root=directory;http.Timeout=TimeSpan.FromSeconds(20);string file=Path.Combine(root,"auth-config.json");var value=LauncherService.Json.Deserialize<SignInConfiguration>(File.Exists(file)?File.ReadAllText(file):Bundled.Read("auth-config.json"));
            if(String.IsNullOrEmpty(value.url)||String.IsNullOrEmpty(value.publicKey))return;
            Uri uri;if(!Uri.TryCreate(value.url,UriKind.Absolute,out uri)||uri.Scheme!="https"||uri.AbsolutePath!="/"||!String.IsNullOrEmpty(uri.UserInfo)||!String.IsNullOrEmpty(uri.Query)||!String.IsNullOrEmpty(uri.Fragment))throw new FormatException("Use an HTTPS Supabase project origin.");
            if(!value.publicKey.StartsWith("sb_publishable_")) {try {string part=value.publicKey.Split('.')[1].Replace('-','+').Replace('_','/');part=part.PadRight((part.Length+3)/4*4,'=');var claims=LauncherService.Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(Convert.FromBase64String(part)));if(Convert.ToString(claims["role"])!="anon")throw new Exception();}catch {throw new FormatException("Only a public publishable/anon key belongs in launcher configuration.");}}
            value.url=uri.GetLeftPart(UriPartial.Authority);config=value;
            try {var stored=LauncherService.Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(Path.Combine(root,"auth-session.bin")),null,DataProtectionScope.CurrentUser)));if(Convert.ToString(stored["origin"])==config.url)session=(Dictionary<string,object>)stored["session"];}catch {}
        }
        async Task<object> Request(string route,object value,bool authorized,bool get=false) {
            if(!Configured)throw new InvalidOperationException("TMApps sign-in is not configured. See the deployment guide.");
            var request=new HttpRequestMessage(get?HttpMethod.Get:HttpMethod.Post,config.url+route);request.Headers.TryAddWithoutValidation("apikey",config.publicKey);if(authorized)request.Headers.TryAddWithoutValidation("Authorization","Bearer "+Convert.ToString(session["access_token"]));if(route.StartsWith("/rest/"))request.Headers.TryAddWithoutValidation("Prefer","resolution=merge-duplicates");if(!get)request.Content=new StringContent(LauncherService.Json.Serialize(value),Encoding.UTF8,"application/json");
            using(request)using(var response=await http.SendAsync(request).ConfigureAwait(false)){if(!response.IsSuccessStatusCode)throw new InvalidOperationException("Sign-in service returned HTTP "+(int)response.StatusCode+". Check the code or service configuration.");var text=await response.Content.ReadAsStringAsync().ConfigureAwait(false);return String.IsNullOrWhiteSpace(text)?new Dictionary<string,object>():LauncherService.Json.DeserializeObject(text);}
        }
        void Persist() {Directory.CreateDirectory(root);var bytes=Encoding.UTF8.GetBytes(LauncherService.Json.Serialize(new {origin=config.url,session=session}));var temporary=Path.Combine(root,"auth-session.tmp");File.WriteAllBytes(temporary,ProtectedData.Protect(bytes,null,DataProtectionScope.CurrentUser));var file=Path.Combine(root,"auth-session.bin");if(File.Exists(file))File.Replace(temporary,file,null);else File.Move(temporary,file);}
        void Accept(Dictionary<string,object> value) {if(!value.ContainsKey("access_token")||!value.ContainsKey("refresh_token")||!value.ContainsKey("expires_in"))throw new InvalidDataException("The service did not return a session.");value["expires_at"]=DateTimeOffset.UtcNow.ToUnixTimeSeconds()+Convert.ToInt64(value["expires_in"]);session=value;}
        async Task<bool> Ready() {if(session==null)return false;if(Convert.ToInt64(session["expires_at"])<DateTimeOffset.UtcNow.ToUnixTimeSeconds()+60){try {Accept((Dictionary<string,object>)await Request("/auth/v1/token?grant_type=refresh_token",new {refresh_token=session["refresh_token"]},false).ConfigureAwait(false));Persist();}catch {session=null;File.Delete(Path.Combine(root,"auth-session.bin"));return false;}}return true;}
        public async Task<string[]> Status() {if(!Configured||!await Ready().ConfigureAwait(false))return new string[0];user=(Dictionary<string,object>)await Request("/auth/v1/user",null,true,true).ConfigureAwait(false);if(!user.ContainsKey("email_confirmed_at")||user["email_confirmed_at"]==null)throw new InvalidOperationException("Verify your email before linking apps.");var rows=(object[])await Request("/rest/v1/app_access?select=app_id,enabled",null,true,true).ConfigureAwait(false);return rows.Cast<Dictionary<string,object>>().Where(r=>Convert.ToBoolean(r["enabled"])).Select(r=>Convert.ToString(r["app_id"])).Where(Ids.Contains).ToArray();}
        public async Task Send(string email) {if(!Regex.IsMatch(email ?? "",@"^[^\s@]+@[^\s@]+\.[^\s@]+$"))throw new FormatException("Enter your email address.");await Request("/auth/v1/otp",new {email=email,create_user=true},false).ConfigureAwait(false);}
        public async Task<string[]> Verify(string email,string code) {if(!Regex.IsMatch(code ?? "",@"^\d{6,8}$"))throw new FormatException("Enter the email verification code.");Accept((Dictionary<string,object>)await Request("/auth/v1/verify",new {email=email,token=code,type="email"},false).ConfigureAwait(false));var access=await Status().ConfigureAwait(false);Persist();return access;}
        public async Task Access(string[] apps) {if(apps.Any(id=>!Ids.Contains(id)))throw new FormatException("Unknown app access.");await Status().ConfigureAwait(false);if(Email==null)throw new InvalidOperationException("Sign in before linking apps.");await Request("/rest/v1/app_access",Ids.Select(id=>new {user_id=user["id"],app_id=id,enabled=apps.Contains(id)}).ToArray(),true).ConfigureAwait(false);}
        public async Task<object> Handoff(string appId,string challenge) {var access=await Status().ConfigureAwait(false);if(!access.Contains(appId)||!Regex.IsMatch(challenge ?? "",@"^[A-Za-z0-9_-]{43}$"))throw new InvalidOperationException("Approved app access and a PKCE challenge are required.");return await Request("/functions/v1/app-session",new {action="issue",appId=appId,challenge=challenge},true).ConfigureAwait(false);}
        public async Task Logout() {try {if(await Ready().ConfigureAwait(false))await Request("/auth/v1/logout?scope=local",new {},true).ConfigureAwait(false);}finally {session=null;user=null;File.Delete(Path.Combine(root,"auth-session.bin"));}}
        public void Dispose() {http.Dispose();}
    }
    public partial class LauncherApplication {
        async void ShowSignIn() {
            try {using(var auth=new SuiteSignIn(service.Root)) {
                var access=await auth.Status();var d=new ThemedDialog(window,"TMApps sign-in and linked apps",auth.Configured?"Sign in with an email code, then allow selected compatible apps to reuse your TMApps identity. This does not connect mailbox or social-network accounts.":"The sign-in service is prepared but not configured. The operator must deploy it and provide a project URL and public key. See the deployment guide in Help.");
                var summary=Paragraph(auth.Email==null?"Not signed in.":"Signed in as "+auth.Email);d.Body.Children.Add(summary);d.Body.Children.Add(Paragraph("Email address"));var email=new TextBox {Text=auth.Email ?? suiteProfile.emails.FirstOrDefault() ?? ""};d.Body.Children.Add(email);d.Body.Children.Add(Paragraph("Email verification code"));var code=new TextBox {MaxLength=8};d.Body.Children.Add(code);var error=Paragraph("");
                var entries=new Dictionary<string,CheckBox>();var send=ActionButton("Send sign-in code",()=>{});send.IsEnabled=auth.Configured;send.Click+=async(s,e)=>{send.IsEnabled=false;try {await auth.Send(email.Text);error.Text="If allowed by the service, a code has been sent. Check your email.";}catch(Exception ex){error.Text=ex.Message;}finally{send.IsEnabled=auth.Configured;}};d.Body.Children.Add(send);
                var verify=ActionButton("Verify code",()=>{});verify.IsEnabled=auth.Configured;verify.Click+=async(s,e)=>{verify.IsEnabled=false;try {access=await auth.Verify(email.Text,code.Text);code.Clear();summary.Text="Signed in as "+auth.Email;foreach(var pair in entries)pair.Value.IsChecked=access.Contains(pair.Key);error.Text="Verified. Choose apps and save access.";}catch(Exception ex){error.Text=ex.Message;}finally{verify.IsEnabled=auth.Configured;}};d.Body.Children.Add(verify);d.Body.Children.Add(Paragraph("Selected app access"));
                foreach(var app in apps){var box=new CheckBox {Content=app.Name,IsChecked=access.Contains(app.Id),Margin=new Thickness(0,8,0,5)};entries.Add(app.Id,box);d.Body.Children.Add(box);}
                d.Body.Children.Add(Paragraph("Apps must implement the prepared handoff before they can reuse sign-in. Revoking access blocks future handoffs and session checks. Provider credentials stay inside each app."));var save=ActionButton("Save app access",()=>{});save.IsEnabled=auth.Configured;save.Click+=async(s,e)=>{try {await auth.Access(entries.Where(p=>p.Value.IsChecked==true).Select(p=>p.Key).ToArray());error.Text="App access saved.";}catch(Exception ex){error.Text=ex.Message;}};d.Body.Children.Add(save);
                var logout=ActionButton("Sign out of launcher",()=>{});logout.Click+=async(s,e)=>{try {await auth.Logout();summary.Text="Not signed in.";}catch(Exception ex){error.Text=ex.Message;}};d.Body.Children.Add(logout);d.Body.Children.Add(ActionButton("Open sign-in deployment guide",()=>Browse("https://github.com/DaddyTylerXO/TMApps/blob/TMApps-Launcher/backend/README.md")));d.Body.Children.Add(error);d.AddAction("Close",true,()=>d.Close(),"ConfirmAction");d.ShowDialog();
            }}catch(Exception ex){ThemedDialogs.Info(window,"TMApps sign-in",ex.Message);}
        }
    }
}
