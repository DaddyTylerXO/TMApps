# TMA-Mail

A native Windows desktop mail client with forest green navigation, neutral dark/light themes, a rich composer, and customisable layouts.

**Version 0.8.2 beta** simplifies adding an account. Welcome and Accounts now offer provider buttons with Outlook, Gmail, and iCloud logos, plus **Other Provider / Advanced Setup**. You no longer enter an email address on the welcome screen.

## Download and run

Download [the Windows portable ZIP](dist/TMA-Mail-0.8.2-beta-windows.zip), extract the whole folder, and open `TMA-Mail.exe`. Keep the configuration, XAML, and DLL files together. Requires Windows 10/11 with .NET Framework 4.8. The executable is unsigned.

Choose a provider or **Explore for now** with sample mail. You can add an account later through Accounts. Outlook and Gmail use the official provider sign-in page in your default browser; iCloud asks only for a mail address and an Apple app-specific password. Manual IMAP/SMTP fields are under Advanced Setup. Gmail also offers an app-password fallback.

**Microsoft/Google sign-in must be enabled by the app publisher before distribution.** No provider registrations have been supplied for this repository yet. Unconfigured builds explain this on the relevant sign-in screen; ordinary users never see client-ID/server fields for Outlook or Gmail. [SETUP.md](SETUP.md) separates user instructions from the one-time developer configuration. Live provider sign-in/delivery remains unverified.

## Mail and writing

- Required-TLS IMAP/SMTP connections using MailKit/MimeKit, normal certificate validation, and no insecure fallback.
- Official MSAL Outlook browser sign-in and Google PKCE browser sign-in, automatic account address discovery, and token renewal. Existing 0.7 Microsoft connections remain compatible.
- Windows DPAPI protection for account secrets, OAuth/MSAL caches, and connected mail. Sample mail stays separate.
- Manual Sync and automatic refresh every 60 seconds while running, with the latest 200 messages per Inbox/Sent/Archive/Trash folder. Messages over 25 MB are excluded.
- Real SMTP sending with To/Cc/Bcc, plain text and HTML alternatives, attachments up to 20 MB total, and inline signature graphics. Disconnected mode saves drafts only.
- Server read/unread, stars, move, archive, and Trash/restore. Local drafts and local move undo; server moves are not in the undo history.
- Rich composing with rounded toolbar buttons, fonts, styles, colours, lists, alignment, links, tables, importance, flags, contacts, RTF import/export, word count, spellcheck, dictation, read aloud, and reading view.
- Multiple named signatures with independent new/reply defaults and an advanced editor for graphics and templates.

## Your workspace

- Three-pane mailbox, search, unread filtering, Ctrl/Shift multi-selection, favourites, and bulk actions.
- Forest green navigation; neutral dark mode by default and light mode in Appearance.
- Movable/collapsible navigation ribbon and independently movable inbox list.
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

Or `start.ps1` to build and launch. Build uses the Windows .NET Framework C# compiler, so no separate SDK is required. First build downloads pinned NuGet dependencies via `restore.ps1`. Output: `build/v0.8.2/`. Close that executable before rebuilding.

For provider browser sign-in, copy `provider-settings.example.json` to ignored `provider-settings.json`, configure desktop OAuth registrations as described in [SETUP.md](SETUP.md), then rebuild. A blank configuration still allows Explore mode, iCloud/app-password connections, and custom IMAP/SMTP.

Tests cover mailbox operations, preferences, layouts, rich signatures/composing, encrypted storage, MIME, delivery success/failure, and 35 provider-setup checks for routing, presets, hidden advanced fields, dependency loading, and Explore mode. They never authenticate to real providers or send external mail. Optional `test-media.ps1` checks local media discovery.
Optional `test-tls.ps1` verifies Apple IMAP/SMTP TLS connectivity using the production mail-client settings, without credentials or sending mail. Version 0.8.2 corrects the executable's .NET target and TLS defaults; both Apple endpoints were verified with TLS 1.3 and standard certificate checks.

`package.ps1` includes runtime files, provider deployment configuration, documentation, and third-party notices, never user profiles, test data, or account credentials. It generates a ZIP and SHA-256 checksum. [THIRD_PARTY.md](THIRD_PARTY.md) lists dependencies; [CHANGELOG.md](CHANGELOG.md) records development milestones.

## Data and beta limits

Default data folder: `%LOCALAPPDATA%\TMA-Mail`. Account secrets/MSAL cache are protected in `account.protected`; connected mail uses per-account protected caches. Settings/signature templates and the older sample mailbox remain unencrypted local JSON. DPAPI files are tied to your Windows user. Disconnect removes saved account credentials and retains the encrypted cache; revoke provider consent through your provider account settings when required.

One active account, local drafts, limited-window sync, and text reading of incoming HTML are supported. Full-history/custom-folder sync, a signed installer, and live-provider verification remain outstanding. Desktop banners appear while the app runs and are not persistent Windows Notification Center entries. Spotify controls need an active desktop media session. SMTP acceptance does not guarantee final delivery; if sending is interrupted, check Sent/the recipient before retrying.

Keep older prototypes closed when sharing a profile. `--data-dir <path>` selects an isolated test profile, `--setup` reopens the provider chooser, and `--splash-preview` displays the animated splash only.
