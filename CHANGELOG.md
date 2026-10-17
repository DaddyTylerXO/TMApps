# TMA-Mail changelog

Development history reconstructed from the local prototype milestones. Earlier versions were local builds, not previously published GitHub releases.

## 0.12.0 beta — 17 October 2026

- Enlarge the red unread icon badge and remove the simultaneous Windows overlay drawing; keep 99+ and zero/disabled clearing behavior.
- Remove native white DatePicker text borders. Add All day with cleared/disabled times, named calendar selection/creation, custom Every recurrence intervals, and preset/custom reminder offsets.
- Add a calendar selector before the month/year. Connect Outlook/Google calendar access separately from mail, or discover iCloud calendars through CalDAV/app-specific passwords. Gate provider reads/uploads behind a saved opt-in setting; keep queued events locally after errors. Read provider events and upload new all-day/recurring/reminder events. Add local calendar exports and copying local events to a connected provider. Existing provider-event editing/deletion and meeting invitations are not supported.
- Add persistent in-app and desktop reminders, enabled by default while the app runs, with shared Calendar/Notifications controls, snooze, dismiss and dismiss-all.
- Add double-click mail pop-outs with captured message/account context and green action bars. Expand right-click mail options with copy, print, reply, reply all, forward, follow-up, categories, read/star and filing actions. Normalize Inbox display casing.
- Add horizontal/vertical overflow and a draggable lower edge to resize the main action bar. Add account-specific Fast Functions with named move/read/star/reply/flag/category buttons and removal menus.
- Apply forest-green header/rail and green selected tabs to Settings while retaining neutral content backgrounds.
- Extend synthetic workspace, provider-transport and actual editor/reminder integration checks. Provider requests are intercepted; no live calendar writes, unsubscribe requests or email sends are performed by tests.

## 0.11.0 beta — 17 October 2026

- Add a slim rounded green progress bar below subscription scan counts, showing progress through the current folder and completing when scanning finishes.
- Style Mailbox management and Calendar like New message. Calendar view changes the navigation actions to Add to Calendar and Return to Mailbox, and removes the separate Mail action from the calendar toolbar.
- Add a local event editor with title, start/end dates and times, location, and daily/weekly/monthly/yearly recurrence with a repeat count. Save encrypted calendar data on this PC; imported calendars remain read-only and no invitations or provider changes are sent.
- Make None explicitly stop playback. Remove Notification, Chime and Exclamation choices and migrate those saved selections to Cozy. Missing custom WAV files report an error without playing a Windows fallback sound.
- Replace grey desktop banners with rounded forest-green cards, a green accent border, the TMA-Mail logo, New Mail / Mail Sent titles, and sender/recipient plus subject details. Add independent address and subject privacy toggles and incoming/sent previews.
- Add a red unread inbox badge across connected accounts to the running app icon and Windows taskbar overlay, capped visually at 99+. Remove it at zero or when disabled in Notifications settings. Static desktop shortcuts retain their standard icon.
- Extend synthetic tests for event creation/recurrence/escaping, invalid durations, sound migration/silence, notification privacy and persistence, contextual navigation, and live unread badge updates. No real email, unsubscribe request, or calendar provider write was sent.

## 0.10.0 beta — 16 October 2026

