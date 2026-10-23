# TMApps Launcher compulsory app standards

- Project branch: [TMApps-Launcher](https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher)
- Launcher branch: [TMApps-Launcher](https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher)
- App colour: Burnt orange #CC5500.
- App icon: White rocket on the burnt orange rounded tile.
- KB numbering: Launcher-KB1, Launcher-KB2 and onward; preserve any established IDs.

## Current project identities

| Project branch | App colour | White icon |
| --- | --- | --- |
| [TMApps-Launcher](https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher) | Burnt orange #CC5500 | White rocket on the burnt orange rounded tile |
| [TMA-Mail](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Mail) | Existing forest green palette; retain the established Mail brand | White envelope on the existing green rounded tile |
| [TMA-AgentOffice](https://github.com/DaddyTylerXO/TMApps/tree/TMA-AgentOffice) | Grey #6B7280 | White robot on the grey rounded tile |
| [TMA-Safe](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Safe) | Purple #7048A4 | Existing white horizontal key on the purple rounded tile |
| [TMA-Padlock](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Padlock) | Pink #ED65A0 | White padlock containing the six numbered boxes on the pink rounded tile |
| [TMA-SocialsManager](https://github.com/DaddyTylerXO/TMApps/tree/TMA-SocialsManager) | Yellow #E5B92F | Existing white speech bubble with three dots on the yellow rounded tile |
| [TMA-Cut](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Cut) | Red #D5414C | Existing white camera on the red rounded tile |
| [TMA-Finance](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Finance) | Green #163A2B | White bundle of bills on a green #163A2B rounded tile |
| [TMA-Libraries](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Libraries) | Leather Brown #97572B | White folder on the brown app background |


## Compulsory requirements

Revision: **2026-10-23**. Applies to all existing and future apps, projects and branches.

These are required acceptance criteria, not claims of implemented features. Track evidence and open work in [APP-COMPLIANCE.md](APP-COMPLIANCE.md). Preserve app-specific release requirements.

- [ ] **APP-01 GitHub branch:** Link every app to its exact project branch. Preserve existing work, history and app-specific release requirements.

- [ ] **APP-02 TMApps Launcher:** Register and distribute every app through TMApps Launcher using approved branding, actual version/update date/release notes, verified package URLs and SHA-256 hashes. Preserve other apps. Keep Agent Office last and SocialsManager immediately before it. Maintain launcher self-update feeds instead of a recursive app entry. Advertise only published working OS/architecture packages.

- [ ] **APP-03 UI and approved identity:** Offer the four approved theme styles with Original Bubble Look as default, using Safe/Padlock as Bubble references. Preserve approved app colours and white icons across the app, installer, shortcuts, tray and Launcher. TMA-Finance is the Settings layout reference in every theme. Preserve readable contrast and keyboard operation.

- [ ] **APP-04 Windows macOS and Linux:** Implement native-compatible Windows, macOS and Linux builds and verify supported architectures on matching OS runners, including packaged startup, install, update and uninstall. Record porting/signing gaps. Renaming a Windows executable is not a native port.

- [ ] **APP-05 Consistent settings layout:** Use TMA-Finance's settings layout and interaction pattern in every app: main settings search and categories, consistent navigation/panels/control placement, app-colour bubble styling, clear save/cancel behaviour and keyboard focus. Keep Feature request, Bug report, Issue report and Help directly on the main Settings page; do not hide them exclusively in nested pages.

- [ ] **APP-06 Feature request button:** Put a distinct Feature request button on main Settings. Open the matching GitHub feature form on the actual default branch with app/version identified. Verify the destination.

- [ ] **APP-07 Bug report button:** Put a distinct Bug report button on main Settings. Open the matching GitHub bug form on the actual default branch with app/version identified. Verify the destination.

- [ ] **APP-08 Issue report button:** Put a distinct Issue report button on main Settings. Open the matching general-issue form on the actual default branch with app/version identified. Verify the destination.

- [ ] **APP-09 Help button:** Put Help on main Settings, linking to the app KB Library, a relevant FAQ or actual enabled GitHub Discussions destination. Verify links and clear setup guidance.

- [ ] **APP-10 First-run feature tour:** Offer a Would you like a tour prompt during first setup only. Remember acceptance or dismissal and allow replay from Settings. Place each dialog next to the actual highlighted feature, keeping its target visible, unblurred and unobscured. Reposition/scroll for small windows and keyboard/screen-reader use. Support Skip, Back, Next and Exit without modifying real user data. Update tour steps with feature changes.

- [ ] **APP-11 Branded Word KB Library:** Publish docs/(App Name) KB Library.docx on the app branch. Preserve existing KB Library.docx links as compatibility copies until all consumers are migrated. Use the approved app colours and include app name and logo on every page, including cover/continued pages. Link and reference the main-branch TMApps Master KB Library on the first page. Include current numbered guides and sanitized real screenshots/photos. Preserve clickable index, stable bookmarks, cross-references and Back to index. Render and visually inspect every page before publishing.

- [ ] **APP-12 KB guides errors and offline coverage:** Keep user guides, setup, general knowledge, common issues and an error-message catalogue in Settings/Help and the Word library. For each actual error explain meaning, safe resolution steps and how to submit a sanitized GitHub report if it persists. List which features work offline and which require connectivity, account/provider access or another local dependency. Preserve established KB IDs such as Mail-KB1 or Socials-KB1; append new numbers without renumbering old references.

- [ ] **APP-13 Settings and KB search:** Search Settings by keywords and navigate to matching controls/sections. Include relevant KB guides and allow users to disable KB search results while retaining the full Help library. Persist the preference and test it.

- [ ] **APP-14 Master KB on main:** Maintain docs/TMApps Master KB Library.docx on main with every app, its branch, canonical child Word-library link, existing KB numbers/titles and cross-references. Keep a machine-readable KB registry and update it whenever child libraries change. State missing/unpublished libraries accurately rather than inventing articles or links.

- [ ] **APP-15 Reviewed built-in crash reports:** Prepare a crash report with app/version/platform and relevant sanitized errors in the matching GitHub issue template. Offer an Upload to GitHub Issues button after user review/edit. If it opens a browser for final submission, label that accurately. Never silently submit reports, include private files or expose credentials.

- [ ] **APP-16 Zero-cost features:** Do not implement or retain a feature path that incurs charges, requires a paid API/subscription/trial, creates billable resources or falls back to paid usage. Find a genuinely free/local alternative or leave that feature unavailable and document it. A free quota is acceptable only with no billing required and a fail-closed limit; never auto-upgrade or exceed it. Audit existing integrations too, including AI, cloud, speech, finance and social providers. Do not enable a paid option merely because a user can supply a key.

- [ ] **APP-17 Appearance and gradual scheduling:** Offer dark mode and toned-back Grey and Black choices in Settings with consistent dialogs/menus and saved preferences. Allow configurable times to transition gradually to a selected appearance and configurable transition duration, including 2-minute and 30-minute examples. Handle clock/day changes, cancellation and restart without busy polling. Respect reduced motion and do not promise medical eye-strain outcomes.

- [ ] **APP-18 Online and offline indicator:** Follow TMA-Mail's connection-status light pattern and pair colour with an accessible text label. Distinguish app/provider connectivity from general internet reachability; do not show Online merely because a network adapter exists. Respect offline/no-network modes, privacy and bounded low-frequency checks. Update when connectivity changes.

- [ ] **APP-19 Desktop notifications:** Provide desktop push notifications following TMA-Mail's established notification design/behaviour with this app's colour. Implement preferences, permissions, dismiss/click behaviour, do-not-disturb and any native OS styling limitations. Keep sensitive content out by default; explain when background/closed-app delivery is unsupported.

- [ ] **APP-20 Tray icon menu:** Follow TMA-Mail's rounded tray right-click menu design in the approved app colour. Verify open, close-to-tray and quit. Document native desktop-controlled fallback styling and availability where custom tray menus cannot be provided.

- [ ] **APP-21 Settings performance detail:** Explain in Settings which features affect startup, CPU, GPU, RAM, disk, battery or network usage and how users can reduce those costs. Keep status checks, tours, schedules, search, background refresh and notifications bounded; avoid needless timers or work while idle.

- [ ] **APP-22 Performance and functional checks every update:** Optimize and test after every application code update. Record startup/idle and changed-workload CPU/memory/timing against budgets or prior results, plus appropriate functional and packaged/native-platform checks. Investigate regressions before publication. Never claim unrun checks. Policy-only edits record their no-runtime-impact assessment.

- [ ] **APP-23 Sensitive-data checks and remediation:** Scan and manually review actual outgoing source/history, packages, installers, KBs/screenshots, logs, reports and CI artifacts with redacted output before publication. Never publish API secrets or private user data. If exposure is suspected, stop affected publication, notify using redacted locations, revoke/rotate credentials and coordinate removal from current files and affected artifacts/history. Removing the latest text alone is insufficient; do not force-push or rewrite shared history without explicit authorization. Preserve .cursor/rules/security-data.mdc.

- [ ] **APP-24 New Features by version:** Provide a New Features button inside Settings showing actual version numbers and the features/fixes in each version. Keep it consistent with changelog/release notes, tour and KB changes. Do not advertise unreleased or prepared work as shipped.

- [ ] **APP-25 Accessibility setup and settings:** Offer optional accessibility choices during setup and under Settings > Accessibility: screen-reader integration, dynamic/larger text, magnification, contrast and accessible dark-mode options. Optional adaptations are off by default until selected, persisted and reversible. Baseline semantic labels, native accessibility APIs and keyboard access must remain available. Test focus order, scaling/clipping, screen-reader announcements, contrast and reduced motion.

- [ ] **APP-26 Current and future app enforcement:** Apply these standards to every current app and every new project/branch. Copy AGENTS.md, APP-STANDARDS.md, APP-COMPLIANCE.md, shared requirements and app/security/KB rules when starting a project. Replace template identity fields with real approved values. Maintain an evidence-backed per-app compliance checklist; unchecked gaps remain required work. Requirements or policy copies alone never establish runtime compliance.

- [ ] **APP-27 Local profile:** Provide a Profile section in every app. Synchronize the display name locally with TMApps Launcher; explain scope, avoid a mandatory cloud account, and preserve unrelated local app data.

- [ ] **APP-28 Startup animation approval:** Prepare app-colour startup-animation ideas based on TMA-Mail for owner approval before implementation. Keep startup short, provide a static/reduced-motion path, and measure startup impact.

- [ ] **APP-29 Four themes in separate updates:** Implement themes in this order: 1 Original Bubble Look (default; Safe/Padlock references), 2 TMA-Finance design, 3 ArtCraft-inspired design, 4 Blocky Basic. Complete and verify one theme per app-branch update and push that update before starting the next theme. The sequence applies to theme implementation; maintenance-only documentation changes do not claim a completed theme. Preserve installed theme preferences and the common Finance Settings layout.

- [ ] **APP-30 Notification sounds:** Offer selectable notification sounds using the established TMA-Mail sound set, including silent None, preview and saved preferences. Respect OS notification permissions and quiet settings.

- [ ] **APP-31 Optional now playing:** Offer an optional Spotify now-playing setting only through a zero-cost implementation. Keep it off until enabled, explain connectivity/permissions, handle absence gracefully and avoid unnecessary polling.

- [ ] **APP-32 OS versions and architectures:** Expand version coverage within Windows, macOS and Linux using matching-OS build and packaged smoke tests. Record app version, OS version/build, architecture, test date, evidence and limitations. Published packages alone do not prove every OS version works. Distinguish OS Not Supported (no supported package for the OS) from OS Version Not Supported (a known incompatible version of an otherwise supported OS). Show Not yet verified where evidence is missing; never infer incompatibility from lack of testing.

- [ ] **APP-33 OS support in listings:** Maintain per-app OS/version tables in GitHub documentation and Projects and in TMApps Launcher app descriptions, using the same dated evidence. Do not replace the published app version with a newer unshipped source version.

- [ ] **APP-34 App showcase videos:** Create an AD-style video for every application showing real verified functions and features. Use synthetic data, accurate app branding and readable captions; review footage and exports for sensitive information. Do not advertise planned features as available.

- [ ] **APP-35 README and security lifecycle:** After every branch update, review and update README.md and SECURITY.md as appropriate, recording a no-change assessment when accurate. Keep published/source versions, setup, platforms, known limitations and private-report destinations truthful. Review KB, tours and release notes when affected. Documentation-only changes do not require an app build or version bump.

- [ ] **APP-36 Wiki and community documentation:** Maintain app KB articles in the GitHub Wiki with stable IDs, links to canonical app Word libraries and the Master KB, offline coverage and sanitized images. Keep contribution, community conduct and accessibility documentation accurate; never claim accessibility certification without evidence.

- [ ] **APP-37 Release and package metadata:** Maintain actual release notes, package links, checksums and source provenance. Distinguish GitHub Releases installers from GitHub Packages registry packages. Use app-scoped Git version tags only for verified corresponding source/builds; do not invent version tags for unshipped work. Apply consistent app labels and repository topics.

- [ ] **APP-38 HTTPS:** Use HTTPS for remote application services, downloads and support links with normal certificate validation. Audit any HTTP exception individually, including local loopback callback or development endpoints; do not mechanically replace loopback schemes or disable validation. Document any hosting/domain work still required.

## Future apps and updates

Copy these standards, standards/requirements.json, AGENTS.md, APP-COMPLIANCE.md and the app/security/KB rules into new projects. Read the latest main-branch standards before starting from an older branch. Use [the onboarding checklist](https://github.com/DaddyTylerXO/TMApps/blob/main/templates/NEW-APP-CHECKLIST.md). Resolve actual branch, app name, KB prefix, approved colour and icon before publishing. Preserve existing KB IDs, user data and release history.

## Deferred owner decisions

Licensing, usage-rights/legality assessment and legal-policy work are deferred at the owner's request. This standards update does not select or change any licence or approve third-party usage. Preserve existing notices and app-specific licence files. Publisher identity/contact details remain deferred. Startup animation implementation also awaits the owner's selection of a concrete proposal.
