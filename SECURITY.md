# TMA-AgentOffice security

The [suite security policy](https://github.com/DaddyTylerXO/TMApps/blob/main/SECURITY.md) covers this branch, its source and any published release packages. Use [private vulnerability reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new) for vulnerabilities. Do not include real passwords, tokens, authenticator seeds, vaults, mailbox data or private files in public issues, logs or test examples.

Use the newest published package listed in the [suite download index](https://github.com/DaddyTylerXO/TMApps/blob/main/DOWNLOADS.md). App versions are independent. Older assets do not imply long-term security support; no guaranteed response schedule or independent security audit is claimed.

Follow [.cursor/rules/security-data.mdc](.cursor/rules/security-data.mdc) before every commit, push or release. Keep credentials in appropriate local/server secret stores and review actual source, history and generated artifacts before publication. If exposure is suspected, stop the affected publication and notify the owner with redacted locations; coordinate credential rotation and cleanup without rewriting shared history unless explicitly authorized.

See this branch's [README](README.md) for actual capabilities and platform limitations, and the suite policy for private reporting instructions and checksum verification limits.
