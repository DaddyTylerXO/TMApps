export const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const monthly = (s) =>
  s.active === false
    ? 0
    : s.cost / ({ Monthly: 1, Quarterly: 3, Yearly: 12 }[s.cycle] || 1);
export const dateISO = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function monthStats(state, month) {
  const budget = state.budgets[month] || { income: 0, limit: 0 };
  const transactions = state.transactions.filter((t) =>
    t.date.startsWith(month),
  );
  const subs = state.subscriptions.filter(
    (s) =>
      s.start.slice(0, 7) <= month && (!s.end || s.end.slice(0, 7) >= month),
  );
  const recurring = subs.reduce((a, s) => a + monthly(s), 0);
  const expenses = transactions.reduce((a, t) => a + t.amount, 0) + recurring;
  return {
    ...budget,
    transactions,
    recurring,
    expenses,
    remaining: budget.limit - expenses,
    cashRemaining: budget.income - expenses,
  };
}
export function goalStats(g, today = dateISO()) {
  const remaining = Math.max(0, g.target - g.saved);
  const days = Math.ceil(
    (Date.parse(g.deadline + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) /
      86400000,
  );
  return {
    remaining,
    days,
    daily: days > 0 ? remaining / days : null,
    percent: Math.min(100, (g.saved / g.target) * 100),
  };
}
export function taxEstimate(revenue, expenses, region = "rest") {
  const profit = Math.max(0, revenue - expenses);
  const allowance = Math.max(0, 12570 - Math.max(0, profit - 100000) / 2);
  let taxable = Math.max(0, profit - allowance),
    previous = 0,
    tax = 0;
  const bands =
    region === "scotland"
      ? [
          [3967, 0.19],
          [16956, 0.2],
          [31092, 0.21],
          [62430, 0.42],
          [125140, 0.45],
          [Infinity, 0.48],
        ]
      : [
          [37700, 0.2],
          [125140, 0.4],
          [Infinity, 0.45],
        ];
  for (const [upper, rate] of bands) {
    const ceiling =
      upper === Infinity
        ? Infinity
        : upper === 125140
          ? upper - allowance
          : upper;
    const portion = Math.min(taxable, Math.max(0, ceiling - previous));
    tax += portion * rate;
    taxable -= portion;
    previous = ceiling;
  }
  const ni =
    Math.max(0, Math.min(profit, 50270) - 12570) * 0.06 +
    Math.max(0, profit - 50270) * 0.02;
  return {
    profit,
    allowance,
    tax: round(tax),
    ni: round(ni),
    total: round(tax + ni),
    takeHome: round(profit - tax - ni),
  };
}
export const csv = (rows) =>
  "\uFEFF" +
  rows
    .map((row) =>
      row
        .map((v) => {
          let s = String(v ?? "");
          if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
export function emptyState() {
  return {
    version: 1,
    budgets: {},
    transactions: [],
    subscriptions: [],
    goals: [],
    holdings: [],
    watchlist: [],
    quotes: {},
    widgets: ["cashflow", "categories", "goals", "subscriptions"],
    investmentWidgets: [],
    alerts: [],
    notifications: [],
    settings: { refresh: "manual", monthlyInsights: true, crashPercent: 5 },
  };
}
export const companies = [
  ["AAPL", "Apple", "Technology", 218.32, 1.28],
  ["MSFT", "Microsoft", "Technology", 427.18, 0.84],
  ["NVDA", "NVIDIA", "Technology", 136.42, 2.67],
  ["AMZN", "Amazon", "Consumer", 192.73, -0.62],
  ["GOOGL", "Alphabet", "Technology", 173.21, 1.12],
  ["META", "Meta Platforms", "Technology", 583.42, -1.34],
  ["TSLA", "Tesla", "Automotive", 249.18, 3.21],
  ["JPM", "JPMorgan Chase", "Financials", 224.83, 0.42],
  ["V", "Visa", "Financials", 291.64, 0.78],
  ["UNH", "UnitedHealth", "Healthcare", 562.11, -0.38],
  ["XOM", "Exxon Mobil", "Energy", 119.46, -0.92],
  ["COST", "Costco", "Consumer", 889.34, 1.07],
];
export function demoState() {
  const s = emptyState(),
    now = new Date(),
    m = dateISO().slice(0, 7);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1),
      month = dateISO(d).slice(0, 7);
    s.budgets[month] = { income: 4200, limit: 3000 };
    [
      ["Rent", "Housing", 1150],
      ["Weekly groceries", "Food", 268 + i * 12],
      ["Electricity & gas", "Utilities", 136 + i * 9],
      ["Train & travel", "Transport", 142 - i * 4],
      ["A little something", "Shopping", 184 + i * 8],
      ["Coffee & eating out", "Lifestyle", 117 + i * 5],
    ].forEach(([name, category, amount], j) =>
      s.transactions.push({
        id: crypto.randomUUID(),
        name,
        category,
        amount,
        date: month + "-" + String(j * 3 + 1).padStart(2, "0"),
        notes: "",
      }),
    );
  }
  s.subscriptions = [
    ["Netflix", 12.99, "Entertainment"],
    ["Spotify", 11.99, "Entertainment"],
    ["iCloud+", 2.99, "Storage"],
    ["Adobe Creative Cloud", 21.98, "Software"],
  ].map(([name, cost, category], i) => ({
    id: crypto.randomUUID(),
    name,
    cost,
    category,
    cycle: "Monthly",
    start: m + "-01",
    end: "",
    renewal: m + "-" + String(23 + i).padStart(2, "0"),
    active: true,
    notes: "",
  }));
  s.goals = [
    {
      id: crypto.randomUUID(),
      name: "A place of my own",
      target: 15000,
      saved: 8750,
      deadline: dateISO(new Date(now.getFullYear() + 1, now.getMonth() + 4, 1)),
      icon: "home",
    },
    {
      id: crypto.randomUUID(),
      name: "Japan, here I come",
      target: 3500,
      saved: 1420,
      deadline: dateISO(new Date(now.getFullYear() + 1, 3, 1)),
      icon: "plane",
    },
  ];
  s.holdings = [
    { id: crypto.randomUUID(), symbol: "AAPL", quantity: 10, cost: 195 },
    { id: crypto.randomUUID(), symbol: "NVDA", quantity: 20, cost: 110 },
    { id: crypto.randomUUID(), symbol: "MSFT", quantity: 5, cost: 400 },
  ];
  s.watchlist = ["AAPL", "NVDA", "MSFT"];
  s.quotes = Object.fromEntries(
    companies.map(([symbol, name, sector, price, change]) => [
      symbol,
      { symbol, name, sector, price, change, demo: true, at: Date.now() },
    ]),
  );
  return s;
}
