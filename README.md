# TMA-Safe

A local desktop password vault in the TMApps family. Purple, rounded controls and a two-key icon follow TMApps Launcher and TMA-Mail. Version 0.1.0 is an unsigned beta and has not had an independent security audit.

## Getting started

Create a `.tmasafe` vault and choose a master passphrase of at least 14 characters. There is no password reset. The master password is requested every time the app opens; no unlock key is saved. Use **Open a vault** for an existing file.

Optionally generate a separate `.tmakey` file when creating the vault. This adds a possession factor to encryption: **both** the master password and original key file are required. Keep it on a separate device/removable drive; storing it beside the vault loses the benefit. This release implements key-file two-factor protection. Authenticator TOTP and Windows Hello are not implemented. A local TOTP check alone would not protect a copied offline vault.

Add, edit, search, copy or delete logins. Passwords remain hidden until revealed; reveal hides after 15 seconds. Clipboard contents clear after 20 seconds if unchanged. Automatic locking runs after five minutes without keyboard/pointer activity inside the app, on OS screen-lock events, suspend, close or renderer failure. OS event availability varies by desktop environment: verify Linux screen-lock behavior locally. Ctrl+L locks immediately.

Generate 8–128 character passwords with lowercase, capitals, numbers, symbols and similar-character exclusion. Reminders accept 1–3650 days, appear in the due list and are mentioned when unlocking. They do not change website passwords or run while the app is closed. Editing notes does not restart a reminder; changing a password does.

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

The release workflow tests and packages Windows x64, macOS x64/arm64 and Linux x64/arm64 before updating the launcher's shared catalog with checksummed packages. Older launchers accept exactly two applications and need the updated launcher release before seeing TMA-Safe. Platform support is verified by native CI, not inferred from a Windows build. See workflow results for actual successful targets.

## References

[KeePass security](https://keepass.info/help/base/security.html) informed full-database encryption, salted key derivation, portability and locking. TMA-Safe uses its own format, not KDBX, and does not claim KeePass's review history. Renderer isolation follows [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security/).