- Update unread folder counts immediately for local read/unread changes and as server folder status arrives, including custom folder labels. Add Appearance setting to mark messages read when opened, off by default, including clicking an already-selected first message.
- Remove the Connected Mail badge, keep the profile button at its original header height when Spotify is on, and fit a rounded Spotify card before the profile/new-message controls. Move branding toward the top, add a mail-plus header composer button, and move Sync beside the connection light in the footer.
- Expand the main toolbar with Reply, Reply all, Forward, Follow up, Categorise, Print text, Save .eml and Apps. Preserve embedded images when reconstructing an exported MIME message. Follow-up/category metadata remains local.
- Add Mailbox Management below New message. Scan server message headers on a separate read-only IMAP connection for mailing lists, display individual and bulk selection controls, and request one-click unsubscribe via explicit reviewed HTTPS POST. Browser/mailto senders remain manual; accepted requests are not presented as guaranteed removal. Scan history is private and protected.
- Add Calendar below Mailbox Management and a large month view with day details, navigation, and a return-to-mail action. Add Calendar settings for provider .ics exports, public HTTPS/webcal links, email invitation attachments, and week-start preference. Support time zones, floating local times, all-day events, recurrences and exceptions using iCal.NET 5.2.3. Imports are read-only snapshots, not continuous provider calendar synchronization.
- Add a functional web-tool plug-in manager for TMA-Mail JSON manifests, with install confirmation, enable/disable, removal, and toolbar launchers. No mail content or account permissions are supplied to these tools. Outlook add-in host APIs are not implemented and Outlook add-ins are explicitly unsupported.
- Add App Info with installed version, on-demand GitHub branch update checks, and a browser download action. Publish update.json alongside each portable build.
- Create seven original soft incoming sounds and seven distinct outgoing sounds, including Cozy defaults for fresh profiles and six alternatives per direction. Retain existing users' sound selections and custom WAV support.
- Add 42 synthetic suite checks for defaults/counts, header/footer layout, calendar recurrence/time zones/floating time, sound files, manifests, reply-all, and intercepted unsubscribe POST. Existing mailbox/settings/layout/connection/provider and large-cache responsiveness tests pass. No real unsubscribe, calendar provider mutation, or external email was sent during verification.
- Verify the expanded mailbox and imported calendar in a native synthetic workspace. Include new runtime dependencies, sounds, plug-in documentation, update manifest and license notices in the portable package.
## 0.9.2 beta — 16 October 2026

- Fix an expensive sync path that serialized, encrypted, and rewrote the complete cache on the UI thread after every folder. Merge completed folders in memory, persist changed data once per sync in a worker, and retain completed batches after an interrupted sync.
- Reuse loaded mailbox stores when switching accounts, load inactive caches in the background, and avoid resetting unchanged message lists. Refresh only the displayed folder when its contents change.
- Replace JSON round-trip cloning and repeated full-cache UID scans with lightweight message copies and folder/UID dictionaries. Share immutable body/attachment data and omit computed presentation properties from serialized caches.
- Coalesce progress updates at background dispatcher priority, prevent overlapping periodic sync cycles, and reuse parsed folder-menu templates. Enable message-list container recycling explicitly.
- Save read/star cache updates asynchronously. Order concurrent writes so an older snapshot cannot replace a newer one, and finish pending sync/cache work asynchronously when exiting instead of blocking the window thread.
- Set native scrollbar thumb minimum length to 44 pixels using WPF Track resources, and apply the same minimum to HTML-reader scrollbars.
- Expand the collapsed sidebar to 88 pixels, centre folder icons in 44-pixel targets, keep custom folders as icons with full tooltips, and use one mailbox chooser rather than stacked account buttons.
- Pass the existing suite and 43 synthetic workspace checks. Add a real WPF responsiveness regression using 2,400 synthetic messages (roughly 40 MB), background DPAPI cache writes, UI timer activity, minimise/restore during saving, latest-write ordering, unchanged-folder reuse, and measured 44-pixel vertical/horizontal thumbs. The measured run processed 87 UI timer ticks during the initial write; snapshot capture rounded to 0 ms.
- Verify the collapsed sidebar visually and rerun the isolated WebView2 picture/script-policy test. No real mailbox data was changed or uploaded. Live-provider sync throughput remains unbenchmarked; the responsiveness check exercises local cache/merge work.
## 0.9.1 beta — 16 October 2026

