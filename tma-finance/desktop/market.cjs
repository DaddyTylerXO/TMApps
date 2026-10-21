const { createHash } = require("node:crypto");
const providers = Object.freeze({
  twelvedata: {
    name: "Twelve Data",
    origin: "https://api.twelvedata.com/quote",
    variable: "TWELVE_DATA_API_KEY",
    quoteOnly: true,
  },
  fmp: {
    name: "Financial Modeling Prep",
    origin: "https://financialmodelingprep.com/stable/quote",
    variable: "FMP_API_KEY",
    quoteOnly: true,
  },
  marketstack: {
    name: "Marketstack",
    origin: "https://api.marketstack.com/v2/eod",
    variable: "MARKETSTACK_API_KEY",
    quoteOnly: true,
  },
  finnhub: {
    name: "Finnhub",
    origin: "https://finnhub.io/api/v1/",
    variable: "FINNHUB_API_KEY",
  },
  alphavantage: {
    name: "Alpha Vantage",
    origin: "https://www.alphavantage.co/query",
    variable: "ALPHAVANTAGE_API_KEY",
  },
});
const operations = new Set([
  "quote",
  "search",
  "stock/profile2",
  "stock/metric",
  "stock/candle",
  "news",
  "company-news",
]);
const number = (value) => {
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
};
function validate(provider, operation, params = {}) {
  if (!Object.hasOwn(providers, provider) || !operations.has(operation))
    throw Error("Unsupported market-data request.");
  if (providers[provider].quoteOnly && operation !== "quote")
    throw Error(
      providers[provider].name +
        " supports quotes only in TMA-Finance. Select Alpha Vantage or Finnhub for other datasets.",
    );
  if (!params || typeof params !== "object" || Array.isArray(params))
    throw Error("Invalid request parameters.");
  const symbol = String(params.symbol || "").toUpperCase();
  if (
    !["search", "news"].includes(operation) &&
    !/^[A-Z0-9.-]{1,15}$/.test(symbol)
  )
    throw Error("Enter a valid stock ticker.");
  if (
    operation === "search" &&
    (!String(params.q || "").trim() || String(params.q).length > 80)
  )
    throw Error("Enter a search of 1–80 characters.");
  return {
    symbol: operation === "search" || operation === "news" ? "" : symbol,
    q: operation === "search" ? String(params.q || "").trim() : "",
    from: ["stock/candle", "company-news"].includes(operation)
      ? params.from
      : undefined,
    to: ["stock/candle", "company-news"].includes(operation)
      ? params.to
      : undefined,
  };
}
function createMarketClient({
  fetchImpl = globalThis.fetch,
  env = process.env,
  now = Date.now,
} = {}) {
  const keys = new Map(),
    cache = new Map(),
    usage = new Map(),
    pending = new Map();
  const keyFor = (id) =>
    keys.has(id) ? keys.get(id) : env[providers[id]?.variable];
  function status(id) {
    if (!Object.hasOwn(providers, id)) throw Error("Unknown provider.");
    return {
      provider: id,
      name: providers[id].name,
      configured: !!keyFor(id),
      source: keys.has(id) ? "session" : "environment",
    };
  }
  function connect(id, key) {
    status(id);
    if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{8,256}$/.test(key))
      throw Error("Enter a valid API key, without spaces.");
    keys.set(id, key);
    return status(id);
  }
  function disconnect(id) {
    status(id);
    keys.set(id, null);
    return status(id);
  }
  async function performRequest(id, operation, params = {}) {
    const p = validate(id, operation, params),
      key = keyFor(id);
    if (!key)
      throw Error("Connect " + providers[id].name + " in Settings first.");
    const scope = createHash("sha256").update(key).digest("hex");
    const cacheId = JSON.stringify([id, scope, operation, p]);
    const hit = cache.get(cacheId);
    if (hit && hit.expires > now()) return structuredClone(hit.value);
    const stamp = ["alphavantage", "fmp"].includes(id)
      ? new Date(now()).toISOString().slice(0, 10)
      : id === "marketstack"
        ? new Date(now()).toISOString().slice(0, 7)
        : Math.floor(now() / 60000);
    const bucket = id + ":" + scope + ":" + stamp,
      count = usage.get(bucket) || 0,
      limit = {
        alphavantage: 25,
        fmp: 250,
        marketstack: 100,
        twelvedata: 8,
        finnhub: 30,
      }[id];
    if (count >= limit)
      throw Error(
        id === "alphavantage"
          ? "Alpha Vantage daily request budget reached. Try tomorrow."
          : providers[id].name +
              " local request budget reached. Wait for its budget window to reset.",
      );
    const url = new URL(providers[id].origin),
      headers = { Accept: "application/json" };
    if (providers[id].quoteOnly) {
      url.searchParams.set(id === "marketstack" ? "access_key" : "apikey", key);
      url.searchParams.set(
        id === "marketstack" ? "symbols" : "symbol",
        p.symbol,
      );
      if (id === "marketstack") {
        url.searchParams.set("limit", "2");
        url.searchParams.set("sort", "DESC");
      }
    } else if (id === "finnhub") {
      url.pathname += operation;
      headers["X-Finnhub-Token"] = key;
      if (p.symbol) url.searchParams.set("symbol", p.symbol);
      if (operation === "search") url.searchParams.set("q", p.q);
      if (operation === "stock/metric") url.searchParams.set("metric", "all");
      if (operation === "news") url.searchParams.set("category", "general");
      if (operation === "company-news") {
        for (const k of ["from", "to"]) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p[k])))
            throw Error("Invalid news date.");
          url.searchParams.set(k, p[k]);
        }
      }
      if (operation === "stock/candle") {
        url.searchParams.set("resolution", "D");
        for (const k of ["from", "to"]) {
          if (!Number.isSafeInteger(p[k]) || p[k] < 0)
            throw Error("Invalid history date.");
          url.searchParams.set(k, p[k]);
        }
      }
    } else {
      const functions = {
        quote: "GLOBAL_QUOTE",
        search: "SYMBOL_SEARCH",
        "stock/profile2": "OVERVIEW",
        "stock/metric": "OVERVIEW",
        "stock/candle": "TIME_SERIES_MONTHLY",
        news: "NEWS_SENTIMENT",
        "company-news": "NEWS_SENTIMENT",
      };
      url.searchParams.set("function", functions[operation]);
      url.searchParams.set("apikey", key);
      if (operation === "search") url.searchParams.set("keywords", p.q);
      else if (operation === "company-news")
        url.searchParams.set("tickers", p.symbol);
      else if (p.symbol) url.searchParams.set("symbol", p.symbol);
      if (operation.includes("news")) url.searchParams.set("limit", "30");
    }
    usage.set(bucket, count + 1);
    let response;
    try {
      response = await fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
    } catch {
      throw Error(
        "Unable to reach " +
          providers[id].name +
          ". Check your internet connection, firewall or proxy, then retry.",
      );
    }
    if (!response.ok)
      throw Error(
        response.status === 401
          ? "The provider rejected this API key."
          : response.status === 403
            ? "The key or account plan does not allow this data."
            : response.status === 429
              ? "Provider rate limit reached. Try later."
              : "Market provider returned HTTP " + response.status + ".",
      );
    let data;
    try {
      data = await response.json();
    } catch {
      throw Error("The provider returned an unreadable response.");
    }
    if (!data || typeof data !== "object")
      throw Error("The provider returned an invalid response.");
    // Never echo provider error bodies: they can include credentials or request URLs.
    if (data.error || data["Error Message"] || data.status === "error")
      throw Error(
        "The provider rejected the request. Check the API key, ticker and account permissions.",
      );
    if (data.Note || data.Information)
      throw Error(
        "Alpha Vantage has limited this request. Check your daily quota and the endpoint’s plan requirements.",
      );
    let value = data;
    if (providers[id].quoteOnly) {
      if (id === "twelvedata") {
        if (data.currency !== "USD")
          throw Error("This workspace supports USD stock quotes only.");
        value = {
          c: number(data.close),
          dp: number(data.percent_change),
          pc: number(data.previous_close),
          t: number(data.timestamp),
        };
      } else if (id === "fmp") {
        const q = Array.isArray(data)
          ? data.find((q) => q.symbol === p.symbol)
          : null;
        if (
          !q ||
          !["NASDAQ", "NYSE", "AMEX", "NYSEARCA", "BATS", "CBOE"].includes(
            q.exchange,
          )
        )
          throw Error(
            "No supported US exchange quote returned. Check the ticker and account plan.",
          );
        value = {
          c: number(q.price),
          dp: number(q.changePercentage),
          pc: number(q.previousClose),
          t: number(q.timestamp),
        };
      } else {
        const rows = (Array.isArray(data.data) ? data.data : [])
          .filter(
            (q) =>
              q.symbol === p.symbol &&
              ["XNAS", "XNYS", "XASE", "ARCX", "BATS", "IEXG"].includes(
                q.exchange,
              ),
          )
          .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        if (!rows.length)
          throw Error(
            "No supported US exchange quote returned. Check the ticker and plan.",
          );
        const current = number(rows[0].close),
          previous = number(rows[1]?.close);
        value = {
          c: current,
          pc: previous,
          dp: previous > 0 ? (current / previous - 1) * 100 : undefined,
          t: Date.parse(rows[0].date) / 1000,
          frequency: "daily",
        };
      }
      if (!(value.c > 0) || !Number.isFinite(value.dp))
        throw Error(
          "The provider did not return a complete USD quote with daily movement. Check coverage and plan.",
        );
    } else if (id === "alphavantage") {
      if (operation === "quote") {
        const q = data["Global Quote"];
        if (!q || !number(q["05. price"]))
          throw Error(
            "No quote returned. Check the ticker or provider coverage.",
          );
        value = {
          c: number(q["05. price"]),
          dp: number(q["10. change percent"]) || 0,
          pc: number(q["08. previous close"]),
          t: Date.parse(q["07. latest trading day"] + "T00:00:00Z") / 1000,
          frequency: "daily",
        };
      } else if (operation === "search")
        value = {
          result: (data.bestMatches || [])
            .filter((r) => r["8. currency"] === "USD")
            .map((r) => ({
              symbol: r["1. symbol"],
              description: r["2. name"],
            })),
        };
      else if (operation === "stock/profile2" || operation === "stock/metric") {
        if (!data.Symbol)
          throw Error("No company overview returned. Check provider coverage.");
        const metric = {
          roeTTM: number(data.ReturnOnEquityTTM) * 100,
          peTTM: number(data.PERatio),
          netProfitMarginTTM: number(data.ProfitMargin) * 100,
          revenueTTM: number(data.RevenueTTM),
          peg: number(data.PEGRatio),
          pb: number(data.PriceToBookRatio),
          roaTTM: number(data.ReturnOnAssetsTTM) * 100,
          "52WeekHigh": number(data["52WeekHigh"]),
          "52WeekLow": number(data["52WeekLow"]),
        };
        Object.keys(metric).forEach((k) => {
          if (!Number.isFinite(metric[k])) delete metric[k];
        });
        value = {
          name: data.Name,
          country: data.Country,
          currency: data.Currency,
          exchange: data.Exchange,
          finnhubIndustry: data.Sector,
          weburl: data.OfficialSite,
          metric,
        };
        const other =
          operation === "stock/profile2" ? "stock/metric" : "stock/profile2";
        cache.set(JSON.stringify([id, scope, other, p]), {
          value,
          expires: now() + 900000,
        });
      } else if (operation === "stock/candle") {
        const rows = Object.entries(data["Monthly Time Series"] || {})
          .filter(
            ([d, v]) =>
              Date.parse(d) >= now() - 86400000 * 366 * 5 &&
              number(v["4. close"]) > 0,
          )
          .sort((a, b) => a[0].localeCompare(b[0]));
        if (rows.length < 2) throw Error("No monthly price history returned.");
        value = {
          s: "ok",
          c: rows.map(([, v]) => number(v["4. close"])),
          t: rows.map(([d]) => Date.parse(d) / 1000),
          interval: "monthly",
        };
      } else
        value = (data.feed || []).map((n) => ({
          headline: n.title,
          summary: n.summary,
          source: n.source,
          url: n.url,
          datetime:
            Date.parse(
              String(n.time_published).replace(
                /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
                "$1-$2-$3T$4:$5:$6Z",
              ),
            ) / 1000,
        }));
    }
    cache.set(cacheId, {
      value,
      expires:
        now() +
        (id === "alphavantage"
          ? operation === "quote"
            ? 86400000
            : 900000
          : 60000),
    });
    return structuredClone(value);
  }
  async function request(id, operation, params = {}) {
    const p = validate(id, operation, params);
    const key = keyFor(id);
    if (!key)
      throw Error("Connect " + providers[id].name + " in Settings first.");
    const scope = createHash("sha256").update(key).digest("hex");
    const pendingId = JSON.stringify([id, scope, operation, p]);
    if (pending.has(pendingId))
      return structuredClone(await pending.get(pendingId));
    const job = performRequest(id, operation, p);
    pending.set(pendingId, job);
    try {
      return structuredClone(await job);
    } finally {
      pending.delete(pendingId);
    }
  }
  return { status, connect, disconnect, request };
}
module.exports = { createMarketClient, validate, providers };
