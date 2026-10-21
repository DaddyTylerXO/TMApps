# TMA Socials Manager KB Library

User guides and setup information for version 0.4.0.

[Download the illustrated Word KB Library](KB%20Library.docx)

## Socials-KB1 Getting started and the demo tour

TMA-SocialsManager keeps a local workspace for connected social accounts, analytics, drafts and dashboards. Open Social accounts to choose an integration. Bluesky uses a revocable app password. YouTube, Twitch and Kick use browser sign-in after a local developer registration is configured. LinkedIn and Pinterest currently use advanced access-token connections. API approval and permissions still apply.

On first launch, the tour prompt offers an isolated demo. Next moves through sample overview, dashboard, composer, review and help screens. Exit demo returns to your real starter overview. Demo changes are not saved and network or account actions are blocked. Reopen the tour from Help.

Use Create a post at the top of navigation for drafts. Settings controls navigation position, appearance, refresh and offline behaviour.

Related: Socials-KB2, Socials-KB5

## Socials-KB2 Browser sign in and configuration errors

Developer registrations are not bundled with releases. Each device needs its own local configuration. In Settings → Provider sign-in, save the client registration in encrypted storage. Never put client IDs, secrets, tokens or downloaded registration files in GitHub issues. Replace any secret previously shared in chat.

YouTube: enable YouTube Data API v3 and YouTube Analytics API, create a Desktop app OAuth client, add your account to the consent screen test users when Testing, then use Import Google JSON. A Web client JSON is not a Desktop client.

Twitch and Kick: save the current local client ID and secret and register the exact callback shown in Settings. The default is http://127.0.0.1:43821/oauth/callback. Kick and Google use PKCE; Twitch uses its documented authorization-code flow. Use a free callback port, then start a fresh browser sign-in.

The app now distinguishes missing configuration, rejected client/code, denied API access, rate limits and callback failures. Optional follower/report permissions do not prevent basic supported identity and metrics from connecting. Check the warning beside the resulting account. Shared consumer Twitch/Kick sign-in requires a protected backend; local confidential settings are for per-device operator use.

Related: Socials-KB3, Socials-KB10

## Socials-KB3 API access costs and limits

Checked 21 October 2026. X explicitly charges per usage using prepaid credits. Its official pricing lists endpoint/resource charges and console spending controls. Do not assume X data polling is free. Reddit commercial use requires a separate agreement; eligible approved noncommercial access and rate limits do not imply free commercial distribution.

YouTube standard usage is subject to project quotas; extra quota requires a compliance request rather than buying unlimited requests. Twitch documents request buckets/rate limits. Bluesky publishes service rate limits. For Kick, TikTok, Meta, LinkedIn and Pinterest, no general per-call price was confirmed in the reviewed standard documentation. This is not a guarantee of free access: app approval, product eligibility, provider agreements, account requirements and future pricing can apply. Ads, media hosting and any shared OAuth backend can cost money separately.

Use manual checks or longer intervals to reduce requests. Live mode and short widget intervals can increase quota use or charges. Check the linked official pricing/developer portal before enabling a paid integration or commercial rollout.

Related: Socials-KB4, Socials-KB11

## Socials-KB4 Refresh intervals offline work and cached data

Manual refresh runs only when requested. Live mode polls every 30 seconds; it is not a push stream and provider reporting may lag. Scheduled mode accepts minutes through 24 hours. A custom widget interval can request checks even when global refresh is manual. Shared accounts use the fastest enabled interval and are fetched once per due check. A manual widget does not freeze data refreshed by another widget. Rate-limit cooldowns still take priority.

Offline mode pauses scheduled social requests, connections, trend fetches and publishing. Existing labels, last successful statistics, charts, KB articles and drafts remain available without a connection. A failed request keeps the last successful observation with a warning and original timestamp. External help links opened explicitly still use your browser.

Green indicators represent recent successful automatic checks, not guaranteed instant provider data. Amber means stale or failed data. Grey covers manual/unavailable data. Exit the app from the tray to stop background checking.

Related: Socials-KB5, Socials-KB8

