# TMA-SocialsManager security

The [suite security policy](https://github.com/DaddyTylerXO/TMApps/blob/main/SECURITY.md) covers this branch and its release packages. Report vulnerabilities through [private reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new). Keep passwords, provider tokens, OAuth secrets, social account data and private files out of public issues, logs and screenshots.

Use the newest published build from the [suite download index](https://github.com/DaddyTylerXO/TMApps/blob/main/DOWNLOADS.md). Source may be ahead of the available package while a new version is being tested. No long-term support window, guaranteed response time or independent security audit is claimed.

Follow [.cursor/rules/security-data.mdc](.cursor/rules/security-data.mdc) before every commit, push and publication. Provider credentials belong in protected local/server storage, never in repository files or distributed packages. Review outgoing changes and generated artifacts with redacted scanning and manual inspection. Stop affected publication if credential exposure is suspected and coordinate rotation and cleanup with the owner.

Read [README.md](README.md) and [OAUTH-SETUP.md](OAUTH-SETUP.md) for the implemented connection modes, provider restrictions and setup. The suite security policy explains checksum verification and its limits.
