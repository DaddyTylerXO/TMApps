# TMA-Libraries security

The [suite security policy](https://github.com/DaddyTylerXO/TMApps/blob/main/SECURITY.md) covers this branch, its source and any published release packages. Use [private vulnerability reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new) for vulnerabilities. Do not include real passwords, tokens, authenticator seeds, vaults, mailbox data or private files in public issues, logs or test examples.

This branch is in preparation and has no published application package. It does not have a supported released version yet.

Follow [.cursor/rules/security-data.mdc](.cursor/rules/security-data.mdc) before every commit, push or release. Keep credentials in appropriate local/server secret stores and review actual source, history and generated artifacts before publication. If exposure is suspected, stop the affected publication and notify the owner with redacted locations; coordinate credential rotation and cleanup without rewriting shared history unless explicitly authorized.

See this branch's [README](README.md) for actual capabilities and platform limitations, and the suite policy for private reporting instructions and checksum verification limits.

## Maintenance review — 23 October 2026

This update changes documentation and shared acceptance criteria only. It makes no new claim about app security, platform support or completed security testing. Review this policy and README after each branch update; record any no-change assessment and preserve the app-specific model above. Follow the sensitive-data publishing rule for source, history and every generated artifact. Security vulnerabilities must use [private reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new), never a public support form.
