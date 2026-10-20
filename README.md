# TMA-SocialsManager

A yellow, bubble-style desktop workspace for the TMApps suite, built with Electron for Windows, macOS and Linux.

## Run and build

Use Node 24 and pnpm 10:

```sh
pnpm install --frozen-lockfile
node node_modules/electron/install.js
pnpm start
pnpm test
pnpm package
```

Windows x64 ZIP, macOS x64/arm64 tar.gz and DMG, and Linux x64/arm64 AppImage packages are built on their native GitHub Actions runners. The release job verifies all five launcher packages, uploads them to the existing `tma-apps` release, and then merges this app into the latest launcher catalogue. Existing apps are retained. Builds are unsigned/ad-hoc signed, without macOS notarization.

## Platform support in 0.1.0 beta

| Platform | Connect | Metrics | Publish |
| --- | --- | --- | --- |
| Bluesky | Handle + app password, no developer registration | Followers, posts, recent likes/replies/reposts | Text |
| YouTube | User OAuth access token | Subscribers, videos, lifetime views | Not yet: video upload workflow required |
| Twitch | Client ID + user OAuth token | Followers (scope required), live viewers | No general social feed publishing API |
| Kick | User OAuth token | Current stream viewers | Not supported |
| TikTok | Approved app + user OAuth token | Followers, likes, videos (scopes required) | Not yet: audit and upload/consent workflow required |
| Instagram | Instagram Login token + professional account ID | Followers, media count | One public HTTPS JPEG + caption |
| Facebook | Page access token + Page ID | Page followers | Page text posts |
| X | User OAuth 2 access token | Followers, posts | Text |
| Reddit | Approved API access + user OAuth token | Karma | Subreddit text posts |

**Bluesky is the easiest connection.** Create a dedicated app password in Bluesky settings, then enter it with your handle. Only Bluesky-hosted PDS servers are supported in this beta. Your regular password is never needed. Native browser OAuth flows for other providers are not included: the advanced token connection requires your own provider setup. Access tokens expire; reconnect when necessary. Bluesky sessions refresh automatically.

The setup guide button opens the official documentation for each provider. API permissions, app reviews, account types, quotas and fees are controlled by the provider. No live provider account has been used during development; adapters are tested against representative API responses and require verification with authorized accounts.

## Analytics and publishing

Select all accounts or one account in Overview. Unknown metrics are `—`, not zero. Audience sums are not deduplicated. Reddit karma and live viewers stay separate. Bluesky engagement covers at most 100 recent feed entries and excludes reposts of other authors. Only the latest snapshot is retained; historical graphs and date-range reports are not included.

Create a post, choose connected publishing accounts, then save a draft or publish. Platform validation runs before any target is called. A confirmation precedes publishing. Each destination records its own outcome. Successful, in-progress and uncertain attempts are not resent automatically. After an uncertain result, inspect the provider before creating another post. Editing and republishing a previously successful draft requires creating a new draft. Drafts save when navigating or closing the window; there is no timed autosave or background scheduling.

## Settings and tray

Settings includes launch at sign-in, tray icon visibility, close-to-tray, start minimized at sign-in and start maximized. Launch at sign-in requires a packaged app in a permanent location. Windows/macOS use Electron's login item API. Linux uses an XDG autostart desktop file and needs a desktop secret store for accounts and tray support for notification-area behaviour. Without a tray icon, close-to-tray and hidden startup are disabled.

The Windows tray menu follows TMA-Mail's rounded container and pill buttons, recoloured yellow: **Open TMA-SocialsManager**, **Settings**, **Exit TMA-SocialsManager**. macOS and Linux use their native tray menus. Closing saves the active draft before hiding or exiting.

Analytics settings offer manual refresh, live polling every 30 seconds, or a custom interval from 1 minute to 24 hours. Automatic modes check immediately when enabled and schedule their next check after the previous check finishes, without overlapping publishing or account operations. Checks continue in the tray and stop when the app exits. Every metric has a freshness indicator: green for successful recent automatic checks, amber for stale or failed checks, grey for manual or unavailable data. Live polling is not a provider push stream and remains subject to API quotas. No green indicator is shown for an account with a failed refresh. HTTP 429 responses pause that account using the provider's Retry-After header, or five minutes by default.

## Security

No application keys or account credentials are committed. Tokens use Electron `safeStorage`: Windows DPAPI, macOS Keychain, or a Linux secret store. Connections fail closed when encryption is unavailable or Linux reports `basic_text`. Renderer code receives account labels and metrics, never tokens. The Bluesky app password is discarded after obtaining a session. Disconnect deletes local credentials; revoke the app password/authorization in provider settings to remove remote access too.

Workspace data is stored in Electron's OS-specific `userData` directory (`TMA-SocialsManager`). Drafts, labels, metrics and history are **plain local data**, not encrypted. Protect your OS account and backups. Credentials are not portable between machines. Renderer isolation, sandboxing, CSP, blocked navigation and fixed provider endpoints limit exposure. Provider error bodies are not displayed or logged.

## Validation

`pnpm test` covers metrics normalization, credential redaction, trusted Bluesky hosts, platform validation, partial publishing, duplicate prevention, uncertain outcomes, persistence and startup configuration. `node node_modules/electron/cli.js . --smoke` runs an isolated desktop check and writes screenshots and a result to ignored `artifacts/`. Use a fresh smoke profile for repeated tests. No real social post is sent by tests.
