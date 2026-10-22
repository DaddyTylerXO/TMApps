const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");
function createYahooClient({
  executable,
  args = [],
  cacheDir,
  spawnImpl = spawn,
} = {}) {
  let enabled = false,
    stream = null;
  const children = new Set();
  const usage = new Map();
  const cache = new Map(),
    pending = new Map();
  function status() {
    return {
      configured: enabled,
      available: !!executable && existsSync(executable),
      source: "personal",
      name: "Yahoo Finance via yfinance",
    };
  }
  function stop() {
    if (stream) {
      const previous = stream;
      stream = null;
      previous.kill();
    }
  }
  function call(operation, params = {}, onMessage) {
    return new Promise((resolve, reject) => {
      if (!status().available)
        return reject(
          Error("Yahoo helper is unavailable. Reinstall the desktop package."),
        );
      const child = spawnImpl(executable, args, {
        windowsHide: true,
        shell: false,
        env: { ...process.env, TMA_YAHOO_CACHE: cacheDir || "" },
        stdio: ["pipe", "pipe", "pipe"],
      });
      children.add(child);
      let output = "",
        done = false;
      const fail = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          child.kill();
          reject(
            Error(
              "Yahoo data is unavailable. Check coverage, internet access or throttling.",
            ),
          );
        }
      };
      const timer = setTimeout(fail, onMessage ? 3600000 : 45000);
      child.on("error", fail);
      child.stderr.on("data", () => {});
      child.stdout.on("data", (chunk) => {
        output += chunk.toString("utf8");
        if (output.length > 2000000) return fail();
        if (onMessage) {
          let i;
          while ((i = output.indexOf("\n")) >= 0) {
            const line = output.slice(0, i);
            output = output.slice(i + 1);
            try {
              const data = JSON.parse(line);
              if (data.error) return fail();
              onMessage(data);
            } catch {
              return fail();
            }
          }
        }
      });
      child.on("close", (code) => {
        children.delete(child);
        clearTimeout(timer);
        if (done) return;
        done = true;
        if (onMessage) {
          if (stream === child) {
            stream = null;
            reject(Error("Yahoo streaming ended."));
            return;
          }
          resolve();
          return;
        }
        try {
          const parsed = JSON.parse(output);
          if (code !== 0 || parsed.error) throw Error();
          resolve(parsed.data);
        } catch {
          reject(
            Error(
              "Yahoo returned no usable data. Check coverage or retry later.",
            ),
          );
        }
      });
      child.stdin.on("error", fail);
      child.stdin.end(JSON.stringify({ operation, params }) + "\n");
      if (onMessage) stream = child;
    });
  }
  async function connect() {
    if (!status().available)
      throw Error(
        "Yahoo helper is unavailable. Reinstall the desktop package.",
      );
    await call("status");
    enabled = true;
    return status();
  }
  function disconnect() {
    enabled = false;
    stop();
    for (const child of children) child.kill();
    return status();
  }
  async function request(operation, params = {}) {
    if (!enabled)
      throw Error("Enable Yahoo personal access in Settings first.");
    const supported = [
      "quote",
      "search",
      "stock/profile2",
      "stock/metric",
      "stock/candle",
      "news",
      "company-news",
      "batch",
      "download",
      "market",
      "sector",
      "industry",
      "screener",
      "financials",
      "actions",
    ];
    if (!supported.includes(operation))
      throw Error("Unsupported Yahoo request.");
    if (
      !params ||
      typeof params !== "object" ||
      Array.isArray(params) ||
      JSON.stringify(params).length > 1500
    )
      throw Error("Invalid Yahoo parameters.");
    const fields = {
      quote: ["symbol"],
      "stock/profile2": ["symbol"],
      "stock/metric": ["symbol"],
      "stock/candle": ["symbol"],
      "company-news": ["symbol"],
      search: ["q"],
      news: [],
      batch: ["symbols"],
      download: ["symbols"],
      market: ["region"],
      sector: ["key"],
      industry: ["key"],
      screener: ["minMarketCap", "maxPE"],
      financials: ["symbol"],
      actions: ["symbol"],
    }[operation];
    params = Object.fromEntries(
      fields.filter((k) => params[k] !== undefined).map((k) => [k, params[k]]),
    );
    const key = JSON.stringify([operation, params]),
      hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return structuredClone(hit.value);
    if (pending.has(key)) return structuredClone(await pending.get(key));
    const minute = Math.floor(Date.now() / 60000),
      used = usage.get(minute) || 0;
    if (used >= 10)
      throw Error("Yahoo local request budget reached. Wait a minute.");
    usage.set(minute, used + 1);
    const job = call(operation, params);
    pending.set(key, job);
    try {
      const value = await job;
      cache.set(key, { value, expires: Date.now() + 300000 });
      return structuredClone(value);
    } finally {
      pending.delete(key);
    }
  }
  function startStream(symbols, asyncMode, onMessage, onError) {
    if (!enabled) throw Error("Enable Yahoo personal access first.");
    if (
      !Array.isArray(symbols) ||
      !symbols.length ||
      symbols.length > 5 ||
      !symbols.every((s) => /^[A-Z0-9.-]{1,15}$/.test(s))
    )
      throw Error("Enter one to five valid tickers.");
    stop();
    const emitted = new Map();
    call(asyncMode ? "async-stream" : "stream", { symbols }, (data) => {
      if (
        symbols.includes(data.symbol) &&
        data.currency === "USD" &&
        Number.isFinite(data.price) &&
        data.price > 0
      ) {
        const stamp = Date.now();
        if (stamp - (emitted.get(data.symbol) || 0) < 1000) return;
        emitted.set(data.symbol, stamp);
        onMessage(data);
      }
    }).catch(() => onError("Yahoo streaming stopped. Retry later."));
    return { active: true };
  }
  return {
    status,
    connect,
    disconnect,
    request,
    startStream,
    stop,
    shutdown: disconnect,
  };
}
module.exports = { createYahooClient };
