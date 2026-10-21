export const ARTICLES = [
  {
    id: "Libraries-KB1",
    title: "Create and organise documents",
    text: "Home offers ten document types. Choose a type, name your document and start editing. Use folders, favourites and comma-separated coloured tags to organise work. Recent lists recently opened documents. New editors load only when needed. The app works offline; no account is required.",
  },
  {
    id: "Libraries-KB2",
    title: "Saving, backups and migration",
    text: "Ctrl+S saves immediately. Autosave writes changed documents at your chosen interval. A transactional SQLite database and immutable assets store the workspace. A recovery database is refreshed after changes. Export workspace creates a portable .tmalibrary archive including Trash. Keep dated copies privately. Import accepts old schema-1 Libraries copies. Settings can migrate the legacy Windows workspace after the old app is closed. Originals remain untouched. Workspace files and exports are not encrypted.",
  },
  {
    id: "Libraries-KB3",
    title: "Errors and recovery",
    text: "E100: workspace could not open or an asset failed integrity checks. Retain the workspace and backup, check disk access and free space, and use a verified private backup. E101: invalid document/settings or size limit. Correct the input. E102: invalid or unsupported import/conversion. Keep the original and check format limits. E103: storage or processing failure. Keep the window open and retry saving or export. E104: document/revision no longer exists. Refresh the list. E105: restore a trashed document before editing. E106: revision conflict. Reopen the document; do not overwrite newer work. Review a sanitized report before opening GitHub; never attach private workspaces.",
  },
  {
    id: "Libraries-KB4",
    title: "Settings, accessibility and performance",
    text: "Appearance offers Brown, Light, Grey and Black. Larger text and high contrast are optional and off by default. Baseline keyboard controls remain available. Short autosave intervals increase disk/CPU activity. Editor modules load on demand. PDF pages render individually; spreadsheet formula work runs in a worker. Very large files can still require significant memory. Macros and document scripts do not run. GitHub links require connectivity; document creation, editing, saving, imports/exports and this guide work offline.",
  },
  {
    id: "Libraries-KB5",
    title: "Trash and permanent deletion",
    text: "Delete moves a managed document to Trash by default. Restore returns it to its folder, or All Documents if the folder is gone. Trash has no automatic expiry. Settings can switch to permanent deletion with confirmation. Delete Permanently and Empty Trash remove managed documents and their managed revisions. Imported source files and separately exported backups are never deleted. This is not forensic disk erasure. Delete a folder only removes the folder organisation; its documents remain.",
  },
  {
    id: "Libraries-KB6",
    title: "Document formats and compatibility",
    text: "DOCX: rich documents, ADs, newsletters, CVs and cover letters use the same editor with distinct templates. Preserve originals and review advanced imported elements after export. Books use a Libraries notebook format, not Microsoft .one/.onepkg. XLSX: local cells, formulas, basic styles, merges and sheet names; macros, pivots, external connections and advanced charts are unsupported. CSV/TSV exports the first worksheet and loses formatting. PPTX imports basic text, pictures and rectangles; unsupported objects are reported. Export supports text, pictures, shapes, tables, charts and local media. Imported animation is not preserved. PDF: page tools, text annotations, form text, drawn signatures and real redaction. Scanning/OCR and certificate signing remain pending.",
  },
  {
    id: "Libraries-KB7",
    title: "PDF redaction and signatures",
    text: "Choose Mark redaction, drag a region on the page, then Apply redactions. Review the confirmation before removing content. The engine rewrites the PDF and removes images touched by the selected region in full. Older managed revisions, original source files and exported copies can retain unredacted information. Drawn signatures are ink annotations; they do not certify identity or provide cryptographic validation.",
  },
];
export const RELEASES = [
  {
    version: "0.2.0-dev.1",
    text: "Finance-inspired brown Electron desktop rebuild. Ten document types, local editor modules, transactional storage, schema-1 migration, Trash with Restore and configurable permanent deletion. Development build: format and platform limits are recorded in the verification report.",
  },
  {
    version: "0.1.0",
    text: "Initial Windows Forms notes and checklists, folders, favourites, tags, atomic JSON saves and workspace copies.",
  },
];
export function Help({ query = "" }: { query?: string }) {
  const matches = ARTICLES.filter((a) =>
    (a.id + " " + a.title + " " + a.text)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="help-library">
      <h2>Knowledge base</h2>
      <p>Offline guidance · Libraries-KB1–Libraries-KB7</p>
      <nav className="kb-index">
        {matches.map((a) => (
          <a href={"#" + a.id} key={a.id}>
            {a.id} · {a.title}
          </a>
        ))}
      </nav>
      {matches.map((a) => (
        <article id={a.id} key={a.id}>
          <span className="eyebrow">{a.id}</span>
          <h3>{a.title}</h3>
          <p>{a.text}</p>
          <a href="#kb-top">Back to index</a>
        </article>
      ))}
    </div>
  );
}
