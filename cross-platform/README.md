# TMA-Mail cross-platform migration

This is the first migration increment, not a replacement for the supported Windows application. The Avalonia window uses synthetic sample mail only. It neither opens the existing Windows profile nor connects to real accounts. Production macOS/Linux compatibility remains outstanding until the gates in [PORTABILITY.md](../PORTABILITY.md) pass.

## What is implemented

- A .NET 10 shared core links the same account/message models, MailKit transport, MIME conversion, folder discovery and sync implementation used by Windows. Core assemblies have no WPF or WinForms dependency.
- The provider login implementation is shared; Google deployment credentials remain excluded. The preview does not expose account sign-in yet. Browser login and OS credential storage still need target-system integration tests.
- AES-256-GCM profile-file storage authenticates both ciphertext and profile identity, generates a new nonce for each save, replaces files atomically and refuses plaintext fallback. Native vault integration is a required next gate: the preview deliberately does not persist sample accounts or use an on-disk encryption key.
- The green/dark Avalonia mailbox window has working sample search, folder selection, read/unread, starring, delete/restore and resizable panes.
- Synthetic protocol tests are reused on modern .NET. Portable checks cover MIME, validation, encryption/tampering/wrong keys/cancellation, profile isolation, serialized writes and headless UI at three widths.
- GitHub Actions is configured to build, test and package on native Windows, macOS and Linux runners. CI archives are development previews, not production releases. A passing headless job does not establish live-account or physical-device compatibility.

## Build and run

Install a supported .NET 10 SDK (the SDK selection is in `global.json`) and PowerShell 7. From the repository root:

```powershell
./cross-platform.ps1 -Mode Check
./cross-platform.ps1 -Mode Run
./cross-platform.ps1 -Mode Publish
```

`Check` restores the committed dependency lockfiles, builds and runs synthetic checks. `Run` opens the sample-only desktop preview. `Publish` checks first, creates a self-contained package for the host runtime and scans the complete publish directory before archiving. All generated output goes under `build/` or ignored `bin/obj` directories. On Linux a graphical session and the [Avalonia desktop dependencies](https://docs.avaloniaui.net/docs/supported-platforms) are required to open the actual window; headless CI uses an in-memory backend.

The Windows development workspace can use `build/tools/dotnet/dotnet.exe`; the helper prefers that local SDK without replacing the installed system runtime. Native OS vaults, safe HTML rendering, rich composing, actual mailbox UI wiring, calendar migration and platform integrations are not complete.

## Security and distribution

Never copy the ignored local `provider-settings.json`, DPAPI profile files, live-test outputs or account credentials into this project. Only `provider-settings.public.json` is copied by the desktop project. Keep the existing Windows public update manifest unchanged until a separately tested release is ready. macOS signing/notarization and supported Linux distribution declarations require additional validation.

Framework references: [.NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy), [Avalonia supported platforms](https://docs.avaloniaui.net/docs/supported-platforms), [Avalonia headless testing](https://docs.avaloniaui.net/docs/testing/setting-up-the-headless-platform). Avalonia package licences must remain with distributed previews; dependency versions are pinned and NuGet security advisories of moderate severity or higher fail restore.