## Socials-KB5 Dashboards widgets presets and CSV export

Create a named dashboard and add named tabs. Add widget retains the dropdown setup and offers visual choices for a number counter, line graph, bar chart or pie chart. Choose a statistic, time range, account scope, size and check frequency. Preset buttons start a simpler setup. Save named preset stores a reusable definition without binding it to private account IDs.

Drag a card to another card to reorder it within its tab. Move earlier and Move later in its menu provide keyboard-accessible alternatives. Widget titles are saved. Presets can be removed in Manage saved presets.

Check now refreshes the widget’s account sources. Export CSV saves numeric observations with account, platform, metric and timestamp. Line widgets export observations in their selected period; other widgets export latest source values. CSV cells are escaped to reduce spreadsheet formula injection. A CSV contains local account labels and analytics: share it deliberately.

History starts when observed, keeps minute buckets for 48 hours and hourly buckets to 90 days, capped at 5,200 per account. Missing metrics are not zero. YouTube stays separate from mixed totals, invented change scores and pie shares.

Related: Socials-KB4, Socials-KB7

## Socials-KB6 Drafts images and publishing

Write a post, select destinations and save a draft locally. The Subreddit field appears only when a Reddit destination is selected. Pinterest destinations reveal a Board ID field; Instagram and Pinterest can use an appropriate public image URL.

Upload JPEG / PNG chooses one local image up to 8 MB and 40 megapixels. The app re-encodes it to remove embedded metadata, resizes it to a maximum dimension of 2,048 pixels, and compresses it to fit the supported upload bound. Add descriptive alt text. Managed copies stay in the app’s media folder so drafts work offline. Unreferenced copies older than seven days are removed at the next app start. The library is capped at 250 images. Local attachments publish to Bluesky, Facebook Pages and Pinterest. Instagram still needs a public HTTPS JPEG URL; X, Reddit and LinkedIn local attachment workflows are not included. An unsupported selected destination blocks publishing before any target is sent.

LinkedIn publishes text to an authorized organization Page. Pinterest creates an image Pin on the chosen Board. Pinterest pin counts include created and saved Pins. Other supported text destinations remain available.

Publishing requires confirmation. Each destination records its own result. Successful or uncertain attempts are not automatically resent; inspect the provider before retrying uncertain results.

Related: Socials-KB9, Socials-KB10

## Socials-KB7 Performance reviews and topic discovery

Performance reviews lists every integration and its connected accounts. It shows available source statistics, last check, warnings and measured local follower movement where appropriate. General review prompts suggest comparing content relevance, timing, clarity and accessibility one change at a time. These prompts are not predictions, causal findings or platform grades. YouTube values remain provider-reported and do not receive an invented score.

Topics and trends offers supported popular-content feeds and official discovery links. YouTube lists US most-popular videos, Twitch lists top game categories and Reddit lists r/popular hot posts. These rankings are not interchangeable trend measurements and do not list every trend. Other platforms open official discovery tools that may require login or special access.

Feeds are fetched only when requested. Saved results work offline. The app enforces a five-minute minimum between repeat requests. It does not scrape unsupported platforms or fabricate topic rankings. Check the source, region and timestamp before deciding what to engage with.

Related: Socials-KB3, Socials-KB5

## Socials-KB8 Appearance startup tray and resource use

Choose Left, Right, Top or Bottom navigation in Settings. Yellow, toned Grey and Black are dark palettes. Scheduled appearance uses local day/night start times and blends palettes over a configurable 0–60 minutes. Use distinct start times. OS reduced-motion preferences disable visible transitions.

Launch at sign-in needs a packaged app kept in a stable location. Tray visibility, close-to-tray, hidden startup and maximized startup are separate options. Windows uses the Mail-style bubble tray menu; macOS/Linux use native desktop menus. Turning off the tray also disables hidden startup and close-to-tray.

Frequent checks increase CPU, network activity, quota usage and possibly charges. Larger dashboards increase rendering work. History is bounded; shared due checks avoid duplicate per-widget requests. Images are bounded and re-encoded. Appearance uses a lightweight timer while visible rather than a continuous animation loop. Use manual/offline mode, longer intervals, fewer active widgets or Exit in the tray to reduce load. Every release should run automated regression, desktop smoke and performance checks; synthetic timing is not a promise for every computer.

