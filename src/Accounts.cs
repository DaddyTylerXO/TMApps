using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace Postbox {
    public static class ProtectedFile {
        public static void Write(string path, string text) {
            byte[] bytes = ProtectedData.Protect(Encoding.UTF8.GetBytes(text), null, DataProtectionScope.CurrentUser);
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
            string temp = path + ".tmp"; File.WriteAllBytes(temp, bytes);
            if (File.Exists(path)) File.Replace(temp, path, null); else File.Move(temp, path);
        }
        public static string Read(string path) { return Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(path), null, DataProtectionScope.CurrentUser)); }
    }
    public sealed class AccountStore {
        private readonly string path;
        private readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 16777216 };
        private readonly object gate = new object();
        private AccountCatalog catalog;
        public AccountStore(string directory) { path = Path.Combine(directory, "account.protected"); }
        private AccountCatalog Read() {
            if (catalog != null) return catalog;
            catalog = new AccountCatalog { Accounts = new List<MailAccount>() };
            if (File.Exists(path)) {
                string text = ProtectedFile.Read(path); var values = json.Deserialize<Dictionary<string, object>>(text);
                if (values.ContainsKey("Accounts")) catalog = json.Deserialize<AccountCatalog>(text);
                else { var legacy = json.Deserialize<MailAccount>(text); if (legacy != null) { catalog.Accounts.Add(legacy); catalog.ActiveAccountId = legacy.Id; } }
            }
            catalog.Accounts = catalog.Accounts ?? new List<MailAccount>(); return catalog;
        }
        public MailAccount Load() { lock (gate) { var value = Read(); return value.Accounts.FirstOrDefault(a => a.Id == value.ActiveAccountId) ?? value.Accounts.FirstOrDefault(); } }
        public List<MailAccount> LoadAll() { lock (gate) return Read().Accounts.ToList(); }
        public void Save(MailAccount account) { Save(account, false); }
        public void Save(MailAccount account, bool activate) {
            lock (gate) { var value = Read(); int index = value.Accounts.FindIndex(a => a.Id == account.Id); if (index < 0) value.Accounts.Add(account); else value.Accounts[index] = account; if (activate || String.IsNullOrEmpty(value.ActiveAccountId)) value.ActiveAccountId = account.Id; ProtectedFile.Write(path, json.Serialize(value)); }
        }
        public void SaveTokens(MailAccount account) { lock (gate) { var value = Read(); if (value.Accounts.Any(a => Object.ReferenceEquals(a, account))) ProtectedFile.Write(path, json.Serialize(value)); } }
        public void Activate(string id) { lock (gate) { var value = Read(); if (!value.Accounts.Any(a => a.Id == id)) throw new ArgumentException("Account not found."); value.ActiveAccountId = id; ProtectedFile.Write(path, json.Serialize(value)); } }
        public void Remove(string id) { lock (gate) { var value = Read(); value.Accounts.RemoveAll(a => a.Id == id); if (value.ActiveAccountId == id) value.ActiveAccountId = value.Accounts.Select(a => a.Id).FirstOrDefault(); if (value.Accounts.Count == 0) { if (File.Exists(path)) File.Delete(path); } else ProtectedFile.Write(path, json.Serialize(value)); } }
        public void Remove() { lock (gate) { catalog = new AccountCatalog { Accounts = new List<MailAccount>() }; if (File.Exists(path)) File.Delete(path); } }
    }
    public sealed class AccountCatalog { public string ActiveAccountId { get; set; } public List<MailAccount> Accounts { get; set; } }
    public static class MicrosoftLogin {
        private sealed class TimedClient : WebClient {
            protected override WebRequest GetWebRequest(Uri address) { var request = base.GetWebRequest(address); request.Timeout = 15000; return request; }
        }
        private const string Endpoint = "https://login.microsoftonline.com/common/oauth2/v2.0/";
        private const string Scope = "offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send";
        private static Dictionary<string, object> Post(string endpoint, NameValueCollection form) {
            using (var client = new TimedClient()) {
                try { return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(client.UploadValues(Endpoint + endpoint, form))); }
                catch (WebException ex) {
                    if (ex.Response == null) throw;
                    using (var stream = ex.Response.GetResponseStream()) using (var reader = new StreamReader(stream)) return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
                }
            }
        }
        private static void Apply(MailAccount account, Dictionary<string, object> response) {
            if (!response.ContainsKey("access_token")) throw new InvalidOperationException(response.ContainsKey("error_description") ? (string)response["error_description"] : "Microsoft sign-in did not return a token.");
            account.AccessToken = (string)response["access_token"];
            if (response.ContainsKey("refresh_token")) account.RefreshToken = (string)response["refresh_token"];
            account.ExpiresUtc = DateTime.UtcNow.AddSeconds(Convert.ToInt32(response["expires_in"]) - 90);
        }
        public static void SignIn(MailAccount account, Action<string, string> showCode, CancellationToken cancellation) {
            Guid clientId; if (!Guid.TryParse(account.ClientId, out clientId)) throw new ArgumentException("Enter the Application (client) ID of your Microsoft public-client app registration. See SETUP.md.");
            var device = Post("devicecode", new NameValueCollection { { "client_id", account.ClientId }, { "scope", Scope } });
            if (!device.ContainsKey("device_code")) throw new InvalidOperationException(device.ContainsKey("error_description") ? (string)device["error_description"] : "Unable to begin sign-in.");
            showCode((string)device["verification_uri"], (string)device["user_code"]);
            var deadline = DateTime.UtcNow.AddSeconds(Convert.ToInt32(device["expires_in"]));
            int interval = Convert.ToInt32(device["interval"]);
            while (DateTime.UtcNow < deadline) {
                if (cancellation.WaitHandle.WaitOne(interval * 1000)) cancellation.ThrowIfCancellationRequested();
                var token = Post("token", new NameValueCollection { { "client_id", account.ClientId }, { "grant_type", "urn:ietf:params:oauth:grant-type:device_code" }, { "device_code", (string)device["device_code"] } });
                if (token.ContainsKey("access_token")) { Apply(account, token); return; }
                string error = token.ContainsKey("error") ? (string)token["error"] : "unknown";
                if (error == "slow_down") interval += 5;
                else if (error != "authorization_pending") throw new InvalidOperationException("Microsoft sign-in: " + error);
            }
            throw new TimeoutException("Sign-in expired. Try again.");
        }
        public static void Refresh(MailAccount account) {
            if (account.Provider != "Microsoft" || account.ExpiresUtc > DateTime.UtcNow) return;
            Apply(account, Post("token", new NameValueCollection { { "client_id", account.ClientId }, { "grant_type", "refresh_token" }, { "refresh_token", account.RefreshToken }, { "scope", Scope } }));
        }
    }
}
