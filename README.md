# TMA-Mail

A native Windows desktop mail client with forest green navigation, neutral dark/light themes, a rich composer, and customisable layouts.

**Version 0.9.2 beta** improves sync responsiveness, adds a 44-pixel minimum scrollbar thumb, and gives the collapsed sidebar more room with centred icons and a mailbox chooser.

## Download and run

Download [the Windows portable ZIP](dist/TMA-Mail-0.9.2-beta-windows.zip), extract the whole folder, and open `TMA-Mail.exe`. Keep the configuration, XAML, and DLL files together. Requires Windows 10/11 x64 with .NET Framework 4.8. HTML reading uses the Microsoft Edge WebView2 Runtime; plain-text reading remains available if it is missing. The executable is unsigned.

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
- Multiple named signatures with independent new/reply defaults and an advanced editor for graphics and templates.

## Your workspace

- Three-pane mailbox, search, unread filtering, Ctrl/Shift multi-selection, favourites, and bulk actions.
- Live footer progress identifies the mailbox, folder, and item count. A neon green indicator means the active mail server is connected and Windows reports a network; red means disconnected, reconnecting, or waiting for confirmation.
- Bottom-left Settings opens Accounts first. The profile bubble offers name/signature editing, a local profile photo, and account settings.
- Forest green navigation; neutral dark mode by default and light mode in Appearance.
- A roomier 88-pixel collapsed sidebar with centred folder icons, 44-pixel targets, full folder-name tooltips, and a mailbox chooser.
- Movable/collapsible navigation ribbon and independently movable inbox list. Drag the green edge of either pane to resize it; widths are saved. Top/bottom message lists support height adjustment. Rounded green scrollbars cover native panes and the HTML reader, with a 44-pixel minimum thumb length.
- Imported folders match the sidebar typography. Right-click to mark the entire server folder read, edit its icon/text colour, pin it, or delete it. Deletion requires confirmation, is permanent, and is unavailable for provider system folders or folders with children.
- Live settings preview: Save keeps changes and Cancel restores the previous settings.
- Startup folder, maximize/minimize, optional Windows sign-in startup, and close-to-tray.
- Incoming/outgoing notification banners and sounds, custom WAV previews, and an optional Spotify desktop media widget with placement and playback controls.
- Matching green-envelope Windows executable/title-bar/tray icon and animated tree/envelope splash.

Keyboard shortcuts: Ctrl+N compose, Ctrl+F search, Ctrl+, settings, Ctrl+Shift+B collapse navigation, Delete move to Trash, Ctrl+Z undo local moves outside text fields. In composing, Ctrl+S saves a draft and Ctrl+Enter sends through a connected account.

## Build, test, package

```powershell
.\build.ps1
.\test.ps1
.\package.ps1
```

Or `start.ps1` to build and launch. Build uses the Windows .NET Framework C# compiler, so no separate SDK is required. First build downloads pinned NuGet dependencies via `restore.ps1`. Output: `build/v0.9.2/`. Close that executable before rebuilding.

For provider browser sign-in, copy `provider-settings.example.json` to ignored `provider-settings.json`, configure desktop OAuth registrations as described in [SETUP.md](SETUP.md), then rebuild. A blank configuration still allows Explore mode, iCloud/app-password connections, and custom IMAP/SMTP.

Tests cover mailbox operations, preferences, layouts, rich signatures/composing, encrypted storage, MIME, delivery success/failure, and 35 provider-setup checks for routing, presets, hidden advanced fields, dependency loading, and Explore mode. The default suite uses synthetic accounts and never sends external mail. It includes 43 checks for account migration, separate caches, folder navigation, HTML resource policy, and profile settings. Optional `test-reader.ps1` checks formatted HTML and an embedded image in the actual WebView2 runtime and verifies message scripts stay disabled. The default suite also writes a roughly 40 MB encrypted synthetic mailbox while measuring dispatcher activity, minimises/restores the real WPF window during the write, verifies latest-write ordering and unchanged-folder reuse, and measures both scrollbar thumb directions. This is a local responsiveness regression check, not a live-provider throughput benchmark. Optional `test-media.ps1` checks local media discovery.
Optional `test-tls.ps1` verifies Apple IMAP/SMTP TLS connectivity using the production mail-client settings, without credentials or sending mail. Version 0.8.2 corrects the executable's .NET target and TLS defaults; both Apple endpoints were verified with TLS 1.3 and standard certificate checks.

`package.ps1` includes runtime files, provider deployment configuration, documentation, and third-party notices, never user profiles, test data, or account credentials. It generates a ZIP and SHA-256 checksum. [THIRD_PARTY.md](THIRD_PARTY.md) lists dependencies; [CHANGELOG.md](CHANGELOG.md) records development milestones.

## Data and beta limits

Default data folder: `%LOCALAPPDATA%\TMA-Mail`. Account secrets/MSAL cache are protected in `account.protected`; connected mail uses per-account protected caches. Settings/signature templates and the older sample mailbox remain unencrypted local JSON. DPAPI files are tied to your Windows user. Disconnect removes saved account credentials and retains the encrypted cache; revoke provider consent through your provider account settings when required.

Multiple saved accounts are supported, with one selected mailbox at a time. Background sync runs while the app is open; it is not a Windows service. Full-history sync and a signed installer remain outstanding. Composing saves local drafts; editing a server draft makes a local copy. Deleted or renamed server folders disappear from navigation on the next successful discovery, but older encrypted cache entries may remain on disk. Profile names, signatures, and photos are shared across the workspace. Desktop banners appear while the app runs and are not persistent Windows Notification Center entries. Spotify controls need an active desktop media session. SMTP acceptance does not guarantee final delivery; if sending is interrupted, check Sent/the recipient before retrying.

Close older versions before opening this build: the saved account file migrates to a multi-account catalog. Do not run older builds against the migrated profile. `--data-dir <path>` selects an isolated test profile, `--setup` reopens the provider chooser, and `--splash-preview` displays the animated splash only.
