# TMA-Finance launcher handoff

The exact application name is **TMA-Finance**. Source branch: `TMA-Finance` in `DaddyTylerXO/TMApps`. The approved identity is a white bundle of bills on green `#163A2B`, supplied in `dist/assets/icon.svg`, `.png` and `.ico`.

The Windows build produces a portable EXE and a ZIP of the unpacked desktop application. The launcher expects the **ZIP**, which contains `TMA-Finance.exe` and the supporting Electron files. Do not rename the portable EXE to a ZIP or remove supporting files from the unpacked package.

Run `node scripts/package-manifest.mjs` after packaging to generate SHA-256 sidecars and `release/launcher-handoff.json`. The repository's Finance build workflow uploads these as a **development artifact**, not a public supported app release.

Before adding this application to the shared launcher catalog:

1. Complete the acceptance gaps in `RELEASE-STATUS.md`, including native packaged launch and lifecycle checks.
2. Publish the tested ZIP and its checksum at a stable GitHub Release URL. Verify the downloaded bytes against SHA-256.
3. Update the launcher's validation/UI/catalog together using its current contract. Set app name, version, source update date, release notes, approved icon, package URL, checksum and executable path from verified artifacts.
4. Retain every other catalog entry. Keep Agent Office last and SocialsManager immediately before it. Advertise only verified published operating-system packages.

No launcher catalog or shared release has been changed by this initial source upload. No other app assets should be replaced.
