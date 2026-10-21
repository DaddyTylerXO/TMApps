import { _electron as electron } from "playwright";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const root = path.resolve(".");
const qa = path.join(root, ".qa", "desktop-" + Date.now());
fs.mkdirSync(qa, { recursive: true });
const env = { ...process.env, TMA_QA_DATA: qa };
delete env.ELECTRON_RUN_AS_NODE;
const start = Date.now();
const application = await electron.launch({
  executablePath: process.env.TMA_QA_EXECUTABLE || require("electron"),
  args: process.env.TMA_QA_EXECUTABLE ? [] : [root],
  env,
  timeout: 60000,
});
let window;
const errors = [];
async function capture(destination) {
  const data = await application.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
      .toPNG()
      .toString("base64"),
  );
  fs.writeFileSync(destination, Buffer.from(data, "base64"));
}
try {
  window = await application.firstWindow();
  window.setDefaultTimeout(15000);
  window.on("pageerror", (e) => errors.push(e.message));
  window.on("console", (m) => {
    if (m.type() === "error") console.log("RENDERER:", m.text().slice(0, 300));
  });
  await window
    .getByRole("heading", { name: "Welcome to TMA-Libraries" })
    .waitFor({ timeout: 30000 });
  await window
    .getByRole("button", { name: "Start creating", exact: true })
    .click();
  await window
    .getByRole("heading", { name: "What will you create today?" })
    .waitFor();
  const startupMs = Date.now() - start;
  await window
    .getByRole("heading", { name: "Welcome to TMA-Libraries" })
    .waitFor({ state: "hidden" });
  await window.waitForTimeout(400);
  await capture(".qa/home.png");
  console.log("PASS desktop startup and home; startupMs=" + startupMs);
  assert.equal(await window.locator(".type-grid .type-card").count(), 10);
  await window.getByRole("button", { name: "New folder", exact: true }).click();
  await window
    .getByRole("textbox", { name: "Folder name" })
    .fill("Synthetic project");
  await window
    .getByRole("button", { name: "Create folder", exact: true })
    .click();
  await window
    .getByRole("button", { name: "Synthetic project", exact: true })
    .waitFor();
  console.log("PASS folder creation");
  await window.locator(".type-card").filter({ hasText: "Check List" }).click();
  await window
    .getByRole("textbox", { name: "Document title", exact: true })
    .fill("Synthetic launch checklist");
  await window
    .getByRole("textbox", { name: "New checklist item" })
    .fill("Prepare launch");
  await window.getByRole("button", { name: "Add item", exact: true }).click();
  await window
    .getByRole("checkbox", { name: "Complete Prepare launch" })
    .check();
  await window.getByRole("button", { name: "Save", exact: true }).click();
  await window
    .getByText("All changes saved locally", { exact: true })
    .waitFor();
  await capture(".qa/checklist.png");
  console.log("PASS checklist create edit save");
  await window
    .getByRole("button", { name: "Side notes and document details" })
    .click();
  await window
    .getByLabel("Side notes", { exact: true })
    .fill("Synthetic side note");
  await window.getByRole("button", { name: "Save", exact: true }).click();
  await window
    .getByRole("button", { name: "Delete document", exact: true })
    .click();
  await window
    .getByRole("button", { name: /^Trash/ })
    .first()
    .click();
  await window
    .getByText("Synthetic launch checklist", { exact: true })
    .waitFor();
  await window.getByRole("button", { name: "Restore", exact: true }).click();
  await window
    .getByRole("button", { name: "All documents", exact: true })
    .click();
  await window
    .locator(".document-open")
    .filter({ hasText: "Synthetic launch checklist" })
    .click();
  await window
    .getByRole("textbox", { name: "Document title", exact: true })
    .waitFor();
  if (
    (await window
      .getByRole("button", { name: "Side notes and document details" })
      .getAttribute("aria-pressed")) === "false"
  )
    await window
      .getByRole("button", { name: "Side notes and document details" })
      .click();
  assert.equal(
    await window.getByLabel("Side notes", { exact: true }).inputValue(),
    "Synthetic side note",
  );
  console.log("PASS Trash and Restore preserve content");
  await window.getByRole("button", { name: "Home", exact: true }).click();
  await window
    .locator(".type-card")
    .filter({ hasText: "General Document" })
    .click();
  await window.locator(".rich-surface").waitFor({ timeout: 60000 });
  await window
    .getByText("Preparing document…", { exact: true })
    .waitFor({ state: "hidden", timeout: 60000 });
  await capture(".qa/document.png");
  console.log("PASS DOCX editor opens");
  await window.locator(".rich-surface").click({ position: { x: 350, y: 180 } });
  await window.keyboard.press("Control+End");
  await window.keyboard.type(" Synthetic edited text");
  await window.getByRole("button", { name: "Save", exact: true }).click();
  const editedBinary = await window.evaluate(async () => {
    const state = (await window.libraries.invoke("state")).value;
    const d = state.documents.find((d) => d.kind === "document");
    return (await window.libraries.invoke("get", d.id)).value.payload.binary;
  });
  const { default: JSZip } = await import("jszip");
  const editedPackage = await JSZip.loadAsync(
    Buffer.from(editedBinary, "base64"),
  );
  assert.ok(
    (await editedPackage.file("word/document.xml").async("string")).includes(
      "Synthetic edited text",
    ),
  );
  console.log("PASS real DOCX editing and saved OOXML content");
  await window.getByRole("button", { name: "Home", exact: true }).click();
  await window.locator(".type-card").filter({ hasText: "Spreadsheet" }).click();
  await window
    .locator(".sheet-surface canvas")
    .first()
    .waitFor({ timeout: 60000 });
  await capture(".qa/spreadsheet.png");
  console.log("PASS spreadsheet editor opens");
  await window.getByRole("button", { name: "Home", exact: true }).click();
  await window.locator(".type-card").filter({ hasText: "Slide Show" }).click();
  await window.getByRole("button", { name: "Text", exact: true }).click();
  await window.getByRole("button", { name: "Present", exact: true }).click();
  await window.getByRole("button", { name: /Exit presentation/ }).click();
  console.log("PASS slide editing and presentation");
  await window.getByRole("button", { name: "Home", exact: true }).click();
  await window.locator(".type-card").filter({ hasText: "PDF" }).click();
  await window.getByAltText("PDF page 1").waitFor({ timeout: 30000 });
  await capture(".qa/pdf.png");
  console.log("PASS PDF editor opens");
  await window.getByRole("button", { name: "Home", exact: true }).click();
  await window
    .locator(".type-card")
    .filter({ hasText: "Book", hasNotText: "Notebook" })
    .click();
  await window.locator(".book-page .rich-surface").waitFor({ timeout: 60000 });
  await window
    .getByText("Preparing document…", { exact: true })
    .waitFor({ state: "hidden", timeout: 60000 });
  console.log("PASS book editor opens");
  await window.getByRole("button", { name: "Home", exact: true }).click();
  await window.getByRole("button", { name: "Settings", exact: true }).click();
  await window
    .getByRole("textbox", { name: "Search settings and knowledge base" })
    .fill("deletion");
  await window
    .getByLabel("Default deletion behaviour")
    .selectOption("permanent");
  await window
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  console.log("PASS settings search and deletion preference");
  await application.evaluate(({ dialog }) => {
    globalThis.qaConfirmations = [];
    dialog.showMessageBox = async (...args) => {
      globalThis.qaConfirmations.push(args.at(-1));
      return { response: 0 };
    };
  });
  const protectedId = await window.evaluate(async () => {
    const r = await window.libraries.invoke("create", {
      kind: "checklist",
      title: "Synthetic deletion confirmation",
    });
    return r.value.id;
  });
  assert.equal(
    await window.evaluate(
      async (id) => (await window.libraries.invoke("delete", id)).value,
      protectedId,
    ),
    false,
  );
  assert.ok(
    await window.evaluate(
      async (id) => (await window.libraries.invoke("get", id)).value.id === id,
      protectedId,
    ),
  );
  await application.evaluate(({ dialog }) => {
    dialog.showMessageBox = async (...args) => {
      globalThis.qaConfirmations.push(args.at(-1));
      return { response: 1 };
    };
  });
  assert.equal(
    await window.evaluate(
      async (id) => (await window.libraries.invoke("delete", id)).value,
      protectedId,
    ),
    true,
  );
  const confirmations = await application.evaluate(
    () => globalThis.qaConfirmations,
  );
  assert.equal(confirmations.length, 2);
  assert.equal(confirmations[0].defaultId, 0);
  console.log(
    "PASS permanent deletion cancellation and explicit confirmation gate",
  );
  const metrics = await application.evaluate(async ({ app }) => {
    const before = app.getAppMetrics();
    await new Promise((r) => setTimeout(r, 1000));
    return app.getAppMetrics().map((m) => ({
      type: m.type,
      memoryKB: m.memory.workingSetSize,
      cpu: m.cpu.percentCPUUsage,
    }));
  });
  assert.equal(errors.length, 0, errors.join("\n"));
  fs.writeFileSync(
    ".qa/desktop-results.json",
    JSON.stringify({ startupMs, metrics, errors }, null, 2),
  );
  console.log("PASS no renderer exceptions; metrics saved");
} catch (e) {
  await capture(".qa/failure.png").catch(() => {});
  throw e;
} finally {
  await application.close();
}
