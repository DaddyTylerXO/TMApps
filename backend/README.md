# TMApps sign in deployment

The launcher has an email-code client and per-app permission editor. This directory prepares the service; it is not deployed or enabled by this release. No project credentials were supplied. Existing apps must implement the handoff before shared sign-in replaces a separate TMApps sign-in. Mailbox and social-provider OAuth/passwords remain app-specific.

## Operator setup

1. Create or select a Supabase project under your account. Apply `supabase/migrations/202610210001_suite_sign_in.sql` using its SQL editor or migration tooling.
2. Enable email authentication and put `{{ .Token }}` in the email template so users receive a verification code. Configure production SMTP and suitable Auth rate limits. Supabase default email delivery is restricted; test it with real non-team addresses before enabling public sign-in.
3. Deploy `supabase/functions/app-session` as `app-session` with `--no-verify-jwt`. The issue action verifies the bearer token explicitly through Supabase Auth; exchange and profile use their own PKCE/app-session credentials. The service-role key stays only in the edge runtime environment. Never place it in a launcher, profile, report, or Git repository.
4. Put only the project HTTPS origin and publishable/anon key in the launcher's storage `auth-config.json`, or configure both `content/auth-config.json` and `desktop/auth-config.json` before building. Empty configuration keeps sign-in disabled.
5. Test email verification, cross-user row isolation, access revocation, wrong verifier, wrong app, expired code and simultaneous replay before enabling app integrations. This repository tests the clients with simulated responses; the SQL and edge service require integration testing against your actual deployment.

```json
{"url":"https://YOUR_PROJECT.supabase.co","publicKey":"sb_publishable_YOUR_PUBLIC_KEY"}
```

Windows storage is `%LOCALAPPDATA%/TMApps/Launcher`; macOS uses `~/Library/Application Support/TMApps/Launcher`; Linux uses `$XDG_CONFIG_HOME/TMApps/Launcher` or `~/.config/TMApps/Launcher`. Session files are protected with Windows DPAPI or Electron safeStorage. Linux basic_text/no-keyring mode never persists a session. The profile JSON and renderer APIs never receive refresh/access tokens.

## App integration contract

The launcher client classes expose a handoff operation for a future approved local app broker. A broker/deep-link adapter and consumer integration must be added per app before automated app launch handoffs are enabled; this release does not register a callback protocol or transfer sessions to existing apps automatically.

- The requesting app creates a random 43–128 character PKCE verifier and its base64url SHA256 challenge. It keeps the verifier private.
- After confirming the app identity, local request origin, user approval and allowed app ID, the launcher calls `SuiteSignIn.Handoff` or `SuiteAuth.handoff`. This calls `POST /functions/v1/app-session` with `{action:"issue", appId, challenge}` and the private launcher Auth bearer. Never give an app the launcher bearer or refresh token.
- The code expires after 60 seconds and is bound to the app and verifier challenge. The app calls the same endpoint with `{action:"exchange",appId,code,verifier}`. An atomic SQL function consumes it once and returns a separate app session. Store that session in the app's OS credential facility.
- Call `{action:"profile",appId,appSession}` to obtain the server-verified email, user ID and optional display name. App sessions last up to 30 days. Every profile check enforces expiry and current app access; unchecking access blocks it immediately. Re-check at app startup and before relying on the identity. Cached identity is not proof of current permission.
- Sign-out in the launcher removes its session. Revoke app access separately to stop existing app sessions. Unlinking TMApps is separate from revoking permissions at Google, Apple, Meta or another provider.

No ratings tables or review collection are included.

## Official references

- [Email verification codes](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp)
- [Authentication rate limits](https://supabase.com/docs/guides/auth/rate-limits)
