> Repository-wide reporting, supported-version guidance and publishing requirements: [suite security policy](https://github.com/DaddyTylerXO/TMApps/blob/main/SECURITY.md). Send vulnerabilities through [private vulnerability reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new); keep sensitive details out of public issues.

# Security model

TMA-Padlock keeps authenticator secrets and metadata encrypted in `vault.tmapadlock` under Electron's per-user application-data directory (`app.getPath('userData')`). Code generation and vault storage make no network requests. Renderer connections are blocked. User-selected help/report actions open fixed GitHub URLs in the system browser, which sends the reviewed report text to GitHub. There is no telemetry or cloud recovery.

## Password mode

A password of at least 12 characters derives a 256-bit key using scrypt with N=65,536, r=8, p=1, and a random 16-byte salt. Each save uses AES-256-GCM, a fresh random 12-byte nonce, a 16-byte tag, and application/version additional authenticated data. Names, counters, and secrets are encrypted together. Writes use an owner-only temporary file, atomic replacement, and exclusive initialization; failed writes roll back in-memory mutations. There is no password reset. Backups require their original password. Restore authenticates and validates the entire file before exclusive installation; merge import authenticates the source before changing the current vault. Imports skip duplicate configurations and retain current HOTP counters. Input files are bounded to 8 MB and reject directories/symlinks; saves enforce the same bound. Four failed password attempts introduce a progressively increasing in-process delay up to 30 seconds. This does not prevent offline guessing or app restarts.

## Device mode

A random 256-bit data key is wrapped using Electron safeStorage: DPAPI on Windows, Keychain on macOS, or a supported Linux secret store. Linux `basic_text` and unavailable backends are rejected. This protection is tied to the OS account; it does not protect against every app running as the same user. Portable backup requires choosing and confirming a separate master password; a fresh salt and key protect the exported file. The live vault retains device protection. See [Electron safeStorage documentation](https://www.electronjs.org/docs/latest/api/safe-storage/).

## Runtime

The sandboxed renderer has no Node access. Context isolation, an IPC allowlist, sender/frame/URL checks, denied navigation and permissions, and a network-blocking CSP reduce exposure. Stored setup secrets are never returned to the renderer. Setup fields clear after saving, cancelling, or locking. Codes and account names are visible while unlocked.

The app locks on request, screen lock, suspend, renderer failure, exit, close-to-tray, or the selected inactivity limit (1, 5, 15, or 30 minutes; five by default). Polling does not reset inactivity. Startup and tray options never unlock the vault automatically. Lock invalidates in-flight password derivation, queued sensitive operations, import, save and late renderer results. Failed mutations cannot restore plaintext snapshots after lock. Clipboard codes clear after 20 seconds or on lock if the clipboard still contains the copied code; another app's newer value is preserved. Clipboard managers may retain history.

Eye buttons reveal only the password or setup key currently being entered. They do not fetch stored setup secrets. Revealed inputs are masked again after saving, cancelling setup, or locking. Preferences contain no vault passwords or authenticator secrets. The tray window has a separate sandboxed preload exposing only Open, Mini, Settings, Lock, and Exit, with its own sender/frame/URL checks.

Key buffers are zeroed on lock. JavaScript strings, garbage-collected copies, swap, crash dumps, screenshots, and privileged processes cannot be reliably erased or excluded. Use OS disk encryption and a trustworthy device. A compromised unlocked session can expose codes. A scoped source and automated adversarial assessment is recorded in docs/security-assessment.md. No independent security audit or security certification has been performed.

## Distribution and recovery

Release packages have SHA-256 checksums and publish after matrix tests and packaged smoke checks pass. The launcher verifies downloads. Windows/Linux packages are unsigned; macOS is ad-hoc signed rather than notarized. Checksums do not independently authenticate a publisher.

Keep offline service recovery codes and encrypted backups separately. Account deletion is permanent within the live vault. Previous backups can contain deleted accounts and older HOTP counters; restoring them may require service resynchronization. Master password changes and a second authenticator for unlocking the vault are not implemented in this version.

Report vulnerabilities privately through this repository's GitHub security reporting where available. Never include real secrets or vault passwords in an issue or test fixture.

## Additional hardening

Packaged Electron disables RunAsNode, NODE_OPTIONS, CLI inspector arguments and loading code outside ASAR; ASAR integrity validation is enabled. Every release verifies the packaged fuse values and runs the source and packaged smoke tests. Dependencies are pinned in the lockfile and audited on every release; Electron runtime security updates are reviewed separately from npm audits.

Uploaded icons accept only size-bounded PNG/JPEG headers with bounded pixel dimensions before native decoding, then normalize to 64-pixel PNG. Presets and custom icons are encrypted account metadata. SVG and remote image URLs are rejected. Account lists render at most 100 matches at once; code caches are bounded by account count and cleared on lock.

Crash diagnostics persist at most ten timestamps and allowlisted failure categories alongside version/platform/architecture. Raw exception messages, stacks, OS paths, vault files, names, codes and setup secrets are excluded. User-written report text is reviewed separately with an explicit checkbox before opening GitHub. Do not include secrets in that text. Windows ACLs remain inherited from the per-user application-data directory; POSIX vault files use mode 0600.
## Maintenance review — 23 October 2026

The earlier suite maintenance update changed documentation and shared acceptance criteria only. The 0.4.0 code update is assessed in docs/security-assessment.md. It makes no new claim about app security, platform support or completed security testing. Review this policy and README after each branch update; record any no-change assessment and preserve the app-specific model above. Follow the sensitive-data publishing rule for source, history and every generated artifact. Security vulnerabilities must use [private reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new), never a public support form.
