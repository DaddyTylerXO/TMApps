# Changelog

User-visible changes to Agent Office are recorded here. Entries under Unreleased
move into a numbered release when that release is prepared.

## Unreleased

### Added

- GitHub source repository setup and project instructions for maintaining this changelog.

## 0.1.0 — 2026-10-15

### Added

- Windows desktop application with a visual agent office, Overview, and dedicated The Office Live tab.
- Configurable specialist agents, collaborative stage handoffs, job priorities, pause, cancellation, and retry.
- Eight project zones: Forge, Content, SNS, Products, Infra, Business, Games, and Archive; project status styling and seven-day inactivity indicators.
- Codex integration with ChatGPT browser sign-in, account model selection, usage information, and streamed output. No API key is required for this connection.
- Optional OpenAI API connection with encrypted Windows key storage or session-only credentials.
- ArtCraft integration for all 13 applications shown in the suite, including per-agent app permissions, folder confinement where supported, and action review.
- Spotify desktop playback information and previous/play/pause/next controls through Windows media sessions.
- Light, dark, and system appearance, reduced motion, and text scaling from 100% to 200%.
- Projects tab with live disk changes, nested folder navigation, safe text previews, recent changes, and Open folder.
- Per-project folder location and folder name controls, full-path preview, and persistent folder settings.
- Completed Jobs tab with saved deliverables, tool results, file locations, and history across restarts.
- Windows installer with installation-folder selection, Desktop and Start menu shortcuts, and uninstall support.

### Fixed

- Corrected the Codex project configuration that described writable work as read-only and caused chat-only output instead of saved files.
- Jobs now verify that non-empty output files were created or changed before reporting completion. Empty folders, unchanged files, and chat claims do not pass verification.
- Generated Codex images are copied into the project instead of being left only in the runtime cache.
- Specialist stages are coordinated by Agent Office; unnecessary internal delegation is discouraged, and the tool budget scales with the team.
- Linked jobs and supported ArtCraft sessions use the selected project directory, including locations outside the office default workspace.
- Project folder names reject invalid Windows characters and reserved names; existing folders are not overwritten or silently moved.
- Interrupted jobs are reported as failures and are never automatically retried. Explicit retry preserves the original job history.

### Validation

- 42 automated tests pass for the current implementation.
- Real signed-in Codex checks created and read back HTML, and completed a two-specialist job producing five SVG logos, a gallery, a README, and review notes.
- A real VectorCraft open/export check verified output in a custom project folder. Automated protocol fixtures do not themselves constitute live AI generation tests.