- Load external HTTPS email pictures automatically by default. Add an Appearance toggle with live preview/Cancel restoration to return to per-message Load images. Keep message scripts, forms, frames, and unrelated resources blocked.
- Prefer readable HTML content for message-list previews instead of plain-text open-in-browser boilerplate. Reuse prepared preview text and the WebView2 image cache; keep original email links usable in the default browser.
- Replace native and HTML-reader scrollbars with rounded green thumbs and subtle tracks, including horizontal scroll support.
- Add draggable green dividers for folders, the message list, and the preview. Save pane dimensions, support right/top/bottom layouts, and retain minimum reading space.
- Match imported folders to the standard sidebar text size, weight, and colour. Add a rounded folder menu with Mark all as read, favourites, appearance editing, and Delete folder.
- Add per-mailbox/per-path folder icons, colour swatches, custom hex colours, previews, and Reset. Mark all as read covers the complete server folder, beyond the 200 cached messages. Folder deletion requires confirmation; server system folders and folders containing subfolders are protected.
- Pass 40 synthetic workspace checks plus the existing mailbox, settings, layout, connection, and provider suite. Verify automatic/blocked picture loading with intercepted synthetic image responses in the real WebView2 runtime; no external image server contacted.
- Verify both pane edges by dragging in a synthetic Windows workspace, inspect scrollbars and the appearance editor. No real folders were deleted or marked read during testing. Sender image availability and live folder mutations remain outside this verification.
## 0.9.0 beta — 16 October 2026

- Add a protected multi-account catalog with migration from the existing single-account file. Keep mailbox caches separate and preserve saved sign-in credentials when switching accounts.
- Start sync automatically after connecting. Use IMAP IDLE to watch Inbox changes, polling when unavailable, a 30-second all-folder refresh, and automatic reconnect attempts. Keep manual Sync available.
- Discover selectable custom and nested server folders, server Drafts, and special folders. Group folders under collapsible email-address headings and allow custom-folder favourites and moves.
- Show live mailbox/folder/item progress in the footer. Add a neon green/red connection indicator reflecting the active server and Windows network availability.
- Preserve incoming MIME HTML and embedded CID graphics. Add an isolated WebView2 reader with Load images for external HTTPS pictures, disabled message scripts, restricted resources/navigation, and a plain-text fallback.
- Put Settings at the bottom left and make Accounts the first settings section. List saved accounts with Open, Reconnect, Remove, and Add email account actions using the provider chooser.
- Add a rounded profile menu for editing name/signatures, choosing a local profile photo, and opening account settings. Preserve live preview and Cancel restoration for profile preferences.
- Keep local composition drafts separate when editing a server draft. Protect account selection and queued operations from mailbox switches and stale watcher credentials.
- Add 27 automated live-workspace checks for account migration, cache isolation, custom folders, HTML policy, profile preview, and account management. Existing mailbox/settings/layout/connection/provider tests pass.
- Verify HTML formatting, tables, and an embedded graphic in the actual WebView2 runtime; confirm message scripts remain disabled. Check the Accounts/profile screens in an isolated synthetic workspace.
- Verify a connected mailbox read-only: discover 14 server folders, preserve the newest message HTML, and successfully enter IMAP IDLE. No mail was sent and no message flags or saved account/cache files were changed. Real incoming-arrival and round-trip sending tests remain outstanding.
- Package the WebView2 SDK/native loader and license notices. HTML reading requires the separately installed Microsoft Edge WebView2 Runtime on Windows x64. Keep the latest-200-per-folder and 25 MB message limits documented.
## 0.8.2 beta — 16 October 2026

- Fix iCloud IMAP/SMTP TLS failures caused by the executable's missing .NET target-framework metadata. Explicitly target .NET Framework 4.8 and let Windows select the TLS protocol for mail connections.
- Keep normal certificate and revocation validation enabled. Add application-scoped strong-crypto/system-default TLS settings without changing Windows settings.
- Replace the oversized connection-error dump with concise messages and an optional scrollable connection-details panel.
- Add regression checks for framework metadata and production mail-client TLS/certificate policy, plus an optional password-free Apple endpoint smoke check.
- Verify both Apple endpoints negotiate TLS 1.3 with normal certificate validation. This confirms transport connectivity; account authentication and mail delivery still require the user's own sign-in.

## 0.8.1 beta — 16 October 2026

- Add a question-mark help button beside the iCloud app-specific password label. Clicking it reveals Apple Account instructions, the two-factor authentication requirement, and a direct link to Apple's UK support guide. Click again to hide the instructions.

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
