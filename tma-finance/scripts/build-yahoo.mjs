import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
function run(command, args) {
  const r = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    shell: false,
  });
  if (r.status !== 0) throw Error("Yahoo helper build failed.");
}
const venv = path.join(root, ".cache/yahoo-build-env");
let basePython = "python";
if (process.env.RUNNER_TOOL_CACHE) {
  const folder = path.join(process.env.RUNNER_TOOL_CACHE, "Python");
  if (existsSync(folder)) {
    const version = readdirSync(folder)
      .filter((v) => v.startsWith("3.13."))
      .sort()
      .at(-1);
    const candidate =
      version && path.join(folder, version, "x64", "python.exe");
    if (candidate && existsSync(candidate)) basePython = candidate;
  }
}
if (!existsSync(path.join(venv, "Scripts/python.exe")))
  run(basePython, ["-m", "venv", venv]);
const python = path.join(venv, "Scripts/python.exe");
run(python, [
  "-m",
  "pip",
  "install",
  "--disable-pip-version-check",
  "-r",
  "yahoo/requirements.txt",
]);
run(python, [
  "-m",
  "PyInstaller",
  "--noconfirm",
  "--clean",
  "--onedir",
  "--name",
  "tma-yahoo",
  "--distpath",
  ".cache/yahoo-runtime",
  "--workpath",
  ".cache/yahoo-work",
  "--specpath",
  ".cache",
  "--collect-all",
  "yfinance",
  "--collect-all",
  "curl_cffi",
  "--collect-all",
  "websockets",
  "--exclude-module",
  "tkinter",
  "--exclude-module",
  "matplotlib",
  "yahoo/worker.py",
]);
run(python, [
  "scripts/yahoo-notices.py",
  path.join(root, ".cache/yahoo-runtime/tma-yahoo/licenses"),
]);
console.log(
  "Built bundled local Yahoo helper. No shared credentials or external Python installation are included or required.",
);
