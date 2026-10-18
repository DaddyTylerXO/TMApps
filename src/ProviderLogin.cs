using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Identity.Client;
using Google.Apis.Auth;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;

namespace Postbox {
    // Deployment configuration: never shown as fields in the user's sign-in journey.
    public sealed class ProviderConfiguration {
        public string OutlookClientId { get; set; }
        public string GmailClientId { get; set; }
        public string GmailDesktopClientSecret { get; set; }
        public static ProviderConfiguration Load() {
            string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "provider-settings.json");
            return File.Exists(path) ? new JavaScriptSerializer().Deserialize<ProviderConfiguration>(File.ReadAllText(path)) ?? new ProviderConfiguration() : new ProviderConfiguration();
        }
        public bool Ready(string provider) {
            Guid value;
            return provider == "Microsoft" ? Guid.TryParse(OutlookClientId, out value) && value != Guid.Empty : provider == "Gmail" && !String.IsNullOrWhiteSpace(GmailClientId) && GmailClientId.EndsWith(".apps.googleusercontent.com", StringComparison.OrdinalIgnoreCase) && !String.IsNullOrWhiteSpace(GmailDesktopClientSecret);
        }
    }
    public static class ProviderLogin {
        private static readonly string[] OutlookScopes = { "https://outlook.office.com/IMAP.AccessAsUser.All", "https://outlook.office.com/SMTP.Send" };
        private static readonly string[] GmailScopes = { "openid", "email", "https://mail.google.com/" };
        public static bool UsesOAuth(MailAccount account) { return account.Provider == "Microsoft" || account.AuthMethod == "OAuth"; }
        private static IPublicClientApplication MicrosoftClient(MailAccount account) {
            var client = PublicClientApplicationBuilder.Create(account.ClientId).WithAuthority("https://login.microsoftonline.com/common").WithRedirectUri("http://localhost").Build();
            client.UserTokenCache.SetBeforeAccess(args => { if (!String.IsNullOrEmpty(account.AuthCache)) args.TokenCache.DeserializeMsalV3(Convert.FromBase64String(account.AuthCache)); });
            client.UserTokenCache.SetAfterAccess(args => { if (args.HasStateChanged) account.AuthCache = Convert.ToBase64String(args.TokenCache.SerializeMsalV3()); });
            return client;
        }
        private static void ApplyMicrosoft(MailAccount account, AuthenticationResult result) {
            account.Email = WelcomeFlow.ValidateEmail(result.Account.Username); account.UserName = account.Email;
            account.AccessToken = result.AccessToken; account.ExpiresUtc = result.ExpiresOn.UtcDateTime.AddSeconds(-90); account.AuthMethod = "OAuth";
        }
        private static PkceGoogleAuthorizationCodeFlow GoogleFlow(MailAccount account, bool calendar = false) {
            return new PkceGoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer { ClientSecrets = new ClientSecrets { ClientId = account.ClientId, ClientSecret = account.ClientSecret }, Scopes = calendar ? new[] { "openid", "email", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.calendarlist.readonly" } : GmailScopes, Prompt = "consent select_account", DataStore = null });
        }
        public static async Task SignIn(MailAccount account, ProviderConfiguration config, CancellationToken cancellation, bool calendar = false) {
            if (!config.Ready(account.Provider)) throw new InvalidOperationException("Provider sign-in has not been enabled for this build yet.");
            if (account.Provider == "Microsoft") {
                account.ClientId = config.OutlookClientId;
                var client = MicrosoftClient(account);
                var result = await client.AcquireTokenInteractive(calendar ? new[] { "https://graph.microsoft.com/Calendars.ReadWrite" } : OutlookScopes).WithUseEmbeddedWebView(false).WithPrompt(Prompt.SelectAccount).ExecuteAsync(cancellation).ConfigureAwait(false);
                ApplyMicrosoft(account, result);
            } else if (account.Provider == "Gmail") {
                account.ClientId = config.GmailClientId; account.ClientSecret = config.GmailDesktopClientSecret;
                using (var flow = GoogleFlow(account, calendar)) {
                    var credential = await new AuthorizationCodeInstalledApp(flow, new LocalServerCodeReceiver()).AuthorizeAsync(Guid.NewGuid().ToString("N"), cancellation).ConfigureAwait(false);
                    if (String.IsNullOrEmpty(credential.Token.RefreshToken)) throw new InvalidOperationException("Google did not grant ongoing access. Please try signing in again and approve mail access.");
                    var identity = await GoogleJsonWebSignature.ValidateAsync(credential.Token.IdToken, new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { account.ClientId } }).ConfigureAwait(false);
                    if (!identity.EmailVerified) throw new InvalidOperationException("Google did not return a verified email address.");
                    account.Email = WelcomeFlow.ValidateEmail(identity.Email); account.UserName = account.Email;
                    account.AccessToken = credential.Token.AccessToken; account.RefreshToken = credential.Token.RefreshToken;
                    account.ExpiresUtc = DateTime.UtcNow.AddSeconds((credential.Token.ExpiresInSeconds ?? 3600) - 90); account.AuthMethod = "OAuth";
                }
            } else throw new ArgumentException("Choose Outlook or Gmail for browser sign-in.");
        }
        public static void Refresh(MailAccount account, bool calendar = false, CancellationToken cancellation = default(CancellationToken)) {
            cancellation.ThrowIfCancellationRequested();
            if (account.ExpiresUtc > DateTime.UtcNow) return;
            if (account.Provider == "Microsoft") {
                // Keep existing 0.7 device-code connections working after upgrading.
                if (String.IsNullOrEmpty(account.AuthCache)) { if (calendar) throw new InvalidOperationException("Reconnect calendar access."); MicrosoftLogin.Refresh(account); return; }
                var client = MicrosoftClient(account); var identity = client.GetAccountsAsync().GetAwaiter().GetResult().FirstOrDefault();
                if (identity == null) throw new InvalidOperationException("Please reconnect Outlook from Accounts.");
                ApplyMicrosoft(account, client.AcquireTokenSilent(calendar ? new[] { "https://graph.microsoft.com/Calendars.ReadWrite" } : OutlookScopes, identity).ExecuteAsync(cancellation).GetAwaiter().GetResult());
            } else if (account.Provider == "Gmail" && account.AuthMethod == "OAuth") {
                using (var flow = GoogleFlow(account, calendar)) {
                    var token = flow.RefreshTokenAsync(account.Id, account.RefreshToken, cancellation).GetAwaiter().GetResult();
                    account.AccessToken = token.AccessToken; if (!String.IsNullOrEmpty(token.RefreshToken)) account.RefreshToken = token.RefreshToken;
                    account.ExpiresUtc = DateTime.UtcNow.AddSeconds((token.ExpiresInSeconds ?? 3600) - 90);
                }
            }
        }
    }
}
