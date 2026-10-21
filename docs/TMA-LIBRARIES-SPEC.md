# TMA-Libraries product specification

Source: Tyler's requirements, 21 October 2026. Completion evidence for the initial desktop build is in [VERIFICATION-0.1.0.md](VERIFICATION-0.1.0.md). The shared [TMApps standards](TMAPPS-STANDARDS.md) also apply. Partial requirements remain unchecked.

## Identity and purpose

- Brand: Leather Brown `#97572B`.
- Icon: white folder on a brown background.
- Purpose: a highly customisable workspace for notes, OneNote-style books, checklists, newsletters, advertisements, CVs, cover letters, general documents, PDFs, art/inspiration boards with stickers, spreadsheets, presentations, portfolios, and databases.

## Workspace and projects

- [x] Organise documents into folders inside the app. (0.1.0 native notes/checklists; MainWindow, storage and desktop checks.)
- [x] Favourite documents for quick access on the Home screen. (0.1.0 workspace Favourites view; desktop filter/persistence checks.)
- [x] Show recently opened documents alongside New Document and Open from Location. (0.1.0 recent view, native-copy import only; desktop/storage checks.)
- [x] Apply custom tags, displayed as colour-coded labels in document lists. (0.1.0 comma-separated tags; screenshot and persistence checks.)
- [ ] Create projects describing required documents, a timeline, deadline dates, and a progress bar on a project dashboard tab.
- [ ] Provide dashboards suitable for managing large projects.
- [ ] Provide art boards and inspiration collections with stickers and extensive customisation.
- [ ] Support portfolio creation.
- [ ] Support database creation.

## New Document and document-specific editors

- [ ] New Document offers General Document, Book, Check List, AD, Newsletter, CV, Cover Letter, PDF, Slide Show, and Spreadsheet.
- [ ] Give each document type its own relevant features and customisation controls, rather than one generic editor for all formats.
- [ ] General documents: DOCX support, rich text, broad content insertion, headers, footers, and file attachments.
- [ ] Books: many pages grouped into tabs/sections, support for large information collections, and broad content insertion.
- [x] Checklists: quick input, completion toggles, and an optional progress bar counting remaining checkpoints. (0.1.0; desktop completion/progress assertions and storage checks.)
- [ ] Advertisements: a reusable generic advertising template users can fill in.
- [ ] Newsletters: creation and editing within the document/template system.
- [ ] CVs and cover letters: fill-in templates with guidance/validation so critical information is not omitted.
- [ ] PDFs: creation, conversion, redaction, signatures, and additional PDF tools.
- [ ] Explore PDF eSignatures later if too complex for initial implementation; distinguish drawn signatures from certificate-backed signatures.
- [ ] Print to Digital: acquire paper documents from scanners and create PDFs.
- [ ] Spreadsheets: complex data, data-source equations/formulas, and macro-document support. Macro execution requires a separately designed trust model.
- [ ] Slideshows: insert tables, pictures, stock media, 3D models, shapes, charts, audio, local/online video, and hyperlinks.
- [ ] Slideshows: theme templates, colour variants, background formatting, slide sizes, page/content transitions and animations, and presentation mode.
- [ ] Provide extensive creative toolbars, including font family, size, colour, outlining, and text editing controls.
- [x] Allow a side notes/comments tab while editing a document. (0.1.0 notes/checklists; binding and persistence assertions.)
- [ ] Provide a built-in emoji menu.

## Templates, branding, and data

- [ ] Dynamic templates with preformatted layouts, styles, and reusable blocks for consistent branding.
- [ ] Create, save, reuse, export, and import custom document templates.
- [ ] Settings > Branding stores logos and other information for easy insertion into documents.
- [ ] Import data sources into applicable document types.
- [ ] Export and share documents, including opening a new TMA-Mail email with the exported document attached.

## Protection, history, and recovery

- [ ] Configurable autosaving and backups.
- [ ] Password-protected document encryption.
- [ ] Sensitivity labelling.
- [ ] Document editing history and version history.
- [ ] Document details include date created, author, template used, and versions.

## Settings

- [ ] Configurable keybinds, including document-type-specific bindings.
- [ ] Configurable spellchecking and grammar checking, including disabling either service.
- [ ] A settings section for every supported document type.
- [ ] All shared settings/support/accessibility/appearance/performance controls required by the TMApps standards.

## TMApps integrations

- [ ] Integrate built-in notes and synchronise notes with TMA-Mail.
- [ ] Integrate built-in notes and synchronise notes with TMA-Finance.
- [ ] Integrate built-in notes and synchronise notes with TMA-Cut.
- [ ] Integrate built-in notes and synchronise notes with TMA-SocialsManager.

Integration work must establish actual sibling-app contracts, ownership, conflict resolution, and offline behaviour before claiming sync support.
