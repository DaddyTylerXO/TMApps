# App compliance evidence

Standards revision: **2026-10-23**. Branch: `TMA-Mail`. Baseline source: `b21fe9cf7041f6a979270547215bfa08889b9e2c`.

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

## Migration increment — 23 October 2026

The source preview is 0.17.0-preview.1; the published Windows application and update manifest remain 0.16.5. No requirement above is marked fully complete by this increment.

- APP-04/32/33: in progress. Shared transport, models and authentication compile under .NET 10; an Avalonia sample interface is implemented. Native Windows x64 packaged startup passed on Microsoft Windows 10.0.26300. macOS/Linux native CI validation is pending. Real-account UI, native vault adapters, complete feature parity and supported OS/version/architecture acceptance remain open.
- APP-03/17/29: partial. The preview uses the existing icon and green rounded controls, with a dark original-style palette. Four complete themes, settings parity and gradual scheduling are still open.
- APP-11/12: partial. The branded four-page Word KB includes three numbered preview guides, internal index/backlinks, troubleshooting, offline/privacy limits and an actual sanitized UI screenshot. All four pages were rendered through installed Word and visually reviewed. Full application KB coverage remains open.
- APP-14: open. Main was reviewed at 7696d580281a8602bdea854488c4d9a9d084d9a6; no Master KB or suite KB registry was published there. No unavailable master link is claimed.
- APP-22: this increment passed the existing Windows regression suite, ten synthetic IMAP checks and 31 portable checks including encryption and rendered layouts at 820/1180/1600 pixels. The packaged native Windows preview opened in 1,374 ms, used 135,438,336 bytes of working set and consumed 31.25 ms of CPU during a one-second idle sample following a two-second warm-up. This two-message baseline does not establish real-mail performance.
- APP-23: public preview configuration leaves the Google client secret empty. The packaged Windows preview's 253 files passed the secret scanner. Outgoing source and nested Word archives must also pass before publication; CI scans each native package tree before upload. Native credential-vault integration remains unfinished; encryption tests do not establish end-to-end profile security.
- APP-24/35/37: roadmap, README, SECURITY, portability notes and source-preview changelog reviewed. Development CI artifacts are separate from the public Windows update channel.

Native CI results and remaining migration gates must be updated from actual runs. Licensing and legal-policy assessment remain deferred as instructed.
