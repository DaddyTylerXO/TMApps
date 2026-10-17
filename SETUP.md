# TMA-Mail account setup

In v0.11, **Settings → Notifications** controls banner addresses, subjects, and the unread inbox badge on the running app's Windows taskbar/icon. The badge sums Inbox unread counts across added accounts, shows 99+ above 99, and disappears at zero. Desktop shortcut files retain the static logo. Choosing None stops audio; missing WAV files do not fall back to a Windows sound.

On Calendar, **Add to Calendar** chooses a writable calendar, dates/times or All day, location, a repeat count, and reminders. Custom recurrence supports an Every interval. The header's calendar selector can create named local calendars. Local calendars remain on this PC unless you explicitly copy their events to a connected provider. **Return to Mailbox** restores the mail view.

## Connecting provider calendars (v0.12)

Open **Settings → Calendar → Connect provider calendar**. Outlook and Google use separate calendar authorization in your browser; mail-only authorization does not grant this access. iCloud uses your Apple Account email and an app-specific password, with the option to reuse the matching iCloud mailbox's saved app password. Tick one or more calendars in the green list and choose Add selected calendars, or choose Add all calendars. Select all and Clear selection adjust the checkboxes. Adding multiple calendars opens the All Calendars view. Reconnecting a calendar preserves its cached events and pending changes. Read-only calendars cannot receive new events. Connecting saves a separate encrypted calendar login; remove that calendar connection separately if you no longer want it saved.

To activate automatic refresh and uploads, enable **Sync connected provider calendars** and click **Save changes**. Previewing this checkbox cannot enable external writes. Turning it off pauses automatic refresh and uploads; explicit downloads remain available and an already-running request may finish. Reads refresh about every two minutes while the app runs, and another month loads on demand. New events targeting a connected writable calendar are queued locally, then uploaded when sync is enabled. Local calendar cards also offer **Copy events to provider calendar** and **Export .ics**. There is no provider deletion or meeting invitation/response flow in this release. Live calendar round trips require user sign-in and remain unverified; automated tests intercept requests without contacting providers.

