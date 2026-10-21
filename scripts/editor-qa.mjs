import { _electron as electron } from "playwright";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url),
  root = path.resolve(".");
const env = {
  ...process.env,
  TMA_QA_DATA: path.join(root, ".qa", "editors-" + Date.now()),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  executablePath: require("electron"),
  args: [root],
  env,
});
let page;
async function capture(destination) {
  const data = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
      .toPNG()
      .toString("base64"),
  );
  fs.writeFileSync(destination, Buffer.from(data, "base64"));
}
try {
  page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error")
      console.log("CONSOLE ERROR", m.text().slice(0, 250));
  });
  await page
    .getByRole("button", { name: "Start creating", exact: true })
    .click();
  for (const name of [
    "General Document",
    "Spreadsheet",
    "Slide Show",
    "PDF",
    "Book",
  ]) {
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page
      .locator(".type-card")
      .filter({
        has: page.locator("strong", { hasText: new RegExp("^" + name + "$") }),
      })
      .click();
    await page
      .getByRole("textbox", { name: "Document title", exact: true })
      .waitFor();
    if (name === "General Document")
      await page.locator(".rich-surface").waitFor();
    if (name === "Spreadsheet")
      await page
        .locator(".sheet-surface canvas")
        .first()
        .waitFor({ timeout: 60000 });
    if (name === "PDF") await page.getByAltText("PDF page 1").waitFor();
    await page.waitForTimeout(3000);
    await capture(".qa/editor-" + name.replaceAll(" ", "-") + ".png");
    console.log(
      "OPENED",
      name,
      "contenteditables=",
      await page.locator("[contenteditable=true]").count(),
      "alerts=",
      await page.locator("[role=alert]").allTextContents(),
    );
  }
} catch (e) {
  await capture(".qa/editor-failure.png");
  throw e;
} finally {
  await app.close();
}
