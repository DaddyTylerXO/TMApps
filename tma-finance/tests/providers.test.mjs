import test from "node:test";
import assert from "node:assert/strict";
import {
  migrateProviders,
  validateProviderPreferences,
  createProviderController,
} from "../dist/providers.js";
test("independent connections route each job to exactly one provider", async () => {
  const settings = migrateProviders({}),
    calls = [],
    timers = new Map(),
    ticks = [];
  settings.assignments.quotes = "finnhub";
  settings.assignments.news = "alphavantage";
  settings.providerRefresh.finnhub = "300";
  const controller = createProviderController({
    getSettings: () => settings,
    transport: async (p) => {
      calls.push(p);
      return p.action === "request"
        ? { ok: true }
        : { configured: p.action !== "disconnect" };
    },
    onTick: async (id, jobs) => ticks.push({ id, jobs }),
    setTimer: (fn, ms) => {
      const id = Symbol();
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  await controller.connect("finnhub", "example-finnhub-key");
  const firstTimer = [...timers.keys()][0];
  await controller.connect("alphavantage", "example-alpha-key");
  assert.ok(
    timers.has(firstTimer),
    "connecting another provider must not reset the first timer",
  );
  assert.equal(controller.status("finnhub").configured, true);
  assert.equal(controller.status("alphavantage").configured, true);
  assert.equal(calls.filter((c) => c.action === "request").length, 0);
  assert.deepEqual(
    [...timers.values()].map((t) => t.ms).sort((a, b) => a - b),
    [300000, 86400000],
  );
  await [...timers.values()].find((t) => t.ms === 300000).fn();
  assert.deepEqual(ticks, [{ id: "finnhub", jobs: ["quotes"] }]);
  await controller.request("news", "news");
  await controller.request("quotes", "quote", { symbol: "IBM" });
  assert.deepEqual(
    calls.filter((c) => c.action === "request").map((c) => c.provider),
    ["alphavantage", "finnhub"],
  );
  await controller.disconnect("finnhub");
  assert.equal(controller.status("alphavantage").configured, true);
  const before = calls.length;
  await assert.rejects(
    controller.request("quotes", "quote", { symbol: "IBM" }),
    /Connect/,
  );
  assert.equal(calls.length, before);
  controller.stop();
  assert.equal(timers.size, 0);
});
test("invalid job assignments and fast Alpha schedules fail closed", () => {
  const s = migrateProviders({
    marketSource: "personal",
    provider: "twelvedata",
  });
  assert.equal(s.assignments.quotes, "twelvedata");
  assert.equal(s.assignments.news, "shared");
  s.assignments.news = "marketstack";
  assert.throws(() => validateProviderPreferences(s), /does not support/);
  s.assignments.news = "shared";
  s.providerRefresh.shared = "300";
  assert.throws(() => validateProviderPreferences(s), /refresh/);
  migrateProviders(s);
  assert.equal(s.providerRefresh.shared, "86400");
});
test("a busy provider never blocks another provider timer", async () => {
  const s = migrateProviders({}),
    timers = [],
    ticks = [];
  let finish;
  s.assignments.quotes = "finnhub";
  s.assignments.news = "yahoo";
  s.providerRefresh.finnhub = "300";
  s.providerRefresh.yahoo = "900";
  const controller = createProviderController({
    getSettings: () => s,
    transport: async () => ({ configured: true }),
    setTimer: (fn, ms) => {
      const t = { fn, ms };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      const i = timers.indexOf(t);
      if (i >= 0) timers.splice(i, 1);
    },
    onTick: async (id) => {
      ticks.push(id);
      if (id === "finnhub") await new Promise((resolve) => (finish = resolve));
    },
  });
  await controller.connect("finnhub", "example-credential");
  await controller.connect("yahoo");
  const a = timers.find((t) => t.ms === 300000),
    b = timers.find((t) => t.ms === 900000);
  const running = a.fn();
  await a.fn();
  await b.fn();
  assert.deepEqual(ticks, ["finnhub", "yahoo"]);
  finish();
  await running;
  controller.stop();
});
