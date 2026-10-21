import Database from "./sqlite.mjs";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

export const KINDS = [
  "document",
  "book",
  "checklist",
  "advertisement",
  "newsletter",
  "cv",
  "cover-letter",
  "pdf",
  "slides",
  "spreadsheet",
];
export const DEFAULTS = {
  theme: "brown",
  largeText: false,
  highContrast: false,
  autosave: true,
  autosaveSeconds: 5,
  deletionMode: "trash",
  setupComplete: false,
  kbSearch: true,
  author: "",
  brandName: "",
  brandColour: "#97572B",
  shortcuts: { new: "Ctrl+N", save: "Ctrl+S", search: "Ctrl+F" },
  editor: {},
  closeToTray: false,
  notifications: false,
};
const MAX = 128 * 1024 * 1024;
const fail = (code, message) => {
  const e = new Error(message);
  e.code = code;
  throw e;
};
const text = (v, max = 1000) => typeof v === "string" && v.length <= max;
const idValid = (v) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(v);
const hash = (b) => createHash("sha256").update(b).digest("hex");
const clone = (v) => JSON.parse(JSON.stringify(v));
export function initialPayload(kind) {
  if (kind === "checklist") return { items: [], showProgress: true };
  if (kind === "book")
    return {
      sections: [
        {
          id: randomUUID(),
          title: "First section",
          colour: "#97572B",
          pages: [{ id: randomUUID(), title: "Untitled page", text: "" }],
        },
      ],
    };
  if (kind === "spreadsheet") return { workbook: null };
  if (kind === "slides")
    return {
      width: 1280,
      height: 720,
      slides: [
        {
          id: randomUUID(),
          background: "#ffffff",
          notes: "",
          transition: "none",
          elements: [],
        },
      ],
    };
  return {};
}
export function validatePayload(kind, payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Buffer.byteLength(JSON.stringify(payload)) > MAX
  )
    fail("E101", "This document is invalid or exceeds 128 MiB.");
  if (
    kind === "checklist" &&
    (!Array.isArray(payload.items) ||
      payload.items.length > 10000 ||
      payload.items.some(
        (i) => !text(i.text, 10000) || typeof i.done !== "boolean",
      ))
  )
    fail("E101", "Invalid checklist items.");
  if (
    kind === "book" &&
    (!Array.isArray(payload.sections) ||
      payload.sections.length > 1000 ||
      payload.sections.some(
        (s) =>
          !idValid(s.id) ||
          !text(s.title, 200) ||
          !/^#[\da-f]{6}$/i.test(s.colour) ||
          !Array.isArray(s.pages) ||
          s.pages.some((p) => !idValid(p.id) || !text(p.title, 200)),
      ))
  )
    fail("E101", "Invalid notebook sections or pages.");
  if (
    kind === "slides" &&
    (!Number.isFinite(payload.width) ||
      payload.width < 200 ||
      payload.width > 10000 ||
      !Number.isFinite(payload.height) ||
      payload.height < 200 ||
      payload.height > 10000 ||
      !Array.isArray(payload.slides) ||
      payload.slides.length > 1000 ||
      payload.slides.some(
        (s) =>
          !idValid(s.id) ||
          !/^#[\da-f]{6}$/i.test(s.background) ||
          !Array.isArray(s.elements),
      ))
  )
    fail("E101", "Invalid slide layout.");
}
function validateSettings(input) {
  const s = { ...DEFAULTS, ...input };
  if (
    !["brown", "light", "grey", "black"].includes(s.theme) ||
    !["trash", "permanent"].includes(s.deletionMode) ||
    !Number.isInteger(s.autosaveSeconds) ||
    s.autosaveSeconds < 2 ||
    s.autosaveSeconds > 300
  )
    fail("E101", "Invalid settings.");
  for (const key of [
    "largeText",
    "highContrast",
    "autosave",
    "setupComplete",
    "kbSearch",
    "closeToTray",
    "notifications",
  ])
    if (typeof s[key] !== "boolean") fail("E101", "Invalid settings.");
  if (
    !text(s.author, 200) ||
    !text(s.brandName, 200) ||
    !/^#[\da-f]{6}$/i.test(s.brandColour) ||
    !s.shortcuts ||
    typeof s.shortcuts !== "object"
  )
    fail("E101", "Invalid branding or shortcuts.");
  return s;
}
function date(v, fallback) {
  const match = typeof v === "string" && /\/Date\((-?\d+)/.exec(v);
  const n = match ? Number(match[1]) : Date.parse(v);
  return Number.isFinite(n) ? new Date(n).toISOString() : fallback;
}
export function parseLegacy(bytes) {
  if (bytes.length > 16 * 1024 * 1024)
    fail("E102", "Legacy workspace exceeds 16 MiB.");
  const w = JSON.parse(bytes.toString("utf8"));
  if (
    w.Schema !== 1 ||
    !Array.isArray(w.Documents) ||
    !Array.isArray(w.Folders) ||
    !w.Settings ||
    w.Documents.length > 10000 ||
    w.Folders.length > 1000 ||
    w.Folders.some((f) => !text(f, 120) || !f.trim()) ||
    new Set(w.Folders.map((f) => f.toLowerCase())).size !== w.Folders.length
  )
    fail("E102", "Unsupported legacy workspace.");
  const seen = new Set();
  const now = new Date().toISOString();
  const documents = w.Documents.map((d) => {
    if (
      !d ||
      !/^[a-f\d]{32}$/i.test(d.Id) ||
      seen.has(d.Id) ||
      !["Note", "Checklist"].includes(d.Kind) ||
      !text(d.Title, 200) ||
      !text(d.Body, 2000000) ||
      !text(d.SideNotes, 200000) ||
      !text(d.Tags) ||
      !text(d.Folder, 120) ||
      (d.Folder && !w.Folders.includes(d.Folder)) ||
      !Array.isArray(d.Items)
    )
      fail("E102", "Invalid legacy document. Originals have not been changed.");
    seen.add(d.Id);
    const kind = d.Kind === "Note" ? "document" : "checklist";
    const payload =
      kind === "document"
        ? { legacyText: d.Body }
        : {
            items: d.Items.map((i) => ({
              id: randomUUID(),
              text: i.Text,
              done: i.Done,
            })),
            showProgress: d.ShowProgress,
          };
    validatePayload(kind, payload);
    return {
      id: d.Id,
      kind,
      title: d.Title,
      folder: d.Folder,
      tags: d.Tags.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      favourite: !!d.Favourite,
      sideNotes: d.SideNotes,
      created: date(d.Created, now),
      modified: date(d.Modified, now),
      opened: date(d.Opened, ""),
      payload,
    };
  });
  const settings = {
    ...DEFAULTS,
    theme:
      { Light: "light", Grey: "grey", Black: "black" }[w.Settings.Theme] ||
      "brown",
    largeText: !!w.Settings.LargeText,
    highContrast: !!w.Settings.HighContrast,
    autosave: !!w.Settings.Autosave,
    autosaveSeconds: w.Settings.AutosaveSeconds || 5,
    setupComplete: !!w.Settings.SetupComplete,
    kbSearch: w.Settings.SearchKB !== false,
  };
  validateSettings(settings);
  return { schema: 2, documents, folders: w.Folders, settings };
}

export class LibraryStore {
  constructor(directory) {
    this.directory = path.resolve(directory);
    this.file = path.join(this.directory, "library.sqlite");
    this.assetDirectory = path.join(this.directory, "assets");
    this.recovered = false;
    fs.mkdirSync(this.assetDirectory, { recursive: true });
    try {
      this.open();
    } catch (e) {
      if (
        !["SQLITE_CORRUPT", "SQLITE_NOTADB"].includes(e.code) &&
        ![11, 26].includes(e.errcode)
      )
        throw e;
      this.db?.close();
      const backup = new Database(this.file + ".bak", {
        readonly: true,
        fileMustExist: true,
      });
      try {
        if (backup.pragma("integrity_check", { simple: true }) !== "ok")
          fail("E100", "Recovery backup is damaged.");
      } finally {
        backup.close();
      }
      const suffix = ".damaged-" + Date.now();
      for (const ending of ["", "-wal", "-shm"])
        if (fs.existsSync(this.file + ending))
          fs.renameSync(this.file + ending, this.file + ending + suffix);
      fs.copyFileSync(this.file + ".bak", this.file);
      this.open();
      this.recovered = true;
    }
  }
  open() {
    this.db = new Database(this.file);
    if (this.db.pragma("quick_check", { simple: true }) !== "ok")
      fail("SQLITE_CORRUPT", "Workspace integrity check failed.");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 3000");
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS folders(name TEXT PRIMARY KEY COLLATE NOCASE);
      CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,folder TEXT NOT NULL DEFAULT '',tags TEXT NOT NULL DEFAULT '[]',favourite INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,modified TEXT NOT NULL,opened TEXT NOT NULL DEFAULT '',sideNotes TEXT NOT NULL DEFAULT '',template TEXT NOT NULL DEFAULT '',deleted TEXT,revision INTEGER NOT NULL DEFAULT 1,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions(documentId TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,revision INTEGER NOT NULL,payload TEXT NOT NULL,modified TEXT NOT NULL,PRIMARY KEY(documentId,revision));
      CREATE TABLE IF NOT EXISTS migrations(fingerprint TEXT PRIMARY KEY,completed TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS templates(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,created TEXT NOT NULL);`);
    const schema = this.db
      .prepare("SELECT value FROM meta WHERE key=?")
      .get("schema");
    if (schema && schema.value !== "2")
      fail("E100", "This workspace requires a different application version.");
    this.db
      .prepare("INSERT OR IGNORE INTO meta VALUES(?,?)")
      .run("schema", "2");
  }
  settings() {
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key=?")
      .get("settings");
    return validateSettings(row ? JSON.parse(row.value) : {});
  }
  setSettings(settings) {
    const result = validateSettings({ ...this.settings(), ...settings });
    this.db
      .prepare("INSERT OR REPLACE INTO meta VALUES(?,?)")
      .run("settings", JSON.stringify(result));
    return result;
  }
  list() {
    return this.db
      .prepare(
        "SELECT id,kind,title,folder,tags,favourite,created,modified,opened,template,deleted,revision FROM documents ORDER BY modified DESC",
      )
      .all()
      .map((d) => ({
        ...d,
        tags: JSON.parse(d.tags),
        favourite: !!d.favourite,
      }));
  }
  state() {
    return {
      documents: this.list(),
      folders: this.db
        .prepare("SELECT name FROM folders ORDER BY name")
        .all()
        .map((f) => f.name),
      templates: this.db
        .prepare("SELECT id,name,kind FROM templates ORDER BY name")
        .all(),
      settings: this.settings(),
      recovered: this.recovered,
    };
  }
  saveTemplate({ id, name }) {
    const d = this.get(id, false);
    if (!text(name, 200) || !name.trim())
      fail("E101", "Enter a template name.");
    const templateId = randomUUID();
    this.db
      .prepare("INSERT INTO templates VALUES(?,?,?,?,?)")
      .run(
        templateId,
        name.trim(),
        d.kind,
        JSON.stringify(d.payload),
        new Date().toISOString(),
      );
    return templateId;
  }
  createFromTemplate({ id }) {
    const t = this.db.prepare("SELECT * FROM templates WHERE id=?").get(id);
    if (!t) fail("E104", "Template no longer exists.");
    return this.create({
      kind: t.kind,
      title: ("Untitled " + t.name).slice(0, 200),
      payload: this.hydrate(JSON.parse(t.payload)),
      template: t.name,
    });
  }
  get(id, hydrate = true) {
    const d = this.db.prepare("SELECT * FROM documents WHERE id=?").get(id);
    if (!d) fail("E104", "Document no longer exists.");
    return {
      ...d,
      tags: JSON.parse(d.tags),
      favourite: !!d.favourite,
      payload: hydrate
        ? this.hydrate(JSON.parse(d.payload))
        : JSON.parse(d.payload),
    };
  }
  hydrate(value) {
    if (Array.isArray(value)) return value.map((v) => this.hydrate(v));
    if (value && typeof value === "object") {
      const result = {};
      for (const [k, v] of Object.entries(value)) result[k] = this.hydrate(v);
      if (typeof result.binaryId === "string") {
        result.binary = this.readAsset(result.binaryId).toString("base64");
      }
      return result;
    }
    return value;
  }
  normalize(value) {
    if (Array.isArray(value)) return value.map((v) => this.normalize(v));
    if (value && typeof value === "object") {
      const result = {};
      for (const [k, v] of Object.entries(value))
        if (k !== "binary") result[k] = this.normalize(v);
      if (typeof value.binary === "string") {
        if (
          value.binary.length > MAX * 1.4 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(value.binary)
        )
          fail("E101", "Invalid binary asset.");
        result.binaryId = this.putAsset(Buffer.from(value.binary, "base64"));
      }
      return result;
    }
    return value;
  }
  putAsset(bytes) {
    if (bytes.length > MAX) fail("E101", "Asset exceeds 128 MiB.");
    const name = hash(bytes);
    const target = path.join(this.assetDirectory, name);
    if (!fs.existsSync(target)) {
      const temporary = target + "." + randomUUID() + ".tmp";
      const fd = fs.openSync(temporary, "wx");
      try {
        fs.writeFileSync(fd, bytes);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      try {
        fs.renameSync(temporary, target);
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
    }
    return name;
  }
  readAsset(name) {
    if (!/^[a-f0-9]{64}$/.test(name)) fail("E101", "Invalid asset reference.");
    const bytes = fs.readFileSync(path.join(this.assetDirectory, name));
    if (hash(bytes) !== name)
      fail("E100", "An asset failed its integrity check.");
    return bytes;
  }
  create({ kind, title, folder = "", payload, template = "" }) {
    if (
      !KINDS.includes(kind) ||
      !text(title, 200) ||
      !title.trim() ||
      !text(template, 200)
    )
      fail("E101", "Choose a document type and title.");
    if (
      folder &&
      !this.db.prepare("SELECT 1 FROM folders WHERE name=?").get(folder)
    )
      fail("E101", "Folder no longer exists.");
    payload = payload ?? initialPayload(kind);
    validatePayload(kind, payload);
    const normalized = this.normalize(payload);
    const id = randomUUID(),
      now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO documents(id,kind,title,folder,created,modified,template,payload) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        kind,
        title.trim(),
        folder,
        now,
        now,
        template,
        JSON.stringify(normalized),
      );
    return this.get(id);
  }
  save({ id, revision, payload, ...metadata }) {
    const current = this.get(id, false);
    if (current.deleted) fail("E105", "Restore this document before editing.");
    if (revision !== current.revision)
      fail(
        "E106",
        "This document changed in another view. Reopen it before saving.",
      );
    const d = { ...current, ...metadata };
    if (
      !text(d.title, 200) ||
      !d.title.trim() ||
      !text(d.sideNotes, 200000) ||
      !Array.isArray(d.tags) ||
      d.tags.length > 30 ||
      d.tags.some((t) => !text(t, 80)) ||
      typeof d.favourite !== "boolean" ||
      !text(d.folder, 120) ||
      (d.folder &&
        !this.db.prepare("SELECT 1 FROM folders WHERE name=?").get(d.folder))
    )
      fail("E101", "Invalid document details.");
    validatePayload(current.kind, payload);
    const normalized = JSON.stringify(this.normalize(payload));
    this.db.transaction(() => {
      this.db
        .prepare("INSERT INTO revisions VALUES(?,?,?,?)")
        .run(
          id,
          current.revision,
          JSON.stringify(current.payload),
          current.modified,
        );
      this.db
        .prepare(
          "UPDATE documents SET title=?,folder=?,tags=?,favourite=?,sideNotes=?,modified=?,revision=revision+1,payload=? WHERE id=?",
        )
        .run(
          d.title.trim(),
          d.folder,
          JSON.stringify([...new Set(d.tags)]),
          Number(d.favourite),
          d.sideNotes,
          new Date().toISOString(),
          normalized,
          id,
        );
      this.db
        .prepare("DELETE FROM revisions WHERE documentId=? AND revision < ?")
        .run(id, Math.max(0, current.revision - 19));
    })();
    return this.get(id);
  }
  opened(id) {
    this.get(id, false);
    this.db
      .prepare("UPDATE documents SET opened=? WHERE id=?")
      .run(new Date().toISOString(), id);
  }
  addFolder(name) {
    if (!text(name, 120) || !name.trim()) fail("E101", "Enter a folder name.");
    this.db.prepare("INSERT INTO folders VALUES(?)").run(name.trim());
    return this.state();
  }
  removeFolder(name) {
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM folders WHERE name=?").run(name);
      this.db
        .prepare(
          "UPDATE documents SET folder='' WHERE folder=? AND deleted IS NULL",
        )
        .run(name);
    })();
    return this.state();
  }
  trash(id) {
    this.get(id, false);
    this.db
      .prepare("UPDATE documents SET deleted=? WHERE id=?")
      .run(new Date().toISOString(), id);
  }
  restore(id) {
    const d = this.get(id, false);
    let folder = d.folder;
    if (
      folder &&
      !this.db.prepare("SELECT 1 FROM folders WHERE name=?").get(folder)
    )
      folder = "";
    this.db
      .prepare("UPDATE documents SET deleted=NULL,folder=? WHERE id=?")
      .run(folder, id);
    return this.get(id);
  }
  purge(id) {
    this.get(id, false);
    this.db.prepare("DELETE FROM documents WHERE id=?").run(id);
    this.collectAssets();
  }
  emptyTrash() {
    this.db.prepare("DELETE FROM documents WHERE deleted IS NOT NULL").run();
    this.collectAssets();
  }
  collectAssets() {
    const referenced = new Set();
    const find = (v) => {
      if (v && typeof v === "object") {
        if (typeof v.binaryId === "string") referenced.add(v.binaryId);
        Object.values(v).forEach(find);
      }
    };
    for (const r of this.db
      .prepare(
        "SELECT payload FROM documents UNION ALL SELECT payload FROM revisions UNION ALL SELECT payload FROM templates",
      )
      .all())
      find(JSON.parse(r.payload));
    for (const name of fs.readdirSync(this.assetDirectory))
      if (/^[a-f0-9]{64}$/.test(name) && !referenced.has(name))
        fs.unlinkSync(path.join(this.assetDirectory, name));
  }
  history(id) {
    this.get(id, false);
    return this.db
      .prepare(
        "SELECT revision,modified FROM revisions WHERE documentId=? ORDER BY revision DESC",
      )
      .all(id);
  }
  restoreRevision({ id, revision }) {
    const row = this.db
      .prepare(
        "SELECT payload FROM revisions WHERE documentId=? AND revision=?",
      )
      .get(id, revision);
    if (!row) fail("E104", "Revision no longer exists.");
    const d = this.get(id);
    return this.save({ ...d, payload: this.hydrate(JSON.parse(row.payload)) });
  }
  importManifest(
    manifest,
    { preserveIds = false, includeSettings = false } = {},
  ) {
    if (
      !manifest ||
      manifest.schema !== 2 ||
      !Array.isArray(manifest.documents) ||
      manifest.documents.length > 10000 ||
      !Array.isArray(manifest.folders) ||
      manifest.folders.length > 1000 ||
      manifest.folders.some((f) => !text(f, 120) || !f.trim()) ||
      new Set(manifest.folders.map((f) => f.toLowerCase())).size !==
        manifest.folders.length
    )
      fail("E102", "Invalid workspace manifest.");
    const ids = new Set();
    for (const d of manifest.documents) {
      if (
        !idValid(d.id) ||
        ids.has(d.id) ||
        !KINDS.includes(d.kind) ||
        !text(d.title, 200) ||
        !d.title.trim() ||
        !text(d.sideNotes, 200000) ||
        !text(d.folder, 120) ||
        (d.folder && !manifest.folders.includes(d.folder)) ||
        !Array.isArray(d.tags) ||
        d.tags.some((t) => !text(t, 80)) ||
        !Number.isFinite(Date.parse(d.created)) ||
        !Number.isFinite(Date.parse(d.modified))
      )
        fail("E102", "Invalid imported document.");
      ids.add(d.id);
      validatePayload(d.kind, d.payload);
    }
    if (includeSettings) validateSettings(manifest.settings);
    const templates = manifest.templates || [];
    if (
      !Array.isArray(templates) ||
      templates.length > 1000 ||
      templates.some(
        (t) => !text(t.name, 200) || !t.name.trim() || !KINDS.includes(t.kind),
      )
    )
      fail("E102", "Invalid templates.");
    for (const t of templates) validatePayload(t.kind, t.payload);
    let added = 0;
    this.db.transaction(() => {
      for (const f of manifest.folders)
        this.db.prepare("INSERT OR IGNORE INTO folders VALUES(?)").run(f);
      for (const d of manifest.documents) {
        if (
          preserveIds &&
          this.db.prepare("SELECT 1 FROM documents WHERE id=?").get(d.id)
        )
          continue;
        const id = preserveIds ? d.id : randomUUID();
        const actualFolder = d.folder
          ? this.db
              .prepare("SELECT name FROM folders WHERE name=?")
              .get(d.folder)?.name || ""
          : "";
        this.db
          .prepare(
            "INSERT INTO documents(id,kind,title,folder,tags,favourite,created,modified,opened,sideNotes,template,deleted,revision,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            d.kind,
            d.title,
            actualFolder,
            JSON.stringify(d.tags),
            Number(!!d.favourite),
            d.created,
            d.modified,
            d.opened || "",
            d.sideNotes,
            d.template || "",
            d.deleted || null,
            1,
            JSON.stringify(this.normalize(d.payload)),
          );
        added++;
      }
      for (const t of templates)
        this.db
          .prepare("INSERT INTO templates VALUES(?,?,?,?,?)")
          .run(
            randomUUID(),
            t.name,
            t.kind,
            JSON.stringify(this.normalize(t.payload)),
            new Date().toISOString(),
          );
      if (includeSettings) this.setSettings(manifest.settings);
    })();
    return added;
  }
  migrate(bytes) {
    const fingerprint = hash(bytes);
    if (
      this.db
        .prepare("SELECT 1 FROM migrations WHERE fingerprint=?")
        .get(fingerprint)
    )
      return 0;
    const manifest = parseLegacy(bytes);
    let count;
    this.db.transaction(() => {
      count = this.importManifest(manifest, {
        preserveIds: true,
        includeSettings: this.list().length === 0,
      });
      this.db
        .prepare("INSERT INTO migrations VALUES(?,?)")
        .run(fingerprint, new Date().toISOString());
    })();
    return count;
  }
  async exportArchive(onlyId) {
    const zip = new JSZip();
    const documents = this.list()
      .filter((d) => !onlyId || d.id === onlyId)
      .map((d) => this.get(d.id, false));
    const templates = onlyId
      ? []
      : this.db
          .prepare("SELECT * FROM templates")
          .all()
          .map((t) => ({ ...t, payload: JSON.parse(t.payload) }));
    const refs = new Set();
    const find = (v) => {
      if (v && typeof v === "object") {
        if (v.binaryId) refs.add(v.binaryId);
        Object.values(v).forEach(find);
      }
    };
    documents.forEach((d) => find(d.payload));
    templates.forEach((t) => find(t.payload));
    zip.file(
      "manifest.json",
      JSON.stringify({
        schema: 2,
        documents,
        templates,
        folders: this.state().folders,
        settings: this.settings(),
      }),
    );
    for (const name of refs) zip.file("assets/" + name, this.readAsset(name));
    const bytes = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    if (bytes.length > MAX) fail("E102", "Export exceeds 128 MiB.");
    return bytes;
  }
  async importArchive(bytes) {
    if (bytes.length > MAX) fail("E102", "Import exceeds 128 MiB.");
    if (bytes[0] !== 0x50) return this.importManifest(parseLegacy(bytes));
    const zip = await JSZip.loadAsync(bytes);
    const files = Object.values(zip.files);
    if (
      files.length > 20000 ||
      files.some(
        (f) =>
          f.name.includes("..") ||
          f.name.includes("\\") ||
          f.name.startsWith("/") ||
          (f.unsafeOriginalName && f.unsafeOriginalName !== f.name),
      ) ||
      files.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0) > MAX
    )
      fail("E102", "Unsafe or oversized archive.");
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) fail("E102", "Missing workspace manifest.");
    const manifestBytes = await manifestFile.async("nodebuffer");
    if (manifestBytes.length > MAX) fail("E102", "Manifest exceeds the limit.");
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    const hydrate = async (v) => {
      if (Array.isArray(v)) return Promise.all(v.map(hydrate));
      if (v && typeof v === "object") {
        const r = {};
        for (const [k, x] of Object.entries(v)) r[k] = await hydrate(x);
        if (r.binaryId) {
          if (!/^[a-f0-9]{64}$/.test(r.binaryId))
            fail("E102", "Invalid archive asset.");
          const entry = zip.file("assets/" + r.binaryId);
          if (!entry) fail("E102", "Archive asset missing.");
          const b = await entry.async("nodebuffer");
          if (b.length > MAX || hash(b) !== r.binaryId)
            fail("E102", "Archive asset integrity check failed.");
          r.binary = b.toString("base64");
        }
        return r;
      }
      return v;
    };
    return this.importManifest(await hydrate(manifest));
  }
  async backup() {
    const target = this.file + ".next-backup";
    try {
      if (fs.existsSync(target)) fs.unlinkSync(target);
      await this.db.backup(target);
      fs.renameSync(target, this.file + ".bak");
      return true;
    } catch {
      return false;
    }
  }
  close() {
    this.db.close();
  }
}
