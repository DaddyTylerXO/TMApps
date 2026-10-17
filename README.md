# TMA-Mail

A native Windows desktop mail client with forest green navigation, neutral dark/light themes, a rich composer, and customisable layouts.

**Version 0.14.1 beta** adds inbox filters and sorting, drag-to-swap toolbar editing, multi-action Fast Functions with recipient presets, music Widgets settings, full-Inbox mail analytics, and green controls across menus.

## Download and run

Download [the Windows portable ZIP](dist/TMA-Mail-0.14.1-beta-windows.zip), extract the whole folder, and open `TMA-Mail.exe`. Keep the configuration, XAML, and DLL files together. Requires Windows 10/11 x64 with .NET Framework 4.8. HTML reading uses the Microsoft Edge WebView2 Runtime; plain-text reading remains available if it is missing. The executable is unsigned.

Choose a provider or **Explore for now** with sample mail. You can add an account later through Settings → Accounts. Outlook and Gmail use the official provider sign-in page in your default browser; iCloud asks only for a mail address and an Apple app-specific password. Manual IMAP/SMTP fields are under Advanced Setup. Gmail also offers an app-password fallback.

**Microsoft/Google sign-in must be enabled by the app publisher before distribution.** No provider registrations have been supplied for this repository yet. Unconfigured builds explain this on the relevant sign-in screen; ordinary users never see client-ID/server fields for Outlook or Gmail. [SETUP.md](SETUP.md) separates user instructions from the one-time developer configuration. Outlook/Gmail sign-in and round-trip delivery remain unverified. A read-only check verified the connected IMAP server, folder discovery, HTML extraction, and IMAP IDLE.

## Mail and writing

- Required-TLS IMAP/SMTP connections using MailKit/MimeKit, normal certificate validation, and no insecure fallback.
- Official MSAL Outlook browser sign-in and Google PKCE browser sign-in, automatic account address discovery, and token renewal. Existing 0.7 Microsoft connections remain compatible.
- Windows DPAPI protection for account secrets, OAuth/MSAL caches, and connected mail. Sample mail stays separate.
- Automatic initial sync, IMAP IDLE for new Inbox mail, reconnect attempts, and a 30-second refresh of all connected mailboxes and folders. Servers without IDLE use polling. Manual Sync remains available. Cache serialization/encryption runs in the background, once per changed sync rather than after every folder. Unchanged folders keep their rows, and overlapping timer refreshes are skipped. The latest 200 messages per selectable server folder are cached; messages over 25 MB are excluded.
- Server folder discovery includes custom/nested folders, Junk, and server Drafts. Mailboxes have separate email-address headings and encrypted caches.
- HTML reading preserves tables, formatting, and embedded CID images. External HTTPS pictures load automatically by default, using the browser image cache. Switch this off under **Settings → Appearance → Load email pictures automatically** to use **Load images** per message. External image servers may receive image requests; unavailable or slow sender servers can still delay pictures. Scripts, forms, downloads, and embedded frames are disabled; links open in your browser.
- Real SMTP sending with To/Cc/Bcc, plain text and HTML alternatives, attachments up to 20 MB total, and inline signature graphics. Disconnected mode saves drafts only.
- Server read/unread, stars, move, archive, and Trash/restore. Local drafts and local move undo; server moves are not in the undo history.
- Rich composing with rounded toolbar buttons, fonts, styles, colours, lists, alignment, links, tables, importance, flags, contacts, RTF import/export, word count, spellcheck, dictation, read aloud, and reading view.
- Opening a message leaves it unread by default. Turn on **Settings → Appearance → Automatically mark messages as read when I open them** to change this. Manual read/unread actions update the folder count immediately; server counts update during sync.
- The main toolbar includes Reply, Reply all, Forward, Follow up, Categorise, Print (text), Save .eml, and Apps. Follow-up flags and categories are local workspace metadata.
- Multiple named signatures with independent new/reply defaults and an advanced editor for graphics and templates.

## Your workspace

