const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  saveFile: (payload) => ipcRenderer.invoke("desktop:save-file", payload),
  openBackup: () => ipcRenderer.invoke("desktop:open-backup"),
  onExport: (callback) => ipcRenderer.on("desktop:export", () => callback()),
});
