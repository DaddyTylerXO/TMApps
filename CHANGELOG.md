# TMA-Mail changelog

Development history reconstructed from the local prototype milestones. Earlier versions were local builds, not previously published GitHub releases.

## 0.8.0 beta — 16 October 2026

- Replace the email-entry welcome screen with logo buttons for Sign in with Outlook, Sign in with Gmail, Sign in with iCloud, and Other Provider / Advanced Setup, plus Explore for now.
- Replace the overwhelming Accounts form with the same provider chooser and focused steps with Back and Cancel.
- Move IMAP/SMTP hosts, ports, and optional username into Advanced Setup only. Remove client-ID fields from the user-facing account journey.
- Add official MSAL system-browser sign-in for Outlook and official Google .NET PKCE system-browser sign-in for Gmail, automatic signed-in address discovery, protected token caching, and renewal. Preserve existing Microsoft device-code and Gmail app-password account compatibility.
- Add publisher-level provider configuration via ignored `provider-settings.json`; include a blank example. Unconfigured providers explain that sign-in is not enabled for the build rather than attempting fake authentication.
- Add automatic iCloud server presets and a simple email/app-specific-password form with an Apple Account link. Keep a simple Gmail app-password fallback.
- Add 31 provider-setup checks covering routing, hidden fields, provider presets, authentication dependency loading, Back, Explore, and connection handoff. The existing test suite also passes.
- Verify welcome and iCloud form appearance in the native Windows app. Update portable packaging, license notices, and separate user/developer setup instructions.
- Live provider sign-in/delivery remains unverified pending publisher app registrations and user authorization. Apple Account mailbox OAuth is not claimed by the iCloud app-password flow.

## 0.7.0 beta — 16 October 2026

- Replaced the generic Windows icon with the application's green envelope: executable, title bars, compose/settings windows, startup window, and tray. Included 16–256 px icon assets.
- Added MailKit/MimeKit-based IMAP receiving and SMTP sending over required TLS, with normal certificate validation.
- Added Microsoft device-code browser sign-in and refresh-token support, Gmail app-password settings, and custom IMAP/SMTP configuration.
- Test both IMAP and SMTP before saving an account. Microsoft requires a developer-owned public client ID; see SETUP.md.
- Protect credentials/tokens and connected mail caches with Windows DPAPI. Keep sample mail separate from real accounts.
- Add manual Sync and automatic 60-second refresh for the latest 200 messages in Inbox, Sent, Archive, and Trash; reuse cached message bodies and refresh remote flags.
- Apply read/unread, stars, moves, archive, and Trash/restore to the server. Drafts remain local; server moves are not part of the local Ctrl+Z undo history.
- Send MIME plain text and HTML alternatives, formatting, links, tables, attachments, and inline signature graphics. Remove simulated send behavior; disconnected composing can save drafts only.
- Keep failed sends as drafts with an uncertain-delivery guard. Treat SMTP acceptance separately from Sent-copy/cache failures to prevent accidental retries.
- Add setup documentation, dependency license notices, portable packaging, and 18 connection tests covering DPAPI, cache isolation, MIME, HTML, delivery outcomes, and icon resources.
- Validation: build and automated checks pass. Live Microsoft/Gmail/custom-provider sign-in and round-trip delivery remain unverified pending user setup. This is a beta, not a certified production release.

## 0.6 — local prototype

- Animated startup splash with a swaying tree and falling envelopes; respect Windows reduced animation preferences.
- First-run welcome: save an address or explore without an account. Preserve setup state and skip onboarding for existing profiles.
- Revisit email profile setup from Accounts; use the saved address as the composing identity.

## 0.5 / 0.5.1 — local prototype

- Align composing tools to the left and split To, Cc, and Bcc into individual rounded cards.
- Preview settings live; Save commits changes, Cancel restores the previous settings.
- Named signatures with separate defaults for new messages and replies/forwards.
- Advanced signature editor with rich formatting, embedded graphics, built-in templates, and saved custom templates.
- Independently position the inbox list and navigation ribbon on any edge.
- Optional Spotify desktop media widget with previous, play/pause, next, and placement settings.

## 0.4 / 0.4.1 — local prototype

- Refine composing with rounded pill buttons, line icons, writing cards, and compact toolbars.
- Limit forest green to navigation; use neutral charcoal surfaces for the inbox, preview, settings, and composer.
- Improve active tab styling, spacing, and light-mode compatibility.

## 0.3 — local prototype

- Forest green navigation and dark mode by default, with a light/dark appearance setting.
- Ctrl/Shift multi-selection, batch actions, move menu, and local move undo.
- Favourite folders with a separate ribbon tab and edge-aligned settings/collapse controls.
- Rich composer: To/Cc/Bcc, fonts, formatting, colours, lists, alignment, links, tables, attachments, importance, and follow-up flags.
- Local contacts, Windows spellchecking, dictation, read aloud, reading view, and RTF import/export.

## Early prototype milestones

- Rename Postbox to TMA-Mail.
- Profile/name/signature editing, Windows startup preferences, minimize/maximize options, close-to-tray, incoming/outgoing notification choices, sounds, and custom WAV files.
- Movable and collapsible navigation ribbon and configurable text sizes.
- Original WPF three-pane mailbox, fictional sample messages, search, folders, stars, read/unread, archive, Trash/restore, compose/reply/forward, local drafts, and simulated local sending.
- Atomic local JSON persistence and recovery copies for malformed data.
