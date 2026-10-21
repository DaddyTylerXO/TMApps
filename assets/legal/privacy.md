# TMA-SocialsManager — Privacy Policy

DRAFT — prepared 21 October 2026. The operator, public privacy contact, distribution model and final hosting arrangements must be confirmed before this policy is adopted or submitted for platform review.

## 1. Who is responsible

TMA-SocialsManager is part of the TMApps suite. The service operator and public privacy email are [TO BE CONFIRMED]. The final policy must identify the responsible person or organization and an effective date. This draft describes the current desktop implementation and separately identifies hosting and public-distribution details that remain unsettled.

## 2. Data the desktop app accesses

When you connect an account, the app may access its provider-issued account/channel identifier, display name or handle, and the metrics available under the permissions you grant. These can include follower or subscriber counts, post/video counts, views, likes, replies, reposts, live viewers and Reddit karma. YouTube browser sign-in also requests a 28-day report of views, likes, watch minutes and subscribers gained or lost. Provider reporting delays and account restrictions apply.

The app stores access tokens and, where issued, refresh tokens. If you configure a developer app locally, it stores its client ID, client secret where required, and loopback callback URL. Bluesky app-password sign-in exchanges your handle and app password for a session; the app password is not retained after the exchange. Normal social-account passwords are not requested.

The app also stores the drafts, post text, media URLs, selected destinations, dashboard names, tabs, widget configuration, preferences and publishing results you create or request. It does not download a social platform's complete private account archive, private messages, contact list or payment information for these analytics features.

## 3. Purposes and permission

Data is used to authenticate the accounts you select, display the metrics and dashboards you request, maintain local historical observations, refresh your connections, and send confirmed posts to supported destinations. Read-only YouTube, Twitch and Kick connections do not request chat, moderation actions or publishing permissions.

Provider authorization is voluntary and you can disconnect an account. OAuth consent and the legal basis for any personal-data processing are distinct. Before public distribution, the operator must confirm its legal basis and any applicable controller/processor responsibilities. Providing a requested app function, obtaining consent where required, and protecting support/security communications are the intended purposes; no unrelated advertising purpose is introduced by this draft.

## 4. Where data is stored and security

The current desktop design communicates directly with the selected providers. Social account data is not intentionally uploaded to a TMApps-operated account database or to the legal-policy website. Tokens and local OAuth configuration are encrypted using Electron safeStorage through Windows protection, macOS Keychain or an available Linux secret store. Connections are blocked when secure credential storage is unavailable. The normal renderer snapshot does not receive saved client IDs, client secrets or tokens.

Other local records, including labels, drafts, analytics, dashboard layouts and publishing history, are stored as application files and are not all encrypted. Anyone with access to your device or backups may be able to read those files. Operating-system backups, device synchronization or software you install may copy data independently of the app. Protect your operating-system account and backups.

## 5. Sharing and third parties

The relevant social platform receives the network requests, credentials and content needed to complete your requested connection or post. OAuth opens your system browser, and the provider may set its own cookies or process IP address and device information under its own policy. Requests use HTTPS except for the authorization response sent to a loopback listener on your own computer. Client secrets are exchanged only through the applicable provider's token endpoint and local encrypted storage.

The desktop app has no advertising SDK, behavioral advertising or general-purpose usage analytics service in this implementation. The operator does not sell social account data or use it to train AI models. GitHub is used for source/releases and Launcher distribution, not for account-credential storage. Never attach credentials or private workspace files to a support issue.

The policy website's hosting provider may process request, network and security information needed to serve the pages. A private draft site uses hosting-provider sign-in and access controls. The final public site, hosting provider disclosures, international-transfer arrangements, any access logs and their retention must be confirmed before final publication. This draft does not assert that a hosted website creates no logs or cookies.

## 6. Google and YouTube data

The app uses YouTube API Services. Read the [Google Privacy Policy](https://policies.google.com/privacy) and [YouTube Terms of Service](https://www.youtube.com/t/terms). Google permissions are limited to read-only channel access and read-only YouTube Analytics reports. The app does not request monetary reports or YouTube upload access in this implementation.

TMA-SocialsManager's use and transfer of information received from Google APIs must adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including its Limited Use requirements. Google data is used to provide the user-facing features described here, not for advertising, sale, unrelated profiling, generalized AI/model training or human review outside a permitted support, security or legal purpose. A support request should use the minimum information needed; do not send tokens or secrets.

You can revoke the app's Google access at any time through [Google account permissions](https://security.google.com/settings/security/permissions). The app also provides Disconnect to remove its local account data and attempt token revocation. Revocation or failed token refresh detected by the running app removes the affected local YouTube connection and its cached metrics. A closed or offline desktop app cannot detect an external revocation until it runs and can communicate again.

## 7. Retention

Local historical metrics are normally retained at minute resolution for 48 hours and hourly resolution for up to 90 days, with a maximum of 5,200 observations per account. Recording occurs only after successful observations; earlier history is not invented. YouTube retention is additionally subject to continued authorization checks and applicable YouTube storage rules. If the app cannot refresh/reconfirm a stale YouTube connection, its managed local YouTube data is removed; a connection whose last successful data check is over 30 days old is pruned when the app next runs or performs maintenance.

Tokens remain until replaced, disconnected or removed. User-authored drafts and dashboard preferences remain until you delete them or remove the application data. Publishing records remain until the associated account is disconnected or the managed workspace is deleted. Developer client configuration is independent of account tokens and can be removed in Provider sign-in settings. Copies in personal backups or previously exported files are under your control.

## 8. Deletion and control

Use Social accounts → Disconnect to remove that account's encrypted tokens, cached metrics, historical observations and managed publishing records. The app attempts remote revocation for supported browser OAuth connections and tells you when it cannot confirm it. User-authored drafts are retained, with the disconnected destination removed. Dashboard layouts remain; widgets for a disconnected account show no current source data.

Use the provider's own security settings to revoke any remaining authorization, and remove a Bluesky app password in Bluesky settings. To remove all local app files, close every running copy and use the Launcher's explicit delete-data option or delete the app's managed OS application-data folder after preserving work you need. Removing local data does not delete posts, channels or accounts held by YouTube or another platform. Those require the platform's own controls.

## 9. Rights and requests

Depending on the law that applies, you may have rights to information, access, correction, deletion, restriction, portability, objection and withdrawal of consent, and the right to complain to a supervisory authority. For UK users, information is available from the [Information Commissioner's Office](https://ico.org.uk/). The public privacy contact must be completed before release. Because this implementation stores most account data on your device, the operator may not possess a server-side copy that it can retrieve or delete on your behalf.

## 10. Children and changes

The app is not designed to bypass a platform's age restrictions. Do not connect an account you are not permitted to use. The operator must confirm the intended audience before adopting this policy. Material changes to data use must be disclosed, and renewed consent obtained where required. Updated policies must identify their effective date and remain accessible from the app and public policy site.

Operator: [TO BE CONFIRMED]. Public privacy contact: [TO BE CONFIRMED]. Effective date: [TO BE CONFIRMED AFTER REVIEW].
