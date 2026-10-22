const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  saveFile: (payload) => ipcRenderer.invoke("desktop:save-file", payload),
  openBackup: () => ipcRenderer.invoke("desktop:open-backup"),
  onExport: (callback) => ipcRenderer.on("desktop:export", () => callback()),
  onYahooTick: (callback) => ipcRenderer.on("desktop:yahoo-tick", (_event,data) => callback(data)),
  market: async (payload) => {
    const result = await ipcRenderer.invoke("desktop:market", payload);
    if (!result.ok) throw Error(result.error);
    return result.data;
  },
});
