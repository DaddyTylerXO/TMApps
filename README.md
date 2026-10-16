# TMApps Launcher

A Windows launcher for **TMA-Mail** and **TMA-Agent Office**, installed through a single setup EXE. A burnt-orange navigation pane sits beside the app library, with version numbers, update dates, and Install / Open / Update controls. Downloads, verification, and app installation happen inside the launcher.

![TMApps Launcher library](docs/launcher-preview.png)

## Download and run

Download [**TMApps-Launcher-Setup.exe**](https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMApps-Launcher-Setup.exe) and run it. Setup installs the launcher for your Windows user, creates a Start menu entry, and adds a normal Windows Apps uninstall entry. No ZIP extraction, administrator access, or developer tools are needed. Requires Windows 10/11 x64 with .NET Framework 4.8. Builds are currently unsigned.

During setup choose **Open when I sign in to Windows**, **Create a desktop icon**, **Stay in the tray when the window is closed**, and whether to open the launcher immediately. The default installation folder is `%LOCALAPPDATA%\Programs\TMApps Launcher`. Re-run setup to upgrade; first quit the running launcher using its tray menu. Preferences and installed application data are preserved.

**Install location → Browse** selects a different launcher folder, including another drive. You can also type a full path. Choose an empty folder you can write to; setup remembers the registered location for upgrades and points shortcuts, Windows startup, and the uninstaller at that location. Selecting a new folder during setup relocates the launcher while keeping its separate profile.

The rocket tray icon has **Open launcher**, **Check for updates**, and **Quit** actions. Double-click to reopen a hidden launcher. Turn off close-to-tray in Settings if closing the window should exit instead. Opening the installed launcher again restores an existing hidden instance.

