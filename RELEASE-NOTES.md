TMApps Launcher 1.14.0 adds app detail screens, searchable settings and help, neutral dark palettes, and reviewed crash-report drafts.

- Download Windows Setup.exe, a matching macOS Intel/Apple Silicon DMG, or a Linux x64/ARM64 AppImage below. macOS/Linux source and packaged launchers are checked in CI. OS badges under each app show its actual published builds; a launcher port does not port a Windows-only application.
- Click an app name or Details for version/date information, app-branch release notes, one showcase-video slot and ten screenshot slots. Existing app screenshots are used; missing media is labelled unpublished. Video never autoplays.
- Settings offers Orange, Grey and Black palettes, keyword search, optional KB results, and explanations of startup, tray, update and media resource costs.
- Help contains twelve numbered KB articles, feature/bug/issue forms and a reviewable crash-report draft. GitHub submissions remain explicit user actions. Download KB Library.docx below for the Word edition.
- TMApps email-code sign-in clients, protected session storage, app permissions and a Supabase backend are prepared. Sign-in is disabled until the operator configures and deploys that service; apps also need handoff integration before reusing it. Mailbox/social-provider sign-ins remain separate. Ratings are not included.
- Every release runs functional checks and bounded startup, memory and idle-CPU checks. Diagnostics remain local until the user chooses to submit a report.

Existing install locations, profiles and application state are preserved. Windows builds remain unsigned. macOS builds are ad-hoc signed, not notarized. Linux tray availability depends on the desktop; AppImages can use --appimage-extract-and-run when FUSE is unavailable.

Source and setup guides: https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher
