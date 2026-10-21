# Local OAuth setup — no credentials in GitHub

Configure provider apps inside **Settings → Provider sign-in**. Client IDs and client secrets use masked fields and OS-encrypted storage in the app's managed userData folder. They are excluded from renderer snapshots, app source and release packages. The app does not ship the operator's clients or secrets. Do not paste replacements into chat or an issue.

Secrets already pasted into a conversation should be revoked and replaced in the provider dashboard before live use. Configuration stays on your device; it is not portable to another OS account.

## Common callback

Register the following exact redirect URI for Twitch and Kick:

```text
http://127.0.0.1:43821/oauth/callback
```

You may choose another port of 1024 or higher in local settings, but it must match the provider registration. The app listens only on 127.0.0.1, validates the OAuth state and closes the temporary listener after success, denial or timeout. It never listens on all network interfaces. YouTube Desktop clients support loopback redirects without registering each port separately. Public policy website URLs and OAuth loopback callbacks are different purposes.

## YouTube / Google

1. Use your existing Google Cloud project. Enable **YouTube Data API v3** and **YouTube Analytics API**.
2. In Google Auth Platform → Clients, create a client of type **Desktop app**. A web application client is not interchangeable with this flow.
3. Configure your app's consent screen/branding. While its audience is in **Testing**, add your Google account under **Test users**. The screenshot's testing restriction is expected until that is changed or the app is approved for the required audience.
4. Download the Desktop client JSON directly to a private local folder, outside this Git checkout. In the app, choose **Import Google JSON**. The file is read locally, its client configuration is encrypted, and its contents are never returned to the normal page. Avoid keeping unencrypted downloaded files in shared/synced locations.
5. Open Social accounts → Connect YouTube, read the data-use disclosures and choose **Continue in browser**. Sign in to the authorized account and select the correct channel.

Scopes are `youtube.readonly` and `yt-analytics.readonly`. No YouTube upload, monetary-report or account-management scope is requested. Channel lifetime statistics stay separate from the requested 28-day views, likes, watch minutes and subscribers gained/lost report. Reports may lag behind the current date. API access, quotas, test-user limits and verification remain controlled by Google.

Google documentation: [desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [YouTube Analytics reports](https://developers.google.com/youtube/analytics/reference/reports/query).

## Twitch

1. Open your app in the [Twitch developer console](https://dev.twitch.tv/console/apps).
2. Register the common callback URI exactly. For this local confidential-client flow, keep the client secret on your device and configure it in Provider sign-in settings.
3. Connect Twitch through the browser and grant `moderator:read:followers`. This is read access for follower reporting, not permission to perform moderation actions. Use the broadcaster account or an account authorized to read the target channel's followers.
4. The app validates the user token at sign-in and while running, and refreshes supported expired tokens. If access is revoked, reconnect rather than pasting a normal Twitch account password.

Documentation: [authorization code flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/), [required token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/).

## Kick

1. Open your registered app in Kick's developer settings.
2. Register the common callback exactly and enable the scopes `user:read` and `channel:read`.
3. Save its replacement client ID and secret in the app's local Provider sign-in settings.
4. Connect Kick through the browser. The app uses authorization code flow with PKCE and stores rotated tokens encrypted locally.

Documentation: [Kick OAuth](https://docs.kick.com/getting-started/generating-tokens-oauth2-flow).

## Distribution boundary

Desktop apps cannot protect a shared confidential client secret from the people who receive the binary. The app therefore does not bundle the operator's confidential registrations, even in an encrypted file. The implemented configuration is per device, for an operator/developer using their own registered apps. A consumer-facing shared sign-in service requires an appropriately protected backend, or a provider-supported public-client flow and matching registration, plus applicable provider review. Choose that production model before distributing a shared OAuth registration.

## Privacy and deletion

Disconnecting removes the selected account's local tokens, cached statistics, recorded metric history and managed publishing records, and attempts provider revocation for browser OAuth connections. Draft text and dashboard layouts remain. Remove local developer clients independently in Provider sign-in settings. Revocation failures are reported; remove remaining access directly in provider security settings.

Google access can also be revoked at [Google account permissions](https://security.google.com/settings/security/permissions). Closed/offline desktop apps cannot detect a remote revocation until they next run and communicate. Stale YouTube data is pruned at startup/maintenance if the last successful data check is over 30 days old. YouTube values are shown separately from mixed sums and derived pie percentages, with raw historical graphs and provider-reported subscriber changes available.

## Policy website and deferred providers

Draft Terms, Privacy and Data deletion documents are in `assets/legal/`. The separate hosted site is a **private review draft**, not a completed public provider-review URL. Operator name, a working public privacy/support email, audience/distribution model and applicable jurisdiction remain to be confirmed. After review, make the site public, check anonymous HTTPS access and complete any provider domain verification. A hosted subdomain alone does not guarantee Google/TikTok will accept domain ownership or app verification.

TikTok and Meta (Facebook, Instagram and Threads) are intentionally deferred. No new TikTok or Meta OAuth registration is used by this work.