The launcher uses a white rocket on a rounded burnt-orange (`#CC5500`) tile, embedded as a multi-resolution Windows executable icon and shown in the title bar and launcher header. Rounded controls and panels follow TMA-Mail's dark theme. File Properties lists **DaddyTylerXO** as Company. This metadata is separate from Windows' verified publisher: code signing is deferred, so SmartScreen can still display **Unknown publisher** and an unrecognised-app warning. A trusted signing identity and publisher reputation are needed for that; a self-signed certificate does not solve public distribution trust. See [Microsoft's signing guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).

The release is created by the [Publish Windows launcher and app catalog workflow](https://github.com/DaddyTylerXO/TMApps/actions/workflows/publish.yml). Check that workflow for the first build's status if the release is not available yet.

**Public downloads are available without a GitHub account or token.** Both application packages and the release catalog can be downloaded directly. If you previously connected a GitHub token, choose **Settings → Disconnect GitHub** to use public downloads. Optional token support remains available if private access is needed later; saved tokens are encrypted for your Windows user and removed on disconnect.

- **Install app** downloads a Windows ZIP and verifies its SHA-256 checksum before extraction.
- Before a new app installation, choose its destination using **Browse** or enter a full folder path, then confirm **Install**. Cancel closes the prompt without starting a download. Each app can use a different folder or drive. Updates reuse the saved location; existing installations from older launcher versions retain their locations.
- The app-install prompt also offers **Open app on Windows start-up** (off by default) and **Create desktop icon** (on by default). These apply to the app being installed. The launcher remembers the choices, updates their executable targets after an app update, and removes its managed startup entry/shortcut when that app is uninstalled.
- **Open app** starts the installed executable. The options menu also opens an older installed version while an update is available.
- **Check for updates** fetches the current application catalog. **Update app** installs the newer build when you choose it.
- Mail update checks also inspect the `TMA-Mail` branch's `update.json` and package checksum at one pinned Git commit. A new branch package can appear before the shared release catalog is republished. Numeric version comparison recognises `0.10.0` as newer than `0.9.2`; known newer cached versions are retained if the shared catalog is stale. An incomplete branch check is reported instead of claiming everything is up to date.
- Search, **Installed** / **Updates** / **Not installed** filters, and explicit **Grid** / **List** buttons help navigate the library. The selected view is saved.
- **Settings → Appearance** moves navigation to **Left**, **Top**, **Right**, or **Bottom**, just like TMA-Mail, and offers a compact icon ribbon. The ☰ button collapses or expands navigation. Appearance changes preview immediately; Cancel reverts them and Save keeps them.
- **Settings → Startup** changes Windows startup, desktop shortcut, close-to-tray, and startup release-check options after installation.
- Every app shows its current published version and source update date. Publishing records the Mail package's last source commit date and Agent Office's source commit date; rebuilding the launcher does not invent a new app update date.
- App options open its source, show its installation folder, or uninstall its managed binaries. Separate app accounts, mail, and workspace profiles are retained.
- Settings can disable startup release checks. Updates download only when clicked.

Applications installed independently are not automatically adopted. Install them through the launcher to manage their versions here. Close an application before updating or uninstalling it.

## Application sources and readiness

| Application | Source branch | Bundled fallback |
| --- | --- | --- |
| TMA-Mail | [TMA-Mail](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Mail) | 0.10.0-beta package pinned to its source commit with SHA-256 verification |
| TMA-Agent Office | [TMA-AgentOffice](https://github.com/DaddyTylerXO/TMApps/tree/TMA-AgentOffice) | Published 0.2.0 package with SHA-256 verification |

The publishing workflow copies the newest checked-in Mail ZIP after verifying its checksum and builds Agent Office's unpacked Windows Electron app using its lockfile. Both ZIPs and checksums upload before `catalog.json`. The launcher reads that catalog from this repository's `tma-apps` GitHub Release. If publication fails, Mail can still install from the bundled fallback; Agent Office is never shown as installable without a package.

Application-specific setup still applies. TMA-Mail's Microsoft/Google browser sign-in needs publisher OAuth configuration as described on its branch. Agent Office's AI features require the corresponding provider connection. The launcher does not supply credentials or change app features.

## Build and test

No Node.js or separate .NET SDK is needed for the launcher:

```powershell
.\build.ps1
.\test.ps1
.\package.ps1
& '.\build\TMApps-Launcher.exe'
```

The build uses the Windows .NET Framework C# compiler and WPF, with no external installer compiler. Tests cover the installation engine, a real installer payload install/launch/uninstall in an isolated folder, real routed Install and three-dot clicks, saved Grid/List controls, all four navigation positions, compact mode, and WPF rendering. The preview is `build/launcher-preview.png`. Packaging creates `dist/TMApps-Launcher-Setup.exe` and its checksum; users download only the setup EXE. The installed runtime remains a single `TMApps-Launcher.exe` with its UI, icon, and initial catalog embedded.

`make-icon.ps1` regenerates the original vector rocket as PNG and a seven-resolution ICO (16–256 px) under `assets/`. The icon is compiled into the EXE; no separate image download is required.

The GitHub button uses the official [Octicons GitHub mark](https://github.com/primer/octicons), rendered as a vector inside the same bubble button style as Settings and Check updates. Its MIT license is preserved in `assets/github-mark-LICENSE.txt`.

## Publish updates

Push launcher changes to `TMApps-Launcher`, or manually run **Publish Windows launcher and app catalog** from GitHub Actions. Actions must be enabled with the workflow's `contents: write` permission. No external secrets are needed for this public repository. Each run builds the current application branches. To release Mail, commit its newer ZIP and `.sha256` sidecar to `TMA-Mail/dist/`. For Agent Office, update its package version and lockfile on `TMA-AgentOffice`. Then rerun the launcher workflow. Source-branch pushes alone do not trigger the workflow on this branch.

The catalog requires exactly the two registered app IDs, fixed executable names, semantic versions, HTTPS download URLs within this repository, and SHA-256 checksums. Add another app by extending the catalog validation, UI metadata, and workflow together. Only publish trusted builds: checksums detect damaged/mismatched packages but are not publisher code signatures.

## Storage and installation safety

Preferences, the cached catalog, and app installation records live in `%LOCALAPPDATA%\TMApps\Launcher`. Each app's binaries live in a version folder under its selected installation directory; the default for new apps is `%LOCALAPPDATA%\Programs\<app-name>`. The installation record stores that directory. Older installations under `apps/<app-id>/` remain supported. Downloads extract into a new version folder. The record switches atomically after verification, extraction, executable checks, cancellation checks, and checking the app is closed. Failed/cancelled updates preserve the previous record. ZIP traversal paths, links, excessive file counts, and oversized packages are rejected.

Install and uninstall work for the current Windows user without administrator access, using writable destination folders. Drive roots and unrelated nonempty folders are rejected. Updates remove only the previously recorded version folder, and app uninstall removes only the active recorded version, preserving other files and folders at the chosen location. An interrupted installation can leave an inactive staging folder. Quit application processes before retrying locked-file errors. Update the launcher by re-running setup. Uninstall it through Windows Apps or its installed `Uninstall.exe`, including from custom locations; launcher-managed applications and profile data are kept.
