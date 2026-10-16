# TMA-Mail account setup

## For people using the app

On the welcome screen or in **Settings → Accounts**, choose:

- **Sign in with Outlook** — continue to Microsoft's sign-in page in your default browser.
- **Sign in with Gmail** — continue to Google's sign-in page in your default browser.
- **Sign in with iCloud** — enter your iCloud Mail address and an Apple app-specific password. The IMAP/SMTP settings are automatic. The form links to your Apple Account to generate a password; do not enter your normal Apple Account password.
- **Other Provider / Advanced Setup** — enter the IMAP/SMTP details supplied by your email provider.

You can also **Explore for now** without connecting anything. Provider selection does not require an email address. Use Back to change your choice; Cancel abandons the current sign-in. TMA-Mail tests both receiving and sending connections before saving the account.

For Gmail accounts that support app passwords, **Use a Google app password instead** is available on the Gmail screen. Google requires 2-Step Verification for app passwords, and some accounts cannot use them. [Google app-password instructions](https://support.google.com/accounts/answer/185833).

Apple documents [third-party access](https://support.apple.com/en-us/121539), [app-specific passwords](https://support.apple.com/en-us/102654), and [iCloud Mail connection settings](https://support.apple.com/en-us/102525). This build uses the app-password method; the iCloud button is not a claim that generic Sign in with Apple grants mailbox access.

## Developer setup: enable Outlook and Gmail once per build

General users should never have to register an application, enter a client ID, or choose mail server ports for a known provider. The app publisher configures the provider registrations before distributing the build. This repository currently has **no registered provider client IDs**. The chooser clearly reports an unconfigured provider instead of pretending that sign-in will work. iCloud/app-password and custom IMAP connections do not need these OAuth registrations.

Copy `provider-settings.example.json` to `provider-settings.json` in the source root and fill in the publisher's registrations. The real file is ignored by Git. `build.ps1` copies it beside the executable; if it is absent, the build uses the empty example. The portable ZIP includes the build configuration.

```json
{
  "OutlookClientId": "YOUR-MICROSOFT-APPLICATION-ID",
  "GmailClientId": "YOUR-GOOGLE-DESKTOP-CLIENT-ID.apps.googleusercontent.com",
  "GmailDesktopClientSecret": "YOUR-GOOGLE-DESKTOP-CLIENT-VALUE"
}
```

Use only installed/desktop client registrations here. Desktop OAuth client values are distributed with the application and cannot be treated as confidential server secrets. Never put a web-service client secret, a user's password, or a user's refresh token into this file. User tokens and the MSAL cache are separately protected with Windows DPAPI.

### Outlook / Hotmail / Microsoft 365

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com/) with an account allowed to register apps. A personal account may first need access to an Entra directory or developer tenant.
2. Choose **App registrations → New registration**, name it **TMA-Mail**, and select **Accounts in any organizational directory and personal Microsoft accounts**.
3. Under **Authentication**, add **Mobile and desktop applications** with redirect URI **http://localhost** for system-browser sign-in. This is a desktop/public client, not a web app or SPA. Do not create a client secret.
4. Add the delegated Outlook/Exchange permissions **IMAP.AccessAsUser.All** and **SMTP.Send**. Work tenants may require administrator consent and must permit IMAP/authenticated SMTP.
5. Copy the public **Application (client) ID** to `OutlookClientId`, then rebuild and package.

Microsoft sign-in now uses the official MSAL library with the system browser, PKCE, and a protected token cache. MSAL handles token renewal. Existing 0.7 device-code connections continue to renew using their saved credentials.

References: [Microsoft native-app authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Outlook IMAP/SMTP scopes](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth), [MSAL system browser](https://learn.microsoft.com/en-us/entra/msal/dotnet/acquiring-tokens/using-web-browsers).

### Gmail

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select the publisher's project, enable Gmail, and configure the Google Auth Platform branding, audience, and consent screen.
2. Create an OAuth client with application type **Desktop app**. Copy its client ID and installed-app client value into `GmailClientId` and `GmailDesktopClientSecret`.
3. Request `openid`, `email`, and **https://mail.google.com/**. The latter is the scope required for Gmail IMAP/SMTP and is restricted. Public distribution needs Google's applicable verification requirements; while testing, add the intended accounts as test users. Testing-mode refresh tokens may expire and require sign-in again.
4. Rebuild and package. Users select Gmail and finish consent on Google's site; the app reads the verified signed-in email address automatically.

Google sign-in uses the official Google .NET library's PKCE flow with a loopback callback and default browser. It uses no embedded web view and no plaintext Google credential store. Refresh tokens are saved only inside TMA-Mail's protected account file.

References: [Google desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Gmail OAuth scope requirements](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol), [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

## First live verification and current limits

Automated tests use synthetic accounts and fake delivery. A read-only check against the connected IMAP mailbox discovered 14 server folders, preserved the latest message HTML, and successfully entered IMAP IDLE. It did not send mail or change message flags, credentials, or cached mail. Outlook/Gmail browser sign-in and round-trip delivery remain **unverified**. After enabling a provider, verify sign-in, receiving, a small message to an address you own, reply/attachment, read/star, and Trash/restore before relying on the build.

Add multiple accounts under **Settings → Accounts → Add email account**. Expand an email-address heading to see its folders, or choose **Open mailbox** in Settings. New Inbox mail is detected through IMAP IDLE when supported, with polling otherwise. Every account and its custom/nested server folders refresh automatically every 30 seconds while the app runs. Initial sync starts after connecting; the footer shows folder/item progress. Green confirms the selected server is connected and Windows has a network; red indicates a connection issue or a connection still being established. A network adapter alone does not guarantee Internet access.

Sync caches the latest 200 messages per selectable server folder; messages over 25 MB are excluded. Server drafts are readable; composing and editing drafts saves a local copy. Full-history download and a signed installer are not included. TLS is required and certificate failures are never ignored.

HTML email keeps its formatting and embedded images. Choose **Load images** to allow external HTTPS pictures for that message. Windows 10/11 x64, .NET Framework 4.8, and the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) are required for HTML reading; if the runtime is unavailable, the app falls back to text. Message scripts do not run.

If sending is interrupted, check the server's Sent folder and the recipient before retrying. SMTP acceptance is not a guarantee of final delivery. Removing an account removes its credentials and selects another saved mailbox, or returns to Explore mode when none remain. Its encrypted cache is retained. Revoke provider consent through Microsoft/Google/Apple account settings when required.

Live mail and credentials live under `%LOCALAPPDATA%\TMA-Mail` and are DPAPI-protected for the Windows user. Settings/signature templates and sample mail remain local unencrypted JSON. Copying DPAPI files to another Windows account is not a backup strategy.
