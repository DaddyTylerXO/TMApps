# Changelog

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
