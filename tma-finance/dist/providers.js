export const providerCatalog = [
  {
    id: "shared",
    name: "Alpha Vantage - shared",
    provider: "alphavantage",
    source: "shared",
    jobs: ["quotes", "news", "search", "profile", "history"],
    limit: "25 calls/day shared by the key; service awaiting setup",
    type: "End-of-day quotes",
    history: "App: 5 years monthly; endpoint and symbol dependent",
    url: "https://www.alphavantage.co/support/",
  },
  {
    id: "alphavantage",
    name: "Alpha Vantage - personal key",
    provider: "alphavantage",
    source: "personal",
    jobs: ["quotes", "news", "search", "profile", "history"],
    limit: "Standard free: 25 calls/day per key",
    type: "End-of-day; real-time/delayed US quotes paid",
    history: "App: 5 years monthly; provider offers longer datasets",
    url: "https://www.alphavantage.co/documentation/",
  },
  {
    id: "finnhub",
    name: "Finnhub - personal key",
    provider: "finnhub",
    source: "personal",
    jobs: ["quotes", "news", "search", "profile", "history"],
    limit: "Plan dependent; app guard 30 calls/minute",
    type: "Quote delay and entitlement vary",
    history: "Daily candles where account permits; app requests 5 years",
    url: "https://finnhub.io/docs/api",
  },
  {
    id: "twelvedata",
    name: "Twelve Data - personal key",
    provider: "twelvedata",
    source: "personal",
    jobs: ["quotes"],
    limit: "Free Basic: 8 credits/minute, 800/day; endpoint weights vary",
    type: "Real-time/delayed/EOD varies by exchange and plan",
    history: "Provider and plan dependent; not connected in this adapter",
    url: "https://twelvedata.com/pricing",
  },
  {
    id: "fmp",
    name: "Financial Modeling Prep - personal key",
    provider: "fmp",
    source: "personal",
    jobs: ["quotes"],
    limit: "Free Basic: 250 calls/day; bandwidth and symbol limits",
    type: "Free limited EOD; quote permissions depend on plan",
    history: "Plan dependent; not connected in this adapter",
    url: "https://site.financialmodelingprep.com/developer/docs/pricing",
  },
  {
    id: "marketstack",
    name: "Marketstack - personal key",
    provider: "marketstack",
    source: "personal",
    jobs: ["quotes"],
    limit: "Free: 100 requests/month",
    type: "App: end-of-day quotes",
    history: "Free provider: 1 year; app quote adapter requests 2 closes",
    url: "https://marketstack.com/pricing/",
  },
  {
    id: "yahoo",
    name: "Yahoo Finance via yfinance - personal",
    provider: "yahoo",
    source: "personal",
    jobs: ["quotes", "news", "search", "profile", "history"],
    limit: "No published guaranteed allowance; throttling may occur",
    type: "Exchange-dependent delayed/live/EOD; timestamps shown",
    history: "App: up to 5 years daily; Yahoo availability varies",
    url: "https://github.com/ranaroussi/yfinance",
  },
];
export const jobLabels = {
  quotes: "Market quotes",
  news: "Market and company news",
  search: "Stock search",
  profile: "Company data and ratios",
  history: "Price history",
};
export const refreshOptions = [
  ["manual", "Manual only"],
  ["300", "Every 5 minutes"],
  ["900", "Every 15 minutes"],
  ["3600", "Every hour"],
  ["17280", "5 checks per day while open"],
  ["86400", "Every 24 hours"],
];
export function connection(id) {
  const c = providerCatalog.find((c) => c.id === id);
  if (!c) throw Error("Unknown market connection.");
  return c;
}
export function migrateProviders(settings) {
  const old =
    settings.marketSource === "personal"
      ? settings.provider || "alphavantage"
      : "shared";
  const base = providerCatalog.some((c) => c.id === old) ? old : "shared";
  settings.assignments ||= Object.fromEntries(
    Object.keys(jobLabels).map((job) => [
      job,
      connection(base).jobs.includes(job) ? base : "shared",
    ]),
  );
  settings.providerRefresh ||= {};
  for (const c of providerCatalog) {
    if (c.provider === "alphavantage") settings.providerRefresh[c.id] = "86400";
    else if (
      !refreshOptions.some(([v]) => v === settings.providerRefresh[c.id])
    )
      settings.providerRefresh[c.id] = "manual";
  }
  return settings;
}
export function validateProviderPreferences(settings) {
  if (!settings.assignments || !settings.providerRefresh)
    throw Error("Missing provider preferences.");
  for (const job of Object.keys(jobLabels))
    if (!connection(settings.assignments[job]).jobs.includes(job))
      throw Error("Provider does not support " + jobLabels[job] + ".");
  for (const c of providerCatalog) {
    const v = settings.providerRefresh[c.id];
    if (
      c.provider === "alphavantage"
        ? v !== "86400"
        : !refreshOptions.some(([id]) => id === v)
    )
      throw Error("Invalid provider refresh preference.");
  }
}
export function createProviderController({
  getSettings,
  transport,
  onTick,
  setTimer = setInterval,
  clearTimer = clearInterval,
}) {
  const statuses = new Map(),
    timers = new Map(),
    busy = new Set();
  function route(job) {
    const id = getSettings().assignments[job];
    if (!connection(id).jobs.includes(job))
      throw Error("Unsupported provider assignment.");
    return id;
  }
  function stop() {
    for (const timer of timers.values()) clearTimer(timer.handle);
    timers.clear();
  }
  function schedule() {
    const s = getSettings();
    validateProviderPreferences(s);
    const wanted = new Set();
    for (const c of providerCatalog) {
      if (!statuses.get(c.id)?.configured) continue;
      const jobs = ["quotes", "news"].filter((j) => s.assignments[j] === c.id);
      const refresh =
        c.provider === "alphavantage" ? "86400" : s.providerRefresh[c.id];
      if (!jobs.length || refresh === "manual") continue;
      wanted.add(c.id);
      const signature = refresh + ":" + jobs.join(","),
        existing = timers.get(c.id);
      if (existing?.signature === signature) continue;
      if (existing) clearTimer(existing.handle);
      const handle = setTimer(
        async () => {
          if (busy.has(c.id)) return;
          busy.add(c.id);
          try {
            await onTick(c.id, jobs);
          } finally {
            busy.delete(c.id);
          }
        },
        Number(refresh) * 1000,
      );
      timers.set(c.id, { handle, signature });
    }
    for (const [id, timer] of timers)
      if (!wanted.has(id)) {
        clearTimer(timer.handle);
        timers.delete(id);
      }
  }
  async function connect(id, key = "") {
    const c = connection(id);
    const status = await transport({
      action:
        id === "yahoo" || (c.source === "personal" && key)
          ? "connect"
          : "status",
      provider: c.provider,
      source: c.source,
      ...(c.source === "personal" && key ? { key } : {}),
    });
    statuses.set(id, status);
    schedule();
    return status;
  }
  async function disconnect(id) {
    const c = connection(id);
    await transport({
      action: "disconnect",
      provider: c.provider,
      source: c.source,
    });
    statuses.set(id, { configured: false });
    schedule();
  }
  async function restore() {
    await Promise.all(
      providerCatalog.map(async (c) => {
        try {
          statuses.set(
            c.id,
            await transport({
              action: "status",
              provider: c.provider,
              source: c.source,
            }),
          );
        } catch {
          statuses.set(c.id, { configured: false });
        }
      }),
    );
    schedule();
  }
  async function request(job, operation, params = {}, explicit) {
    const id = explicit || route(job),
      c = connection(id);
    if (!c.jobs.includes(job)) throw Error("Unsupported provider assignment.");
    if (!statuses.get(id)?.configured)
      throw Error("Connect " + c.name + " in Settings first.");
    return transport({
      action: "request",
      provider: c.provider,
      source: c.source,
      operation,
      params,
    });
  }
  return {
    route,
    connect,
    disconnect,
    restore,
    request,
    schedule,
    stop,
    status: (id) => statuses.get(id) || { configured: false },
  };
}
