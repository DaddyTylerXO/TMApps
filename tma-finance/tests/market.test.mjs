import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { createMarketClient } = createRequire(import.meta.url)(
  "../desktop/market.cjs",
);
const fake = "example-test-credential";
const response = (data, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => data,
});
test("desktop transport keeps session keys out of status and validates operations", async () => {
  let calls = 0;
  const client = createMarketClient({
    env: {},
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url.origin, "https://finnhub.io");
      assert.equal(init.headers["X-Finnhub-Token"], fake);
      assert.equal(url.searchParams.has("token"), false);
      return response({ c: 100, dp: 1 });
    },
  });
  assert.equal(client.connect("finnhub", fake).configured, true);
  assert.equal(JSON.stringify(client.status("finnhub")).includes(fake), false);
  await assert.rejects(
    client.request("finnhub", "https://example.com", { symbol: "AAPL" }),
    /Unsupported/,
  );
  await assert.rejects(
    client.request("finnhub", "quote", { symbol: "../../escape" }),
    /ticker/,
  );
  await assert.rejects(
    client.request("__proto__", "quote", { symbol: "AAPL" }),
    /Unsupported/,
  );
  assert.equal(calls, 0);
  await client.request("finnhub", "quote", { symbol: "AAPL" });
  await client.request("finnhub", "quote", { symbol: "AAPL" });
  assert.equal(calls, 1, "cached refresh avoids another provider request");
  client.disconnect("finnhub");
  assert.equal(client.status("finnhub").configured, false);
  await assert.rejects(
    client.request("finnhub", "quote", { symbol: "AAPL" }),
    /Connect/,
  );
});
test("Alpha Vantage normalises daily quotes and caps the local daily request budget", async () => {
  let calls = 0;
  const client = createMarketClient({
    env: { ALPHAVANTAGE_API_KEY: fake },
    fetchImpl: async (url) => {
      calls++;
      assert.equal(url.origin, "https://www.alphavantage.co");
      assert.equal(url.searchParams.get("function"), "GLOBAL_QUOTE");
      return response({
        "Global Quote": {
          "05. price": "123.45",
          "10. change percent": "-1.2%",
          "08. previous close": "125",
          "07. latest trading day": "2026-10-20",
        },
      });
    },
  });
  const q = await client.request("alphavantage", "quote", { symbol: "IBM" });
  assert.equal(q.c, 123.45);
  assert.equal(q.dp, -1.2);
  assert.equal(q.frequency, "daily");
  for (let i = 0; i < 24; i++)
    await client.request("alphavantage", "quote", { symbol: "TEST" + i });
  await assert.rejects(
    client.request("alphavantage", "quote", { symbol: "LIMIT" }),
    /daily request budget/,
  );
  assert.equal(calls, 25);
});
test("profile and metrics reuse one Alpha Vantage overview response", async () => {
  let calls = 0;
  const client = createMarketClient({
    env: { ALPHAVANTAGE_API_KEY: fake },
    fetchImpl: async () => {
      calls++;
      return response({
        Symbol: "IBM",
        Name: "Example company",
        Currency: "USD",
        ReturnOnEquityTTM: "0.2",
        PERatio: "15",
        ProfitMargin: "0.1",
      });
    },
  });
  const p = await client.request("alphavantage", "stock/profile2", {
    symbol: "IBM",
  });
  const m = await client.request("alphavantage", "stock/metric", {
    symbol: "IBM",
    metric: "all",
  });
  assert.equal(p.name, "Example company");
  assert.equal(m.metric.roeTTM, 20);
  assert.equal(m.metric.peTTM, 15);
  assert.equal(calls, 1);
});
test("network and provider errors never echo credentials or response bodies", async () => {
  const make = (fetchImpl) =>
    createMarketClient({
      env: { FINNHUB_API_KEY: fake, ALPHAVANTAGE_API_KEY: fake },
      fetchImpl,
    });
  const network = make(async () => {
    throw Error("https://example.com?apikey=" + fake);
  });
  await assert.rejects(
    network.request("finnhub", "quote", { symbol: "IBM" }),
    (e) => e.message.includes("Unable to reach") && !e.message.includes(fake),
  );
  const forbidden = make(async () => response({}, 403));
  await assert.rejects(
    forbidden.request("finnhub", "quote", { symbol: "IBM" }),
    /account plan/,
  );
  const error = make(async () => response({ error: fake }));
  await assert.rejects(
    error.request("finnhub", "quote", { symbol: "IBM" }),
    (e) => !e.message.includes(fake),
  );
  const quota = make(async () =>
    response({ Information: "Daily limit " + fake }),
  );
  await assert.rejects(
    quota.request("alphavantage", "quote", { symbol: "IBM" }),
    (e) => e.message.includes("limited") && !e.message.includes(fake),
  );
});
test("environment presets expose configuration status without exposing the key", () => {
  const client = createMarketClient({ env: { FINNHUB_API_KEY: fake } });
  assert.deepEqual(client.status("finnhub"), {
    provider: "finnhub",
    name: "Finnhub",
    configured: true,
    source: "environment",
  });
});

test("prepared backend rejects missing configuration and unauthenticated callers", async () => {
  const { createMarketHandler } = createRequire(import.meta.url)(
    "../backend/market-handler.cjs",
  );
  const request = () =>
    new Request("https://example.invalid/market", {
      method: "POST",
      body: JSON.stringify({
        provider: "finnhub",
        operation: "quote",
        params: { symbol: "IBM" },
      }),
    });
  const disabled = createMarketHandler();
  assert.equal((await disabled(request())).status, 503);
  let calls = 0;
  const client = {
    request: async () => {
      calls++;
      return { c: 100 };
    },
  };
  const denied = createMarketHandler({ authorize: async () => null, client });
  assert.equal((await denied(request())).status, 401);
  assert.equal(calls, 0);
  const allowed = createMarketHandler({
    authorize: async () => ({ userId: "synthetic-user" }),
    client,
  });
  assert.equal((await allowed(request())).status, 200);
  assert.equal(calls, 1);
});

test("Alpha quote lock survives reconnects and expires after 24 hours", async () => {
  let timestamp = Date.parse("2026-10-21T10:00:00Z"),
    calls = 0;
  const client = createMarketClient({
    env: {},
    now: () => timestamp,
    fetchImpl: async () => {
      calls++;
      return response({
        "Global Quote": {
          "05. price": String(calls),
          "07. latest trading day": "2026-10-20",
        },
      });
    },
  });
  client.connect("alphavantage", fake);
  await client.request("alphavantage", "quote", { symbol: "IBM" });
  timestamp += 86400000 - 1;
  client.disconnect("alphavantage");
  client.connect("alphavantage", fake);
  assert.equal(
    (await client.request("alphavantage", "quote", { symbol: "IBM" })).c,
    1,
  );
  assert.equal(calls, 1);
  timestamp++;
  assert.equal(
    (await client.request("alphavantage", "quote", { symbol: "IBM" })).c,
    2,
  );
  assert.equal(calls, 2);
  client.connect("alphavantage", "another-example-credential");
  assert.equal(
    (await client.request("alphavantage", "quote", { symbol: "IBM" })).c,
    3,
    "different keys do not share cached responses",
  );
});
