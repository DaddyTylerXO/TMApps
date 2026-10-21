import { parentPort } from "node:worker_threads";
import * as formats from "./formats.mjs";
let queue = Promise.resolve();
parentPort.on("message", (r) => {
  queue = queue.then(async () => {
    try {
      if (
        !["makeDocx", "importFile", "exportFile", "pdfOperation"].includes(
          r.method,
        )
      )
        throw Error("Unsupported format operation.");
      const value = await formats[r.method](r.args);
      parentPort.postMessage({ requestId: r.requestId, value });
    } catch (e) {
      parentPort.postMessage({
        requestId: r.requestId,
        error: e.message?.startsWith("E102")
          ? e.message
          : "E102 · Document processing failed. Keep the original file and review supported-format limits.",
      });
    }
  });
});
