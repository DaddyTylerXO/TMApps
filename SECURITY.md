# Security policy

This policy covers all TMApps application branches, the launcher, release assets, update feeds and shared repository files.

## Versions and security updates

Use the newest published package for your app and supported platform, listed in [DOWNLOADS.md](DOWNLOADS.md). Versions are independent across apps; the suite does not use a single shared version number. Older downloads may remain in the shared release for history and compatibility. Their presence is not a promise of continued security maintenance.

TMApps applications are in development. There is no published long-term-support schedule or guaranteed response time. A branch version or successful build alone is not evidence that a package is available or independently security-audited. The 23 October 2026 distribution audit found published Windows development packages for Finance and Libraries. OS-version verification remains separate from package availability; see [OS-SUPPORT.md](OS-SUPPORT.md).

## Report a vulnerability privately

Use **[Report a vulnerability](https://github.com/DaddyTylerXO/TMApps/security/advisories/new)** on the repository's Security page. Private reporting was available when checked on 21 October 2026. If that option is unavailable, open a public issue requesting a private contact channel **without disclosing the vulnerability, exploit or sensitive data**.

Include the app name, version, operating system/architecture, affected feature, impact and reproducible steps using synthetic data. Attach only sanitized logs or minimal examples. Do not include actual passwords, vaults, authenticator seeds, recovery codes, OAuth credentials, tokens, private keys, mailbox contents or personal files. Keep technical details private while the report is assessed. The maintainer will use the private report to discuss reproduction, a fix and coordinated disclosure; no response deadline is promised.

Ordinary bugs and feature requests belong in the public forms linked from [SUPPORT.md](SUPPORT.md).

## Download integrity and limitations

Download only from this repository's official release links. Compare a downloaded file's SHA-256 hash with its matching `.sha256` sidecar, or use the launcher, which verifies catalogued package hashes. A checksum detects a mismatch; a checksum distributed alongside a file does not independently authenticate the publisher. Do not bypass a mismatch.

Windows/Linux builds are unsigned; macOS builds are ad-hoc signed and are not notarized. Read the app-specific security model before relying on an experimental security tool:

- [TMA-Safe security model](https://github.com/DaddyTylerXO/TMApps/blob/TMA-Safe/SECURITY.md)
- [TMA-Padlock security model](https://github.com/DaddyTylerXO/TMApps/blob/TMA-Padlock/SECURITY.md)
- [TMA-Mail credential and release checks](https://github.com/DaddyTylerXO/TMApps/blob/TMA-Mail/SECURITY.md)

Keep independent backups and service recovery methods. Do not assume an app has passed an independent audit.

## Publisher requirements

Follow [.cursor/rules/security-data.mdc](.cursor/rules/security-data.mdc) for every commit, push and publication. Review outgoing history, source changes and generated packages with redacted scanning and manual inspection. Keep secrets in an appropriate OS/server secret store or protected CI secrets; never embed them in a distributed client or publish real user data.

If credentials may have been exposed, stop the affected publication, notify the owner with redacted file locations and arrange revocation/rotation. Removing the latest copy does not remove earlier history or release artifacts. Coordinate cleanup; do not rewrite shared history or force-push without explicit authorization.

## Maintenance review — 23 October 2026

This update changes documentation and shared acceptance criteria only. It makes no new claim about app security, platform support or completed security testing. Review this policy and README after each branch update; record any no-change assessment and preserve the app-specific model above. Follow the sensitive-data publishing rule for source, history and every generated artifact. Security vulnerabilities must use [private reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new), never a public support form.

## Distribution maintenance check — 24 October 2026

The current manifests publish Launcher 1.15.1 and TMA-Safe 0.2.3. The read-only
audit matched all 28 referenced package hashes to release metadata and checksum
sidecars, with no findings. This is an integrity-metadata check, not execution of
the packages, a historical secret scan or an independent security assessment.
Read Safe's branch-specific security model and update notes before use. No app
security guarantees or supported OS versions were expanded by this docs update.
