import {
  app,
  BrowserWindow,
  protocol,
  net,
  ipcMain,
  dialog,
  shell,
  Menu,
  nativeTheme,
  Tray,
  Notification,
} from "electron";
import { Worker } from "node:worker_threads";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qa = !!process.env.TMA_QA_DATA;
app.setName("TMA-Libraries");
if (qa) app.setPath("userData", path.resolve(process.env.TMA_QA_DATA));
protocol.registerSchemesAsPrivileged([
  {
    scheme: "tma",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
let window,
  tray,
  storage,
  conversion,
  quitting = false;
const queues = new Map();
let sequence = 0;
function rpc(worker, method, args) {
  return new Promise((resolve, reject) => {
    const requestId = ++sequence;
    const timer = setTimeout(() => {
      queues.delete(requestId);
      reject(
        Error(
          "This operation timed out. Your last committed save is retained.",
        ),
      );
    }, 120000);
    queues.set(requestId, { resolve, reject, timer });
    worker.postMessage({ requestId, method, args });
  });
}
function attach(worker) {
  worker.on("message", (r) => {
    if (r.fatal) {
      dialog.showErrorBox("Libraries E100", r.error);
      app.exit(1);
      return;
    }
    const pending = queues.get(r.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    queues.delete(r.requestId);
    if (r.error) pending.reject(Error(r.error));
    else pending.resolve({ value: r.value, backupWarning: !!r.backupWarning });
  });
  worker.on("error", () => {
    for (const [p, q] of queues) {
      clearTimeout(q.timer);
      q.reject(
        Error(
          "Libraries E103 · Background processing stopped. Keep the window open and export any unsaved work.",
        ),
      );
      queues.delete(p);
    }
  });
  return worker;
}
const call = async (method, args) => (await rpc(storage, method, args)).value;
const convert = async (method, args) =>
  (await rpc(conversion, method, args)).value;
const external = new Set([
  "https://github.com/DaddyTylerXO/TMApps/tree/TMA-Libraries",
  "https://github.com/DaddyTylerXO/TMApps/issues/new",
  "https://github.com/DaddyTylerXO/TMApps/security/advisories/new",
]);
async function writeFileAtomic(destination, bytes) {
  const temporary = destination + ".libraries-" + Date.now() + ".tmp";
  let handle;
  try {
    handle = await fs.open(temporary, "wx");
    await handle.writeFile(Buffer.from(bytes));
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporary, destination);
  } finally {
    await handle?.close();
    await fs.unlink(temporary).catch(() => {});
  }
}
async function legacyBusy() {
  if (process.platform !== "win32") return false;
  try {
    const { stdout } = await promisify(execFile)(
      "tasklist.exe",
      ["/FI", "IMAGENAME eq TMA-Libraries.exe", "/FO", "CSV", "/NH"],
      { windowsHide: true },
    );
    return stdout
      .split(/\r?\n/)
      .some(
        (line) =>
          line.toLowerCase().includes("tma-libraries.exe") &&
          Number(
            line.split(",")[1]?.replaceAll(String.fromCharCode(34), ""),
          ) !== process.pid,
      );
  } catch {
    return true;
  }
}
async function confirmDeletion(action, count = 1) {
  const answer = await dialog.showMessageBox(window, {
    type: "warning",
    buttons: ["Cancel", action],
    defaultId: 0,
    cancelId: 0,
    title: action,
    message: `${action} ${count === 1 ? "this document" : `${count} documents`}?`,
    detail:
      "This removes the managed copies and their editing history. Imported originals and independently exported backups remain. This is not secure disk erasure.",
  });
  return answer.response === 1;
}
function makeTray(settings) {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (!settings.closeToTray) return;
  tray = new Tray(path.join(root, "assets/app.ico"));
  tray.setToolTip("TMA-Libraries");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open TMA-Libraries", click: () => window.show() },
      {
        label: "New document",
        click: () => {
          window.show();
          window.webContents.send("libraries:command", "new");
        },
      },
      {
        label: "Settings",
        click: () => {
          window.show();
          window.webContents.send("libraries:command", "settings");
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          quitting = true;
          window.webContents.send("libraries:command", "quit");
          window.show();
        },
      },
    ]),
  );
  tray.on("double-click", () => window.show());
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  app.whenReady().then(async () => {
    nativeTheme.themeSource = "dark";
    storage = attach(
      new Worker(new URL("./storage-worker.mjs", import.meta.url), {
        workerData: {
          directory: path.join(app.getPath("userData"), "library-v2"),
        },
      }),
    );
    conversion = attach(
      new Worker(new URL("./formats-worker.mjs", import.meta.url)),
    );
    protocol.handle("tma", (request) => {
      try {
        const url = new URL(request.url);
        if (url.host !== "app")
          return new Response("Not found", { status: 404 });
        const target = path.resolve(
          root,
          "dist",
          "." + decodeURIComponent(url.pathname),
        );
        if (!target.startsWith(path.join(root, "dist") + path.sep))
          return new Response("Forbidden", { status: 403 });
        return net.fetch(pathToFileURL(target).href);
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });
    window = new BrowserWindow({
      width: 1480,
      height: 980,
      minWidth: 960,
      minHeight: 650,
      title: "TMA-Libraries",
      backgroundColor: "#211710",
      icon: path.join(root, "assets/app.ico"),
      show: false,
      webPreferences: {
        preload: path.join(root, "desktop/preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        backgroundThrottling: !qa,
      },
    });
    window.webContents.session.setPermissionRequestHandler((_c, _p, callback) =>
      callback(false),
    );
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("tma://app/")) event.preventDefault();
    });
    window.on("close", (event) => {
      if (!quitting) {
        event.preventDefault();
        window.webContents.send("libraries:command", "close");
      }
    });
    app.on("before-quit", () => {
      quitting = true;
    });
    const trusted = (event) =>
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame &&
      event.senderFrame.url.startsWith("tma://app/");
    ipcMain.handle("libraries:invoke", async (event, method, args) => {
      if (!trusted(event)) return { error: "Untrusted request." };
      try {
        if (
          [
            "state",
            "get",
            "create",
            "save",
            "opened",
            "addFolder",
            "removeFolder",
            "history",
            "restoreRevision",
            "restore",
            "saveTemplate",
            "createFromTemplate",
          ].includes(method)
        )
          return await rpc(storage, method, args);
        if (method === "settings") {
          const s = await call("setSettings", args);
          makeTray(s);
          return { value: s };
        }
        if (method === "delete") {
          const d = await call("get", args);
          const settings = (await call("state")).settings;
          if (settings.deletionMode === "permanent") {
            if (!(await confirmDeletion("Permanently delete")))
              return { value: false };
            await call("purge", d.id);
          } else await call("trash", d.id);
          return { value: true };
        }
        if (method === "purge") {
          if (!(await confirmDeletion("Permanently delete")))
            return { value: false };
          await call("purge", args);
          return { value: true };
        }
        if (method === "emptyTrash") {
          const state = await call("state");
          const count = state.documents.filter((d) => d.deleted).length;
          if (!count || !(await confirmDeletion("Empty Trash", count)))
            return { value: false };
          await call("emptyTrash");
          return { value: true };
        }
        if (method === "exportArchive") {
          const result = await dialog.showSaveDialog(window, {
            title: "Export complete workspace, including Trash",
            defaultPath: args
              ? "Libraries notebook.tmalibrary"
              : "Libraries backup.tmalibrary",
            filters: [
              { name: "Libraries workspace", extensions: ["tmalibrary"] },
            ],
          });
          if (result.canceled) return { value: false };
          const bytes = await call("exportArchive", args);
          await writeFileAtomic(result.filePath, bytes);
          return { value: true };
        }
        if (method === "importArchive") {
          const result = await dialog.showOpenDialog(window, {
            properties: ["openFile"],
            filters: [
              {
                name: "Libraries workspace",
                extensions: ["tmalibrary", "json"],
              },
            ],
          });
          if (result.canceled) return { value: null };
          const stat = await fs.stat(result.filePaths[0]);
          if (stat.size > 128 * 1024 * 1024)
            throw Error("E102 · Import exceeds 128 MiB.");
          return await rpc(
            storage,
            "importArchive",
            await fs.readFile(result.filePaths[0]),
          );
        }
        if (method === "legacyStatus") {
          const file =
            process.platform === "win32"
              ? path.join(
                  process.env.LOCALAPPDATA || "",
                  "TMApps",
                  "TMA-Libraries",
                  "workspace.json",
                )
              : null;
          return {
            value: {
              available:
                !!file &&
                (await fs
                  .stat(file)
                  .then(() => true)
                  .catch(() => false)),
            },
          };
        }
        if (method === "migrateLegacy") {
          if (await legacyBusy())
            throw Error(
              "Close the legacy TMA-Libraries app before migration. Originals are retained.",
            );
          const file = path.join(
            process.env.LOCALAPPDATA || "",
            "TMApps",
            "TMA-Libraries",
            "workspace.json",
          );
          let bytes;
          try {
            bytes = await fs.readFile(file);
          } catch {
            throw Error(
              "Legacy workspace unavailable. Import a private backup instead.",
            );
          }
          return await rpc(storage, "legacy", bytes);
        }
        if (method === "chooseAsset") {
          const r = await dialog.showOpenDialog(window, {
            properties: ["openFile"],
            filters: args?.filters || [
              { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
            ],
          });
          if (r.canceled) return { value: null };
          const stat = await fs.stat(r.filePaths[0]);
          if (stat.size > 64 * 1024 * 1024)
            throw Error("Asset exceeds 64 MiB.");
          return {
            value: {
              name: path.basename(r.filePaths[0]),
              extension: path.extname(r.filePaths[0]).slice(1).toLowerCase(),
              binary: (await fs.readFile(r.filePaths[0])).toString("base64"),
            },
          };
        }
        if (method === "importFile") {
          const r = await dialog.showOpenDialog(window, {
            properties: ["openFile"],
            filters: [
              {
                name: "Supported document formats",
                extensions: [
                  "docx",
                  "xlsx",
                  "csv",
                  "tsv",
                  "pptx",
                  "pdf",
                  "txt",
                ],
              },
            ],
          });
          if (r.canceled) return { value: null };
          const file = r.filePaths[0];
          if ((await fs.stat(file)).size > 64 * 1024 * 1024)
            throw Error("File exceeds 64 MiB.");
          return {
            value: await convert("importFile", {
              extension: path.extname(file).slice(1).toLowerCase(),
              title: path.basename(file, path.extname(file)),
              binary: (await fs.readFile(file)).toString("base64"),
            }),
          };
        }
        if (method === "exportFile") {
          if (
            !args ||
            !["docx", "xlsx", "csv", "tsv", "pptx", "pdf", "json"].includes(
              args.extension,
            )
          )
            throw Error("Unsupported export format.");
          const r = await dialog.showSaveDialog(window, {
            defaultPath:
              String(args.title || "Document").replace(
                /[<>:"/\\|?*\x00-\x1f]/g,
                "_",
              ) +
              "." +
              args.extension,
            filters: [
              {
                name: args.extension.toUpperCase(),
                extensions: [args.extension],
              },
            ],
          });
          if (r.canceled) return { value: false };
          const bytes = args.binary
            ? Buffer.from(args.binary, "base64")
            : Buffer.from(await convert("exportFile", args));
          await writeFileAtomic(r.filePath, bytes);
          return { value: true };
        }
        if (method === "convert")
          return { value: await convert(args.method, args.args) };
        if (method === "print") {
          if (args?.pdf) {
            const r = await dialog.showSaveDialog(window, {
              defaultPath: "Document.pdf",
              filters: [{ name: "PDF", extensions: ["pdf"] }],
            });
            if (r.canceled) return { value: false };
            const bytes = await window.webContents.printToPDF({
              printBackground: true,
              preferCSSPageSize: true,
            });
            await writeFileAtomic(r.filePath, bytes);
          } else
            await new Promise((resolve, reject) =>
              window.webContents.print({ printBackground: true }, (ok) =>
                ok
                  ? resolve()
                  : reject(Error("Printing was cancelled or unavailable.")),
              ),
            );
          return { value: true };
        }
        if (method === "external") {
          const url = new URL(args);
          if (!external.has(url.origin + url.pathname))
            throw Error("Unsupported external destination.");
          await shell.openExternal(url.href);
          return { value: true };
        }
        if (method === "notify") {
          const state = await call("state");
          if (state.settings.notifications && Notification.isSupported())
            new Notification({
              title: "TMA-Libraries",
              body: "Your document was exported.",
              icon: path.join(root, "assets/app.png"),
            }).show();
          return { value: true };
        }
        if (method === "close") {
          const s = (await call("state")).settings;
          if (s.closeToTray && !quitting) {
            makeTray(s);
            window.hide();
          } else {
            quitting = true;
            app.quit();
          }
          return { value: true };
        }
        if (method === "environment")
          return {
            value: {
              version: app.getVersion(),
              platform: process.platform,
              qa,
            },
          };
        throw Error("Unsupported operation.");
      } catch (e) {
        const safe =
          /^(E\d|Close the legacy|This operation|Unsupported|Asset exceeds|File exceeds|Printing was|Legacy workspace)/.test(
            e.message,
          )
            ? e.message
            : "E103 · Operation failed. Check disk space, access and file validity. No report was transmitted.";
        return { error: safe };
      }
    });
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "File",
          submenu: [
            {
              label: "New document",
              accelerator: "CmdOrCtrl+N",
              click: () => window.webContents.send("libraries:command", "new"),
            },
            {
              label: "Save",
              accelerator: "CmdOrCtrl+S",
              click: () => window.webContents.send("libraries:command", "save"),
            },
            {
              label: "Find",
              accelerator: "CmdOrCtrl+F",
              click: () =>
                window.webContents.send("libraries:command", "search"),
            },
            { type: "separator" },
            {
              label: "Quit",
              click: () => {
                quitting = true;
                window.webContents.send("libraries:command", "quit");
              },
            },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
        {
          label: "Help",
          submenu: [
            {
              label: "Knowledge base",
              accelerator: "F1",
              click: () => window.webContents.send("libraries:command", "help"),
            },
          ],
        },
      ]),
    );
    await window.loadURL("tma://app/index.html");
    if (!qa) window.show();
    makeTray((await call("state")).settings);
  });
  app.on("window-all-closed", () => {
    storage?.terminate();
    conversion?.terminate();
    app.quit();
  });
}
