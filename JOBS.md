# TMA-Safe job register

Updated 24 October 2026. Version 0.2.3 is published. The 0.3.0 source work below is prepared locally until its native build and publication workflow succeeds. “Ongoing” checks apply to future updates as well.

1. **Security assessment — ongoing.** 0.2.3 fixes published; 0.3.0 source has 34 passing Windows tests and fictional-data GUI smoke. Final package scan/native release verification pending. Independent audit remains unavailable.
2. **Security checks every update — implemented release gate, ongoing maintenance.** Regression suite, dependency audit and manual source/artifact review. Automated checks do not replace manual testing.
3. **Appearance — prepared in 0.3.0.** Original Bubble default, grey/black palettes, local schedules and configurable instant/2–60 minute transitions. Other suite theme styles require separate verified pushes in the prescribed order.
4. **Optional MFA — partial.** Separate key-file possession factor already works at vault creation. Existing-vault factor conversion, TOTP and Windows Hello remain open; no superficial offline TOTP bypass is advertised as encryption protection.
5. **Dashboard — prepared in 0.3.0.** Selectable local widgets and encrypted daily snapshots. Global data-breach spikes are not measured.
6. **Generator defaults — prepared in 0.3.0.** Saved length/character choices apply to future generation.
7. **Generated signup passwords and browser capture — open.** Needs explicit approval, exact-origin checks and safe save/update handling.
8. **Breach warnings — offline-only per owner.** Manual flags and local password-health checks prepared in 0.3.0. Online/dark-web monitoring deferred by the owner; no service receives identities, passwords or hashes.
9. **Backup/export/import — prepared in 0.3.0.** Complete encrypted portable copies and master-authenticated encrypted merge with folders/duplicate handling, alongside browser CSV import. Plaintext export is not provided.
10. **Travel Mode — open.** Needs a safe, reviewable backup/removal/recovery design, optional dates and honest limits for cloud copies, snapshots and local files. Hiding a label is not secure removal.
11. **Performance optimisation/testing — ongoing.** Workload benchmark and GUI startup/idle/memory measurements; release ceilings recorded in CI.
12. **Performance guidance — prepared in 0.3.0 Settings.** Startup, scrypt RAM/CPU, imports, clipboard/idle limits, browser bridge and bounded schedule work explained.
13. **First-launch tour — prepared in 0.3.0.** Acceptance/dismissal persisted; inert fictional demo, visible highlighted targets, Back/Next/Exit and Settings replay. Further manual screen-reader/small-window checks remain.
14. **Zero-knowledge check — design reviewed.** No provider-held recovery key, remote vault account or uploaded vault. Local encryption is not claimed to be a formally audited zero-knowledge protocol.
15. **AES-256 check — verified by source and tests.** AES-256-GCM at rest and authenticated headers. App does not transmit vault files; HTTPS remote links and the documented local HTTP browser bridge are distinct transport cases.
16. **Autofill/autologin/payment forms — partial.** Approval-based exact-origin login filling exists, with a new disable setting. Automatic login and payment filling remain open.
17. **Passkeys — open.** Requires a real platform/browser authenticator integration, portability/recovery design and native verification; no placeholder is advertised as support.
18. **Feature request button — prepared in 0.3.0.** Main Settings, app/version and verified default-branch feature template.
19. **Bug report button — prepared in 0.3.0.** Main Settings and reviewed GitHub draft.
20. **Issue report button — prepared in 0.3.0.** Distinct general-issue template on the default branch.
21. **Help button — prepared in 0.3.0.** Offline numbered guides on main Settings.
22. **Settings search — prepared in 0.3.0.** Keyword filtering of sections and optional KB results.
23. **Word KB Library — prepared update.** Safe-KB1–8, screenshots, clickable bookmarks/cross-references, all nine pages rendered and inspected. First library published with 0.2.3. Main master registry/library and Wiki alignment remain open.
24. **In-app KB Library — prepared in 0.3.0.** Shared article source, offline help, stable IDs and optional search results.
25. **Crash reporting — prepared in 0.3.0 with limits.** Fixed sanitised categories, renderer-failure locking/reload, native preview and browser draft/final user submission. Main-process/OS crashes may require a manual report; private stacks are never automatically uploaded.
26. **Cards — prepared in 0.3.0.** Encrypted typed records, masked edit/reveal, number-only copy, folders and deletion. Browser payment filling remains open.
27. **Accessibility — prepared controls, further manual validation open.** First-run access to optional 100–200% magnification, contrast and reduced motion; semantic labels and keyboard access remain baseline. No certification or completed NVDA/VoiceOver testing is claimed.
28. **API entries — prepared in 0.3.0.** App Name, Email, Client ID, Client Secret, folders, reminders and encrypted storage; excluded from login filling.
29. **Release/docs — in progress for 0.3.0.** Finish package review, native matrix, source/Word upload and catalog verification. Maintain all other launcher entries. Shared suite gaps, such as profile sync, desktop notifications/sounds, other themes, OS-version breadth, master KB/Wiki and showcase video remain tracked in APP-COMPLIANCE.md. Startup animation awaits owner approval; legal/licensing work remains deferred.
