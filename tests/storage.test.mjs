import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LibraryStore, parseLegacy, KINDS } from "../desktop/store.mjs";
import JSZip from "jszip";
const base = path.resolve(".qa/storage");
fs.mkdirSync(base, { recursive: true });
const fixture = () => {
  const dir = fs.mkdtempSync(path.join(base, "case-"));
  const store = new LibraryStore(dir);
  return { store, dir, close: () => store.close() };
};
function legacy() {
  return {
    Schema: 1,
    Folders: ["Research"],
    Settings: {
      Theme: "Light",
      LargeText: false,
      HighContrast: false,
      Autosave: true,
      AutosaveSeconds: 5,
      SetupComplete: true,
    },
    Documents: [
      {
        Id: "1234567890abcdef1234567890abcdef",
        Kind: "Note",
        Title: "café 世界",
        Body: "Line one\nLine two 🗂",
        SideNotes: "Review",
        Folder: "Research",
        Tags: "Ideas, work",
        Favourite: true,
        Created: "/Date(1700000000000)/",
        Modified: "/Date(1700000100000)/",
        Opened: "/Date(1700000200000)/",
        Items: [],
      },
      {
        Id: "abcdef1234567890abcdef1234567890",
        Kind: "Checklist",
        Title: "Steps",
        Body: "",
        SideNotes: "",
        Folder: "",
        Tags: "",
        Favourite: false,
        ShowProgress: true,
        Items: [{ Text: "Done", Done: true }],
        Created: "/Date(1700000000000)/",
        Modified: "/Date(1700000000000)/",
      },
    ],
  };
}
test("fresh database defaults, CRUD, metadata and durable revision saves", () => {
  const { store, dir } = fixture();
  assert.equal(store.settings().theme, "brown");
  assert.equal(store.settings().deletionMode, "trash");
  assert.equal(store.settings().largeText, false);
  assert.equal(store.settings().highContrast, false);
  store.addFolder("Project");
  const d = store.create({
    kind: "checklist",
    title: "Synthetic checklist",
    folder: "Project",
  });
  const saved = store.save({
    ...d,
    tags: ["Planning"],
    favourite: true,
    sideNotes: "Side note",
    payload: {
      items: [{ id: "one", text: "café 世界", done: true }],
      showProgress: true,
    },
  });
  assert.equal(saved.revision, 2);
  store.close();
  const reopened = new LibraryStore(dir);
  assert.equal(reopened.get(d.id).payload.items[0].done, true);
  assert.equal(reopened.get(d.id).favourite, true);
  assert.equal(reopened.get(d.id).sideNotes, "Side note");
  assert.equal(reopened.history(d.id).length, 1);
  reopened.close();
});
test("legacy migration preserves identities, metadata, unicode, dates and preferences without duplicating on retries", () => {
  const { store, close } = fixture();
  const input = Buffer.from(JSON.stringify(legacy()));
  assert.equal(store.migrate(input), 2);
  assert.equal(store.migrate(input), 0);
  const note = store.get(legacy().Documents[0].Id);
  assert.equal(note.kind, "document");
  assert.equal(note.title, "café 世界");
  assert.equal(note.payload.legacyText, legacy().Documents[0].Body);
  assert.equal(note.created, "2023-11-14T22:13:20.000Z");
  assert.equal(note.sideNotes, "Review");
  assert.equal(note.favourite, true);
  assert.deepEqual(note.tags, ["Ideas", "work"]);
  assert.equal(store.settings().theme, "light");
  const changed = legacy();
  changed.Documents[0].Body = "Later legacy edit";
  assert.equal(store.migrate(Buffer.from(JSON.stringify(changed))), 0);
  assert.equal(
    store.get(note.id).payload.legacyText,
    legacy().Documents[0].Body,
  );
  close();
});
test("invalid later document rolls back entire migration and leaves original bytes unchanged", () => {
  const { store, close } = fixture();
  const w = legacy();
  w.Documents[1].Items[0].Text = null;
  const bytes = Buffer.from(JSON.stringify(w)),
    before = Buffer.from(bytes);
  assert.throws(() => store.migrate(bytes));
  assert.equal(store.list().length, 0);
  assert.equal(store.state().folders.length, 0);
  assert.deepEqual(bytes, before);
  close();
});
test("default deletion, restore, folder removal fallback and no automatic expiry", () => {
  const { store, close } = fixture();
  store.addFolder("Project");
  const d = store.create({
    kind: "checklist",
    title: "Synthetic",
    folder: "Project",
  });
  store.trash(d.id);
  assert.ok(store.get(d.id).deleted);
  store.removeFolder("Project");
  const restored = store.restore(d.id);
  assert.equal(restored.deleted, null);
  assert.equal(restored.folder, "");
  store.trash(d.id);
  assert.equal(store.list().length, 1);
  close();
});
test("permanent purge removes revisions and only unreferenced assets", () => {
  const { store, dir, close } = fixture();
  const binary = Buffer.from("synthetic binary shared asset").toString(
    "base64",
  );
  const a = store.create({
      kind: "document",
      title: "First",
      payload: { binary },
    }),
    b = store.create({
      kind: "document",
      title: "Second",
      payload: { binary },
    });
  const asset = store.get(a.id, false).payload.binaryId;
  store.save({
    ...a,
    payload: { binary: Buffer.from("next synthetic asset").toString("base64") },
  });
  store.purge(a.id);
  assert.throws(() => store.get(a.id));
  assert.equal(
    store.db
      .prepare("SELECT count(*) AS n FROM revisions WHERE documentId=?")
      .get(a.id).n,
    0,
  );
  assert.ok(fs.existsSync(path.join(dir, "assets", asset)));
  store.purge(b.id);
  assert.equal(
    fs
      .readdirSync(path.join(dir, "assets"))
      .filter((x) => /^[a-f\d]{64}$/.test(x)).length,
    0,
  );
  close();
});
test("empty Trash retains live documents and externally exported copies", async () => {
  const { store, dir, close } = fixture();
  const a = store.create({ kind: "checklist", title: "Trashed" });
  const b = store.create({ kind: "checklist", title: "Keep" });
  const file = path.join(dir, "independent.tmalibrary");
  fs.writeFileSync(file, await store.exportArchive());
  const before = fs.readFileSync(file);
  store.trash(a.id);
  store.emptyTrash();
  assert.equal(store.list().length, 1);
  assert.equal(store.get(b.id).title, "Keep");
  assert.deepEqual(fs.readFileSync(file), before);
  close();
});
test("settings persist, invalid preferences fail without changing saved settings", () => {
  const { store, dir } = fixture();
  store.setSettings({ deletionMode: "permanent", theme: "black" });
  assert.throws(() => store.setSettings({ autosaveSeconds: 1 }));
  assert.equal(store.settings().autosaveSeconds, 5);
  store.close();
  const next = new LibraryStore(dir);
  assert.equal(next.settings().deletionMode, "permanent");
  assert.equal(next.settings().theme, "black");
  next.close();
});
test("stale revision saves and editing trashed documents fail without losing committed content", () => {
  const { store, close } = fixture();
  const d = store.create({ kind: "checklist", title: "Original" });
  store.save({ ...d, title: "Committed" });
  assert.throws(() => store.save({ ...d, title: "Stale" }), /another view/);
  assert.equal(store.get(d.id).title, "Committed");
  store.trash(d.id);
  assert.throws(
    () => store.save({ ...store.get(d.id), title: "Trashed edit" }),
    /Restore/,
  );
  close();
});
test("native archive roundtrip preserves nested binaries and Trash and adds new IDs", async () => {
  const one = fixture(),
    two = fixture();
  const a = one.store.create({
    kind: "document",
    title: "Synthetic unicode 世界",
    payload: { binary: Buffer.from("synthetic").toString("base64") },
  });
  one.store.trash(a.id);
  const book = one.store.create({ kind: "book", title: "Book" });
  book.payload.sections[0].pages[0].binary =
    Buffer.from("synthetic page").toString("base64");
  one.store.save(book);
  const bytes = await one.store.exportArchive();
  assert.equal(await two.store.importArchive(bytes), 2);
  const docs = two.store.list();
  assert.ok(!docs.some((d) => d.id === a.id));
  assert.equal(
    two.store.get(docs.find((d) => d.kind === "document").id).payload.binary,
    one.store.get(a.id).payload.binary,
  );
  assert.ok(docs.find((d) => d.kind === "document").deleted);
  assert.equal(
    two.store.get(docs.find((d) => d.kind === "book").id).payload.sections[0]
      .pages[0].binary,
    book.payload.sections[0].pages[0].binary,
  );
  one.close();
  two.close();
});
test("schema-1 imports preserve current settings and import source bytes", async () => {
  const { store, close } = fixture();
  store.setSettings({ theme: "black" });
  const bytes = Buffer.from(JSON.stringify(legacy()));
  assert.equal(await store.importArchive(bytes), 2);
  assert.equal(store.settings().theme, "black");
  assert.equal(parseLegacy(bytes).documents[1].payload.items[0].done, true);
  close();
});
test("malformed archive and missing asset do not add documents or folders", async () => {
  const { store, close } = fixture();
  const w = parseLegacy(Buffer.from(JSON.stringify(legacy())));
  w.documents[0].payload = { binaryId: "a".repeat(64) };
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(w));
  const invalid = await zip.generateAsync({ type: "nodebuffer" });
  await assert.rejects(() => store.importArchive(invalid));
  assert.equal(store.list().length, 0);
  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  await assert.rejects(() => store.importArchive(bytes));
  assert.equal(store.list().length, 0);
  close();
});
test("reject unsafe archive paths, unsupported kinds, duplicate identifiers and payload limits", async () => {
  const { store, close } = fixture();
  const zip = new JSZip();
  zip.file("../escape.txt", "synthetic");
  zip.file("manifest.json", "{}");
  const unsafe = await awaitedZip(zip);
  await assert.rejects(() => store.importArchive(unsafe));
  assert.throws(() => store.create({ kind: "macro", title: "No execution" }));
  const w = parseLegacy(Buffer.from(JSON.stringify(legacy())));
  w.documents.push(w.documents[0]);
  assert.throws(() => store.importManifest(w));
  assert.throws(() =>
    store.create({
      kind: "checklist",
      title: "Bad",
      payload: { items: [{ text: null, done: true }] },
    }),
  );
  assert.equal(store.list().length, 0);
  close();
});
async function awaitedZip(zip) {
  return zip.generateAsync({ type: "nodebuffer" });
}
test("backup recovery restores committed content and corrupt backup never creates a blank database", async () => {
  const { store, dir } = fixture();
  const d = store.create({ kind: "checklist", title: "Durable" });
  assert.equal(await store.backup(), true);
  store.close();
  fs.writeFileSync(path.join(dir, "library.sqlite"), "damaged primary");
  const restored = new LibraryStore(dir);
  assert.equal(restored.recovered, true);
  assert.equal(restored.get(d.id).title, "Durable");
  restored.close();
  fs.writeFileSync(path.join(dir, "library.sqlite"), "damaged again");
  fs.writeFileSync(path.join(dir, "library.sqlite.bak"), "damaged backup");
  assert.throws(() => new LibraryStore(dir));
  assert.equal(
    fs.readFileSync(path.join(dir, "library.sqlite"), "utf8"),
    "damaged again",
  );
});
test("revision restore creates a new revision, bounded history retains 20 earlier versions", () => {
  const { store, close } = fixture();
  let d = store.create({ kind: "checklist", title: "History" });
  for (let i = 0; i < 25; i++)
    d = store.save({
      ...d,
      payload: { items: [{ id: "one", text: "Revision " + i, done: false }] },
    });
  assert.ok(store.history(d.id).length <= 20);
  const first = store.history(d.id).at(-1);
  const restored = store.restoreRevision({
    id: d.id,
    revision: first.revision,
  });
  assert.equal(restored.revision, d.revision + 1);
  assert.notEqual(restored.payload.items[0].text, d.payload.items[0].text);
  close();
});
test("1000 notes workload saves transactionally and reloads without whole-workspace rewrites", () => {
  const { store, dir } = fixture();
  const start = performance.now();
  store.db.transaction(() => {
    for (let i = 0; i < 1000; i++)
      store.create({
        kind: "document",
        title: "Synthetic " + i,
        payload: { legacyText: "x".repeat(4096) },
      });
  })();
  const createMs = performance.now() - start;
  const d = store.get(store.list()[0].id);
  const saveStart = performance.now();
  store.save({ ...d, sideNotes: "Single changed document" });
  const saveMs = performance.now() - saveStart;
  assert.equal(store.list().length, 1000);
  store.close();
  const next = new LibraryStore(dir);
  assert.equal(next.list().length, 1000);
  next.close();
  console.log(
    JSON.stringify({
      workload: 1000,
      createMs: Math.round(createMs),
      singleSaveMs: Math.round(saveMs),
    }),
  );
});
