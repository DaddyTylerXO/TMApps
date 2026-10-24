# App compliance evidence

Standards revision: **2026-10-23**. Branch: `TMA-Safe`. Baseline source: `912593113945be51346c87aa507d808ff5b97acc`.

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

## Security update evidence 23 October 2026

Source version 0.2.3 is prepared; publication is not implied. The 25-test suite, Windows source smoke and packaged smoke passed. See SECURITY-REVIEW-2026-10-20.md for a sanitised summary and measured performance. Release CI now requires security regressions, an advisory gate and performance ceilings on each native build. Existing Original Bubble appearance and approved key icon are retained; no additional theme is claimed.

The first illustrated child KB library has Safe-KB1 through Safe-KB4, internal index and cross-links, logo/branding on every page and offline/error coverage. All five pages were rendered through native Word and the document skill page pipeline and visually reviewed. Master library/registry and Wiki publication remain open because no published master was found at main.

README and SECURITY were reviewed against the current source; no provider has a recovery key or remote vault access. Runtime limitations remain explicit. Current source and packaged payload are reviewed for outgoing sensitive data; detailed vulnerability notes stay local. Features requested in the job list and unchecked shared standards remain open unless separately evidenced.

## Feature source update 24 October 2026

Prepared version 0.3.0; published version remains 0.2.3 until the release workflow completes. APP-05–09/13/15/17/21/24 have concrete source implementations in the new Settings, support and appearance modules with search/sanitisation/schedule tests. APP-10 has a first-run/replay fictional tour tested not to write real records; native smoke confirms its inert workspace and exit. APP-25 offers optional scale/contrast/reduced motion and semantic controls; manual assistive-technology and small-screen coverage remain open.

APP-11/12: shared Safe-KB1–8 sources, eight bookmarked guides and index, matching offline Help, screenshots using fictional records, and a nine-page branded Word document. All pages rendered and visually checked, internal anchors/cross-links validated. APP-14/36 master library/registry/Wiki alignment remains open; no published master was found at the last check. Compatibility Word path is preserved.

APP-22: 34 Windows tests passed; a 1,000-entry workload measured 38 ms import, 265 ms unlock and 222 MiB peak benchmark RSS. GUI smoke measured 328 ms module-to-renderer load, 0.13% summed process CPU during an idle sample and 401 MiB aggregate working set. These are local measurements, not cross-device guarantees. APP-32/33: local Windows 11 Home 10.0.26300 x64 source checked; final package and native 0.3.0 matrix pending. The 0.2.3 native matrix passed and published. Future releases emit versioned OS/architecture/source/smoke evidence.

APP-03/29: this update verifies Original Bubble only, preserving the purple key identity and adding background palettes; Finance/ArtCraft/Blocky layouts have not been implemented or advertised. APP-16/38: offline-only health and manual reports; no billable service path. Remote support links use HTTPS, with the authenticated loopback HTTP exception retained and documented. APP-23 artifact review and final release evidence are required before publication. APP-35 README/SECURITY were reviewed and updated, preserving unaudited-beta and runtime limitations. Other unchecked standards remain open. See JOBS.md for the complete app-specific job register.
