# TMA-Mail

A native Windows desktop mail client with forest green navigation, neutral dark/light themes, a rich composer, and customisable layouts.

**Version 0.7.0 beta** adds real IMAP/SMTP mail connections. Automated checks pass; live provider sign-in and delivery have not yet been verified. Outlook/Hotmail requires a Microsoft application registration before first use. Follow [SETUP.md](SETUP.md).

## Download and run

Download [the Windows portable ZIP](dist/TMA-Mail-0.7.0-beta-windows.zip), extract the whole folder, and open `TMA-Mail.exe`. Keep the configuration, XAML, and DLL files together. Requires Windows 10/11 with .NET Framework 4.8. The executable is currently unsigned.

On first launch, add an address to continue to account setup, or choose **Explore for now** to see sample messages without connecting anything. Use **Connect an account** later to sign in. The Windows executable, taskbar/title bars, and tray use the matching green envelope icon.

## Connected mail

- Microsoft Outlook/Hotmail/Microsoft 365 browser sign-in using a registered public client ID, with protected refresh tokens.
- Gmail with a Google app password, and custom IMAP/SMTP providers with provider-supported credentials.
- Required TLS with standard certificate validation; no insecure fallback.
- Manual Sync and automatic refresh every 60 seconds while running.
- Receive the latest 200 messages per Inbox/Sent/Archive/Trash folder. Cache message bodies and refresh remote read/star flags. Messages larger than 25 MB are excluded from this initial sync window.
- Real SMTP delivery with To/Cc/Bcc, plain text and HTML alternatives, rich formatting, inline signature graphics, and attachments up to 20 MB total.
- Server read/unread, stars, move, archive, and Trash/restore. Server folders must be advertised as special-use folders. Server moves do not use the local move-undo history.
- Windows DPAPI protection for credentials/tokens and the connected mail cache. Sample mail stays separate and is never transmitted automatically.
- Local drafts, with warnings for interrupted or uncertain delivery. Disconnected mode saves drafts only and cannot simulate a successful send.

## Workspace and writing

- Three-pane mailbox, current-folder search, unread filter, Ctrl/Shift multi-selection, favourite folders, and bulk actions.
- Forest green sidebar with neutral dark mode by default; light mode in Appearance.
- Move/collapse the navigation ribbon and independently move the inbox list to any edge.
- Settings preview changes immediately; Save keeps them and Cancel restores previous choices.
- Profile editing, multiple named signatures, separate new/reply defaults, and advanced signature graphics/templates.
- Rounded composing toolbar with fonts, styles, colours, lists, alignment, links, tables, attachments, importance, flags, and local contacts.
- Windows spellcheck, dictation, read aloud, word count, reading view, and RTF body import/export.
- Incoming/outgoing notification banners, independent sound choices, and custom WAV previews. Banners appear while running and are not persistent Windows Notification Center entries.
- Startup folder, maximize/minimize, optional launch at Windows sign-in, and close-to-tray. Startup registration changes only when saved.
- Optional local Spotify media widget with placement options, previous/play-pause/next. Requires an active Spotify desktop media session.

Keyboard shortcuts: Ctrl+N compose, Ctrl+F search, Ctrl+, settings, Ctrl+Shift+B collapse navigation, Delete move to Trash, Ctrl+Z undo local moves outside text fields. In composing, Ctrl+S saves a draft and Ctrl+Enter sends through a connected account.

## Build, test, package

From PowerShell in this source folder:

```powershell
.\build.ps1
.\test.ps1
.\package.ps1
```

Or `start.ps1` to build and launch. The Windows .NET Framework C# compiler is used directly; no .NET SDK is required. First build downloads pinned NuGet dependencies through `restore.ps1`. Source is in `src/`, test code in `tests/`, and output in `build/v0.7-release/`. Close that executable before rebuilding it.

Tests cover 21 mailbox checks, 34 preference checks, XAML layouts, eight navigation layouts, dark/light themes, live-settings and signature behavior, rich drafts, and 18 connection checks for encrypted storage, MIME/HTML, delivery success/failure, and the icon. No external email is sent by tests. Optional `test-media.ps1` checks local Windows media-session discovery; live Spotify playback control is not certified by the automated suite.

`package.ps1` includes only runtime files and documentation, never local profiles, test data, or credentials. It writes a ZIP and SHA-256 checksum. [THIRD_PARTY.md](THIRD_PARTY.md) lists dependency versions and included licenses.

## Data and current limits

Default data folder: `%LOCALAPPDATA%\TMA-Mail`. Credentials are in `account.protected`; each account has a separate `mail-<id>.protected` cache. DPAPI binds these files to the Windows user. Settings, saved signature templates, and the older sample `mailbox.json` remain unencrypted local JSON. Keep older prototypes closed when using the same profile. `--data-dir <path>` selects an isolated profile for testing; `--setup` opens onboarding and `--splash-preview` shows only the animated splash.

This beta supports one active account, local drafts, a limited sync window, and safe text reading of incoming HTML (remote content is not loaded). Full-history/custom-folder sync, Gmail OAuth, account switching UI, a signed installer, and live-provider verification remain outstanding. An SMTP acceptance is not a guarantee of final delivery; check bounced messages normally. Disconnect removes credentials and keeps the encrypted cache; revoke Microsoft access through your Microsoft account if required.

See [CHANGELOG.md](CHANGELOG.md) for the progression from the original local prototype through the current beta, and [SETUP.md](SETUP.md) for account setup and the first live test.