- Three-pane mailbox, search, unread/read/flagged/important/attachment filters, newest/oldest sorting, Ctrl/Shift multi-selection, favourites, and bulk actions.
- Live footer progress identifies the mailbox, folder, and item count. A neon green indicator means the active mail server is connected and Windows reports a network; red means disconnected, reconnecting, or waiting for confirmation.
- Mailbox Management scans all selectable server folders for List-Unsubscribe headers, with checkboxes and bulk unsubscribe requests where senders advertise one-click support. Other senders need a browser/email step. Scanning is read-only, cancellable by closing the dialog, and runs on its own connection. A discovered list does not prove the subscription is still active.
- Notifications use green branded cards with optional address/subject details, silent None, and an optional red unread inbox badge on the running app/taskbar icon (99+ cap). Desktop shortcuts keep the static logo.
- Add to Calendar supports named calendar selection, all-day dates, reminders, and counted recurrence including custom intervals such as every four days. The calendar header switches calendars and creates custom local calendars. Return to Mailbox restores email navigation.
- **Settings → Calendar** connects Outlook/Google through separate calendar OAuth consent and iCloud through CalDAV with an app-specific password. Provider sync starts disabled and must be enabled and saved. Connected calendars refresh about every two minutes and when opening another month; newly created events upload to the selected writable calendar. Pending events remain protected locally after failures. Local calendars can queue copies to a connected provider or export .ics. Existing provider-event editing/deletion and meeting invitations/responses are not implemented. Provider connections are covered by intercepted transport tests; live provider round trips are unverified.
- In-app and desktop calendar reminders are enabled by default while TMA-Mail runs. Calendar and Notifications settings share the same controls. The reminder window supports Dismiss, Dismiss all, and Snooze; state survives restarts. Closing the app stops reminder delivery. Imports of .ics files, public HTTPS/webcal export URLs and cached mail invitations remain read-only snapshots.
- Double-click received mail for a separate TMA-Mail reading window with green action buttons. Right-click mail for copy, print, reply, reply all, forward, flags, categories and filing. Drag the mail toolbar's lower green edge to change height; overflow can scroll horizontally. Edit Bar enables drag-to-swap action ordering. Fast Functions can combine up to 12 actions with recipient/folder/category settings; right-click a button to edit or remove it. Replies and forwards open a composer for review.
- **Settings → Add-ins / plug-ins** installs TMA-Mail JSON web-tool launchers, with enable/disable and removal. Outlook Office.js/COM/VSTO add-ins are not supported; see [PLUGINS.md](PLUGINS.md).
- **Settings → App Info** shows the installed version and checks the GitHub branch update manifest on demand. Downloads open in the browser; the app does not install updates automatically.
- Bottom-left Settings opens Accounts first. The profile bubble offers name/signature editing, a local profile photo, and account settings.
- Forest green navigation; neutral dark mode by default and light mode in Appearance.
- A roomier 88-pixel collapsed sidebar with centred folder icons, 44-pixel targets, full folder-name tooltips, and a mailbox chooser.
- Movable/collapsible navigation ribbon and independently movable inbox list. Drag the green edge of either pane to resize it; widths are saved. Top/bottom message lists support height adjustment. Rounded green scrollbars cover native panes and the HTML reader, with a 44-pixel minimum thumb length.
- Imported folders match the sidebar typography. Right-click to mark the entire server folder read, edit its icon/text colour, pin it, or delete it. Deletion requires confirmation, is permanent, and is unavailable for provider system folders or folders with children.
- Live settings preview: Save keeps changes and Cancel restores the previous settings.
- Startup folder, maximize/minimize, optional Windows sign-in startup, and close-to-tray.
- Seven original soft sound choices for each direction (14 WAV files), with Cozy defaults, silent None, and custom WAV support. Old Windows Notification/Chime/Exclamation selections migrate to Cozy. Incoming/outgoing notification banners and an optional music widget include placement and playback controls in Settings → Widgets (Spotify, YouTube Music, Apple Music or Amazon Music).
- Matching green-envelope Windows executable/title-bar/tray icon and animated tree/envelope splash.

Keyboard shortcuts: Ctrl+N compose, Ctrl+F search, Ctrl+, settings, Ctrl+Shift+B collapse navigation, Delete move to Trash, Ctrl+Z undo local moves outside text fields. In composing, Ctrl+S saves a draft and Ctrl+Enter sends through a connected account.

## Build, test, package

```powershell
.\build.ps1
.\test.ps1
.\package.ps1
```

Or `start.ps1` to build and launch. Build uses the Windows .NET Framework C# compiler, so no separate SDK is required. First build downloads pinned NuGet dependencies via `restore.ps1`. Output: `build/v0.14.1/`. Close that executable before rebuilding.

