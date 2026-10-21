import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const electron = require("electron");
const r = spawnSync(
  electron,
  ["--test", "tests/storage.test.mjs", "tests/formats.test.mjs"],
  {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    windowsHide: true,
  },
);
process.exit(r.status ?? 1);
