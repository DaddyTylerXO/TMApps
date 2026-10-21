> Repository-wide reporting, supported-version guidance and publishing requirements: [suite security policy](https://github.com/DaddyTylerXO/TMApps/blob/main/SECURITY.md). Send vulnerabilities through [private vulnerability reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new); keep sensitive details out of public issues.

# Security policy and format

TMA-Safe 0.2.x is an experimental, unaudited beta. Report vulnerabilities through the repository's private security advisory flow if available; otherwise contact the owner privately. Do not put real vaults, passwords, keys, CSV exports or pairing codes in issues.

## At-rest encryption

Folder names/memberships and all titles, websites, usernames, passwords, notes, reminder policies, timestamps and IDs are inside authenticated ciphertext. The filename, file size, OS metadata and public envelope header are not concealed.

* Node/OpenSSL scrypt: N=131072, r=8, p=1 (128 MiB work memory), random 32-byte salt, 32-byte derived key. Fixed parameters are strictly checked to prevent hostile resource costs. Input is SHA-256 of `TMA-Safe/v1\0`, UTF-8 master password, NUL separator and optional 32-byte key content. Passwords cannot contain NUL. This is a custom envelope, not KDBX.
* AES-256-GCM: fresh random 96-bit IV per save and 128-bit tag. Canonical format/version/cipher/KDF/key-file/salt/IV fields are authenticated as additional data. Wrong passwords/keys and ciphertext modification fail before plaintext parsing. Unsupported versions fail closed.
* Keys: optional 32 random bytes, exclusive file creation, owner-only file permissions where supported. No master-password bypass or persisted decryption key. New vaults require at least 14 characters.
* Persistence: encrypted vaults, encrypted previous-save backups, encrypted temporary files and empty lock files. New files never silently overwrite existing files. Conflicting writers fail. Removable/network/cloud filesystem durability varies; maintain backups.

## Runtime boundary

The main process holds decrypted entries and a derived key while unlocked. Renderer lists exclude passwords. Reveal/edit/copy and approved browser fills request individual secrets. Node integration is off, context isolation and sandbox are on, navigation/windows/webviews and permissions are denied, CSP disallows network connections, and IPC verifies the sender and main frame. User fields are inserted as DOM text rather than HTML.

Lock wipes the key Buffer, drops plaintext references, clears sensitive UI, revokes the bridge and clears the clipboard if unchanged. JavaScript strings, garbage collection, OS paging, crash reports, clipboard history/managers and Chromium internals prevent guaranteed memory/clipboard erasure. This app cannot protect an unlocked process from OS compromise, keyloggers, malicious local apps, debuggers or screen capture. It has no OS-protected memory, locked RAM or secure desktop input. Independent review is needed before relying on the beta for irreplaceable secrets.

Pairing authorizes requests, not unattended disclosure: every fill requires desktop approval. The loopback API refuses normal website origins, matches exact HTTPS origins and accepts only a random session bearer token. An explicit extension popup action fills the active top-level tab after rechecking its origin. A website can read credentials filled into its own fields. Do not approve unsolicited requests or install untrusted extensions. Local malware is outside the protection boundary. Permanent Firefox signing and browser-store distribution are not provided.

Key-file protection is a cryptographic possession factor. TOTP and Windows Hello are not implemented. A seed inside the same offline vault would not independently strengthen its encryption. Future hardware-backed authentication needs a separate threat model and must preserve the explicit master-password-on-launch requirement.

## Verification

Tests cover incorrect passwords/keys, encrypted-at-rest fields, ciphertext/KDF tampering, portability, lock cancellation during derivation, concurrent writes, backups, no overwrite, generator constraints, CSV parsing, DOM injection, lock cleanup and bridge authentication/origin rejection. Real Electron smoke checks cover startup, rendering, Node isolation, hidden list passwords and lock cleanup. These checks are not an independent security audit or penetration test.

Device-local settings contain only preferences. Startup never unlocks the vault. Closing to tray locks immediately; the custom tray menu has a separate sandboxed renderer and an allowlisted IPC channel that cannot access credentials.
