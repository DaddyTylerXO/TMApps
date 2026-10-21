# Socials Manager 0.4.0 verification

This update implements the user's requested `Socials-KB` numbering. Those IDs are retained in the app, Word index, bookmarks and cross references.

## Implemented and checked locally

- Eleven integration entries; new approved-token LinkedIn organization and Pinterest adapters, text/image publishing payloads and safe optional-statistic fallbacks.
- OAuth code/state/PKCE/token tests and specific safe diagnostics. Real provider registrations and accounts were not used for testing. Live sign-in and granted scopes still require account verification.
- Offline blocking, saved drafts/analytics, per-widget scheduling, shared-source request planning, rate-limit cooldowns and CSV formula escaping.
- Four navigation positions, scheduled dark palettes, conditional composer fields, local media re-encoding, demo isolation, Settings/KB search and report preview.
- Automated regression suite: 70 tests, including a representative 20-account/24-widget preparation budget. Local desktop smoke checks passed, using synthetic accounts and a public app icon as the example attachment.
- Packaged launch checks record startup time, two-second idle CPU and aggregate process working sets against explicit budgets. The release matrix runs these on Windows x64, macOS x64/arm64 and Linux x64/arm64. Results are CI artifacts, not a claim about every device.
- Status-only IPC no longer repeatedly serializes unchanged history. Stored history and media are bounded. No supplied client credentials were added to source, documents, screenshots or packages.
- Word KB has 12 numbered articles, five sanitized app screenshots, stable bookmarks, clickable index/related links and Back to index links. A separate Linux workflow renders every page for visual review.

## Limits and remaining work

- LinkedIn/Pinterest require provider approval and suitable account/product permissions. These are advanced token integrations, not a shared public OAuth service. TikTok/Meta browser setup remains deferred.
- Topic discovery covers supported popular-content feeds and official discovery links. It does not provide every platform's complete trends, scrape unsupported data or invent rankings.
- Local attachments are supported for Bluesky, Facebook Pages and Pinterest. Instagram needs a public JPEG URL; X, Reddit and LinkedIn local attachment uploads remain unavailable and are blocked before any post is sent.
- Policy pages are updated private drafts. Operator identity, public email, audience, jurisdiction and any owned-domain verification remain unresolved. No public policy approval is claimed.
- Reports open a reviewed prefilled GitHub form for the user to submit. There is no unattended report upload or bundled GitHub token.
- Native desktop notifications and their Mail-style design are a standing-standard gap; this update does not claim to implement them. Native tray styling remains OS-controlled outside Windows.
- Packages remain unsigned/ad-hoc signed without macOS notarization. Packaged launch checks do not replace full manual install/update/uninstall and live-account testing on each OS.
- X is metered; Reddit commercial access needs agreement. The cost guide distinguishes documented quotas from fees that could not be confirmed.

The launcher already orders Socials Manager before Agent Office in both Windows and native UI code. Publication merges only this app's verified packages into the current shared catalogue and preserves other entries.
