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
        provider: "alphavantage",
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
    enforcePolicy: async (_request, upstream) => upstream(),
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

test("concurrent and cache-busting quote requests cannot bypass the Alpha lock", async () => {
  let calls = 0,
    release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const client = createMarketClient({
    env: { ALPHAVANTAGE_API_KEY: fake },
    fetchImpl: async () => {
      calls++;
      await wait;
      return response({
        "Global Quote": {
          "05. price": "123",
          "07. latest trading day": "2026-10-20",
        },
      });
    },
  });
  const requests = Array.from({ length: 25 }, (_, i) =>
    client.request("alphavantage", "quote", {
      symbol: i % 2 ? "ibm" : "IBM",
      q: String(i),
      from: i,
      to: i + 1,
      refresh: i,
      force: true,
    }),
  );
  assert.equal(
    calls,
    1,
    "all concurrent requests share a single in-flight fetch",
  );
  release();
  const values = await Promise.all(requests);
  values[0].c = 999;
  assert.equal(values[1].c, 123, "callers cannot mutate another response");
  await client.request("alphavantage", "quote", {
    symbol: "IBM",
    q: "different",
    from: 999,
    to: 1000,
  });
  assert.equal(
    calls,
    1,
    "irrelevant parameters cannot create a new quote cache entry",
  );
});

test("shared desktop route rejects refresh and key injection while awaiting setup", () => {
  const { sharedMarket } = createRequire(import.meta.url)(
    "../desktop/shared-market.cjs",
  );
  for (let i = 0; i < 25; i++)
    assert.throws(
      () =>
        sharedMarket({
          provider: "alphavantage",
          action: "request",
          params: { symbol: "IBM", force: true, refresh: 1 },
        }),
      /awaiting backend/,
    );
  assert.throws(
    () =>
      sharedMarket({ provider: "alphavantage", action: "connect", key: fake }),
    /does not accept/,
  );
  assert.throws(
    () => sharedMarket({ provider: "finnhub", action: "status" }),
    /Alpha Vantage only/,
  );
  assert.equal(
    sharedMarket({ provider: "alphavantage", action: "disconnect" }).configured,
    false,
  );
  assert.equal(
    sharedMarket({ provider: "alphavantage", action: "status" }).configured,
    false,
  );
});

test("shared backend fails closed without a central policy and cannot bypass a policy rejection", async () => {
  const { createMarketHandler } = createRequire(import.meta.url)(
    "../backend/market-handler.cjs",
  );
  let calls = 0;
  const client = {
    request: async () => {
      calls++;
      return { c: 123 };
    },
  };
  const request = () =>
    new Request("https://example.invalid/market", {
      method: "POST",
      body: JSON.stringify({
        provider: "alphavantage",
        operation: "quote",
        params: { symbol: "ibm", force: true, from: 123 },
      }),
    });
  const authorize = async () => ({ userId: "synthetic-user" });
  const missing = createMarketHandler({ authorize, client });
  assert.equal((await missing(request())).status, 503);
  assert.equal(calls, 0);
  const blocked = createMarketHandler({
    authorize,
    client,
    enforcePolicy: async (input) => {
      assert.deepEqual(input.params, {
        symbol: "IBM",
        q: "",
        from: undefined,
        to: undefined,
      });
      throw Error("refresh locked");
    },
  });
  for (let i = 0; i < 25; i++)
    assert.equal((await blocked(request())).status, 400);
  assert.equal(
    calls,
    0,
    "a rejected central policy never invokes the provider",
  );
});

for (const [id, host, path, body, price, change] of [
  [
    "twelvedata",
    "api.twelvedata.com",
    "/quote",
    {
      symbol: "IBM",
      currency: "USD",
      close: "105",
      previous_close: "100",
      percent_change: "5",
      timestamp: 1792497600,
    },
    105,
    5,
  ],
  [
    "fmp",
    "financialmodelingprep.com",
    "/stable/quote",
    [
      {
        symbol: "IBM",
        exchange: "NYSE",
        price: 105,
        previousClose: 100,
        changePercentage: 5,
        timestamp: 1792497600,
      },
    ],
    105,
    5,
  ],
  [
    "marketstack",
    "api.marketstack.com",
    "/v2/eod",
    {
      data: [
        {
          symbol: "IBM",
          exchange: "XNYS",
          close: 100,
          date: "2026-10-19T00:00:00Z",
        },
        {
          symbol: "IBM",
          exchange: "XNYS",
          close: 105,
          date: "2026-10-20T00:00:00Z",
        },
      ],
    },
    105,
    5,
  ],
])
  test(
    id +
      " personal quote uses fixed HTTPS host, normalizes data and rejects unsupported features",
    async () => {
      let calls = 0;
      const client = createMarketClient({
        env: {},
        fetchImpl: async (url) => {
          calls++;
          assert.equal(url.protocol, "https:");
          assert.equal(url.hostname, host);
          assert.equal(url.pathname, path);
          assert.equal(
            url.searchParams.get(
              id === "marketstack" ? "access_key" : "apikey",
            ),
            fake,
          );
          if (id === "marketstack")
            assert.equal(url.searchParams.get("limit"), "2");
          return response(body);
        },
      });
      client.connect(id, fake);
      const value = await client.request(id, "quote", { symbol: "IBM" });
      assert.equal(value.c, price);
      assert.ok(Math.abs(value.dp - change) < 0.00001);
      await client.request(id, "quote", { symbol: "ibm", force: true });
      assert.equal(calls, 1);
      await assert.rejects(client.request(id, "news"), /quotes only/);
      assert.equal(calls, 1);
      assert.equal(JSON.stringify(client.status(id)).includes(fake), false);
      client.disconnect(id);
      await assert.rejects(
        client.request(id, "quote", { symbol: "IBM" }),
        /Connect/,
      );
    },
  );

test("personal providers reject foreign currency, malformed quotes and provider errors without leaking bodies", async () => {
  for (const [id, body] of [
    ["twelvedata", { currency: "GBP", close: "100", percent_change: "1" }],
    ["twelvedata", { status: "error", message: fake }],
    [
      "fmp",
      [{ symbol: "IBM", exchange: "LSE", price: 100, changePercentage: 1 }],
    ],
    ["fmp", []],
    ["marketstack", { error: { info: fake } }],
    [
      "marketstack",
      {
        data: [
          { symbol: "IBM", exchange: "XNYS", close: 100, date: "2026-10-20" },
        ],
      },
    ],
  ]) {
    const client = createMarketClient({
      env: {},
      fetchImpl: async () => response(body),
    });
    client.connect(id, fake);
    await assert.rejects(
      client.request(id, "quote", { symbol: "IBM" }),
      (e) => !e.message.includes(fake),
    );
  }
});
