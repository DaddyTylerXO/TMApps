# Agent Office project instructions

- Maintain `CHANGELOG.md` with every user-visible feature, fix, or breaking change. Add concise entries under `Unreleased`; keep existing release history.
- Do not change the application version or publish a release unless the user requests it. The current application version is 0.2.0.
- Keep `README.md` setup and capability descriptions consistent with the implementation.
- Run the checks appropriate to a change. The automated suite is `npm test`. Real Codex generation checks consume account allowance; distinguish their results from fixtures.
- Keep secrets, local credentials, runtime profiles, job data, build outputs, and verification artifacts out of Git.

## KB maintenance

For every app update, follow the standing KB maintenance requirements in [.cursor/rules/kb-maintenance.mdc](.cursor/rules/kb-maintenance.mdc).

## Sensitive security data

For all work, follow the sensitive-data publishing restrictions in [.cursor/rules/security-data.mdc](.cursor/rules/security-data.mdc). Carry this rule forward to new TMApps projects.
