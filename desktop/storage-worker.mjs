import { parentPort, workerData } from "node:worker_threads";
import { LibraryStore } from "./store.mjs";
let store;
try {
  store = new LibraryStore(workerData.directory);
} catch {
  parentPort.postMessage({
    fatal: true,
    error:
      "E100 · Workspace could not be opened. Existing files were retained. Check disk space, access and the recovery backup.",
  });
}
let queue = Promise.resolve();
parentPort.on("message", (request) => {
  queue = queue.then(async () => {
    try {
      if (!store) throw Error("E100 · Workspace unavailable.");
      let value;
      if (request.method === "legacy")
        value = store.migrate(Buffer.from(request.args));
      else if (request.method === "importArchive")
        value = await store.importArchive(Buffer.from(request.args));
      else if (request.method === "exportArchive")
        value = await store.exportArchive();
      else if (
        [
          "state",
          "get",
          "create",
          "save",
          "opened",
          "addFolder",
          "removeFolder",
          "trash",
          "restore",
          "purge",
          "emptyTrash",
          "history",
          "restoreRevision",
          "setSettings",
          "saveTemplate",
          "createFromTemplate",
        ].includes(request.method)
      )
        value = await store[request.method](request.args);
      else throw Error("Unsupported storage operation.");
      const mutation = !["state", "get", "history", "exportArchive"].includes(
        request.method,
      );
      const backup = mutation ? await store.backup() : true;
      parentPort.postMessage({
        requestId: request.requestId,
        value,
        backupWarning: !backup,
      });
    } catch (e) {
      parentPort.postMessage({
        requestId: request.requestId,
        error:
          {
            E101: e.message,
            E102: e.message,
            E104: e.message,
            E105: e.message,
            E106: e.message,
          }[e.code] ||
          "E103 · Operation failed. Check free disk space, folder access and file validity. Your last committed work was retained.",
      });
    }
  });
});
