# App compliance evidence

Standards revision: **2026-10-23**. Branch: `TMA-Padlock`. Baseline source: `c53201fcd294b27a7fc884995e369c6e44fe578a`.

This is a requirements register, not a runtime certification. Source or package availability alone does not verify every acceptance criterion. Read the existing branch README for current features and known limitations; newer source may differ from published packages.

| ID | Requirement | Status / evidence still required |
| --- | --- | --- |
| APP-01 | GitHub branch | Verified: TMA-Padlock branch; remote maintenance commits merged without rewriting history. |
| APP-02 | TMApps Launcher | Verified: 0.4.0 published with all five native packages and matching SHA-256 metadata; current launcher parser accepted it and suite ordering was verified. |
| APP-03 | UI and approved identity | Original Bubble and approved icon retained. Finance, ArtCraft and Blocky theme updates remain open in required order. |
| APP-04 | Windows macOS and Linux | Five native build/source/package-smoke jobs passed. Windows 11 local launcher install/launch/replacement-update/uninstall passed. Other lifecycle/version and signing gaps remain; see docs/verification-0.4.0.md. |
| APP-05 | Consistent settings layout | Finance settings reference inspected at origin/TMA-Finance; search, categories and two-column panels adapted with pink bubble controls. Future themes remain open. |
| APP-06 | Feature request button | Main Settings feature button targets feature-request.md verified on origin/main, identifying app/version. |
| APP-07 | Bug report button | Main Settings bug button targets bug-report.md verified on origin/main, identifying app/version. |
| APP-08 | Issue report button | Main Settings issue button targets general-issue.md verified on origin/main, identifying app/version. |
| APP-09 | Help button | Main Settings Help links app docs; offline numbered library available. |
| APP-10 | First-run feature tour | Optional first-setup prompt, separate fictional demo, visible highlighted targets, adjacent tour dialog, Back/Next/Exit, replay and remembered dismissal. Source smoke and UI tests. |
| APP-11 | Branded Word KB Library | Canonical TMA-Padlock KB Library.docx and legacy copy; logo/header on every page, bookmarks, clickable index/cross-references and Back to index. Master library not yet published on main; integration remains open. |
| APP-12 | KB guides errors and offline coverage | Padlock-KB1 through KB10 cover setup, offline operation, features, security and actual errors/resolutions. Sources: ui/kb.js and docs/KB-Library.md. |
| APP-13 | Settings and KB search | Settings keywords/categories, KB text matching and persistent KB-search toggle tested in tests/features.test.cjs. |
| APP-14 | Master KB on main | Open: no published Master KB or shared registry found on origin/main at verification. Child registry: docs/kb-registry.json. Shared master maintenance remains required. |
| APP-15 | Reviewed built-in crash reports | Review/edit/consent flow, sanitized allowlisted diagnostics, browser final-submit explanation and bounded versioned issue URL tested. |
| APP-16 | Zero-cost features | Local crypto/code generation; no paid API, cloud resource, subscription or billing path introduced. Support uses system browser/GitHub. |
| APP-17 | Appearance and gradual scheduling | Pink/Grey/Black, schedule across midnight, 0–60 minute transitions, persisted settings, minute scheduling and reduced-motion override. UI tests cover 30-minute transition. |
| APP-18 | Online and offline indicator | Conservative text/light distinguishes offline code availability from unverified GitHub reachability; no ambient provider probes. Further Mail-style parity remains open. |
| APP-19 | Desktop notifications | Opt-in generic native notifications after backup/import/export; click opens app, OS handles dismiss/quiet mode. Windows managed shortcut registration tested; actual OS delivery needs platform/permission verification. |
| APP-20 | Tray icon menu | Pink bubble tray with five actions and Linux native fallback, source/package smoke and trusted-frame tests. |
| APP-21 | Settings performance detail | Settings explains startup, CPU/RAM password derivation, GPU/windows/transitions, disk backup, browser networking and battery tradeoffs. |
| APP-22 | Performance and functional checks every update | Synthetic 2,000-account benchmark and source/package metrics; mandatory tests/performance/dependency/fuse gates. See docs/performance.md; native CI passed; see docs/verification-0.4.0.md. |
| APP-23 | Sensitive-data checks and remediation | Redacted tracked/history/DOCX scan and manual review of fictional screenshots; package ASAR scan added to native CI. No real user vaults accessed. See scripts/check-sensitive.py. |
| APP-24 | New Features by version | New Features in Settings lists actual 0.1.0, 0.2.0, 0.2.1 and current 0.4.0 behavior. |
| APP-25 | Accessibility setup and settings | Partial: semantic labels, keyboard/native dialogs, live status, and reduced-motion override. Optional accessibility setup/settings, screen-reader/scaling/contrast verification remain open. |
| APP-26 | Current and future app enforcement | Merged shared instructions/rules and this evidence register retained; open gaps explicitly preserved. |
| APP-27 | Local profile | Open: local profile and launcher display-name synchronization are not implemented in this update. |
| APP-28 | Startup animation approval | Open owner decision: startup animation not implemented. Proposed options recorded in docs/startup-animation-proposals.md. |
| APP-29 | Four themes in separate updates | Original Bubble is this update. Finance, ArtCraft-inspired and Blocky Basic require three later separately verified/pushed theme updates. |
| APP-30 | Notification sounds | Open: selectable Mail sound set, preview and persisted sound preferences remain required; native notification defaults only. |
| APP-31 | Optional now playing | Open: optional zero-cost Spotify now-playing is not implemented. |
| APP-32 | OS versions and architectures | Dated native OS/build table and local Windows lifecycle evidence are in docs/verification-0.4.0.md. Other OS versions and macOS/Linux desktop lifecycle remain not yet verified. |
| APP-33 | OS support in listings | Dated native OS/version evidence is in docs/verification-0.4.0.md and the live launcher description/verification metadata. Broader OS-version coverage and Projects integration remain open. |
| APP-34 | App showcase videos | Open: AD-style showcase video not created. |
| APP-35 | README and security lifecycle | README and SECURITY reviewed/updated for 0.4.0 and merged suite policy; docs record scope and limitations. |
| APP-36 | Wiki and community documentation | Open: Wiki publishing/community/accessibility documentation requires separate verification and maintenance. |
| APP-37 | Release and package metadata | Verified 0.4.0 release packages, SHA-256 catalog, source 9376efb and workflow 40077553546; app-scoped source tag created after native verification. |
| APP-38 | HTTPS | Fixed HTTPS GitHub support/download URLs; renderer network blocked; no HTTP service added. |

## Runtime update 0.4.0

Final native checks on 24 October 2026: 56 tests on each target; Windows passed 55 with one POSIX-only skip, macOS/Linux passed all 56; source smoke covers main, mini, tray, demo and lock. Dependency audit reported zero known advisories. Performance measurements and security assessment are in docs/. Canonical Word and compatibility copy are rendered and visually checked before publication. Native CI, live catalog/hash verification and the isolated Windows launcher lifecycle passed; this register does not claim unrun checks or complete suite compliance. Licensing and legal-policy work remain deferred.

Latest publishing-only changes were reviewed against README and SECURITY. Package provenance and suite ordering are now recorded; the encryption model is unchanged. All broader open requirements above remain required work.
