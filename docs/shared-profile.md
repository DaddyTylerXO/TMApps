# Shared TMApps profile contract

Launcher 1.15.0 adds global profile autofill alongside optional social account metadata. Saving entries does not authenticate with any service. Those apps still need to implement this contract and their own provider sign-in; the launcher currently does not link or contact social networks.

## Location and compatibility

- Windows: `%LOCALAPPDATA%\TMApps\profile.json`
- macOS: `~/Library/Application Support/TMApps/profile.json`
- Linux: `$XDG_CONFIG_HOME/TMApps/profile.json`, or `~/.config/TMApps/profile.json`

The additive fields retain `schemaVersion: 1`, so existing Mail readers can ignore them. Missing `socialAccounts` means an empty list; missing `shareWithSocialApps` means false. `shareWithApps` defaults to true when absent and controls compatible profile autofill. An explicit false disables all future suggestions; launcher saves also clear `shareWithMail` and `shareWithSocialApps` so older consumers respect the overall opt-out. Mail sharing otherwise keeps its separate `shareWithMail` control. Mail must not use social entries as email account suggestions.

```json
{
  "schemaVersion": 1,
  "revision": "new-random-revision-on-every-save",
  "displayName": "Example User",
  "emails": ["example@example.com"],
  "shareWithApps": true,
  "shareWithMail": true,
  "socialAccounts": [
    {"platform": "Instagram", "account": "@example"},
    {"platform": "YouTube", "account": "https://www.youtube.com/@example"}
  ],
  "shareWithSocialApps": false
}
```

## Consumer behavior

Future social apps must read social entries only when `shareWithSocialApps` is true. Treat them as account suggestions and labels, never as proof of ownership or authentication. Offer the app's own explicit provider connection flow before accessing a social account. Store OAuth tokens, passwords, app keys, and refresh tokens in that app's credential storage, never in this profile.

Read changes on startup or when `revision` changes. Do not rewrite the shared profile or discard fields unknown to the consumer. Turning sharing off stops future suggestions; it does not revoke provider permissions or remove data already imported into another app. Deleting a row removes the saved suggestion, not the external social account. The launcher stores this data locally for the current OS user and does not provide cloud sync.

## Validation and persistence

Up to 20 entries are allowed. Each entry contains only `platform` (up to 40 characters) and `account` (up to 300), trimmed and on one line. A completely blank editor row is ignored; partially completed rows are rejected. Duplicate platform/account pairs are collapsed case-insensitively. Custom platform names and multiple accounts per platform are supported.

An account can be a username/handle or an HTTPS public profile URL. URLs must have no embedded credentials, query parameters, or fragments; for providers requiring those components, save the username instead. No password or token fields are serialized. Saves validate before writing, replace the shared file atomically, and create a new revision. Cancel and rejected saves leave the previous file intact.

## Profile icons and local overrides

The optional consumer in `desktop/electron/suite-profile.cjs` validates a bounded shared file and imports only display name, email suggestions and explicitly permitted social labels. Agent Office and Finance source updates use it for their existing profile icons. These companion changes await their own releases. A new compatible app can reuse this contract and UI; apps without a profile icon do not acquire an unrelated user-profile screen.

Consumers read on startup and focus, with no idle polling. They fill empty profile fields and update values matching their last imported suggestion. Independently edited app names/emails and connected provider identities are preserved. The consumer never writes the launcher file. Local profile edits stay in the app's `tmapps-profile.json` and unknown or credential fields are omitted. Global opt-out keeps existing local identity values and stops further imports. Synthetic demo workspaces remain separate. Standard profile inputs can opt in with `data-tmapps-profile-form` and explicit `data-profile-field` markers; password fields are always excluded.

The profile contains no provider authentication. TMApps sign-in still requires the separately configured service, and each mailbox/social/Spotify account uses its provider's own flow. File paths are per OS user; this is not synchronization between devices.
