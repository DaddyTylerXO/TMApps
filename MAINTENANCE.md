# Repository maintenance

Initial cross-branch audit: **21 October 2026**. This is a dated evidence record, not a claim that every application meets every shared standard or has passed an independent security audit.

## Repository and distribution

All ten branches were inspected: `main`, `TMApps-Launcher`, `TMA-Mail`, `TMA-Safe`, `TMA-Padlock`, `TMA-Cut`, `TMA-Finance`, `TMA-Libraries`, `TMA-SocialsManager` and `TMA-AgentOffice`. Branch instructions, root documentation, package versions, file trees and available publishing workflows were reviewed. That initial snapshot predates the Finance implementation and Libraries rebuild; use the newer dated record below for current distribution.

The shared `tma-apps` release contained **382 assets** at the final check, after Cut's 0.2.0 and SocialsManager's 0.4.0 publications. The audit compared all **26 package references** in the application catalog and launcher update feeds with GitHub's uploaded-asset SHA-256 digests and checksum sidecars. All 26 matched. This check did not download or execute those release binaries, inspect historical packages, or independently reproduce their builds.

The [public GitHub Packages page](https://github.com/DaddyTylerXO/TMApps/packages) showed the registry getting-started screen with no published packages. Installers/archives are GitHub Release assets. Authenticated registry inventory and private vulnerability/Dependabot alert settings were not inspected; no claim of zero private alerts is made.

| Application | Source/published version observed | Published architecture coverage |
| --- | --- | --- |
| Launcher | 1.14.1 | Windows x64; macOS x64/ARM64; Linux x64/ARM64 |
| Mail | 0.16.5-beta | Windows x64 |
| Safe | 0.2.2 | Windows x64; macOS x64/ARM64; Linux x64/ARM64 |
| Padlock | 0.2.1 | Windows x64; macOS x64/ARM64; Linux x64/ARM64 |
| Cut | 0.2.0 | Windows x64; macOS x64/ARM64; Linux x64 |
| SocialsManager | 0.4.0 | Windows x64; macOS x64/ARM64; Linux x64/ARM64 |
| Agent Office | 0.2.0 | Windows x64 |
| Finance / Libraries | No application release | None |

Versions matching does not prove that every source commit is included in the published package. Asset timestamps, source commits, build-run revisions and actual release notes must also be checked for app changes.

## Corrections and follow-up

- Replaced the main three-link README with a full branch/project index and published-platform information. Added [DOWNLOADS.md](DOWNLOADS.md) with actual package and checksum links.
- Replaced the example security version table with a suite-wide [security policy](SECURITY.md), verified private reporting destination and release-integrity guidance. Preserved the existing sensitive-data publishing restrictions.
- Added [SUPPORT.md](SUPPORT.md), a general issue template and security contact links. Copied the launcher's four existing bug/crash/feature/issue forms onto the actual default branch so its template URLs can resolve.
- Corrected the obsolete `AI-Agent-Dashboard` branch name in both launcher source catalogs. The Windows publication refreshed the live catalog to `TMA-AgentOffice`; the repeat distribution audit reported zero findings across all 26 package references.
- Replaced template security policies on Cut, SocialsManager, Finance and Libraries; added missing Launcher/Agent Office policies. Linked Mail/Safe/Padlock to central private reporting while preserving their app-specific security models and credential checks. All ten branches now have real security/reporting guidance.
- Corrected the launcher README's outdated platform paragraph and linked its release-note source to the suite download index. Clarified Finance/Libraries' unpublished status in their own READMEs.
- SocialsManager advanced to 0.4.0 in concurrent app work during the audit. Its source and instructions were reread before changing only its placeholder security policy; independent app changes were preserved. Its verified release completed and the download index now points to 0.4.0 packages.
- Two legacy default-branch issue-template filenames contain `*`, which prevents a normal Windows checkout. They are retained because existing Cut releases link to those exact filenames. Migrate app links before removing/renaming them; do not silently break installed app report buttons. This local checkout excludes that directory with sparse checkout.
- Branch protection is off for all ten observed branches and the repository has no rulesets. This audit did not change repository governance settings.
- The shared release body is maintained by the launcher publishing workflow. Its source now links the full app/download index and explains the independent app versions; app branches retain individual change history.

## Verification

The launcher catalog branch correction passed **188 Windows checks**, including the real installer, UI and update flows. Measured startup was **598 ms**, working set **96.97 MiB**, idle CPU **0.049%**, within the existing check's budgets. Desktop tests passed **37 checks**, with **one native macOS/Linux process check skipped on Windows**. An initial sandboxed desktop run was blocked by fixture file-rename permissions; the same suite passed outside that sandbox. Native runner/package checks remain the publishing workflow's responsibility.

The [launcher maintenance publishing run](https://github.com/DaddyTylerXO/TMApps/actions/runs/39577686018) completed all Windows and four native build jobs and native publication successfully. SocialsManager's [0.4.0 release run](https://github.com/DaddyTylerXO/TMApps/actions/runs/39577741867) also succeeded. An intermediate audit encountered cached metadata while installers were being replaced; fresh asset metadata and live manifests/sidecars agreed at the final check. The public API's unauthenticated rate limit was reached during repeated checks, so final asset/branch metadata came from the authenticated GitHub connector, with checksum files still read from the live release.

The launcher's locked dependency advisory check reported **one moderate development/optional dependency advisory**: [`sprintf-js` <=1.1.3, GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), through electron-builder's build tooling. The registry reported no published patched version. This is an open dependency-maintenance item; no unsupported override or application security-clean claim is made. This check covered the launcher lockfile, not every app's full dependency graph.

This pass changes repository/distribution documentation and source-link metadata. It does not add UI features or change app versions. Existing in-app KB articles, screenshots and Word documents do not require new content for these changes; their published files are preserved. Further app functionality or dependency fixes require their own relevant functional/performance/KB checks.

## Ongoing maintenance procedure

The owner requested daily checks at **09:00 Europe/London**. The chat's maintenance automation holds that schedule; it is not a GitHub Actions schedule. Notify only for meaningful changes, completed fixes, failures or required action.

1. Enumerate all branches and read current instructions. Compare current remote heads before publishing; preserve concurrent work and never force-push.
2. Review changed source/package versions, lockfiles, branch READMEs, security documents, KBs, build results and platform limitations. Keep placeholders distinct from published apps.
3. Fetch the live release catalog and both launcher update feeds. Validate URLs, branches, package availability, platform/architecture selection and checksum agreement before updating the primary page.
4. Use `python tools/audit-releases.py --output <local-report.json>` for a repeatable public distribution check. Exit 0 means metadata checks passed, 1 means findings, and 2 means an incomplete audit. This checks asset metadata and sidecars, not binary contents or runtime behaviour. If the public API is rate-limited, supply `--api-snapshot <fresh-connector-metadata.json>` with `branches`, `release` (including ID/draft/prerelease) and `assets` arrays from the authenticated connector. Never treat an old snapshot as a live inventory. Recheck after active uploads complete before concluding that cached metadata represents a persistent mismatch.
5. Review relevant dependency advisories and resolve supported updates with app-specific tests. Never equate a package version bump with a tested release, or claim unavailable alert/registry access was checked.
6. Update the README/download index and this dated record when facts change. Preserve historical release assets unless the owner authorizes cleanup. Follow app-specific release/version requirements and never publish a build that has not passed its required checks.
7. Run redacted secret scanning and review the actual outgoing changes and artifacts. Keep credentials, real account data, local test output and build products out of commits/releases.


## Maintenance update — 23 October 2026

Reviewed all ten current branch heads and published 38 shared acceptance criteria,
per-branch evidence checklists and future-project guidance. Finance Settings is
the common layout reference; Mail remains the tray/notification/status reference.
Four themes are required in separate verified pushed updates. Agent Office's
approved identity is grey with a white robot; runtime integration remains open.

The read-only release audit checked **403 assets** and **28 manifest packages**
against GitHub digests and live checksum sidecars with **zero findings**. Binaries
were not downloaded/executed by this audit. Published Finance is **0.1.3** and
Libraries **0.2.0-dev.1**, both Windows development builds; newer source or older
branch documentation must not be confused with these catalog versions. Launcher
feeds publish **1.14.2**. DOWNLOADS and OS-SUPPORT reflect the dated evidence.

Main Help links now use the existing Windows-safe issue-template filenames. Bug,
feature, general issue and Launcher templates collect app/version, OS build/CPU,
theme, reproducible details and sanitized supporting evidence. Contribution,
community conduct and accessibility status documents were added. Accessibility
features are described with limits rather than a compliance certification.

README and SECURITY were reviewed/updated on every branch. The changes are policy
and documentation only; no runtime/performance result, new app version or package
is claimed. Existing app-specific release gates and security models are preserved.
Licensing, usage-rights/legality and legal-policy work are deferred by the owner.

The source workbook and four original PNG files were unavailable at their supplied
paths. Visible theme references and pasted requirements were retained; no claim is
made that the workbook was reconciled. Word KB drafts still need current-source
refresh and complete visual QA before publication. Wiki initialization, Project
fields, labels/topics/version tags and app runtime work remain in the queue.

Repository topics and nine app labels were added. Authenticated package-registry inventory returned HTTP 403 for the available credentials; registry maintenance is not marked complete. App-scoped version tags remain pending exact published-build/source verification.

## Daily maintenance — 24 October 2026

Read AGENTS, security/app/KB rules, README, SECURITY and compliance records across
all ten branch heads. Mail, Safe and Launcher have newer source than yesterday's
main maintenance snapshot; other app heads are unchanged. Existing app work and
legal/licensing deferrals were preserved.

Checked the live shared release: **452 assets**, **28 manifest package references**,
**zero digest/sidecar findings**. Refreshed DOWNLOADS, README's checked date and the
OS table for published **Launcher 1.15.1** and **Safe 0.2.3**. Finance remains 0.1.3,
Libraries 0.2.0-dev.1 and Mail 0.16.5-beta in the catalog. Mail's native migration
preview is not a published macOS/Linux app package.

Latest Safe and Mail checks and the replacement Launcher publishing run succeeded.
Earlier Launcher failures are superseded by successful run 40000717239; no new
failure alert is needed for those historical runs. Safe run 40005507808 succeeded.
This audit did not execute release binaries or repeat app performance tests.

Safe's branch now publishes a named illustrated Word library with Safe-KB1–4;
the suite-wide Word/Master KB tasks remain open. No Word file was regenerated by
this maintenance update, so prior local drafts were not substituted for the app's
new published library. Other unfinished numbered jobs remain open.

This commit changes main documentation only. README and SECURITY were reviewed
and updated; no app build, version bump, code change, new OS support or full-suite
compliance is claimed. Published asset links were checked against the fresh API
snapshot; authored changes received bounded redacted credential-pattern scanning
and manual review. Full history and package-content secret scanning remains open.
