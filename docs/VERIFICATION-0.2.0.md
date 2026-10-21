# Verification: 0.2.0-dev.1

Local Windows x64 development verification, 22 October 2026. Synthetic fixtures only; private reference images and user documents are excluded from source control.

## Executed checks

- `pnpm build`: strict TypeScript and production Vite build pass.
- `pnpm test`: 24 passing groups cover transactional saves/restarts, schema-1 migration/idempotency, invalid-import rollback, Trash/Restore, missing folders, shared assets, revisions, archives, templates, corrupt-primary recovery and a 1,000-document workload.
- Actual DOCX/XLSX/PPTX/PDF files are generated. ExcelJS independently reopens XLSX; DOCX/PPTX package contents are inspected; CSV/TSV Unicode is checked. These are representative adapter checks, not complete Office compatibility.
- MuPDF redaction removes synthetic text/images; `scripts/verify-redaction.py` independently checks pypdf extraction and image resources. Historical copies remain unaffected.
- Electron checks cover startup, ten cards, folders, checklist editing, notes, Trash/Restore, editor loading, actual DOCX typing and saved OOXML content, presentation, PDF rendering and settings. Permanent-delete confirmation branches use isolated test responses; native dialog accessibility remains unverified.
- `pnpm audit --prod`: zero reported production advisories after compatible transitive image-size/uuid overrides. Full dependency/licence and development-tool audits remain open.
- `scripts/security-check.ps1`: bounded credential-pattern scan. Sandboxing, context isolation, disabled renderer Node integration, local CSP, sender/method validation and main-process filesystem ownership were inspected. This is not a penetration test.

## Performance

Observed empty-window startup: 652 ms and 1,242 ms in isolated runs. A 1,000-note storage workload completed in approximately 188 ms. These local figures are not platform guarantees.

After exercising all editor families, process working-set memory totalled approximately 645 MiB, exceeding the 500 MiB target. One earlier idle CPU sample total was below 1%; the final all-editor sample total was approximately 1.12%, so the CPU target also needs investigation. Editors load lazily, but retained engine/module memory needs investigation. Lists currently cap rendered results at 200 instead of using complete virtualization. A verified Finance/legacy comparison is pending.

## Remaining release gates

- The Electron better-sqlite3 rebuild needs an unavailable C++ toolchain; bundled Node SQLite is used and tested. Every-target native packaging remains pending.
- Complete interactive create/edit/reopen/export coverage and independent Office-application round trips remain pending. Adapter tests do not prove every toolbar action.
- Real disk-full, locked-file, power-loss and interruption at every migration step are not comprehensively tested. Recovery copies require managed assets; asset cleanup is not a cross-filesystem transaction.
- Advanced DOCX layout/custom ribbon, spreadsheet comments/charts and imported objects remain limited. Spreadsheet charts are a local preview, not full XLSX chart support. PPTX import reports unsupported classes. Books export individual pages/native notebooks; combined-section export is pending.
- OCR/scanning, certificate signatures, advanced PDF editing and encrypted storage remain pending. Redaction does not erase historical copies.
- Screen readers, all theme/dialog combinations, high-DPI/resizing and full keyboard editor operation need broader validation.
- TMA-Mail tray/connection parity, notification settings, integrations, complete branding and remaining standards are open. Local editing status is not an internet reachability test.
- Word KB rendering requires the absent LibreOffice renderer; the master KB destination is unconfirmed. The unverified Word draft must not be uploaded.
- Windows packaging is unsigned development output. Matching-runner macOS/Linux checks, verified public artifact URLs/checksums and Launcher registration remain pending.

Original specifications remain authoritative; partial implementation does not complete a requirement.

## Final packaged Windows workflow

The rebuilt unpacked Windows x64 executable passed the complete isolated Electron workflow, including actual DOCX typing and inspection of the saved OOXML text. The test waits for asynchronous save commitment rather than reading immediately after clicking Save. The application window was visible for canvas keyboard focus and fresh screenshots. No renderer exceptions were recorded.

Packaged startup measured 1,341 ms. After all editor families, working-set total was approximately 905 MiB and sampled CPU total approximately 0.71%. Memory remains over target; an earlier CPU sample was over target, so neither result should be generalized. Fresh Home and DOCX screenshots were visually inspected. Screenshots are synthetic local QA artifacts, not private user documents.

A first package was correctly rejected because renderer assets were missing while build and packaging overlapped. The replacement was packaged after build completion, checked for the renderer index and exercised as an actual executable. Use build.ps1 or package:win, which build sequentially before packaging.
