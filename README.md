# TMA-Safe

A local desktop password vault in the TMApps family. Purple, rounded controls and a simple white key icon follow TMApps Launcher and TMA-Mail. Source version 0.3.0 is an unsigned beta and has not had an independent security audit.

## Getting started

Create a `.tmasafe` vault and choose a master passphrase of at least 14 characters. There is no password reset. The master password is requested every time the app opens; no unlock key is saved. Use **Open a vault** for an existing file.

Tick **Always use this vault when opening TMA-Safe** to remember the selected file on this device. Future launches preselect it and focus the master password field. Only the path is saved; no password or key-file contents are remembered. Untick the option to forget the default. If the file is moved or its drive is disconnected, choose it again. When creating a new vault, the preference is saved after successful creation.

Optionally generate a separate `.tmakey` file when creating the vault. This adds a possession factor to encryption: **both** the master password and original key file are required. Keep it on a separate device/removable drive; storing it beside the vault loses the benefit. This release implements key-file two-factor protection. Authenticator TOTP and Windows Hello are not implemented. A local TOTP check alone would not protect a copied offline vault.

Add, edit, search, copy or delete logins. Passwords remain hidden until revealed; reveal hides after 15 seconds. Clipboard contents clear after 20 seconds if unchanged (configurable in Settings). Automatic locking defaults to five minutes without keyboard/pointer activity inside the app, on OS screen-lock events, suspend, close or renderer failure. OS event availability varies by desktop environment: verify Linux screen-lock behavior locally. Ctrl+L locks immediately.

Generate 8–128 character passwords with lowercase, capitals, numbers, symbols and similar-character exclusion. Reminders accept 1–3650 days, appear in the due list and are mentioned when unlocking. They do not change website passwords or run while the app is closed. Editing notes does not restart a reminder; changing a password does.

## Folders and settings

Use the + beside **Folders** to create a folder. Select it to rename/delete it; choose a folder when adding or editing a login to move that login. Deleting a folder preserves all its passwords in All logins. Folder names and memberships are encrypted inside the portable vault. Existing vaults open with no folders and are upgraded on save.

The eye buttons reveal master, confirmation and login passwords for up to 15 seconds. Click again to hide; leaving the app or locking also hides them.

**Settings** is available from the locked screen, sidebar and tray menu. Options include open at sign-in, show the tray/menu-bar icon, close to tray, idle lock (1–30 minutes) and clipboard clearing (10–60 seconds). Startup is available in packaged builds: Windows/macOS use OS login items; Linux uses a user autostart desktop entry. Startup opens a locked app and never stores the master password. The startup executable must remain at the same installed location; moving an AppImage requires toggling startup off/on again. Use either the launcher's app-startup setting or the app's own setting to avoid duplicate registrations.

Closing to tray always locks. The tray has Open TMA-Safe, Settings, Lock vault and Exit TMA-Safe, using TMA-Mail's rounded panel and bubble buttons in purple. Double-click restores the window; click/right-click opens the menu where supported by the desktop environment. Linux requires a tray/StatusNotifier implementation (GNOME may need an extension). Disabling the tray also disables close-to-tray and restores the window. Settings are device-local and stored separately from vaults; they contain no credentials or unlock keys.

## Portability and backups

Lock the app, then move the `.tmasafe` file to another computer. Open it using TMA-Safe, the same master password and any required key file. **Save an encrypted portable copy** creates an independent copy. Copies do not synchronize. Back up the key separately. Never put vaults, keys or browser exports in Git.

Each save retains the previous encrypted version as `<vault>.bak`. To recover, rename a copy to `.tmasafe` and open it. Backups retain old passwords. Saves use exclusive `.lock` files, encrypted temporary files, flush and atomic rename. External changes cause saving to fail rather than overwrite. After a crash, verify no instance is saving the vault before removing a stale `.lock`. Filesystem/cloud durability varies; avoid simultaneous editing of synchronized copies.

## Browser imports

Export a CSV from Chrome, Edge, Firefox, Opera or Opera GX, then choose **Import passwords**. Chromium `name,url,username,password,note` and Firefox `url,username,password,…` columns are supported. The preview reports valid/skipped rows. Exact URL/username/password duplicates are ignored. Only HTTPS logins are supported; HTTP, Android URLs and malformed rows are skipped with CSV record numbers. CSV exports contain plaintext: delete them afterwards and review cloud backups/recycle bins. The app does not scrape browser profile files.

## Browser filling

Open **Browser filling → Open extension folder**. In Chromium browsers (Chrome/Edge/Opera/GX), enable Developer mode in the extension manager and choose **Load unpacked**. In Firefox use `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`. A permanent Firefox extension requires Mozilla signing; browser-store distribution is not included.

Enable filling in the unlocked app and paste its temporary code into the extension popup. Open an HTTPS login page and click **Fill this website**. Keep the popup open, then approve the exact website/account in TMA-Safe. It fills one visible top-level password field plus an identifiable username, without submitting. Multi-step username pages, cross-origin iframes, ambiguous forms and non-HTTPS sites require manual copying. Subdomains must match the saved origin exactly.

The bridge binds only `127.0.0.1:19473`, accepts extension origins with a random bearer token and requires native desktop approval per fill. Locking revokes the code and pending requests. Pair again after unlocking. Port conflicts fail closed. This does not protect against local malware or a compromised browser; see [SECURITY.md](SECURITY.md).

