import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const files = (await readdir(new URL("release/", root))).filter((n) =>
  /\.(exe|zip)$/.test(n),
);
const artifacts = [];
for (const name of files) {
  const bytes = await readFile(new URL("release/" + name, root));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(
    new URL("release/" + name + ".sha256", root),
    sha256 + "  " + name + "\n",
  );
  artifacts.push({ file: name, sha256, bytes: bytes.length });
}
await writeFile(
  new URL("release/launcher-handoff.json", root),
  JSON.stringify(
    {
      name: "TMA-Finance",
      id: "tma-finance",
      version: pkg.version,
      sourceBranch: "TMA-Finance",
      source: "https://github.com/DaddyTylerXO/TMApps/tree/TMA-Finance",
      status: "development-not-catalog-ready",
      colour: "#163A2B",
      icon: "dist/assets/icon.svg",
      executable: "TMA-Finance.exe",
      platform: "windows-x64",
      artifacts,
      note: "Set verified release URLs and source update date only after release acceptance. No macOS/Linux support is claimed.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Generated checksums for " + artifacts.length + " Windows artifacts.",
);
