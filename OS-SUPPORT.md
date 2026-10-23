# Operating-system support evidence

Checked 23 October 2026. Package availability comes from the live Launcher catalog
and self-update feeds, with 28 package digests/sidecars verified. This document is
not a new OS-version compatibility certification; no native binaries were run in
this documentation update.

Use **OS Not Supported** when the current app has no supported package on that OS.
Use **OS Version Not Supported** for an evidenced incompatible version of an OS
that otherwise has support. Use **Not yet verified** for missing test evidence.
Architecture availability is separate from OS-version compatibility.

| App / published version | Windows | macOS | Linux |
| --- | --- | --- | --- |
| [TMApps Launcher](https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher) 1.14.2 | Windows 10/11 x64 stated requirement; .NET Framework 4.8. Per-build matrix not yet verified | Package available; exact OS versions/builds not yet verified | Package available; exact OS versions/builds not yet verified |
| [TMA-Mail](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Mail) 0.16.5-beta | Windows 10/11 x64 stated requirement; .NET Framework 4.8. Per-build matrix not yet verified | OS Not Supported — no current package | OS Not Supported — no current package |
| [TMA-Safe](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Safe) 0.2.2 | Package available; exact OS versions/builds not yet verified | Package available; exact OS versions/builds not yet verified | Package available; exact OS versions/builds not yet verified |
| [TMA-Padlock](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Padlock) 0.2.1 | Package available; exact OS versions/builds not yet verified | Package available; exact OS versions/builds not yet verified | Package available; exact OS versions/builds not yet verified |
| [TMA-Cut](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Cut) 0.2.0 | Package available; exact OS versions/builds not yet verified | Package available; exact OS versions/builds not yet verified | Package available; exact OS versions/builds not yet verified |
| [TMA-Finance](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Finance) 0.1.3 | Package available; exact OS versions/builds not yet verified | OS Not Supported — no current package | OS Not Supported — no current package |
| [TMA-Libraries](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Libraries) 0.2.0-dev.1 | Package available; exact OS versions/builds not yet verified | OS Not Supported — no current package | OS Not Supported — no current package |
| [TMA-SocialsManager](https://github.com/DaddyTylerXO/TMApps/tree/TMA-SocialsManager) 0.4.0 | Package available; exact OS versions/builds not yet verified | Package available; exact OS versions/builds not yet verified | Package available; exact OS versions/builds not yet verified |
| [TMA-Agent Office](https://github.com/DaddyTylerXO/TMApps/tree/TMA-AgentOffice) 0.2.0 | Package available; exact OS versions/builds not yet verified | OS Not Supported — no current package | OS Not Supported — no current package |

Mail HTML rendering also needs Edge WebView2. Published macOS packages include
Intel and Apple Silicon. Linux ARM64 is unavailable for Cut; do not imply that an
x64 package is native ARM64 support. See [downloads](DOWNLOADS.md) for every
published architecture. Windows/Linux builds are unsigned and macOS builds are
ad-hoc signed without notarization, as documented by the current release notes.

## Evidence needed before expanding support

For each app/package record source commit, app version, OS name/version/build,
architecture, runner/machine, test date, installation, launch, representative core
workflows, offline/online operation, update and uninstall results. Include required
runtime/system dependencies and errors. A build success alone is insufficient.

Keep a shared GitHub Project with an App field and per-app views rather than
duplicating boards. Suggested fields: OS, OS Version/Build, Architecture, App
Version, Support Status, Evidence URL and Last Tested. Project creation/field
population and the Launcher runtime tables remain outstanding; this document does
not claim those interfaces have changed.
