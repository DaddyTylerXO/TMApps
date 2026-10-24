# TMA-Padlock 0.4.0 release verification

Published: 24 October 2026. Source: `9376efb26a1edc16ca40640366a8d3f6c5360717`. The shared launcher catalog points to this version and the five verified native packages. All other app entries were retained, with SocialsManager before Agent Office at the end.

[Successful native workflow](https://github.com/DaddyTylerXO/TMApps/actions/runs/40077553546). Raw public evidence: [release-evidence-0.4.0.json](release-evidence-0.4.0.json).

## Verified OS and architecture coverage

| Environment | Architecture | OS release/build | Result |
| --- | --- | --- | --- |
| Windows Server 2025 Datacenter (native runner) | x64 | 10.0.26100 | Tests, source/package smoke, dependency/performance gates and fuses passed |
| macOS 15 runner | Intel x64 | Darwin 24.6.0 | Same checks plus ad-hoc signature verification passed |
| macOS 15 runner | Apple Silicon ARM64 | Darwin 24.6.0 | Same checks plus ad-hoc signature verification passed |
| Ubuntu 24.04 runner | x64 | Kernel 6.17.0-1022-azure | Tests and source/packaged AppImage smoke passed |
| Ubuntu 24.04 runner | ARM64 | Kernel 6.17.0-1022-azure | Tests and source/packaged AppImage smoke passed |
| Windows 11 Home (local) | x64 | 10.0.26300 | Published package SHA-256, launcher install, launch smoke, replacement update, uninstall and fuse checks passed |

All five native jobs ran 56 tests. Windows passed 55 and skipped its one POSIX-only permissions/symlink case; macOS/Linux passed all 56. No test failed. The dependency audit and redacted source/DOCX/package-ASAR scans passed on each runner.

## Lifecycle scope and limitations

The local lifecycle check used the real current Windows launcher engine and the exact downloaded release ZIP in isolated directories, with personal-data deletion disabled and desktop/startup integration replaced by no-op test integrations. It verified installation, launch, replacement installation of the same published version, and uninstall. It does not establish a user-data migration test from every prior release. macOS/Linux packaged launches were verified on native runners; their complete desktop install/update/uninstall interactions remain unverified.

Other OS versions and desktop configurations are **not yet verified**. This is different from a known incompatible OS/version. Native macOS packages are ad-hoc signed and not notarized; Windows/Linux packages remain unsigned. Tray, notification delivery, accessibility and desktop integration still depend on the actual OS session and permissions.

## Runtime features in this release

- Offline TOTP/HOTP with expiry rings and per-account refresh/hide controls.
- Password-authenticated restore/merge import and portable encrypted export from password/device-key vaults.
- Resizable compact window, right-click actions, always-on-top and startup settings.
- Preset/uploaded account icons with normalized import validation.
- Pink/Grey/Black colours, scheduled gradual transitions and reduced-motion handling.
- Optional desktop notifications, searchable Settings/KB, first-setup demo and version history.
- Reviewed GitHub reports, sanitized diagnostics and illustrated numbered KB guides.

See [security assessment](security-assessment.md), [performance measurements](performance.md) and [open suite requirements](../APP-COMPLIANCE.md). This scoped review is not an independent penetration-testing certification.
