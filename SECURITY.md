# Security model

TMA-Padlock keeps authenticator secrets and metadata encrypted in `vault.tmapadlock` under Electron's per-user application-data directory (`app.getPath('userData')`). It makes no network requests and has no telemetry or cloud recovery.

## Password mode

A password of at least 12 characters derives a 256-bit key using scrypt with N=65,536, r=8, p=1, and a random 16-byte salt. Each save uses AES-256-GCM, a fresh random 12-byte nonce, a 16-byte tag, and application/version additional authenticated data. Names, counters, and secrets are encrypted together. Writes use a temporary file and atomic rename; failed writes roll back in-memory mutations. There is no password reset. Backups require their original password.

## Device mode

A random 256-bit data key is wrapped using Electron safeStorage: DPAPI on Windows, Keychain on macOS, or a supported Linux secret store. Linux `basic_text` and unavailable backends are rejected. This protection is tied to the OS account; it does not protect against every app running as the same user. Portable backup is disabled in this mode. See [Electron safeStorage documentation](https://www.electronjs.org/docs/latest/api/safe-storage/).

## Runtime

The sandboxed renderer has no Node access. Context isolation, an IPC allowlist, sender/frame/URL checks, denied navigation and permissions, and a network-blocking CSP reduce exposure. Stored setup secrets are never returned to the renderer. Setup fields clear after saving, cancelling, or locking. Codes and account names are visible while unlocked.

The app locks on request, screen lock, suspend, renderer failure, exit, or five minutes without keyboard/pointer activity. Polling does not reset inactivity. Lock invalidates in-flight password derivation. Clipboard codes clear after 20 seconds or on lock if the clipboard still contains the copied code; another app's newer value is preserved. Clipboard managers may retain history.

Key buffers are zeroed on lock. JavaScript strings, garbage-collected copies, swap, crash dumps, screenshots, and privileged processes cannot be reliably erased or excluded. Use OS disk encryption and a trustworthy device. A compromised unlocked session can expose codes. No independent security audit has been performed.

## Distribution and recovery

Release packages have SHA-256 checksums and publish after matrix tests and packaged smoke checks pass. The launcher verifies downloads. Windows/Linux packages are unsigned; macOS is ad-hoc signed rather than notarized. Checksums do not independently authenticate a publisher.

Keep offline service recovery codes and encrypted backups separately. Account deletion is permanent within the live vault. Previous backups can contain deleted accounts and older HOTP counters; restoring them may require service resynchronization. Master password changes and a second authenticator for unlocking the vault are not implemented in this version.

Report vulnerabilities privately through this repository's GitHub security reporting where available. Never include real secrets or vault passwords in an issue or test fixture.
