# TMA-Libraries

Offline Electron desktop application using React and TypeScript, with Leather Brown `#97572B`, cream controls and white document pages. Local editing requires no server, account, CDN or paid service.

## Development preview 0.2.0-dev.1

Ten document choices: General Document, Book, Check List, AD, Newsletter, CV, Cover Letter, PDF, Slide Show and Spreadsheet. SuperDoc supplies rich editing, Univer community components supply spreadsheets, MuPDF supplies PDF tools, and slides use a local scene model. This preview does not claim complete Office fidelity or completion of the full specification.

The shell includes folders, favourites, recent work, tags, search, tabs, side notes, autosave, revisions, reusable templates, settings search, setup accessibility choices and a replayable tour. Trash and Restore are the default deletion behavior; permanent deletion asks for confirmation. Imported source files remain untouched.

## Build and run

Use current Node.js and pnpm on Windows:

```powershell
pnpm install --frozen-lockfile
./build.ps1 -Test
pnpm start
```

`./build.ps1 -Package` prepares an unsigned Windows x64 ZIP. For an unpacked build, use `pnpm exec electron-builder --win --x64 --dir --publish never`, then run `release/win-unpacked/TMA-Libraries.exe` with its entire directory present. The older `build/TMA-Libraries.exe` is the legacy Windows Forms app; its build procedure remains in `scripts/build-legacy.ps1`.

Installation of build dependencies requires internet access. Packaged editing is local; external support links require connectivity. macOS/Linux publication awaits matching-runner verification. No Launcher release or public package URL is claimed.

## Storage and preservation

SQLite and managed assets reside in Electron's user-data directory, normally `%APPDATA%/TMA-Libraries/library-v2`. Legacy `%LOCALAPPDATA%/TMApps/TMA-Libraries/workspace.json` remains untouched. Migration accepts schema-1 exports, preserves metadata and prevents repeated migration from duplicating records. Close the legacy app before migrating.

Transactional saves retain revisions and a database recovery copy. Versioned `.tmalibrary` exports include payloads and assets; retain independent dated copies. Storage and exports are **unencrypted**. Historical revisions and copies may retain content removed from newer documents, including pre-redaction content. Redaction creates rewritten PDF output; it does not erase independent copies.

The preferred SQLite binding is better-sqlite3. Where its compatible native binary is unavailable, the packaged Electron runtime's built-in SQLite adapter is used. This environment lacks the C++ toolchain needed to rebuild better-sqlite3 for Electron 44; the fallback is covered by storage and desktop checks.

## Compatibility and remaining work

Rich documents share editable templates. Local XLSX supports values, formulas, basic formatting, merges and worksheets; complex charts, macros and advanced content are limited. PPTX import is bounded and reports unsupported objects. Books use Libraries sections/pages, not Microsoft `.one`/`.onepkg` files. Originals are not silently overwritten.

PDF tools include viewing/search, page operations, merge/extract, annotations, text form values, drawn signatures and applied redaction. Drawn signatures are not certificate signatures. OCR/scanning, certificate signing and advanced object editing remain pending.

Full TMApps compliance remains open, including TMA-Mail tray/connection parity, complete notifications, accessibility/high-DPI verification, advanced editor features, encryption, integrations, master KB linkage, visually verified Word KB publication, Launcher registration and platform releases. Measured idle memory after exercising all editors exceeds the 500 MiB target. See [verification](docs/VERIFICATION-0.2.0.md).

## Requirements and documentation

- [Version notes](docs/RELEASE-NOTES.md)
- [TMApps requirements](docs/TMAPPS-STANDARDS.md)
- [Libraries specification](docs/TMA-LIBRARIES-SPEC.md)
- [Shared application standards](APP-STANDARDS.md)
- [Development guidance](AGENTS.md)

Original requirements remain visible; pending items remain unchecked. The Word KB draft stays local until its master reference and rendered pages can be verified. Markdown does not replace that deliverable.

Libraries rebuild source is AGPL-3.0-only; see LICENSE and THIRD-PARTY-NOTICES.md. Sibling application licences are unchanged.

## Existing legacy Launcher distribution

The branch's existing distribution record identifies Launcher 1.14.2 or later and the unsigned Windows Forms 0.1.0 ZIP at https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMA-Libraries-0.1.0-windows.zip. That record reports isolated install/launch/uninstall and checksum verification, with Launcher-KB14 in the launcher KB. This rebuild does not replace that catalog entry or imply the 0.2 preview has passed Launcher verification.