Publisher configuration: use the existing public client registrations. Add delegated Microsoft Graph **Calendars.ReadWrite** permission for the calendar flow ([Microsoft create-event documentation](https://learn.microsoft.com/en-us/graph/api/calendar-post-events?view=graph-rest-1.0)). Enable Google Calendar API and include **calendar.events** and **calendar.calendarlist.readonly** in the OAuth consent configuration ([Google scopes](https://developers.google.com/workspace/calendar/api/auth), [event insertion](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)). The application requests these separately from mail scopes. Work/school tenants may require administrator consent. iCloud discovery, queries, and event writes use CalDAV ([protocol specification](https://www.rfc-editor.org/rfc/rfc4791)); Apple describes [app-specific passwords here](https://support.apple.com/en-gb/102654).

**Calendar loading:** Connecting a provider calendar or pressing Sync downloads events even while automatic sync is disabled; queued events upload only after enabling and saving provider sync. Choose All Calendars in the calendar list to combine their events. iCloud mail sign-in alone does not connect calendars: use Settings → Calendar → Connect provider calendar.

**Calendar reminders** can be controlled in either Calendar or Notifications settings. In-app popups start enabled; desktop banners start disabled for new settings. Enable Show desktop calendar notifications to use the same green logo/title/detail layout as mail banners. Existing saved choices are preserved. Settings → Calendar also offers a Calendar reminder sound selector, including None, Custom WAV and a preview button; it is independent of incoming/sending mail sounds. Reminders support exact time, preset offsets and custom minutes; Snooze and Dismiss are persisted in `calendar-reminders.protected`. They run while TMA-Mail is open, not through a Windows background service. Local events and calendar logins/outboxes are protected in `calendars.protected`. Imports are still snapshots; adding mail via IMAP alone does not connect a provider calendar.

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

Official builds from 0.15.4 include TMA-Mail’s public Microsoft Application ID, so choose Outlook and Continue with Outlook. Microsoft asks you to approve mailbox access; connecting calendars requests calendar access separately. Organization policies and publisher verification requirements may require an administrator. No client secret or user tokens are distributed.

For your own fork or registration:

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com/) with an account allowed to register apps. A personal account may first need access to an Entra directory or developer tenant.
2. Choose **App registrations → New registration**, name it **TMA-Mail**, and select **Accounts in any organizational directory and personal Microsoft accounts**.
3. Under **Authentication**, add **Mobile and desktop applications** with redirect URI **http://localhost** for system-browser sign-in. This is a desktop/public client, not a web app or SPA. Do not create a client secret.
4. Add the delegated Outlook/Exchange permissions **IMAP.AccessAsUser.All** and **SMTP.Send**. Work tenants may require administrator consent and must permit IMAP/authenticated SMTP.
5. Copy the public **Application (client) ID** to `OutlookClientId`, then rebuild and package.

Microsoft sign-in now uses the official MSAL library with the system browser, PKCE, and a protected token cache. MSAL handles token renewal. Existing 0.7 device-code connections continue to renew using their saved credentials.

References: [Microsoft native-app authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Outlook IMAP/SMTP scopes](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth), [MSAL system browser](https://learn.microsoft.com/en-us/entra/msal/dotnet/acquiring-tokens/using-web-browsers).

### Gmail

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select the publisher's project, enable Gmail, and configure the Google Auth Platform branding, audience, and consent screen.
2. Create an OAuth client with application type **Desktop app**. Copy its client ID and installed-app client value into `GmailClientId` and `GmailDesktopClientSecret` in the ignored local `provider-settings.json`; do not put the client secret in public configuration or distribute it.
3. Request `openid`, `email`, and **https://mail.google.com/**. The latter is the scope required for Gmail IMAP/SMTP and is restricted. Public distribution needs Google's applicable verification requirements; while testing, add the intended accounts as test users. Testing-mode refresh tokens may expire and require sign-in again.
4. Rebuild and package. Users select Gmail and finish consent on Google's site; the app reads the verified signed-in email address automatically.

Google desktop client configuration is retained locally in ignored provider-settings.json and excluded from public packages. Its Google registration is in **Testing**; only named test users can use browser sign-in. The Google app-specific password option remains available independently. Calendar connections request separate consent for `https://www.googleapis.com/auth/calendar.events` (view/edit events) and `https://www.googleapis.com/auth/calendar.calendarlist.readonly` (list subscribed calendars); enable the Google Calendar API for the same project. Mail setup does not automatically connect a calendar: use **Settings → Calendar → Connect provider calendar**.

Google sign-in uses the official Google .NET library's PKCE flow with a loopback callback and default browser. It uses no embedded web view and no plaintext Google credential store. Refresh tokens are saved only inside TMA-Mail's protected account file.

References: [Google desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Gmail OAuth scope requirements](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol), [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

## First live verification and current limits

Automated tests use synthetic accounts and fake delivery. A read-only check against the connected IMAP mailbox discovered 14 server folders, preserved the latest message HTML, and successfully entered IMAP IDLE. It did not send mail or change message flags, credentials, or cached mail. The account holder confirmed Outlook sign-in. Google browser sign-in, mail/calendar token renewal, Gmail IMAP/SMTP login and discovery of two calendars passed a read-only live check with local configuration on 17 October 2026. Actual message sending and calendar writes remain **unverified**. After enabling a provider, verify sign-in, receiving, a small message to an address you own, reply/attachment, read/star, and Trash/restore before relying on the build.

Add multiple accounts under **Settings → Accounts → Add email account**. Expand an email-address heading to see its folders, or choose **Open mailbox** in Settings. New Inbox mail is detected through IMAP IDLE when supported, with polling otherwise. Every account and its custom/nested server folders refresh automatically every 30 seconds while the app runs. Initial sync starts after connecting; the footer shows folder/item progress. Green confirms the selected server is connected and Windows has a network; red indicates a connection issue or a connection still being established. A network adapter alone does not guarantee Internet access.

Sync caches the latest 200 messages per selectable server folder; messages over 25 MB are excluded. Server drafts are readable; composing and editing drafts saves a local copy. Full-history download and a signed installer are not included. TLS is required and certificate failures are never ignored.

HTML email keeps its formatting and embedded images. External HTTPS pictures load automatically by default. To require **Load images** per message, turn off **Settings → Appearance → Load email pictures automatically**. Pictures depend on the sender image server; slow or unavailable resources cannot be repaired by the app. Unsubscribe links open in your browser; TMA-Mail does not submit unsubscribe forms automatically. Windows 10/11 x64, .NET Framework 4.8, and the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) are required for HTML reading; if the runtime is unavailable, the app falls back to text. Message scripts do not run.

If sending is interrupted, check the server's Sent folder and the recipient before retrying. SMTP acceptance is not a guarantee of final delivery. Removing an account removes its credentials and selects another saved mailbox, or returns to Explore mode when none remain. Its encrypted cache is retained. Revoke provider consent through Microsoft/Google/Apple account settings when required.

Live mail and credentials live under `%LOCALAPPDATA%\TMA-Mail` and are DPAPI-protected for the Windows user. Settings/signature templates and sample mail remain local unencrypted JSON. Copying DPAPI files to another Windows account is not a backup strategy.

## Calendar, subscriptions, tools and updates

Calendar imports live under Settings → Calendar. Export .ics from your provider, import a public HTTPS/webcal calendar link, or import invitations already cached from the chosen mailbox. Imports take effect immediately and are read-only snapshots. To update a linked calendar, import its URL again; the previous snapshot for that URL/account is replaced. Private authenticated calendar APIs and continuous provider calendar synchronization are not enabled by IMAP sign-in.

Mailbox Management → Scan mailbox discovers mailing lists from message headers across the server folders without marking mail read. This can take time for a large mailbox; closing the dialog cancels scanning. Headers do not provide an authoritative list of current subscriptions. Review sender and destination before confirming unsubscribe requests. Bulk requests work only for advertised one-click HTTPS endpoints; other lists need their own page/email process. TMA-Mail does not verify sender DKIM signatures, and never sends unsubscribe requests until you select and confirm them. A successful HTTP response means the request was accepted, not that removal has completed. Local/private network endpoints, URL credentials and redirects are not used for these requests.

Settings → Add-ins / plug-ins supports the web-tool format described in PLUGINS.md. It does not run Outlook add-ins. Calendar, plug-in and subscription data is stored privately with Windows DPAPI. Settings → App Info checks update.json on the TMA-Mail GitHub branch on demand and opens newer downloads in your browser. Close older builds before replacing the portable folder; keep all DLLs, Sounds, XAML and configuration together.

## Mail tools and Widgets (v0.14)

Use the folder filter dropdown for unread, read, flagged/starred, important or attachments. The arrow button switches newest/oldest order. These filters operate on cached message bodies. In Mailbox Management choose Mailbox Analytics, then Scan Mailbox to count full server Inbox envelopes read-only. It does not scan automatically. Switching pages or closing Management cancels scanning. Mailbox Subscriptions has its own separate Scan Mailbox, Select All and Unsubscribe From Selected controls.

Analytics shows green headings for the top-ten subject and sender lists. Each result can select every matching email or move/delete the full group. Move Selected and Delete Selected act on combined selections without counting overlapping subject/sender matches twice. Actions include uncached Inbox emails identified by the scan's server UIDs and UIDVALIDITY. Confirm the count and destination before proceeding. Delete moves messages to Trash; it does not permanently expunge them. After an interrupted server operation, scan again before retrying. Live server bulk operations remain unverified by automated tests.

Appearance and Notifications both offer the same unread badge setting. The application logo retains its original dimensions; Windows displays the count as a separate taskbar overlay. The overlay clears at zero unread or when disabled. Static desktop shortcuts retain their normal logo.

Choose Edit Bar, drag a mail action onto another to swap them, then choose Done Editing. Saved Fast Function buttons can also swap within their own row. Right-click a Fast Function to edit its name and ordered actions. Move actions show a folder selector; replies/forwards show sender or custom-recipient fields; category actions show their own category choice. Replies and forwards open for review and are never sent automatically. Later actions continue after saving/sending the composer; closing an unchanged composer stops the chain. If a server move cannot be uniquely resolved after sync, later actions stop rather than targeting another email. Local importance, follow-up and category changes do not rewrite provider message headers.

Settings → Widgets appears below Appearance. Select None to hide music options or choose Spotify, YouTube Music, Apple Music or Amazon Music, then choose a position. Automatic matches the app's Windows media identity. If the player is a browser/PWA or does not match, start playback, refresh media sessions, and select its source. Only playback that the app exposes to Windows can be controlled. A browser source shared by multiple tabs may follow another tab. Provider playback and full live Inbox analytics remain unverified; automated checks use synthetic data.
## Name and email suggestions from TMApps Launcher

The optional launcher profile can supply your display name and email suggestions. Saving an email in the launcher does not connect a mailbox: open Mail account setup, choose an address/provider, and complete its required app-specific password/key or provider sign-in. The launcher never stores these credentials. Existing connected addresses and their saved authentication remain separate.
