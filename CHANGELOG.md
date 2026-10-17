# Changelog

## 1.6.0

- Update and uninstall ask permission to close the selected running app, including tray processes. Apps that resist graceful close require a second explicit force-close confirmation.
- Uninstall defaults to keeping local data, with an explicit permanent-delete choice for the selected app standard profile; external work folders and custom profiles remain untouched.
- Shared orange/grey dialogs with rounded controls now cover app installation, uninstall, close permission, and launcher uninstall.
- Added real windowless-process scoping checks and data-retention/deletion regression tests.

## 1.5.0

- Added per-app Windows startup and desktop icon options to the install dialog; updates retain and retarget them, and uninstall removes the managed integrations.
- Fixed stale Mail discovery by checking its branch update manifest and checksum at a pinned commit in addition to the shared release catalog; incomplete checks are explicitly reported.
- Updated the embedded Mail entry to 0.10.0-beta and retained newer cached releases when an older shared catalog is returned.
- Restyled GitHub as a matching bubble with the official Octicons logo.

## 1.4.0 — 2026-10-16

- Launcher setup now offers an editable destination and Browse picker, remembers the registered folder, and supports launcher relocation and custom-location uninstall.
- App installation prompts for a destination before downloading; cancellation starts no install. Updates, launching, folder browsing, and uninstall use the recorded custom location.
- Retained support for existing installations and limited cleanup to launcher-owned files and recorded app version folders.
- Added custom-path, update reuse, cancellation, and unrelated-file retention regression checks.

## 1.3.0 — 2026-10-16

- Per-user setup EXE with startup, desktop shortcut, close-to-tray, and launch-after-install options; Start menu and Windows Apps uninstall integration.
- Burnt-orange sidebar inspired by TMA-Mail; dock Left/Top/Right/Bottom or collapse to an icon ribbon, with live preview and Save/Cancel settings.
- Explicit Grid and List controls with saved preferences.
- Fixed item-template button routing using the original clicked button; regression tests click Install and the three-dot menu through the real UI.
- Added tray reopen/update/quit controls and second-instance restoration.

## 1.2.0 — 2026-10-16

- Original white rocket on burnt-orange `#CC5500` icon, embedded into the EXE at seven Windows sizes and applied to the window/header.
- TMA-Mail-inspired dark palette, rounded panels, pill buttons, rounded search, and matching context menus/settings.
- Company metadata set to `DaddyTylerXO`; code signing remains deferred by request. Windows verified-publisher and SmartScreen reputation are unchanged.
- Added embedded-icon and publisher-metadata verification.

## 1.1.0 — 2026-10-16

- Single downloadable `TMApps-Launcher.exe` with embedded interface and initial app catalog; no extraction or companion files.
- Compact application list by default, optional grid, and Not installed filter.
- Version numbers and source update dates for each application.
- Both published app packages available immediately from the embedded library.
- Standalone startup test that loads the EXE from an otherwise empty folder.

## Public distribution — 2026-10-16

- Verified installation and uninstall of both published app packages without GitHub authentication.
- Updated launcher messages and setup instructions for public downloads; GitHub connection is optional.

## 1.0.0 — 2026-10-16

- Native Windows library with original TMApps branding, grid/list views, search, filters, and preferences.
- Verified portable installs, explicit updates, launch, cancellation, and uninstall.
- TMA-Mail and TMA-Agent Office catalog with release availability and offline fallback.
- GitHub Actions packaging and publishing for the launcher and both applications.
- Installation safety checks and real WPF rendering verification.
- Private GitHub downloads using a user-supplied token encrypted with Windows DPAPI.
