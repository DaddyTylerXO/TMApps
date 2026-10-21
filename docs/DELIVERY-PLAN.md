# Suggested delivery plan

This is an implementation sequence, not a reduction in the requested scope. Version 0.1.0 begins Phase 1 with a Windows Forms desktop shell, offline notes/checklists, organisation, atomic local storage/recovery and native workspace copies. It also starts setup, tour, appearance and settings work. See [verification and outstanding gates](VERIFICATION-0.1.0.md). All unimplemented requirements are retained.

## Phase 1: desktop and storage foundation

Select a free desktop stack after assessing local tooling and existing TMApps conventions. Establish the brown/white-folder identity, local document model, durable storage, folders, recent documents, favourites, tags, search, settings, first-run setup, and baseline accessibility. Implement general notes and checklists first. Define migration and recovery behaviour before storing user work.

Verify: clean start, persistence across restarts, interrupted-save recovery, keyboard navigation, offline editing, and idle/startup resource usage.

## Phase 2: shared TMApps requirements

Implement the tour, scheduled appearance transitions, accessibility controls, configurable shortcuts, connection indicator, tray menu, desktop notifications, release notes, support buttons, and KB search. Inspect TMA-Mail for the required visual/behavioural patterns. Prepare reviewed crash reports and use the actual GitHub templates.

Verify: first-run/replay tour, transition durations, accessibility prompts/defaults, support destinations, online/offline changes, notification settings, and resource impact.

## Phase 3: productive document workspace

Add books, rich documents, side notes/comments, emoji, templates, branding, CVs, cover letters, advertisements, newsletters, project dashboards, and portfolios. Add imports/exports incrementally with explicit supported-format documentation. Add configurable autosave/backups, document details, and history.

Verify: representative editing workflows, Unicode, large books, template round trips, project progress/deadlines, export fidelity, and restore from backup/history.

## Phase 4: specialised editors

Implement spreadsheet formulas/data sources, presentations and presenting, PDF creation/conversion/redaction/signatures, scanner acquisition, creative boards/stickers, and databases. Assess macro execution and eSignatures separately for complexity and safe implementation. Use only free dependencies and appropriately licensed media.

Verify: real file round trips, spreadsheet calculation correctness, slide rendering/presentation, irreversible removal of redacted data, scanner handling, and documented size/performance limits.

## Phase 5: protection and integrations

Implement established password encryption, sensitivity labels, TMA-Mail attachment handoff, and notes sync with all four named apps. Define versioned local exchange contracts, conflicts, failure/retry handling, and offline queues as needed.

Verify: wrong-password handling, protected backups/temp files, sync conflicts, offline recovery, and attachment handoff using the actual sibling applications.

## Phase 6: documentation and distribution

Create `TMA-Libraries KB Library.docx`, with stable article numbers, real screenshots, app-colour branding, app name/logo on every page, and a first-page master KB reference. Document setup, features, offline limits, settings, performance, errors, and GitHub escalation steps. Update the master KB on the repository's main branch with all Libraries KB entries. Package and register the app with TMApps-Launcher, and publish to the intended branch.

Verify: Word document rendering, links and KB search, launcher install/start/update behaviour, clean install, and release artifacts.

## Dependencies to resolve during implementation

- TMApps-Launcher repository, package format, and registration/update mechanism.
- TMA-Mail source or supplied references for tray design and connectivity indicator.
- Existing GitHub feature/bug/issue forms, Discussions/FAQ destinations, and crash issue template.
- Actual main/default branch and master KB path; do not assume a filename or create dead links.
- Existing TMApps logos/assets and sibling-app notes/mail integration contracts.
- Free dependencies for desktop UI, editors, file formats, scanner support, encryption, and grammar checking, with offline and licensing limits recorded.
- Definitions for database scope, portfolio publishing/export, macro compatibility, scanner devices, and eSignature requirements as these phases approach.

## Recurring update gate

For every application update: run checks appropriate to the changed behaviour, optimise/test performance, inspect changes for sensitive data exposure, update relevant KB articles/screenshots, record new features by version, and refresh tour content. Record actual results and unresolved limitations; do not substitute a checklist for evidence.