For provider browser sign-in, copy `provider-settings.example.json` to ignored `provider-settings.json`, configure desktop OAuth registrations as described in [SETUP.md](SETUP.md), then rebuild. A blank configuration still allows Explore mode, iCloud/app-password connections, and custom IMAP/SMTP.

Tests cover mailbox operations, preferences, layouts, rich signatures/composing, encrypted storage, MIME, delivery success/failure, and 35 provider-setup checks for routing, presets, hidden advanced fields, dependency loading, and Explore mode. The default suite uses synthetic accounts and never sends external mail. It includes 43 checks for account migration, separate caches, folder navigation, HTML resource policy, and profile settings. Optional `test-reader.ps1` checks formatted HTML and an embedded image in the actual WebView2 runtime and verifies message scripts stay disabled. An additional 71 suite checks cover reading defaults/counts, the new layout, calendar recurrence/time zones/floating local time, 14 sound files, manifest validation, reply-all, and intercepted unsubscribe POST requests. No real subscription is changed during testing. Seventeen provider-calendar checks intercept HTTP for Graph, Google and CalDAV, and fourteen integration checks exercise the actual event editor, protected persistence, snooze and dismiss. No live provider calendar is read or written by these checks. The default suite also writes a roughly 40 MB encrypted synthetic mailbox while measuring dispatcher activity, minimises/restores the real WPF window during the write, verifies latest-write ordering and unchanged-folder reuse, and measures both scrollbar thumb directions. This is a local responsiveness regression check, not a live-provider throughput benchmark. Optional `test-media.ps1` checks local media discovery.
Optional `test-tls.ps1` verifies Apple IMAP/SMTP TLS connectivity using the production mail-client settings, without credentials or sending mail. Version 0.8.2 corrects the executable's .NET target and TLS defaults; both Apple endpoints were verified with TLS 1.3 and standard certificate checks.

`package.ps1` includes runtime files, provider deployment configuration, documentation, and third-party notices, never user profiles, test data, or account credentials. It generates a ZIP and SHA-256 checksum. [THIRD_PARTY.md](THIRD_PARTY.md) lists dependencies; [CHANGELOG.md](CHANGELOG.md) records development milestones.

## Data and beta limits

Default data folder: `%LOCALAPPDATA%\TMA-Mail`. Account secrets/MSAL cache are protected in `account.protected`; connected mail uses per-account protected caches. Imported calendars, discovered subscriptions, and plug-in catalogs also use DPAPI-protected files. Settings/signature templates and the older sample mailbox remain unencrypted local JSON. DPAPI files are tied to your Windows user. Disconnect removes saved account credentials and retains the encrypted cache; revoke provider consent through your provider account settings when required.

Multiple saved accounts are supported, with one selected mailbox at a time. Background sync runs while the app is open; it is not a Windows service. Full-history sync and a signed installer remain outstanding. Composing saves local drafts; editing a server draft makes a local copy. Deleted or renamed server folders disappear from navigation on the next successful discovery, but older encrypted cache entries may remain on disk. Profile names, signatures, and photos are shared across the workspace. Desktop banners appear while the app runs and are not persistent Windows Notification Center entries. Music controls need an active Windows media session; unrecognised/browser players require choosing their source in Widgets. Shared browser sources can follow another tab. SMTP acceptance does not guarantee final delivery; if sending is interrupted, check Sent/the recipient before retrying.

Close older versions before opening this build: the saved account file migrates to a multi-account catalog. Do not run older builds against the migrated profile. `--data-dir <path>` selects an isolated test profile, `--setup` reopens the provider chooser, and `--splash-preview` displays the animated splash only.

## Optional TMApps Launcher profile

TMApps Launcher 1.8.0 can share an optional display name and multiple email addresses with TMA-Mail 0.14.1 or later on the same Windows user account. Configure this through the launcher's top-right profile icon and enable sharing. Mail imports the name and offers those addresses during account setup, at startup and within a few seconds while running. Existing connected account addresses and credentials remain unchanged.

This does not sign you in. Connect each mailbox in Mail using its app-specific password/key (where required, such as iCloud) or provider sign-in. Launcher profile sharing never supplies or transfers passwords, app keys, or tokens. Disable sharing in the launcher to remove suggestions and stop future profile updates; connected accounts and the existing Mail display name remain.

The shared file is `%LOCALAPPDATA%\TMApps\profile.json`. Custom `--data-dir` profiles do not read it by default; `--launcher-profile <path>` explicitly opts them in. This is local sharing, not cloud/device sync.
