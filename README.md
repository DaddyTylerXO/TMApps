# TMA-Padlock

Your codes, kept close. A local desktop authenticator in the TMApps family, with a pink, rounded interface and a padlock icon containing six boxes numbered 1–6.

## Features

- Standard TOTP and HOTP accounts for Google, Microsoft, GitHub, and services that provide a Base32 setup key or `otpauth://` URL.
- SHA-1, SHA-256, SHA-512; six or eight digits; configurable time periods and initial counters.
- Guided setup: paste a key or URI, verify the first code against your service, confirm, and save.
- Automatic code refresh, search, hide/show codes, copy, rename, and confirmed deletion. HOTP counters advance only when you choose Next code, with the new counter saved before it appears.
- AES-256-GCM encrypted vault with optional master password (recommended), or an OS-protected device key.
- Lock button, five-minute inactivity lock, screen-lock/suspend lock, and clipboard clearing after 20 seconds.
- Eye buttons reveal the master password, its confirmation, and new setup keys independently; saving, cancelling setup, or locking masks them again.
- A Settings page controls launch at sign-in, tray visibility, close-to-tray, minimized startup, and auto-lock timing (1, 5, 15, or 30 minutes).
- Portable encrypted backups and fresh-install restore for master-password vaults.

## Get the app

Use **TMApps Launcher 1.11.0 or later**, refresh its library, and install **TMA-Padlock**. The release workflow publishes packages and SHA-256 checksums to the shared [TMApps release](https://github.com/DaddyTylerXO/TMApps/releases/tag/tma-apps). A platform is offered after all release builds and smoke checks pass and the shared catalog is updated.

Build targets: Windows x64 ZIP; macOS Intel/Apple Silicon DMG, ZIP and launcher archive; Linux x64/ARM64 AppImage and tar.gz. Windows/Linux builds are unsigned; macOS uses an ad-hoc signature.

## First launch

Choose **Master password** for stronger protection and portable backups. Use at least 12 characters and keep the password separately: there is no reset or recovery service. Alternatively choose **Device key** to encrypt with your OS account's key store. Device mode is unavailable when secure OS storage is missing, and does not support portable backups.

Choose **Add authenticator**, paste the service's manual setup key or `otpauth://` URL, and provide a name. Use Advanced settings when the service specifies different parameters. Click Verify, compare with the service, tick the confirmation, and add. Keep service recovery codes separately and the device clock synchronized automatically.

For HOTP, copy the current code, use it, then choose Next code. Advancing too far can require resynchronization at the service.

Use Encrypted backup after changes. To restore, open a fresh installation before creating a vault, choose Restore encrypted backup, then enter its original master password. Restore never overwrites an existing vault. Launcher uninstall retains your vault; deleting a whole OS profile may remove it.

## Settings and tray

Open **Settings** from the sidebar or tray menu. Startup is available in the packaged app on Windows, macOS, and Linux. It never unlocks the vault automatically. Linux uses a managed XDG autostart entry; Windows and macOS use native login-item registration. If you move a portable installation, save the startup choice again from its new location.

The tray icon is enabled by default. **Close to tray** and **Start minimized to tray** are optional and require the icon to remain enabled. Closing to the tray locks the vault first. Disabling the tray icon restores the main window and disables those dependent options. Use **Exit TMA-Padlock** in the tray menu to fully quit.

The pink tray menu follows TMA-Mail's rounded panel and bubble buttons, with Open, Settings, Lock vault, and Exit. Double-click the tray icon to restore the app. Linux desktop environments that only expose a native StatusNotifier menu use the same actions in the system menu. The Settings page includes a tray preview.

## Development

Requires Node 24+ and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
pnpm test
pnpm start
pnpm exec electron . --smoke build/smoke
pnpm exec electron-builder --win zip --x64 --publish never
```

Build macOS and Linux on their respective OS using the workflow matrix. Linux smoke tests use `xvfb-run -a`. Smoke mode creates a temporary vault with fictional RFC test secrets and removes it before exit; it does not modify the user's vault.

The release workflow tests Windows x64, macOS x64/arm64, and Linux x64/arm64. It smoke-tests source and packaged apps, verifies the macOS signature, checks package hashes, uploads packages, and updates the shared catalog while preserving other apps. Its publish job shares the launcher/Safe release lock to avoid concurrent catalog edits.

## Scope

Setup uses manual keys and otpauth URLs. QR images, camera scanning, encrypted WinAuth imports, proprietary Steam/Battle.net enrollment, cloud sync, and an authenticator as an additional vault-unlock factor are not included. The optional extra protection in this version is the master password. See [SECURITY.md](SECURITY.md) for protection boundaries.

## Shared standards update — 23 October 2026

[APP-STANDARDS.md](APP-STANDARDS.md) now records the complete suite requirements, including Finance Settings, four themes in separate updates, OS-version evidence and showcase videos. [APP-COMPLIANCE.md](APP-COMPLIANCE.md) tracks open acceptance work. This policy update changes no app version, feature or published package. Review README and SECURITY after each branch update.
