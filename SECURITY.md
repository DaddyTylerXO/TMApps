# TMApps Launcher security

The [suite security policy](https://github.com/DaddyTylerXO/TMApps/blob/main/SECURITY.md) covers this branch and its Windows, macOS and Linux releases. Use [private vulnerability reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new), not a public issue containing exploit details or credentials.

The launcher verifies catalogued downloads against SHA-256 hashes. Checksums do not independently authenticate the publisher. Windows/Linux builds are unsigned; macOS builds are ad-hoc signed and are not notarized. App package support is separate from launcher platform support.

Follow [.cursor/rules/security-data.mdc](.cursor/rules/security-data.mdc) before every publication. Never publish credentials, real profiles, account data, local test output or unreviewed crash reports. See the suite policy for reporting requirements and the limits of version support.

## Maintenance review — 23 October 2026

This update changes documentation and shared acceptance criteria only. It makes no new claim about app security, platform support or completed security testing. Review this policy and README after each branch update; record any no-change assessment and preserve the app-specific model above. Follow the sensitive-data publishing rule for source, history and every generated artifact. Security vulnerabilities must use [private reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new), never a public support form.
