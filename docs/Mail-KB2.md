# Mail-KB2 Building and troubleshooting the preview

Updated 23 October 2026. Developer guide for source preview 0.17.0-preview.1.

Install a supported .NET 10 SDK and PowerShell 7. Use a matching checkout of the TMA-Mail branch. From the repository root, run `./cross-platform.ps1 -Mode Check` to build and test, `./cross-platform.ps1 -Mode Run` to open the sample interface, or `./cross-platform.ps1 -Mode Publish` to test and package the host runtime. The normal desktop preview needs a graphical session. Linux native smoke tests use Xvfb; the headless UI checks run without a display.

The checks use synthetic mail and temporary encrypted fixtures. Do not point them at a real account directory. Supported OS/version claims require the corresponding native job and packaged tests; a successful compilation alone is insufficient.

## No SDKs were found

Only a .NET runtime is installed. Install the .NET 10 SDK, then retry with the matching source revision. The helper can use a workspace-local SDK in `build/tools/dotnet`. Do not replace the working Windows application's files to fix a developer SDK error.

## NU1004 inconsistent dependency lock file

The source, runtime settings and committed lockfiles do not match. Use the complete matching checkout and declared SDK. Do not disable locked restore or hand-edit dependency hashes. Maintainers must regenerate and review lockfiles when changing runtime targets or package versions.

## NU1902 or NU1903 dependency advisory

Restore detected a known vulnerable dependency. The migration build blocks moderate-or-higher advisories. Keep the previous working release and report the package name and advisory identifier; do not bypass the security gate.

## Native preview startup failed

Read the native job's sanitized error and confirm its OS libraries and graphical backend are available. A cross-compiled package is not proof of native startup. Preserve the failed job as evidence; keep the platform marked unverified until it passes.

If an error persists, report the app/source version, OS, architecture and sanitized message through the repository's issue channel. Security vulnerabilities go to [private security reporting](https://github.com/DaddyTylerXO/TMApps/security/advisories/new). Never attach account profiles, live mail, tokens or secret configuration.

[Back to index](kb-registry.json)
