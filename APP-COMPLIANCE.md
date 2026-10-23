# App compliance evidence

Standards revision: **2026-10-23**. Branch: `TMApps-Launcher`. Baseline source: `bc7bbf773784cdb11dbaf8cef867b49f7772c7e9`.

This is a requirements register, not a runtime certification. Source or package availability alone does not verify every acceptance criterion. Read the existing branch README for current features and known limitations; newer source may differ from published packages.

| ID | Requirement | Status / evidence still required |
| --- | --- | --- |
| APP-01 | GitHub branch | Branch exists at the baseline source above. |
| APP-02 | TMApps Launcher | Open: verify implementation, relevant tests and documentation before completion. |
| APP-03 | UI and approved identity | Open: verify implementation, relevant tests and documentation before completion. |
| APP-04 | Windows macOS and Linux | Open: verify implementation, relevant tests and documentation before completion. |
| APP-05 | Consistent settings layout | Open: verify implementation, relevant tests and documentation before completion. |
| APP-06 | Feature request button | Open: verify implementation, relevant tests and documentation before completion. |
| APP-07 | Bug report button | Open: verify implementation, relevant tests and documentation before completion. |
| APP-08 | Issue report button | Open: verify implementation, relevant tests and documentation before completion. |
| APP-09 | Help button | Open: verify implementation, relevant tests and documentation before completion. |
| APP-10 | First-run feature tour | Open: verify implementation, relevant tests and documentation before completion. |
| APP-11 | Branded Word KB Library | Open: verify implementation, relevant tests and documentation before completion. |
| APP-12 | KB guides errors and offline coverage | Open: verify implementation, relevant tests and documentation before completion. |
| APP-13 | Settings and KB search | Open: verify implementation, relevant tests and documentation before completion. |
| APP-14 | Master KB on main | Open: verify implementation, relevant tests and documentation before completion. |
| APP-15 | Reviewed built-in crash reports | Open: verify implementation, relevant tests and documentation before completion. |
| APP-16 | Zero-cost features | Open: verify implementation, relevant tests and documentation before completion. |
| APP-17 | Appearance and gradual scheduling | Open: verify implementation, relevant tests and documentation before completion. |
| APP-18 | Online and offline indicator | Open: verify implementation, relevant tests and documentation before completion. |
| APP-19 | Desktop notifications | Open: verify implementation, relevant tests and documentation before completion. |
| APP-20 | Tray icon menu | Open: verify implementation, relevant tests and documentation before completion. |
| APP-21 | Settings performance detail | Open: verify implementation, relevant tests and documentation before completion. |
| APP-22 | Performance and functional checks every update | Open: verify implementation, relevant tests and documentation before completion. |
| APP-23 | Sensitive-data checks and remediation | Open: verify implementation, relevant tests and documentation before completion. |
| APP-24 | New Features by version | Open: verify implementation, relevant tests and documentation before completion. |
| APP-25 | Accessibility setup and settings | Open: verify implementation, relevant tests and documentation before completion. |
| APP-26 | Current and future app enforcement | Open: verify implementation, relevant tests and documentation before completion. |
| APP-27 | Local profile | Open: verify implementation, relevant tests and documentation before completion. |
| APP-28 | Startup animation approval | Open: verify implementation, relevant tests and documentation before completion. |
| APP-29 | Four themes in separate updates | Open: verify implementation, relevant tests and documentation before completion. |
| APP-30 | Notification sounds | Open: verify implementation, relevant tests and documentation before completion. |
| APP-31 | Optional now playing | Open: verify implementation, relevant tests and documentation before completion. |
| APP-32 | OS versions and architectures | Open: verify implementation, relevant tests and documentation before completion. |
| APP-33 | OS support in listings | Open: verify implementation, relevant tests and documentation before completion. |
| APP-34 | App showcase videos | Open: verify implementation, relevant tests and documentation before completion. |
| APP-35 | README and security lifecycle | Open: verify implementation, relevant tests and documentation before completion. |
| APP-36 | Wiki and community documentation | Open: verify implementation, relevant tests and documentation before completion. |
| APP-37 | Release and package metadata | Open: verify implementation, relevant tests and documentation before completion. |
| APP-38 | HTTPS | Open: verify implementation, relevant tests and documentation before completion. |

## This maintenance update

Shared instructions, checklist and documentation only. No application code or packages changed; runtime/performance tests were not run for this policy update. README and SECURITY were reviewed and received the maintenance gate below. Existing app-specific security and release requirements are preserved. Licensing, usage-rights/legality and legal policies remain deferred. Record code-update functional/performance/security results and native OS/build/architecture evidence here as work is completed.

## Launcher 1.15 code evidence

Original Bubble is the implemented layout style; Orange, Grey and Black are its colour palettes. Finance, ArtCraft-inspired and Blocky Basic layout styles remain pending separate updates. Settings has search, categories, panels, Save/Cancel and main-page support actions. Full suite parity, tours, appearance scheduling, accessibility and notification requirements remain open.

See docs/VERIFICATION-1.15.0.md: Windows 210 checks and native 56 passing tests with one platform-specific skip, renderer/performance checks, local photo/email controls, bounded media, reviewed crash drafts and manual public endpoint indicators. Matching-runner release checks provide architecture evidence. Native app installation on the reported Mac remains unresolved. Shared sign-in needs operator deployment; companion consumer/source rollout is incomplete.

The Word guide has canonical app-named and legacy compatibility files with identical contents, app branding on every page, 17 stable KB IDs and verified internal links. The main branch had no published Master KB document when checked; its link and Wiki/registry synchronization remain pending. README and SECURITY were reviewed for the runtime update. Legal and startup-animation decisions remain deferred; no startup animation was added.