## Build and test

Requires Node 24 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
pnpm test
pnpm start
pnpm exec electron . --smoke build/source-smoke
pnpm exec electron-builder --win zip --x64 --publish never
```

Use `--mac dmg zip --x64` or `--arm64` on macOS; `--linux AppImage tar.gz --x64` or `--arm64` on Linux. Run packaging on the target OS. Linux CI smoke tests use `xvfb-run -a`. Packages are unsigned/ad-hoc signed; macOS is not notarized. Do not disable the sandbox routinely.

Linux requires working unprivileged user namespaces for Chromium's sandbox. Some distributions, including Ubuntu with restrictive AppArmor policy, require an administrator to permit them for the application. The CI workflow configures only its ephemeral runner; it does not change end-user machines.

The release workflow tests and packages Windows x64, macOS x64/arm64 and Linux x64/arm64 before updating the launcher's shared catalog with checksummed packages. Older launchers accept exactly two applications and need the updated launcher release before seeing TMA-Safe. Platform support is verified by native CI, not inferred from a Windows build. See workflow results for actual successful targets.

## References

[KeePass security](https://keepass.info/help/base/security.html) informed full-database encryption, salted key derivation, portability and locking. TMA-Safe uses its own format, not KDBX, and does not claim KeePass's review history. Renderer isolation follows [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security/).

## Shared standards update — 23 October 2026

[APP-STANDARDS.md](APP-STANDARDS.md) now records the complete suite requirements, including Finance Settings, four themes in separate updates, OS-version evidence and showcase videos. [APP-COMPLIANCE.md](APP-COMPLIANCE.md) tracks open acceptance work. This policy update changes no app version, feature or published package. Review README and SECURITY after each branch update.

## Security update 0.2.3

Source prepared 23 October 2026. Published packages remain at the version shown in the live launcher catalog until the native release workflow succeeds. This update strengthens locking, reveal handling, file reads and encrypted backup writes. Twenty-five regression tests and Windows source/packaged smoke checks passed with fictional data. Security and performance checks now run in release CI. See the sanitised [verification summary](SECURITY-REVIEW-2026-10-20.md).

The illustrated [TMA-Safe KB Library](docs/TMA-Safe%20KB%20Library.docx) contains Safe-KB1 through Safe-KB4, setup, offline coverage and troubleshooting. [KB Library.docx](docs/KB%20Library.docx) is retained as a compatibility copy. Master-library registration and in-app KB search remain pending.

## Feature update 0.3.0

Prepared 24 October 2026. Until the native release workflow finishes, the live catalog remains the authority for the published version. This build adds searchable two-column Settings, purple/grey/black palettes in Original Bubble, scheduled gradual colour changes, optional magnification/contrast/reduced motion, password-generator defaults, and a first-launch fictional demo tour with replay.

Store API credentials using App Name, Email, Client ID and Client Secret, and store encrypted card records with masked numbers/security codes. These record types are excluded from website login filling. Import another encrypted vault through Vault & security using that file's own master password and key file; folders are preserved and exact duplicates skipped. Portable copies remain encrypted; plaintext export is not provided.

Dashboard widgets calculate local password health and encrypted daily snapshots. Red breach flags are reports entered by you, with an optional reference. They are not results of an online/dark-web lookup. Per your offline preference, no email, username, password or hash is sent to a breach provider. Passkeys, Travel Mode, signup-password capture, autologin and payment-form filling remain open work in [JOBS.md](JOBS.md).

Settings includes separate feature, bug, issue, Help and Crash report actions. Support drafts contain fixed sanitised categories and require native preview plus final submission in your browser. A renderer failure locks the vault before offering reload; main-process/OS crashes may still require a manual report after restart. No private stack trace or vault payload is attached. Guides Safe-KB1–8 are available offline and can appear in Settings search; disable KB results while keeping Help available. The Word library has matching articles and clickable cross-references.

The Windows 11 Home 10.0.26300 x64 source smoke and 34-test suite passed on 24 October. The latest 1,000-entry test measured 265 ms unlock, 38 ms import and 222 MiB peak benchmark-process RSS. GUI smoke measured 328 ms main-module-to-renderer startup, 0.13% summed idle-process CPU and 401 MiB working set across app processes. These are one-machine observations. Native CI additionally records each OS/kernel version, architecture, source commit and source/packaged smoke results in app-scoped verification JSON release assets. A published architecture is not proof of compatibility with every OS version.

| OS / architecture | Current evidence and limitations |
| --- | --- |
| Windows x64 | Windows 11 Home 10.0.26300 source verified locally; packaged verification and CI are required for this source version. Unsigned portable ZIP; no installer/uninstaller certification. |
| macOS x64 / arm64 | 0.2.3 native source/packaged CI passed; 0.3.0 pending its native workflow. Ad-hoc signing, not notarized. See the release verification JSON for the actual OS release tested. |
| Linux x64 / arm64 | 0.2.3 native source/packaged CI passed; 0.3.0 pending its native workflow. Chromium sandbox/user-namespace and tray support depend on the desktop. |
| Other OS versions / architectures | Not yet verified unless listed in the version-specific evidence. Absence of testing does not mean OS Version Not Supported. |
