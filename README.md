# TMA-Libraries

TMA-Libraries is a planned TMApps desktop workspace for documents, notebooks, checklists, projects, PDFs, presentations, spreadsheets, portfolios, databases, and creative boards.

- Brand colour: **Leather Brown `#97572B`**.
- Icon: **white folder on a brown background**.
- Intended repository: [DaddyTylerXO/TMApps](https://github.com/DaddyTylerXO/TMApps).
- Intended branch: [`TMA-Libraries`](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Libraries).

## Current status

Version 0.1.0 is an initial **native Windows desktop application**, built with Windows Forms and .NET Framework 4.8. It is not a website, browser wrapper or hosted service. No account, package download or paid service is needed to build or use the app on a compatible Windows machine.

Implemented: offline plain-text notes and checklists, optional checklist progress, folders, favourites, coloured tags, search, recent documents, side notes, configurable autosave, previous-save recovery, native workspace import/export, first-run accessibility choices, a replayable tour, Light/Grey/Black appearance, and release notes in Settings.

This is a foundation build. Advanced editors, encryption, history, TMApps integrations, notifications, tray/connection patterns, support forms remain pending. Launcher installation is available for this Windows development build. A verified unsigned Windows development ZIP is now published through TMApps Launcher. A standalone installer and macOS/Linux app packages are not published. The branded Word KB draft is retained locally and excluded from this publication because it has not passed visual rendering verification; the master KB destination is unconfirmed.

## Install through TMApps Launcher

Update [TMApps Launcher](https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMApps-Launcher-Setup.exe) to 1.14.2 or later, then choose Install app for TMA-Libraries. The [Windows development ZIP](https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMA-Libraries-0.1.0-windows.zip) is checksum-verified by the launcher. Its installation, smoke launch and uninstall were tested in isolated folders. Data is kept by default; standard profile deletion requires explicit consent. See the [launcher KB Library](https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/KB.Library.docx), Launcher-KB14. The app's own Word KB and other incomplete foundation features remain pending.

## Build and run

On Windows with .NET Framework 4.8, run from this folder in PowerShell:

```powershell
./build.ps1 -Test
./build/TMA-Libraries.exe
```

The build uses the compiler supplied with Windows .NET Framework. It requires no .NET SDK or NuGet dependencies. The executable, configuration and docs folder together form the local build. Build output is ignored by Git; it is not an installer or signed release. Run as a normal Windows user.

## Storage and recovery

The app stores its workspace under `%LOCALAPPDATA%\TMApps\TMA-Libraries\workspace.json`. Saves use a flushed temporary file and atomic replacement; `.bak` retains the previous committed save. Startup recovers a readable backup if necessary and reports recovery. If neither copy is readable, startup aborts without creating an empty workspace. Export dated `.tmalibrary` copies for longer retention. Only one app instance can write at a time within a Windows session; multiple simultaneous Windows sessions are not supported.

The workspace and exports are **unencrypted**. Save metadata, document text and side notes remain in the Windows user profile; do not add them to Git or attach them to public issues. There is no telemetry or automatic crash submission.

Only the app's `.tmalibrary` interchange format is supported and round-trip tested. Imports merge documents with new IDs, preserve existing app settings, and validate the complete merge before mutation. DOCX, PDF, spreadsheet and presentation compatibility is not claimed. Maximum workspace size: 16 MiB. Large workspaces may pause the UI during saving/search; see the verification record for measured limits.

Local editing, setup, settings, tour, recovery, imports/exports and KB viewing work offline. Opening GitHub requires connectivity. A free DOCX viewer is required to open the KB draft.

## Verification and documentation

- [Verification record](docs/VERIFICATION-0.1.0.md): storage/workflow checks, performance observations, contrast, security review and remaining validation.
- [Version notes](docs/RELEASE-NOTES.md): changes by version.
- `docs/TMA-Libraries KB Library.docx`: generated locally, not uploaded in this source publication. Branded Word KB draft, Libraries-KB1 through Libraries-KB4. **Visual QA and publication pending** because the renderer lacks LibreOffice and the master KB document link is unconfirmed.
- `scripts/create_kb.py`: reproducible KB builder using the Codex bundled Python runtime, python-docx and Pillow. The screenshot input is produced by `build.ps1 -Test`. These tools are documentation development dependencies only.

## Project documents

- [TMApps standards](docs/TMAPPS-STANDARDS.md): mandatory requirements shared by all TMApps.
- [TMA-Libraries specification](docs/TMA-LIBRARIES-SPEC.md): application features and settings.
- [Delivery plan](docs/DELIVERY-PLAN.md): suggested implementation order and outstanding dependencies.
- [Development guidance](AGENTS.md): instructions for future work.

The full requested scope is retained in these specifications. Checkboxes only cover implemented and appropriately verified behaviour; partial and external deliverables remain unchecked.
