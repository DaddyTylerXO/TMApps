# TMA-Padlock 0.4.0 security assessment

Assessment started 23 October 2026; final dependency recheck 24 October 2026. Scope: application source, synthetic vaults, renderer/IPC boundaries, encrypted backup/import, startup/tray, icon/report inputs and packaged runtime configuration. This is a code review and automated adversarial assessment, not an independent penetration-testing certification. No real user vaults or credentials were used.

## Findings resolved

| Finding | Change and regression evidence |
| --- | --- |
| Plaintext snapshot could be restored after lock during a failed save | Epoch guards and rollback only for an active matching session; test pauses save, locks, resumes and verifies data/key/header stay cleared. |
| In-flight operations could return names/codes after lock | Main request queue and renderer generation guards; adversarial late verification/save tests. Lock bypasses the queue. |
| Backup restore could install unverified data | Strict envelope, authenticated decrypt and entry validation before exclusive installation; wrong-password, corrupt, existing-vault and lock-cancellation tests. |
| Unbounded or malformed file/IPC input | Bounded regular-file reads, strict primitive field allowlists, queue limit 32, account limit 2,000, vault limit 8 MB; malformed input tests. |
| Repeated online password guessing | In-process progressive cooldown after four failures, tested with an injected monotonic clock. Offline guessing remains a boundary. |
| Default packaged Electron debug/execution switches | RunAsNode, NODE_OPTIONS and CLI inspect disabled; ASAR-only loading and integrity enabled. Fuse verification is a release gate on every platform. |
| New feature inputs could broaden exposure | PNG/JPEG header and pixel limits before decoding, encrypted icon normalization with identical 64-pixel limits on imported metadata, fixed support URL allowlist and strictly sanitized crash metadata. |

## Verification

`pnpm test` runs OTP reference vectors, encrypted round trips, tamper cases, lock races, import/cooldown tests, IPC isolation/flooding tests, HTML injection checks, settings/startup tests and feature UI tests. POSIX permissions/symlink checks run on macOS/Linux and are skipped on Windows. Source and packaged Electron smoke tests assert no renderer Node access, no stored secret in rendered text, working main/mini/tray windows and mini lock clearing. Native builds cover Windows x64, macOS Intel/ARM64 and Linux x64/ARM64.

`pnpm audit --audit-level moderate` is a release gate. The final audit reported zero known advisories, including development dependencies. The 24 October recheck found newly published fast-uri advisories in build tooling; pnpm-workspace.yaml now pins the patched 3.1.9 release before publication. The previously tracked development-only sprintf-js advisory was [withdrawn by GitHub on 22 October 2026](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). Electron was updated from 44.8.0 to 44.9.3 in its existing supported release line; runtime releases are checked independently against the [official release list](https://releases.electronjs.org/?channel=stable).

## Remaining boundaries

- This assessment cannot guarantee absence of vulnerabilities. A compromised OS, administrator, malware, clipboard history, process memory, screenshots and an unlocked session remain outside vault encryption's protection.
- JavaScript strings and garbage-collected copies cannot be reliably zeroed. Key buffers and accessible application references are cleared on lock.
- Strong master passwords are essential. In-app throttling cannot stop offline attacks on a copied vault or prevent restarting the app.
- Windows/Linux packages are unsigned; macOS uses an ad-hoc signature and is not notarized. Checksums verify package integrity but do not independently establish publisher identity.
- Device-key live vaults remain tied to the OS account; portable backups use a separately chosen master password. Second-factor vault unlock, master-password change and cloud recovery are not implemented.
- Notification display, tray support and always-on-top behavior depend on the OS/desktop. No notifications contain vault data.

## Every-update requirements

The release workflow blocks publishing unless the complete test suite, dependency audit, performance gate, source/package smoke tests, package fuse checks and native platform builds pass. Add a regression test for each security bug, rerun relevant adversarial cases after feature changes, review runtime updates, and update this assessment when the threat model changes. Automated regression checks supplement manual review; they are not a new independent penetration test for every commit.
