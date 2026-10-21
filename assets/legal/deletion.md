# TMA-SocialsManager — Data deletion

DRAFT — public operator/contact details are pending confirmation.

## Remove one connected account

Open Social accounts, choose the account and select Disconnect. The app removes its encrypted account tokens, cached metrics, local metric history and managed publishing records. User-authored draft text is retained and the disconnected destination is removed. Dashboard layouts remain, but that source no longer supplies values.

For browser OAuth connections, the app attempts token revocation. If it cannot confirm revocation, remove access directly in the provider's security settings. Google access can be removed at [Google account permissions](https://security.google.com/settings/security/permissions). Remove a Bluesky app password in your Bluesky security settings.

## Remove developer app configuration

Open Settings → Provider sign-in → Remove for each configured provider. This removes the locally encrypted client configuration. Disconnect its accounts separately to remove their tokens and cached data.

## Remove the entire local workspace

Close every copy of TMA-SocialsManager, including any tray copy. Use TMApps Launcher's explicit local-data deletion option where supported, or remove the app's own OS application-data folder. This permanently removes local accounts, drafts, layouts, preferences and history. Keep any personal backups you need first. Do not remove unrelated app folders.

Typical locations are %APPDATA%/TMA-SocialsManager on Windows, ~/Library/Application Support/TMA-SocialsManager on macOS, and ~/.config/TMA-SocialsManager on Linux unless your OS configuration overrides the base location. The running app determines its userData location; package or OS settings can affect it.

## What deletion does not do

Deleting the app's records does not delete your YouTube channel, social account or posts held by a platform. Use that platform's controls to delete those. It does not remove copies in your own backups, screenshots, browser data or previously shared support messages.

## Contact

Public privacy contact: [TO BE CONFIRMED]. The final public policy must include a working contact address and operator identity before submission to provider review.
