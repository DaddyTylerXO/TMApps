# TMApps Launcher security

The [suite security policy](https://github.com/DaddyTylerXO/TMApps/blob/main/SECURITY.md) covers this branch and its Windows, macOS and Linux releases. Use [private vulnerability reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new), not a public issue containing exploit details or credentials.

The launcher verifies catalogued downloads against SHA-256 hashes. Checksums do not independently authenticate the publisher. Windows/Linux builds are unsigned; macOS builds are ad-hoc signed and are not notarized. App package support is separate from launcher platform support.

Follow [.cursor/rules/security-data.mdc](.cursor/rules/security-data.mdc) before every publication. Never publish credentials, real profiles, account data, local test output or unreviewed crash reports. See the suite policy for reporting requirements and the limits of version support.

## Maintenance review — 23 October 2026

This update changes documentation and shared acceptance criteria only. It makes no new claim about app security, platform support or completed security testing. Review this policy and README after each branch update; record any no-change assessment and preserve the app-specific model above. Follow the sensitive-data publishing rule for source, history and every generated artifact. Security vulnerabilities must use [private reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new), never a public support form.

## Launcher 1.15 runtime review

The 1.15 code update stores optional profile photos locally as small normalized PNGs. Photos and profile suggestions do not authenticate providers. Spotify uses PKCE with a public client ID and an individually documented HTTP loopback callback on 127.0.0.1; remote provider requests use HTTPS with normal certificate validation. Refresh credentials stay in the OS-protected store, or memory only when a secure keyring is unavailable. API status checks send no credentials and run only when requested. Crash submission remains reviewable and requires the user to submit on GitHub.

See docs/VERIFICATION-1.15.0.md for functional, performance and bounded credential-scan evidence and practical limits. This review does not certify the entire suite, resolve the macOS signing/companion-launch reports or change licensing and legal policies.
