const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "libraries",
  Object.freeze({
    invoke: (method, args) =>
      ipcRenderer.invoke("libraries:invoke", method, args),
    onCommand: (callback) => {
      const handler = (_e, command) => callback(command);
      ipcRenderer.on("libraries:command", handler);
      return () => ipcRenderer.removeListener("libraries:command", handler);
    },
  }),
);
