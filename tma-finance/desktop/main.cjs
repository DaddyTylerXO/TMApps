const {
  app,
  nativeTheme,
  BrowserWindow,
  Menu,
  protocol,
  net,
  ipcMain,
  dialog,
  shell,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { writeFile, readFile } = require("node:fs/promises");
const { createMarketClient } = require("./market.cjs");
const market = createMarketClient();
const { sharedMarket } = require("./shared-market.cjs");
app.setName("TMA-Finance");
nativeTheme.themeSource = "dark";
// Separate storage for a disposable QA run, never touching the personal profile.
if (process.env.TMA_TEST_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.TMA_TEST_DATA_DIR));
protocol.registerSchemesAsPrivileged([
  {
    scheme: "tma",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let win;
const root = path.resolve(__dirname, "../dist");
const trusted = (e) =>
  e.sender === win?.webContents &&
  e.senderFrame === win.webContents.mainFrame &&
  e.senderFrame.url.startsWith("tma://app/");
function external(url) {
  try {
    if (new URL(url).protocol === "https:") shell.openExternal(url);
  } catch {}
}
app.whenReady().then(() => {
  protocol.handle("tma", (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== "app") return new Response("Not found", { status: 404 });
      const target = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (!target.startsWith(root + path.sep))
        return new Response("Forbidden", { status: 403 });
      return net.fetch(pathToFileURL(target).href);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  win = new BrowserWindow({
    icon: path.join(root, "assets/icon.png"),
    width: 1440,
    height: 1000,
    minWidth: 390,
    minHeight: 600,
    title: "TMA-Finance",
    backgroundColor: "#102c21",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  win.webContents.setWindowOpenHandler(({ url }) => {
    external(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("tma://app/")) {
      event.preventDefault();
      external(url);
    }
  });
  win.once("ready-to-show", () => win.show());
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [
          {
            label: "Export finance CSV",
            accelerator: "CmdOrCtrl+E",
            click: () => win.webContents.send("desktop:export"),
          },
          { type: "separator" },
          { role: "quit" },
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
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { role: "togglefullscreen" },
        ],
      },
    ]),
  );
  ipcMain.handle("desktop:save-file", async (event, payload) => {
    if (!trusted(event)) throw Error("Untrusted request");
    if (
      !payload ||
      typeof payload.data !== "string" ||
      payload.data.length > 10000000
    )
      throw Error("Invalid export");
    const ext = payload.name?.endsWith(".csv") ? "csv" : "json",
      name = path.basename(String(payload.name || "tma-backup.json"));
    const result = await dialog.showSaveDialog(win, {
      title: "Export TMA-Finance data",
      defaultPath: name,
      filters: [
        {
          name: ext === "csv" ? "CSV spreadsheet" : "JSON backup",
          extensions: [ext],
        },
      ],
    });
    if (result.canceled) return false;
    await writeFile(result.filePath, payload.data, "utf8");
    return true;
  });
  ipcMain.handle("desktop:market", async (event, payload) => {
    if (!trusted(event))
      return { ok: false, error: "Untrusted market request." };
    try {
      if (!payload || JSON.stringify(payload).length > 2000)
        throw Error("Invalid market request.");
      let data;
      if (payload.source === "shared") data = sharedMarket(payload);
      else if (payload.action === "status")
        data = market.status(payload.provider);
      else if (payload.action === "connect")
        data = market.connect(payload.provider, payload.key);
      else if (payload.action === "disconnect")
        data = market.disconnect(payload.provider);
      else if (payload.action === "request")
        data = await market.request(
          payload.provider,
          payload.operation,
          payload.params,
        );
      else throw Error("Unknown market action.");
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("desktop:open-backup", async (event) => {
    if (!trusted(event)) throw Error("Untrusted request");
    const result = await dialog.showOpenDialog(win, {
      title: "Import TMA-Finance backup",
      properties: ["openFile"],
      filters: [{ name: "TMA-Finance JSON backup", extensions: ["json"] }],
    });
    if (result.canceled) return null;
    const { stat } = require("node:fs/promises");
    if ((await stat(result.filePaths[0])).size > 5000000)
      throw Error("Backup is larger than 5 MB");
    return readFile(result.filePaths[0], "utf8");
  });
  win.loadURL("tma://app/index.html");
});
app.on("window-all-closed", () => app.quit());
