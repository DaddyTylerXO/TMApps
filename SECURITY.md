> Repository-wide reporting, supported-version guidance and publishing requirements: [suite security policy](https://github.com/DaddyTylerXO/TMApps/blob/main/SECURITY.md). Send vulnerabilities through [private vulnerability reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new); keep sensitive details out of public issues.

# Release credential checks

Never publish OAuth client secrets, user passwords, access/refresh tokens, account stores or private keys. Microsoft public client IDs are identifiers, not client secrets. Keep local provider configuration in ignored `provider-settings.json`; it must never be staged or copied into a public package.

Before publishing, run:

```powershell
./check-secrets.ps1 -Outgoing
```

The scanner checks all outgoing reachable Git blobs, including earlier commits in the push, and decompresses ZIP entries. It detects known local provider secrets (including base64 forms), Google/GitHub credential patterns, non-placeholder client-secret literals and private credential artifacts. Error messages identify files, never secret values. These checks reduce risk; they do not prove that every possible credential format is absent.

Install the pre-push hook in every publishing checkout:

```powershell
git config core.hooksPath .githooks
```

The installed hook scans every pushed ref before upload and fails closed if PowerShell or the scanner is unavailable. Do not bypass it with `--no-verify`, allow a detected secret through GitHub push protection, or disable protection to publish a release. Investigate any finding, remove real secrets from every outgoing commit and archive, then rerun the scan. If a real secret was published, revoke/rotate it before addressing history cleanup.

`package.ps1` packages public provider configuration only, refuses a nonempty Google client secret, and scans the resulting ZIP before writing its checksum. Failed ZIPs are removed. GitHub CI independently scans reachable history and archived contents after pushes and on pull requests; CI is an additional detector, not a substitute for the pre-upload hook or GitHub push protection.

## Maintenance review — 23 October 2026

This update changes documentation and shared acceptance criteria only. It makes no new claim about app security, platform support or completed security testing. Review this policy and README after each branch update; record any no-change assessment and preserve the app-specific model above. Follow the sensitive-data publishing rule for source, history and every generated artifact. Security vulnerabilities must use [private reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new), never a public support form.

## Migration increment review — 23 October 2026

The Avalonia preview uses synthetic mail and has no real-account setup or existing-profile import. Its new profile-file component requires an externally supplied secure-vault key, uses AES-256-GCM with random nonces and profile-bound authentication, and refuses a plaintext fallback. OS vault adapters and real-account storage integration remain unfinished; component encryption tests do not establish native-vault readiness. Existing Windows DPAPI handling remains in the Windows application.

Both editions share mail transport, MIME, sync and modern provider-login source. TLS certificate validation is preserved. Only the public provider configuration is copied to preview packages. Client secrets, live accounts and protected caches remain excluded. Package publication scans files before archiving; CI artifacts contain sample-only previews, sample screenshots and sanitized OS/startup measurements. Moderate-or-higher NuGet advisories fail the migration restore. A vulnerable transitive PKCS dependency discovered during this increment was explicitly pinned to patched 10.0.13 before testing; the affected preliminary build was not published.

The safe HTML renderer and rich editor are not yet ported; the preview displays plain text only. Public Windows downloads and the update manifest remain at 0.16.5. Real-account login, provider writes, actual macOS/Linux vaults and supported installation/update/uninstall claims require separate native validation. README, KB sources/screenshots and the Word library were reviewed for this increment; the full suite compliance checklist remains open.
