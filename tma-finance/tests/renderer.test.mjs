import * as providerModule from "../dist/providers.js";
import * as infoModule from "../dist/api-info.js";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import * as core from "../dist/core.js";
import { kbArticles } from "../dist/kb.js";

test("renderer starts, exposes provider guides and rejects shared refresh clicks without upstream calls", async () => {
  const events = new Map(),
    calls = [];
  const element = () => ({
    innerHTML: "",
    textContent: "",
    classList: { add() {}, remove() {} },
    addEventListener() {},
  });
  const app = element(),
    modal = element(),
    toast = element();
  const source = (
    await readFile(new URL("../dist/app.js", import.meta.url), "utf8")
  )
    .replace(/^import[\s\S]*?from "\.\/kb\.js";\s*/, "")
    .replace(/^import[\s\S]*?from "\.\/core\.js";\s*/, "");
  const context = vm.createContext({
    ...core,
    ...providerModule,
    ...infoModule,
    kbArticles,
    console,
    Date,
    Intl,
    URL,
    structuredClone,
    location: { hash: "" },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    setInterval() {
      throw Error("Disconnected shared access must not poll");
    },
    clearInterval() {},
    document: {
      querySelector: (s) =>
        ({ "#app": app, "#modal": modal, "#toast": toast })[s] || null,
      addEventListener: (name, fn) => events.set(name, fn),
    },
    window: {
      addEventListener() {},
      scrollTo() {},
      desktop: {
        onExport() {},
        market: async (payload) => {
          calls.push(payload);
          return { configured: false, source: "shared" };
        },
      },
    },
  });
  vm.runInContext(source, context, { timeout: 1000 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.innerHTML, /Help and KB Library/);
  const click = async (dataset) =>
    events.get("click")({ target: { closest: () => ({ dataset }) } });
  await click({ action: "nav", page: "settings" });
  assert.match(app.innerHTML, /Every 24 hours \(locked\)/);
  assert.match(app.innerHTML, /value="Every 24 hours \(locked\)" disabled/);
  for (const label of [
    "Alpha Vantage - shared",
    "Alpha Vantage - personal key",
    "Finnhub - personal key",
    "Twelve Data - personal key",
    "Financial Modeling Prep - personal key",
    "Marketstack - personal key",
  ])
    assert.ok(app.innerHTML.includes(label));
  for (let i = 0; i < 25; i++) await click({ action: "refresh" });
  assert.equal(calls.filter((c) => c.action === "request").length, 0);
  await click({ action: "nav", page: "help" });
  assert.match(app.innerHTML, /Finance-KB8/);
  await click({ action: "kb-open", id: "Finance-KB4" });
  assert.match(app.innerHTML, /Advantages/);
  assert.match(app.innerHTML, /25 upstream requests per day/);
  await click({ action: "kb-index" });
  assert.match(app.innerHTML, /Find a guide/);
});