Related: Socials-KB4, Socials-KB12

## Socials-KB9 LinkedIn and Pinterest setup

LinkedIn organization analytics requires an approved Community Management product and an authorized organization administrator. Supply a user access token and numeric organization ID. The adapter uses versioned organization and network-size endpoints for Page identity/followers and the Posts API for organization text posts. Product-specific organization read/write permissions are required. Personal profile analytics and local image upload are not implemented for LinkedIn.

Pinterest requires an approved app token with user_accounts:read for profile statistics. Add the relevant Board/Pin permissions for publishing. Supply a numeric Board ID in the composer and either one local JPEG/PNG or a public HTTPS image URL. Trial access, Standard access and account eligibility are controlled by Pinterest. Pin totals include created and saved Pins.

Advanced tokens can expire and must be replaced manually. The app does not manufacture approvals, register providers automatically, or bundle a shared secret. Use each integration’s official setup guide from Social accounts.

Related: Socials-KB2, Socials-KB6

## Socials-KB10 Privacy credentials deletion and policy pages

Credentials are protected using Electron safeStorage through Windows protection, macOS Keychain or a Linux secret store. Connections fail closed if secure storage is unavailable. Saved secrets are excluded from renderer snapshots, releases and GitHub. Labels, drafts, dashboards, analytics, images and history are local application data and are not all encrypted. Protect your OS account and backups.

Disconnect removes the selected account’s managed tokens, cached metrics and publishing records and attempts supported remote OAuth revocation. Offline disconnection cannot revoke remote access; use provider security settings later. Draft text and dashboard layouts remain. Remove local developer configuration separately in Settings. Deleting the entire app data folder also removes managed media and drafts; preserve work you need first.

Terms, Privacy and deletion drafts are included in Settings. The separate HTTPS legal site remains a private review draft until operator identity, public contact, audience and jurisdiction are confirmed. Provider verification can require an owned domain and anonymous public HTTPS access. Draft pages are not completed provider approval. TikTok and Meta browser OAuth registration remain deferred.

Related: Socials-KB2, Socials-KB12

## Socials-KB11 Official API and pricing references

X pricing: https://docs.x.com/x-api/getting-started/pricing
YouTube quotas: https://developers.google.com/youtube/v3/getting-started
Twitch limits: https://dev.twitch.tv/docs/api/guide/
Kick: https://docs.kick.com/
Bluesky limits: https://docs.bsky.app/docs/advanced-guides/rate-limits
TikTok Display API: https://developers.tiktok.com/doc/display-api-get-started/
Meta: https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
Reddit agreement: https://redditinc.com/policies/data-api-terms
LinkedIn Community Management: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview
Pinterest: https://developers.pinterest.com/docs/api/v5/

Access and pricing can change. Verify the provider console and your agreement before relying on a free allowance. App approval, quotas and hosting charges are separate questions.

Related: Socials-KB3, Socials-KB9

## Socials-KB12 Search help and safe crash reports

Settings search filters settings by keywords. Enable Include KB Library articles to also search article numbers, titles and text. Turn that option off to search settings only. Help lists the full local KB Library and provides cross references between related articles.

Feature request, Bug report and Issue report open the appropriate GitHub form. Help on GitHub opens the versioned KB source. The Word KB Library is included in the branch documentation.

The app retains up to 20 safe diagnostic events for OAuth/application/renderer failures. Raw exception messages, paths, provider bodies, tokens and draft content are omitted. Preview crash report shows the events and space for your reproduction steps. Upload to GitHub Issues opens a prefilled browser form; review and submit it on GitHub. The app does not silently upload or submit a report. You need a GitHub account to file one.

Never add credentials, downloaded client JSON, private screenshots, analytics exports or personal draft content to a public issue. If sign-in fails, report the new safe message and whether the provider shows Configured, without sending its values.

Related: Socials-KB2, Socials-KB10
