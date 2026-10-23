TMApps Launcher 1.15.0 adds profile email rows and a local photo, a showcase-style app details screen, Service Status, Spotify playback modes, themed window controls and shared profile autofill.

- Open Spotify to connect through browser authorization using PKCE. Choose an active Spotify/Connect device or browser streaming with in-app controls. Browser mode opens Spotify's web player; start a track there. Premium and developer-app user access are required. No client secret is bundled. Authorization stays in protected local storage, or in memory if no secure Linux keyring is available. Refresh stops when the music window closes.
- The launcher and Windows installer use dark window chrome. Scrollbars and checkboxes follow the theme. List-mode Details sits below the main app actions. Settings has focused section buttons, dedicated KB Help and a Compact Navigation Bar control.
- Profile setup includes Autofill compatible TMA app profiles on this device. Name/email suggestions are local to this OS user; provider sign-ins remain separate. Office, Finance and Mail source integrations are prepared for their next companion releases. Companion downloads are unchanged in this launcher release; earlier Mail versions retain their existing display-name sync behavior.
- Email addresses have individual fields with + Add and Remove controls. Optional profile photos stay local and are saved only on Save profile.
- App details use a prominent identity header, available install/open actions, feature panels, app-specific support links and a screenshot gallery. Unpublished media stays hidden.
- Service Status performs manual public endpoint checks with gray, glowing green and glowing red indicators. Reachability is separate from provider account health; additional provider diagnostics remain inside apps.
- macOS disk images use a branded background and native ICNS icon. Stable download links point to the current build; the native workflow verifies the bundle version. Existing signing/notarization and reported companion launch issues remain open.
- App installations show a loading indicator and the native Browse row has additional spacing. Full startup-in-tray and tray preference parity across companion apps remains pending.
- Launcher-KB15, Launcher-KB16 and Launcher-KB17 explain Spotify, profile autofill and Service Status. The illustrated Word library has clickable article references. Functional and resource checks cover the launcher and the shared components. A live Spotify account has not yet been used for end-to-end authorization/playback verification.

TMApps Launcher 1.14.2 adds installable Windows development builds of TMA-Libraries and TMA-Finance.

- Install Libraries 0.1.0 for offline text notes, checklists and workspace recovery, or Finance 0.1.0 for budgets, subscriptions, savings and a manual investment workspace. Both are initial development builds with documented missing features.
- Both show their actual app icons, version/date, Windows support and checked download metadata. The Mac/Linux launchers display their details but do not try to install Windows EXEs.
- Startup and desktop shortcuts are optional; each app can use its own install folder. Uninstall keeps profile data by default and requires consent before deleting the selected app's standard local data. Export backups first; app records are not encrypted.
- Libraries and Finance appear before SocialsManager, and Agent Office remains last. Launcher-KB14 documents setup and limitations; the updated Word KB has screenshots and clickable references.
- Windows, macOS and Linux launcher builds run functional and resource checks. Windows app packages additionally run their app checks; Finance's packaged window is tested with disposable data and renderer isolation.

TMApps suite downloads

Choose your application and operating system from the [current download and checksum index](https://github.com/DaddyTylerXO/TMApps/blob/main/DOWNLOADS.md). The [repository overview](https://github.com/DaddyTylerXO/TMApps) links all app branches and their setup/change history. Read the [security policy](https://github.com/DaddyTylerXO/TMApps/blob/main/SECURITY.md) and use [Help and reports](https://github.com/DaddyTylerXO/TMApps/blob/main/SUPPORT.md) for support.

The shared release contains independently versioned apps. Its creation date is not the update date of every package; use individual assets and the update feeds for current versions. Finance and Libraries do not yet have published app packages. Older assets remain available as release history.

TMApps Launcher 1.14.1 adds TMA-Libraries as a coming-soon application.

- Libraries has a neutral question-mark placeholder, working Details/source options and no install or OS badges until verified packages are published. No unpublished version or date is invented.
- Libraries appears before SocialsManager and Agent Office. Agent Office remains last with its number adjusted automatically.
- Adds Launcher-KB13 with a screenshot and linked references in the Word KB Library.
- Functional and startup/idle resource checks run for Windows and native macOS/Linux builds.

TMApps Launcher 1.14.0 adds app detail screens, searchable settings and help, neutral dark palettes, and reviewed crash-report drafts.

- Download Windows Setup.exe, a matching macOS Intel/Apple Silicon DMG, or a Linux x64/ARM64 AppImage below. macOS/Linux source and packaged launchers are checked in CI. OS badges under each app show its actual published builds; a launcher port does not port a Windows-only application.
- Click an app name or Details for version/date information, app-branch release notes, one showcase-video slot and ten screenshot slots. Existing app screenshots are used; missing media is labelled unpublished. Video never autoplays.
- Settings offers Orange, Grey and Black palettes, keyword search, optional KB results, and explanations of startup, tray, update and media resource costs.
- Help contains twelve numbered KB articles, feature/bug/issue forms and a reviewable crash-report draft. GitHub submissions remain explicit user actions. Download KB Library.docx below for the Word edition.
- TMApps email-code sign-in clients, protected session storage, app permissions and a Supabase backend are prepared. Sign-in is disabled until the operator configures and deploys that service; apps also need handoff integration before reusing it. Mailbox/social-provider sign-ins remain separate. Ratings are not included.
- Every release runs functional checks and bounded startup, memory and idle-CPU checks. Diagnostics remain local until the user chooses to submit a report.

Existing install locations, profiles and application state are preserved. Windows builds remain unsigned. macOS builds are ad-hoc signed, not notarized. Linux tray availability depends on the desktop; AppImages can use --appimage-extract-and-run when FUSE is unavailable.

Source and setup guides: https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher
