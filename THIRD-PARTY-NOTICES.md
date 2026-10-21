# TMA-Libraries third-party software

TMA-Libraries 0.2.0 development source is provided under AGPL-3.0-only; see LICENSE. This applies to Libraries, not the other TMApps branches. Distributable packages must include this notice, the licence and the corresponding Libraries source revision/link.

The lockfile records exact versions. Runtime and bundled renderer components include:

| Component | Licence | Use |
| --- | --- | --- |
| Electron | MIT, with Chromium/Node third-party notices | Offline desktop runtime |
| React / React DOM | MIT | Workspace UI |
| SuperDoc community | AGPL-3.0 | DOCX document engine; telemetry explicitly disabled |
| Univer community presets | Apache-2.0 | Local spreadsheet UI and formula engine; no Pro/server features |
| MuPDF | AGPL-3.0 | PDF rendering and rewriting, including real redaction |
| better-sqlite3 | MIT | SQLite binding where a matching native binary is available |
| Node built-in SQLite / SQLite | Node notices / public domain SQLite | Development fallback when the optional native binding is unavailable |
| ExcelJS | MIT | Local XLSX interchange |
| SheetJS Community Edition | Apache-2.0 | CSV/TSV import |
| docx | MIT | Initial editable document templates |
| PptxGenJS | MIT | PPTX export |
| JSZip | MIT or GPL-3.0 | Native workspace and OOXML archives, used under MIT |
| fast-xml-parser | MIT | Bounded PPTX XML parsing |
| Lucide | ISC | Interface icons |
| DM Sans / Manrope through Fontsource | SIL Open Font License | Bundled offline typography |

Dependency notices remain in the installed packages. Before release, review the complete dependency licence inventory and include applicable notices in the package. No commercial licence key, paid SDK, hosted editor, analytics service or cloud conversion service is required. This list is not a claim that dependency vulnerabilities or every transitive licence have been independently audited.

Corresponding rebuild source: https://github.com/DaddyTylerXO/TMApps/tree/TMA-Libraries (development preview 0.2.0-dev.1). Source publication does not constitute verification of every transitive licence or a public binary release.
