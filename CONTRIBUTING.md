# Contributing to TMApps

Choose the affected app from the [project table](README.md#projects) and read that
branch's AGENTS.md, APP-STANDARDS.md and security/KB rules before making changes.
Use the [support forms](SUPPORT.md) for bugs, feature ideas and general issues.
Describe the app/version, OS version/build, architecture, expected result and a
small reproducible example. Send vulnerabilities through private reporting.

Work on a focused branch and open a pull request against the actual app branch.
Preserve concurrent changes, user data and existing app-specific release approval
requirements. Do not force-push shared history. A pull request should explain the
problem, resulting behaviour, verification, KB impact and remaining limitations.

Use TMA-Finance Settings and the shared theme sequence. Finish, verify and push one
theme update before starting another. Preserve stable KB numbers. Update relevant
guides, tours, screenshots and version notes together. Review README and SECURITY
after every branch update and record any no-change assessment.

Run meaningful checks for the affected code, including startup/idle/workload
performance and matching-OS packaged checks where relevant. Record results and
unrun checks in APP-COMPLIANCE.md. A policy-only change should state its lack of
runtime impact instead of inventing measurements. Never present planned features
or untested OS versions as supported.

Review outgoing source, history and generated artifacts for sensitive data with
redacted scanning and manual inspection. Use synthetic fixtures and screenshots.
Never upload credentials, real mail, vaults or personal documents. See SECURITY.md.

Licensing and legal-policy decisions are deferred by the owner. This contribution
guide does not change existing licence files or determine third-party usage rights.
