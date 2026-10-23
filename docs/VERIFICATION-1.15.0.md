# Launcher 1.15 verification

The launcher update adds individual email fields, an optional local profile photo, a showcase details layout, manual service checks, themed window controls, reorganised settings, installation loading indicators, and a branded macOS installer. Previously prepared Spotify and profile-sharing components are included. License and legal decisions are outside this update.

## Executed local checks

- Windows: 210 functional checks passed, including real WPF profile editing, cancellation, sharing controls, settings, app details, support actions, Service Status, installer and package lifecycle fixtures. Startup/idle measurement: 498 ms, 102.53 MiB working set and approximately 0.05% normalized CPU in this run.
- Native client: 56 tests passed, with one platform-specific skip on Windows. Coverage includes install/update/uninstall, package verification, OAuth PKCE and cancellation, profile merge/opt-out, gallery navigation, email row limits, local photo normalization, manual endpoint indicators, settings search and support forms. Tests use synthetic accounts and local provider fixtures.
- Real Electron renderer smoke passed on Windows with Node access disabled, eight app cards, architecture metadata and isolated state. Observed startup was 248 ms and summed process memory 336.15 MiB. Matching-runner macOS/Linux checks are performed by release CI; these local figures are not platform guarantees.
- The Word KB contains 17 stable articles in 15 visually reviewed pages with 92 verified internal links, clickable index/reference/back links and sanitized application screenshots. Every rendered page is visually reviewed before publication; link bookmarks are checked in Word.
- Source, staged changes, package contents and Word XML receive bounded credential-pattern scanning plus manual review. No provider secrets are required by the new features. Public OAuth client IDs are distinguished from credentials.

## Practical limits

- A live Spotify account has not been used for end-to-end authorization/playback verification. Spotify playback requires provider permissions, subscription eligibility and developer-app access. Browser mode streams in the browser; controls use the active Spotify device.
- Service Status checks public endpoint reachability only. It does not validate signed-in accounts. Additional app-specific API diagnostics remain inside the companion apps.
- Companion Spotify/profile changes prepared in isolated app checkouts have not been released. Existing downloads are preserved; do not claim the new consumer behavior is available in those downloads.
- TMApps shared sign-in deployment needs operator configuration. Local name/email suggestions work independently of it. Profile photos stay local to the launcher.
- macOS trusted signing/notarization and the reported companion app launch failures remain open. A new DMG background or icon does not fix those issues. Native packages must pass matching-runner smoke checks before publication.
- Full startup-in-tray, tray visibility and close behavior preference parity across all companion apps remains pending.
- Resource checks are short startup/idle measurements and targeted UI/fixture workloads, not long-duration stress tests or a complete security audit.

The workflow preserves current published companion catalog entries, packages and checksums. Versioned native installers and stable download aliases are uploaded before the native update manifest. The macOS bundle version is checked against package.json to reject stale DMGs.
