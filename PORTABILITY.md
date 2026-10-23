# TMA-Mail: macOS and Linux migration plan

Prepared 17 October 2026. This is a migration plan, not a claim that the current Windows ZIP runs on macOS or Linux. Keep the existing Windows release supported throughout the work.

## Implementation status — 23 October 2026

Migration has started in [cross-platform/](cross-platform/README.md). The shared .NET 10 core links the Windows account/message models, mail transport, sync and provider-login source. A sample-only Avalonia desktop window, authenticated encrypted profile-file implementation and synthetic/headless checks are implemented. The existing Windows application still builds and its regression suite passes after extraction.

Stage 1 is in progress: native credential-vault adapters, persistent account repositories and the remaining calendar/analytics extraction are outstanding. The new OS-matrix workflow exercises shared code and renders development previews; check its actual results before claiming a target has passed. Production macOS and Linux support, real-account validation, HTML/rich-editor proofs, signing and full feature parity are **not complete**. The public Windows update manifest remains on 0.16.5.

## Proposed approach

Build an Avalonia desktop interface on a supported .NET LTS release, with shared mail/calendar services and small platform adapters. Avalonia is a reasonable candidate because the app already uses C# and XAML concepts. Its [WPF migration guide](https://docs.avaloniaui.net/docs/migration/wpf/) describes the differences; this app still needs substantial work because its UI, storage, HTML reader and Windows integrations are coupled together.

Evaluate the proposed HTML renderer and rich editor before committing to the full migration. Avalonia's [web-content documentation](https://docs.avaloniaui.net/docs/app-development/embedding-web-content) describes WebView2 on Windows, WKWebView on macOS, and Linux web-engine prerequisites. Confirm the selected component's distribution licence and test remote-image blocking, CID images, script disabling, navigation interception and clipboard behaviour on each target. Do not treat replacing the WebView control alone as sufficient.

## Source audit and replacement work

| Area | Current source | Migration work |
| --- | --- | --- |
| Mail, MIME and sync | MailTransport.cs, SyncTransport.cs, MailStore.cs | Extract non-UI models and services. Revalidate MailKit/MimeKit and dependency versions on modern .NET. Retain IMAP IDLE, cancellation and serialized mailbox writes. |
| Calendars and analytics | CalendarProviders.cs, SuiteServices.cs, MailboxTools.cs | Separate provider clients, recurrence and grouping from WPF controls. Keep provider-write opt-in and bulk-operation review. |
| UI and composing | App.cs, MainWindow.xaml, Composer.cs, ComposerVisuals.cs | Rebuild views and commands in Avalonia. Replace WPF FlowDocument/RTF editing with a tested rich editor and an explicit draft/signature conversion path. |
| Credentials and encrypted caches | Accounts.cs and ProtectedFile consumers | Introduce a credential-vault interface with Windows, macOS and Linux implementations. Keep the current Windows reader for controlled migration. |
| HTML email | HtmlMessageView.cs | Provide platform renderers with equivalent image/privacy policies and no automatic script execution. Keep plain-text fallback. |
| Tray, unread badges and notifications | SettingsUi.cs, SuiteUi.cs | Use platform implementations. Windows taskbar overlays, macOS Dock badges and Linux desktop/tray capabilities differ; expose supported settings per platform. |
| Music widget | Spotify.cs | Retain Windows media sessions behind an adapter. Evaluate Linux MPRIS and a supported macOS media integration; show an unavailable state where a player exposes no supported controls. |
| Audio, printing, speech and startup | Sounds.cs, Composer.cs, SettingsUi.cs | Replace SoundPlayer, Windows speech, WPF printing and registry startup. Preserve the bundled WAV assets. Offer capability-based fallbacks rather than inactive buttons. |
| Provider login | ProviderLogin.cs, ProviderSetup.cs | Revalidate system-browser OAuth, loopback callbacks, redirect registrations and token-vault integration separately on all three systems. |
| Distribution and updates | build.ps1, package.ps1, update.json | Move to SDK projects and CI builds per OS/architecture. Publish platform-specific packages and update metadata. |

Windows DPAPI-protected files cannot simply be copied to another OS: Microsoft's [ProtectedData documentation](https://learn.microsoft.com/dotnet/api/system.security.cryptography.protecteddata) identifies it as Windows-only. Prefer signing accounts in again on the new platform and resyncing server mail. For local-only drafts, signatures, calendars and settings, design an explicit user-initiated export/import format; never silently downgrade encrypted secrets to plain text.

## Delivery stages and acceptance gates

1. **Extract and test the shared core.** Establish SDK-style projects and service interfaces without changing the shipping WPF app. Run existing MIME, sync, recurrence, analytics and data-integrity checks against the extracted code.
2. **Prove the riskiest UI pieces.** On Windows, macOS and Linux, demonstrate HTML mail with images, rich composing, secure credential persistence, tray lifecycle and provider login. Resolve renderer/editor licensing and native-library requirements here.
3. **Implement the mailbox shell.** Port accounts, folders, search/filter/sort, reading/pop-outs, editing, Fast Functions and Mailbox Management. Verify large-mailbox responsiveness and accessibility on each OS.
4. **Port calendar and desktop integrations.** Add calendar providers/reminders, notifications, music, audio and startup options through the platform adapters. Document any platform-specific limits in Settings.
5. **Package and validate.** Test clean installs, upgrades, uninstall/reinstall data handling, offline use, minimize/restore, TLS errors and interrupted operations. Sign/notarize macOS packages using the owner's signing setup; validate Linux dependencies on declared distributions and desktop sessions. Continue Windows regression tests.

Initially target Windows x64, macOS Apple Silicon and Linux x64; add other architectures after the same acceptance gates. Declare supported OS/distro versions only after testing on them. macOS and Linux release approval requires actual target-system testing, not just cross-compilation from this Windows workspace. No reliable release date follows from this audit alone; the renderer/editor and credential-migration proofs determine the remaining work.
