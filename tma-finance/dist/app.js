import { kbArticles } from "./kb.js";
import {
  monthly,
  dateISO,
  monthStats,
  goalStats,
  taxEstimate,
  csv,
  emptyState,
  demoState,
  companies,
} from "./core.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const money = (n, c = "GBP") =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: c,
      maximumFractionDigits: 2,
    }).format(n || 0),
  num = (n) =>
    new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(n || 0);
const uid = () => crypto.randomUUID(),
  safeUrl = (u) => {
    try {
      const p = new URL(u);
      return p.protocol === "https:" ? p.href : "#";
    } catch {
      return "#";
    }
  };
const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  wallet: "M3 6h17v15H3z M3 6V3h14v3 M15 11h6v5h-6z",
  repeat: "M3 8h16l-4-4 M21 16H5l4 4 M3 8v5 M21 16v-5",
  target: "M21 12a9 9 0 1 1-9-9 M17 3l4 0v4 M12 12l9-9 M16 12a4 4 0 1 1-4-4",
  calculator: "M5 2h14v20H5z M8 5h8v4H8z M8 13h1 M15 13h1 M8 17h1 M15 17h1",
  exchange: "M3 7h17l-4-4 M21 17H4l4 4",
  chart: "M3 3v18h18 M6 15l5-5 4 3 6-8",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18",
  news: "M4 3h16v18H4z M7 7h10 M7 11h10 M7 15h4 M7 18h10",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4",
  plus: "M12 5v14 M5 12h14",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  chevron: "M9 5l7 7-7 7",
  up: "M5 15l7-7 7 7",
  down: "M5 9l7 7 7-7",
  close: "M6 6l12 12 M6 18L18 6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  home: "M3 11l9-8 9 8 M5 10v11h14V10 M9 21v-8h6v8",
  plane: "M3 13l7-3V4a2 2 0 0 1 4 0v6l7 3v3l-7-1v4l3 2H7l3-2v-4l-7 1z",
  leaf: "M20 3C6 2 2 8 5 16c8 4 17-1 15-13 M5 20L16 8",
  trash: "M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  edit: "M4 16L17 3l4 4L8 20H4z M14 6l4 4",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
  star: "M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 10v6 M12 7h.01",
  check: "M5 12l4 4L20 5",
  briefcase: "M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.chart}"/></svg>`;
const button = (label, action, ico = "", cls = "", extra = "") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${ico ? icon(ico) : ""}${label}</button>`;
const field = (label, name, value = "", type = "text", extra = "") =>
  `<label>${label}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;
const options = (values, selected) =>
  values
    .map(
      (v) =>
        `<option value="${esc(Array.isArray(v) ? v[0] : v)}" ${(Array.isArray(v) ? v[0] : v) === selected ? "selected" : ""}>${esc(Array.isArray(v) ? v[1] : v)}</option>`,
    )
    .join("");
const select = (label, name, values, selected) =>
  `<label>${label}<select name="${name}">${options(values, selected)}</select></label>`;
const amount = (label, name, value = "", extra = "") =>
  field(label, name, value, "number", `min="0" step="0.01" required ${extra}`);
// Always open the real workspace. Sample data is an explicit, session-only preview.
let mode = "personal";
let helpArticleId = "",
  kbQuery = "";
const providerName = () =>
  ({
    alphavantage: "Alpha Vantage",
    finnhub: "Finnhub",
    twelvedata: "Twelve Data",
    fmp: "Financial Modeling Prep",
    marketstack: "Marketstack",
  })[provider] || "Market provider";
const profileName = () =>
  mode === "demo"
    ? "Demo workspace"
    : String(state.profile?.name || "Your workspace");
const profileInitial = () =>
  mode === "demo"
    ? "D"
    : Array.from(
        String(state.profile?.name || "You").trim(),
      )[0]?.toUpperCase() || "Y";
function readState() {
  try {
    const raw = localStorage.getItem("tma:" + mode);
    if (!raw) return mode === "demo" ? demoState() : emptyState();
    const s = JSON.parse(raw);
    if (s.version !== 1 || !Array.isArray(s.transactions) || !s.settings)
      throw Error();
    return s;
  } catch {
    return emptyState();
  }
}
let state = readState(),
  month = dateISO().slice(0, 7),
  page = location.hash.slice(1) || "dashboard",
  symbol = "AAPL",
  marketFilter = "",
  marketSector = "All sectors",
  marketSort = "name",
  historyRange = "6",
  portfolioTab = "holdings",
  provider =
    state.settings.marketSource === "personal"
      ? state.settings.provider || "alphavantage"
      : "alphavantage",
  marketSource = state.settings.marketSource || "shared",
  providerConnected = false,
  pollTimer = null,
  newsItems = [],
  newsLoaded = false,
  newsError = "",
  profileData = {},
  histories = {},
  refreshing = false;
let taxValues = { revenue: 50000, expenses: 8000, region: "rest" },
  fxResult = null,
  fxValues = { amount: 1000, from: "GBP", to: "USD" },
  fxBusy = false;
const categories = [
  "Housing",
  "Bills",
  "Food",
  "Utilities",
  "Transport",
  "Shopping",
  "Lifestyle",
  "Health",
  "Other",
];
function save() {
  try {
    localStorage.setItem("tma:" + mode, JSON.stringify(state));
  } catch {
    toast("Browser storage is full or unavailable. Export a backup.");
  }
}
function toast(msg) {
  $("#toast").textContent = msg;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 4200);
}
function go(p) {
  page = p;
  location.hash = p;
  render();
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", () => {
  page = location.hash.slice(1) || "dashboard";
  render();
});
const nav = [
  [
    "YOUR WORKSPACE",
    [
      ["dashboard", "Overview", "dashboard"],
      ["budget", "Monthly budget", "wallet"],
      ["subscriptions", "Subscriptions", "repeat"],
      ["savings", "Savings pots", "target"],
    ],
  ],
  [
    "TOOLS",
    [
      ["tax", "Tax calculator", "calculator"],
      ["currency", "Currency converter", "exchange"],
      ["help", "Help and KB Library", "info"],
    ],
  ],
  [
    "INVESTING",
    [
      ["investing", "Portfolio", "briefcase"],
      ["markets", "Explore markets", "globe"],
      ["watchlist", "Watchlist", "star"],
      ["news", "Market news", "news"],
    ],
  ],
];
const titles = {
  help: [
    "Help and KB Library",
    "Provider setup, data coverage and practical guides.",
  ],
  dashboard: [
    "Your money, in perspective.",
    "A little clarity today. A little more freedom tomorrow.",
  ],
  budget: [
    "A plan for every pound.",
    "Set your monthly budget and make room for what matters.",
  ],
  subscriptions: [
    "Keep the little costs in check.",
    "All your recurring commitments, in one place.",
  ],
  savings: [
    "Give your goals a head start.",
    "Big plans start with small, regular steps.",
  ],
  tax: [
    "Keep tax season simple.",
    "Estimate your self-employed Income Tax and National Insurance.",
  ],
  currency: [
    "A world of possibilities.",
    "Compare currencies using the latest published reference rates.",
  ],
  investing: [
    "See the bigger picture.",
    "Your holdings, your watchlist, your investment workspace.",
  ],
  markets: [
    "Find your next perspective.",
    "Search companies, compare prices and explore the market.",
  ],
  watchlist: [
    "Keep an eye on what matters.",
    "Follow your favourites and compare their price history.",
  ],
  news: [
    "The world behind the numbers.",
    "Company news from your market data provider.",
  ],
  settings: [
    "Make this space yours.",
    "Manage data, market connections and notifications.",
  ],
  notifications: [
    "Your financial check-in.",
    "Price alerts, monthly insights and updates in one place.",
  ],
  stock: ["Company profile", "Understand the business behind the ticker."],
};
function render() {
  if (!titles[page]) page = "dashboard";
  const [title, subtitle] = titles[page];
  const s = monthStats(state, month);
  $("#app").innerHTML =
    `<div class="layout"><aside class="sidebar"><button class="quiet mobile-close" data-action="menu" aria-label="Close navigation">${icon("close")}</button><a href="#dashboard" class="brand"><div class="brandmark"><img src="assets/icon.svg" width="32" height="34" alt=""></div><span>TMA-Finance<small>A LITTLE MORE CLARITY</small></span></a>${nav.map(([heading, links]) => `<div class="nav-label">${heading}</div>${links.map(([id, label, ico]) => button(label, "nav", ico, "nav-link " + (id === page ? "active" : ""), `data-page="${id}"`)).join("")}`).join("")}<div class="sidebar-bottom">${button("Settings & alerts", "nav", "settings", "nav-link " + (page === "settings" ? "active" : ""), 'data-page="settings"')}<div class="local-card">${icon("leaf")}<strong>A healthier money habit.</strong>A little attention goes a long way.</div><div class="profile">${button(esc(profileInitial()), "edit-profile", "", "avatar", 'aria-label="Open profile"')}<div>${esc(profileName())}<small>Personal · GBP</small></div></div></div></aside><main class="main"><header class="topbar"><div class="breadcrumb">${button("", "menu", "menu", "quiet mobile-menu", 'aria-label="Open navigation"')}Your workspace ${icon("chevron")}<strong>${page === "dashboard" ? "Overview" : page === "stock" ? esc(symbol) : nav.flatMap((n) => n[1]).find((n) => n[0] === page)?.[1] || titles[page][0]}</strong></div><div class="top-actions"><span class="status"><i class="dot"></i> Saved on this device</span>${button("", "export", "download", "icon-btn", 'aria-label="Export finance CSV"')}${button(state.notifications.length ? `<span class="notification-count">${state.notifications.length}</span>` : "", "nav", "bell", "icon-btn", 'data-page="notifications" aria-label="Notifications"')}${button(esc(profileInitial()), "edit-profile", "", "avatar", 'aria-label="Open profile"')}</div></header><div class="content page-fade"><div class="eyebrow">${new Date(month + "-01T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })} / ${["investing", "markets", "stock", "watchlist", "news"].includes(page) ? "INVESTING" : "PERSONAL FINANCE"}</div><div class="page-heading"><div><h1>${title}</h1><p class="subtext">${subtitle}</p></div><div class="toolbar">${["dashboard", "budget"].includes(page) ? `<input class="month" type="month" id="month-select" value="${month}" aria-label="Selected budget month">` : ""}${pageAction()}</div></div>${mode === "demo" ? `<div class="banner"><span>${icon("info")} You’re exploring sample data. Make yourself at home.</span>${button("Start my workspace", "personal", "arrow")}</div>` : ""}${pages[page](s)}<footer class="footer"><span>TMA-Finance · A little more clarity.</span><span>Personal data stays on this device. Export a backup to keep it safe.</span></footer></div></main></div>`;
  bindLocalForms();
}
function pageAction() {
  switch (page) {
    case "dashboard":
      return button("Add widget", "widget", "plus");
    case "budget":
      return button("Add expense", "expense", "plus", "primary");
    case "subscriptions":
      return button("Add subscription", "subscription", "plus", "primary");
    case "savings":
      return button("Create a pot", "goal", "plus", "primary");
    case "investing":
      return button("Add holding", "holding", "plus", "primary");
    case "settings":
      return "";
    case "markets":
    case "watchlist":
      return button(
        refreshing ? "Refreshing…" : "Refresh quotes",
        "refresh",
        "repeat",
        "",
        refreshing ? "disabled" : "",
      );
    case "stock":
      return button(
        state.watchlist.includes(symbol) ? "Following" : "Follow stock",
        "watch",
        "star",
        "",
        `data-symbol="${esc(symbol)}"`,
      );
    default:
      return "";
  }
}
const stat = (label, value, note, ico = "wallet", featured = false) =>
  `<article class="stat ${featured ? "featured" : ""}"><div class="stat-label">${label}${icon(ico)}</div><div class="stat-number">${value}</div><div class="stat-note">${note}</div></article>`;
const panel = (title, body, action = "", subtitle = "") =>
  `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${action}</div>${body}</section>`;
const empty = (title, text, action = "") =>
  `<div class="empty">${icon("leaf")}<strong>${title}</strong>${text}${action ? `<br>${action}` : ""}</div>`;
const link = (text, target) =>
  button(text, "nav", "arrow", "quiet", `data-page="${target}"`);
function cashflow() {
  const entries = [];
  for (let i = Number(historyRange) - 1; i >= 0; i--) {
    const d = new Date(
        Number(month.slice(0, 4)),
        Number(month.slice(5)) - 1 - i,
        1,
      ),
      m = dateISO(d).slice(0, 7);
    entries.push({
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      ...monthStats(state, m),
    });
  }
  const max = Math.max(1000, ...entries.flatMap((e) => [e.income, e.expenses]));
  return `<div class="chart-wrap" role="img" aria-label="Monthly income and expenses comparison"><div class="chart-scale">${[1, 0.75, 0.5, 0.25, 0].map((f) => `<span>${f === 0 ? "£0" : "£" + num((max * f) / 1000) + "k"}</span>`).join("")}</div><div class="bar-chart">${entries.map((e) => `<div class="bar-group" title="${e.label}: income ${money(e.income)}, expenses ${money(e.expenses)}"><div class="bar" style="height:${(e.income / max) * 100}%"></div><div class="bar light" style="height:${(e.expenses / max) * 100}%"></div><small>${e.label}</small></div>`).join("")}</div></div><div class="chart-footer">${icon("info")} Includes monthly equivalents of active subscriptions.</div>`;
}
const colors = [
  "#416b50",
  "#87a66f",
  "#b9cf99",
  "#d4b28d",
  "#d2d9bc",
  "#a5b8a0",
  "#dfe6d0",
  "#eacdb7",
];
function spending(s) {
  const totals = {};
  for (const t of s.transactions)
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  if (s.recurring) totals.Subscriptions = s.recurring;
  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  let at = 0;
  const gradient = rows
    .map(([, v], i) => {
      const start = at;
      at += (v / (s.expenses || 1)) * 100;
      return `${colors[i % colors.length]} ${start}% ${at}%`;
    })
    .join(",");
  return `<div class="donut-layout"><div class="donut" style="background:${gradient ? "conic-gradient(" + gradient + ")" : "#335b43"}"><div class="donut-center"><small>TOTAL SPENDING</small><strong>${money(s.expenses)}</strong></div></div></div>${rows.length ? rows.map(([cat, v], i) => `<div class="category-row"><span><i class="swatch" style="background:${colors[i % colors.length]}"></i>${esc(cat)}</span><strong>${money(v)} <span style="color:#acb29e;display:inline;margin-left:8px">${Math.round((v / s.expenses) * 100)}%</span></strong></div>`).join("") : empty("A clean slate", "Add an expense to see your spending breakdown.")}`;
}
function goalCard(g, full = false) {
  const n = goalStats(g);
  return `<div class="goal-card"><div class="goal-title"><div class="tile-icon ${g.icon === "plane" ? "orange" : ""}">${icon(g.icon || "target")}</div><div><strong>${esc(g.name)}</strong><small>Goal ${money(g.target)}</small></div><div class="goal-amount"><strong>${money(g.saved)}</strong><small>${Math.round(n.percent)}% there</small></div></div><div class="progress"><span style="width:${n.percent}%"></span></div><div class="goal-caption"><span>${n.remaining === 0 ? "Goal reached. Well done!" : n.daily === null ? "Deadline reached" : money(n.daily) + " / day to get there"}</span><span>${new Date(g.deadline + "T12:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span></div>${full ? `<div class="toolbar" style="margin-top:18px">${button("Add savings", "contribute", "plus", "", `data-id="${g.id}"`)}${button("Edit", "goal", "edit", "quiet", `data-id="${g.id}"`)}${button("", "delete-goal", "trash", "quiet danger", `data-id="${g.id}" aria-label="Delete ${esc(g.name)}"`)}</div>` : ""}</div>`;
}
function subRows(limit) {
  return state.subscriptions
    .filter((s) => s.active !== false)
    .slice(0, limit || 999)
    .map(
      (s) =>
        `<div class="row"><div class="merchant-logo ${esc(s.name[0].toLowerCase())}">${esc(s.name[0])}</div><div><b>${esc(s.name)}</b><small>${s.renewal ? "Renewal " + new Date(s.renewal + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : s.category}</small></div><div><b>${money(s.cost)}</b><small>${esc(s.cycle)}</small></div></div>`,
    )
    .join("");
}
function transactionTable(list, editable = false) {
  return list.length
    ? `<div class="table-wrap"><table><thead><tr><th>TRANSACTION</th><th>CATEGORY</th><th>DATE</th><th>AMOUNT</th>${editable ? "<th>ACTIONS</th>" : ""}</tr></thead><tbody>${[
        ...list,
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (t) =>
            `<tr><td><div class="merchant"><div class="merchant-logo">${icon(t.category === "Housing" ? "home" : t.category === "Food" ? "leaf" : "wallet")}</div><div><strong>${esc(t.name)}</strong>${t.notes ? `<small>${esc(t.notes)}</small>` : ""}</div></div></td><td><span class="pill neutral">${esc(t.category)}</span></td><td>${new Date(t.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td><td><strong>−${money(t.amount)}</strong></td>${editable ? `<td><div class="list-actions">${button("", "expense", "edit", "quiet", `data-id="${t.id}" aria-label="Edit ${esc(t.name)}"`)}${button("", "delete-expense", "trash", "quiet danger", `data-id="${t.id}" aria-label="Delete ${esc(t.name)}"`)}</div></td>` : ""}</tr>`,
        )
        .join("")}</tbody></table></div>`
    : empty(
        "No expenses yet",
        "Add your first expense for this month.",
        button("Add expense", "expense", "plus"),
      );
}
const widgets = {
  cashflow: {
    name: "Income & expenses",
    render: () => cashflow(),
    subtitle: "A view of your monthly money movement.",
  },
  categories: { name: "Where your money goes", render: (s) => spending(s) },
  goals: {
    name: "A little closer to your goals",
    render: () =>
      state.goals.length
        ? state.goals
            .slice(0, 2)
            .map((g) => goalCard(g))
            .join("") +
          `<div class="insight">${icon("leaf")}<div><strong>Small steps. Real progress.</strong>Keep your savings up to date to see what to put aside each day.</div></div>`
        : empty(
            "Something to look forward to",
            "Give your next big plan a savings pot.",
            button("Create a pot", "goal", "plus"),
          ),
  },
  subscriptions: {
    name: "Your recurring commitments",
    render: () =>
      `<div class="subscription-list">${subRows(4) || empty("No subscriptions", "Add your recurring payments to your budget.")}</div>`,
  },
  transactions: {
    name: "Recent transactions",
    render: (s) => transactionTable(s.transactions.slice(-5)),
  },
};
function renderWidget(key, s) {
  const w = widgets[key];
  if (!w) return "";
  return panel(
    w.name,
    w.render(s),
    `<div class="widget-actions">${key === "cashflow" ? `<select id="history-range" aria-label="Chart period" style="width:auto;padding:4px;font-size:10px;margin:0"><option value="3" ${historyRange === "3" ? "selected" : ""}>3 months</option><option value="6" ${historyRange === "6" ? "selected" : ""}>6 months</option><option value="12" ${historyRange === "12" ? "selected" : ""}>12 months</option></select>` : ""}${button("", "move-widget", "up", "quiet", `data-key="${key}" aria-label="Move widget up"`)}${button("", "remove-widget", "close", "quiet", `data-key="${key}" aria-label="Remove ${w.name} widget"`)}</div>`,
    w.subtitle,
  );
}
function dashboard(s) {
  const saved = state.goals.reduce((a, g) => a + g.saved, 0),
    rate = s.income ? ((s.income - s.expenses) / s.income) * 100 : 0;
  return `<div class="stats">${stat("Left in your budget", money(s.remaining), s.limit ? "Of your " + money(s.limit) + " monthly plan" : "Set your monthly plan to get started", "wallet", true)}${stat("Monthly income", money(s.income), "Your planned income this month", "briefcase")}${stat("Monthly expenses", money(s.expenses), '<span class="pill">' + (s.limit ? Math.round((s.expenses / s.limit) * 100) : 0) + "% of budget</span> incl. subscriptions", "exchange")}${stat("Saved towards your goals", money(saved), state.goals.length + " goals · " + (s.income ? num(rate) + "% income unspent" : "your future starts here"), "target")}</div><div class="grid-main">${state.widgets.map((k) => renderWidget(k, s)).join("")}</div>${!state.widgets.includes("transactions") ? panel("Recent transactions", transactionTable(s.transactions.slice(-5)), link("View all", "budget")) : ""}`;
}
function budget(s) {
  return `<div class="stats">${stat("Monthly budget", money(s.limit), "Your spending ceiling", "wallet", true)}${stat("Spent so far", money(s.expenses), "Expenses + recurring commitments", "exchange")}${stat("Available to spend", money(s.remaining), s.remaining < 0 ? "Over your planned budget" : "Room left in your plan", "target")}${stat("After expenses", money(s.cashRemaining), "Income less monthly expenses", "briefcase")}</div><div class="two-col" style="margin-bottom:22px">${panel("Your monthly plan", `<form id="budget-form"><div class="form-grid">${amount("Expected monthly income (£)", "income", s.income)}${amount("Spending budget (£)", "limit", s.limit)}</div><button class="primary" type="submit">Save monthly plan</button></form>`)}${panel("Budget health", `<div class="big-value">${s.limit ? Math.round((s.expenses / s.limit) * 100) : 0}% <span class="note">used</span></div><div class="progress"><span style="width:${Math.min(100, s.limit ? (s.expenses / s.limit) * 100 : 0)}%;background:${s.remaining < 0 ? "#cc907b" : "#8eac71"}"></span></div><p class="note">${s.limit ? money(Math.max(0, s.remaining)) + " remains in your spending budget." : "Set a spending budget to track your progress."}</p><div class="info-box">Subscriptions contribute ${money(s.recurring)} to this month’s total. Add them in Subscriptions to avoid entering them twice.</div>`)}</div>${panel("Monthly transactions", transactionTable(s.transactions, true), button("Export CSV", "export", "download"))}`;
}
function subscriptions() {
  const total = state.subscriptions.reduce((a, s) => a + monthly(s), 0);
  return `<div class="stats">${stat("Monthly recurring cost", money(total), "Normalised to a monthly amount", "repeat", true)}${stat("Annual equivalent", money(total * 12), "Based on current subscriptions", "calculator")}${stat("Active subscriptions", state.subscriptions.filter((s) => s.active !== false).length, "Keep the ones you love", "check")}${stat("Contracts ending", state.subscriptions.filter((s) => s.active !== false && s.end && new Date(s.end) >= new Date() && new Date(s.end) - new Date() < 86400000 * 30).length, "In the next 30 days", "bell")}</div>${panel("Your subscriptions", state.subscriptions.length ? `<div class="table-wrap"><table><thead><tr><th>SUBSCRIPTION</th><th>COST</th><th>MONTHLY EQUIV.</th><th>NEXT RENEWAL</th><th>CONTRACT END</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${state.subscriptions.map((s) => `<tr><td><div class="merchant"><div class="merchant-logo ${esc(s.name[0].toLowerCase())}">${esc(s.name[0])}</div><div><strong>${esc(s.name)}</strong><small>${esc(s.category)}${s.notes ? " · " + esc(s.notes) : ""}</small></div></div></td><td>${money(s.cost)}<small> / ${esc(s.cycle.toLowerCase())}</small></td><td>${money(monthly(s))}</td><td>${s.renewal || "—"}</td><td>${s.end || "Rolling contract"}</td><td><span class="pill ${s.active === false ? "neutral" : ""}">${s.active === false ? "Paused" : "Active"}</span></td><td><div class="list-actions">${button("", "subscription", "edit", "quiet", `data-id="${s.id}" aria-label="Edit ${esc(s.name)}"`)}${button("", "delete-subscription", "trash", "quiet danger", `data-id="${s.id}" aria-label="Delete ${esc(s.name)}"`)}</div></td></tr>`).join("")}</tbody></table></div>` : empty("Nothing on repeat", "Track costs, renewal dates and contract details.", button("Add subscription", "subscription", "plus")))}<p class="note">Monthly budgeting uses the monthly equivalent, including annual and quarterly contracts, from the start month through the end month. This is a planning estimate, rather than a bank payment schedule.</p>`;
}
function savings() {
  const total = state.goals.reduce((a, g) => a + g.saved, 0),
    target = state.goals.reduce((a, g) => a + g.target, 0);
  return `<div class="stats">${stat("Your savings so far", money(total), "Across all your savings pots", "target", true)}${stat("Your combined goal", money(target), "Plans worth working towards", "home")}${stat("Still to go", money(Math.max(0, target - total)), "One step at a time", "arrow")}${stat("Goals reached", state.goals.filter((g) => g.saved >= g.target).length, "Celebrate every milestone", "check")}</div><div class="two-col">${state.goals.map((g) => panel(g.name, goalCard(g, true))).join("") || panel("Your next chapter", empty("What are you saving for?", "A rainy day, a trip, a new beginning. Make it a goal.", button("Create a pot", "goal", "plus")))}</div>`;
}
function tax() {
  const t = taxEstimate(
    Number(taxValues.revenue),
    Number(taxValues.expenses),
    taxValues.region,
  );
  return `<div class="banner"><span>Tax year 2026/27 · 6 April 2026 – 5 April 2027 · Rates checked 21 October 2026</span></div><div class="two-col">${panel(
    "Your self-employed income",
    `<form id="tax-form">${select(
      "Where do you pay Income Tax?",
      "region",
      [
        ["rest", "England, Wales or Northern Ireland"],
        ["scotland", "Scotland"],
      ],
      taxValues.region,
    )}${amount("Annual business revenue (£)", "revenue", taxValues.revenue)}${amount("Allowable business expenses (£)", "expenses", taxValues.expenses)}<button class="primary" type="submit">Calculate estimate ${icon("arrow")}</button></form><p class="note">For sole trading income only. Assumes the standard Personal Allowance with its income taper, no other income, pension adjustments, losses brought forward, student loans, reliefs or voluntary Class 2 contributions. Does not submit a tax return or include payments on account.</p>`,
  )}${panel(
    "Your estimated tax",
    `<div class="eyebrow">ANNUAL INCOME TAX + CLASS 4</div><div class="big-value">${money(t.total)}</div><span class="pill">${money(t.total / 12)} / month to set aside</span><div class="tax-breakdown">${[
      ["Taxable business profit", t.profit],
      ["Personal Allowance", t.allowance],
      ["Income Tax", t.tax],
      ["Class 4 National Insurance", t.ni],
      ["Estimated annual take-home", t.takeHome],
    ]
      .map(
        ([l, v]) =>
          `<div class="row"><span>${l}</span><strong>${money(v)}</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="info-box">An estimate to help you plan. Your actual liability depends on your full circumstances. Check your figures with HMRC before filing.</div><div class="link-row"><a target="_blank" rel="noopener" href="https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past">HMRC Income Tax rates ↗</a><a target="_blank" rel="noopener" href="https://www.gov.uk/self-employed-national-insurance-rates">Class 4 rates ↗</a></div>`,
  )}</div>`;
}
function currency() {
  const currencies = [
    ["GBP", "GBP · British pound"],
    ["USD", "USD · US dollar"],
    ["EUR", "EUR · Euro"],
    ["JPY", "JPY · Japanese yen"],
    ["CHF", "CHF · Swiss franc"],
    ["CAD", "CAD · Canadian dollar"],
    ["AUD", "AUD · Australian dollar"],
    ["CNY", "CNY · Chinese yuan"],
    ["INR", "INR · Indian rupee"],
  ];
  return `<div class="two-col">${panel("Currency converter", `<form id="fx-form">${amount("Amount", "amount", fxValues.amount)}<div class="form-grid">${select("From", "from", currencies, fxValues.from)}${select("To", "to", currencies, fxValues.to)}</div><div class="toolbar"><button class="primary" type="submit" ${fxBusy ? "disabled" : ""}>${fxBusy ? "Fetching rates…" : "Convert currency"}</button>${button("Swap currencies", "swap-fx", "exchange")}</div></form>${fxResult ? `<div class="currency-output"><small>${num(fxResult.amount)} ${fxResult.from} =</small><strong>${money(fxResult.value, fxResult.to)}</strong><small>1 ${fxResult.from} = ${num(fxResult.rate)} ${fxResult.to} · Published ${esc(fxResult.date)}</small></div>` : ""}`)}${panel("Know your rate", `<div class="tile-icon">${icon("globe")}</div><h3 style="margin-top:20px">A useful reference. A clearer comparison.</h3><p class="note">Frankfurter supplies central bank reference rates, updated on working days. These are daily rates, rather than live trading prices. Banks and payment services may add their own fees or exchange margins.</p><div class="info-box">Every conversion shows the publication date. If the provider is unavailable, you’ll see an error instead of an estimated rate.</div><a class="note" href="https://frankfurter.dev/" target="_blank" rel="noopener">About the data source ↗</a>`)}</div>`;
}
const quote = (s) => state.quotes[s],
  getCompany = (s) => companies.find((c) => c[0] === s),
  companyName = (s) => quote(s)?.name || getCompany(s)?.[1] || s;
function marketNotice() {
  return `<div class="banner"><span>${providerConnected ? providerName() + " configured. Quotes may be daily or delayed, depending on your plan." : "Market provider disconnected. " + (mode === "demo" ? "Visible prices are illustrative samples." : "Connect a provider in Settings, or add a manual quote.")}</span>${link("Data settings", "settings")}</div>`;
}
function portfolio() {
  let cost = 0,
    value = 0,
    missing = 0;
  for (const h of state.holdings) {
    cost += h.quantity * h.cost;
    if (quote(h.symbol)) value += h.quantity * quote(h.symbol).price;
    else missing++;
  }
  return `${marketNotice()}<div class="stats">${stat("Portfolio value", missing ? "Incomplete" : money(value, "USD"), "USD · " + (mode === "demo" ? "sample quotes" : "latest available quotes"), "briefcase", true)}${stat("Total cost", money(cost, "USD"), "Your recorded purchase costs", "wallet")}${stat("Unrealised return", missing ? "—" : money(value - cost, "USD"), cost && !missing ? num(((value - cost) / cost) * 100) + "% since purchase" : "Add prices for every holding", "chart")}${stat("Companies you follow", state.watchlist.length, "A little attention to the market", "star")}</div><div class="tabs">${button("Holdings", "portfolio-tab", "", "" + (portfolioTab === "holdings" ? "active" : ""), 'data-tab="holdings"')}${button("My dashboard", "portfolio-tab", "", "" + (portfolioTab === "dashboard" ? "active" : ""), 'data-tab="dashboard"')}</div>${
    portfolioTab === "holdings"
      ? panel(
          "Your holdings",
          state.holdings.length
            ? `<div class="table-wrap"><table><thead><tr><th>COMPANY</th><th>SHARES</th><th>AVG. COST (USD)</th><th>PRICE (USD)</th><th>VALUE (USD)</th><th>RETURN (USD)</th><th>ACTIONS</th></tr></thead><tbody>${state.holdings
                .map((h) => {
                  const q = quote(h.symbol),
                    gain = q ? (q.price - h.cost) * h.quantity : null;
                  return `<tr><td>${button(`<strong>${esc(h.symbol)}</strong>`, "profile", "", "quiet", `data-symbol="${esc(h.symbol)}"`)}<small>${esc(companyName(h.symbol))}</small></td><td>${num(h.quantity)}</td><td>${money(h.cost, "USD")}</td><td>${q ? money(q.price, "USD") : "—"}${q?.demo ? ' <span class="pill neutral">Sample</span>' : ""}</td><td>${q ? money(h.quantity * q.price, "USD") : "—"}</td><td class="${gain >= 0 ? "positive" : "negative"}">${gain === null ? "—" : money(gain, "USD")}</td><td>${button("", "holding", "edit", "quiet", `data-id="${h.id}" aria-label="Edit holding"`)}${button("", "delete-holding", "trash", "quiet danger", `data-id="${h.id}" aria-label="Delete holding"`)}</td></tr>`;
                })
                .join("")}</tbody></table></div>`
            : empty(
                "Your portfolio starts here",
                "Add the shares you own and your average purchase cost.",
                button("Add holding", "holding", "plus"),
              ),
        )
      : `<div style="margin-bottom:20px">${button("Add stock widget", "investment-widget", "plus")}</div><div class="two-col">${state.investmentWidgets.map((w) => panel(`${esc(w.symbol)} · ${w.type === "price" ? "Latest price" : "Price history"}`, w.type === "price" ? `<div class="big-value">${quote(w.symbol) ? money(quote(w.symbol).price, "USD") : "—"}</div><p class="note">${quoteLabel(w.symbol)}</p>` : stockChart([w.symbol]), button("", "remove-investment-widget", "close", "quiet", `data-id="${w.id}" aria-label="Remove widget"`))).join("") || panel("Your investment dashboard", empty("A view that works for you", "Add stock price or history widgets.", button("Add widget", "investment-widget", "plus")))}</div>`
  }<p class="note">Holdings and quotes use USD. Investment values are separate from your GBP budget. No brokerage orders are placed by this app.</p>`;
}
function quoteLabel(s) {
  const q = quote(s);
  return !q
    ? "No quote available"
    : q.demo
      ? "Illustrative sample · not current market data"
      : `${q.manual ? "Manual quote" : esc(q.providerName || "Market provider") + " quote"} · ${new Date(q.at).toLocaleString("en-GB")}${q.marketAt ? " · market timestamp " + new Date(q.marketAt * 1000).toLocaleString("en-GB") : ""}`;
}
function markets() {
  let rows = Object.values(state.quotes).filter(
    (q) =>
      (q.symbol + " " + q.name)
        .toLowerCase()
        .includes(marketFilter.toLowerCase()) &&
      (marketSector === "All sectors" || q.sector === marketSector),
  );
  rows.sort((a, b) =>
    marketSort === "gainers"
      ? b.change - a.change
      : marketSort === "losers"
        ? a.change - b.change
        : marketSort === "price"
          ? b.price - a.price
          : a.name.localeCompare(b.name),
  );
  return `${marketNotice()}${panel(
    "Explore companies",
    `<form id="market-search" class="search-row">${field("Company or ticker", "query", marketFilter, "search", 'placeholder="e.g. Apple or AAPL"')}${select("Sector", "sector", ["All sectors", "Technology", "Consumer", "Automotive", "Financials", "Healthcare", "Energy"], marketSector)}${select(
      "Sort by",
      "sort",
      [
        ["name", "Company name"],
        ["price", "Highest share price"],
        ["gainers", "Largest daily gain"],
        ["losers", "Largest daily fall"],
      ],
      marketSort,
    )}<button type="submit" class="primary" style="margin-bottom:16px">${icon("search")} Search</button></form><p class="note">Rankings compare loaded companies only. A full Top 100 market feed and advanced fundamental screening need a market-wide data subscription.</p>${marketTable(rows)}<div id="search-results"></div>`,
  )}<p class="note">Use Search with a connected provider key to find other US-listed stocks. Without a connection, search filters your local quotes.</p>`;
}
function marketTable(rows) {
  return rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>COMPANY</th><th>SECTOR</th><th>PRICE (USD)</th><th>DAY CHANGE</th><th>DATA SOURCE</th><th>FOLLOW</th></tr></thead><tbody>${rows.map((q) => `<tr><td><div class="merchant"><div class="merchant-logo">${esc(q.symbol[0])}</div><div>${button(`<strong>${esc(q.name)}</strong>`, "profile", "", "quiet", `data-symbol="${esc(q.symbol)}"`)}<small>${esc(q.symbol)}</small></div></div></td><td>${esc(q.sector || "—")}</td><td>${money(q.price, "USD")}</td><td class="${q.change >= 0 ? "positive" : "negative"}">${q.change > 0 ? "+" : ""}${num(q.change)}%</td><td><span class="pill neutral">${q.demo ? "Sample" : q.manual ? "Manual" : esc(q.providerName || "Provider")}</span></td><td>${button(state.watchlist.includes(q.symbol) ? "Following" : "Follow", "watch", "star", "quiet", `data-symbol="${esc(q.symbol)}"`)}</td></tr>`).join("")}</tbody></table></div>`
    : empty(
        "No matching companies",
        "Connect a provider or add a manual quote in Settings.",
      );
}
function stockChart(symbols) {
  if (!symbols.length)
    return empty(
      "Your chart is ready when you are",
      "Follow a stock to add it to your comparison.",
    );
  const series = symbols
    .map((s, i) => {
      const h = histories[s];
      return {
        symbol: s,
        values: h?.c || [],
        times: h?.t || [],
        color: colors[i % colors.length],
      };
    })
    .filter((s) => s.values.length > 1);
  if (!series.length)
    return empty(
      "No historical prices loaded",
      "Connect a provider and load history from a company profile. Historical candles may require a paid plan. Sample quotes never generate a fictitious price timeline.",
    );
  const width = 600,
    height = 160,
    all = series.flatMap((s) =>
      s.values.map((v) => (v / s.values[0] - 1) * 100),
    ),
    min = Math.min(0, ...all),
    max = Math.max(1, ...all),
    span = max - min;
  return `<p class="note">Relative return from first available price · available provider history (Alpha Vantage: monthly observations)</p><svg class="spark" viewBox="0 0 640 190" role="img" aria-label="Price return comparison for ${esc(symbols.join(", "))}"><path d="M35 10V170H635" fill="none" stroke="#e3e8da"/>${series.map((s) => `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${s.values.map((v, i) => `${35 + (i / (s.values.length - 1)) * width},${10 + height - (((v / s.values[0] - 1) * 100 - min) / span) * height}`).join(" ")}"/>`).join("")}<text x="0" y="15">${num(max)}%</text><text x="0" y="170">${num(min)}%</text></svg><div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.symbol)}</span>`).join("")}</div>`;
}
function watchlist() {
  return `${marketNotice()}${panel("Your watchlist comparison", stockChart(state.watchlist), link("Explore stocks", "markets"))}<div style="height:20px"></div>${panel("Companies you follow", state.watchlist.length ? state.watchlist.map((s) => `<div class="watch-row">${button(esc(s), "profile", "", "quiet", `data-symbol="${esc(s)}"`)}<small>${esc(companyName(s))}</small><span>${quote(s) ? money(quote(s).price, "USD") : "No quote"}</span>${button("Unfollow", "watch", "star", "quiet", `data-symbol="${esc(s)}"`)}</div>`).join("") : empty("Keep your favourites close", "Find a company and select Follow.", link("Explore markets", "markets")))}`;
}
const metricDefs = [
  [
    "Return on equity",
    "roeTTM",
    "Profit compared with shareholder equity. Helps assess how effectively a company uses shareholder capital.",
  ],
  [
    "Price / earnings",
    "peTTM",
    "Share price relative to trailing earnings per share. A valuation measure best compared with similar businesses.",
  ],
  [
    "Net profit margin",
    "netProfitMarginTTM",
    "The percentage of revenue retained as net profit. Helps assess profitability.",
  ],
  [
    "TTM revenue",
    "revenueTTM",
    "Revenue over the trailing twelve months. Useful for judging the size and direction of sales.",
  ],
  [
    "PEG ratio",
    "peg",
    "Price / earnings relative to earnings growth. A growth-adjusted valuation measure; assumptions matter.",
  ],
  [
    "Price / book",
    "pb",
    "Share price compared with net assets per share. More informative in some industries than others.",
  ],
  [
    "Return on assets",
    "roaTTM",
    "Net earnings compared with total assets. Helps assess how efficiently a company uses its assets.",
  ],
  [
    "52-week high",
    "52WeekHigh",
    "The highest traded share price during the past year. Provides context for today’s price.",
  ],
  [
    "52-week low",
    "52WeekLow",
    "The lowest traded share price during the past year. Provides context for the trading range.",
  ],
  [
    "Previous close",
    "previousClose",
    "The price at the end of the previous trading session. Used to measure the daily price change.",
  ],
  [
    "Revenue 1 year ago",
    "revenue1y",
    "Previous annual revenue. Compare multiple years to assess growth.",
  ],
  [
    "Revenue 2 years ago",
    "revenue2y",
    "Annual revenue two years earlier. Helps identify longer-term changes.",
  ],
  [
    "Revenue 3 years ago",
    "revenue3y",
    "Annual revenue three years earlier. Helps put recent results in context.",
  ],
  [
    "Balance sheet",
    "balanceSheet",
    "A snapshot of assets, liabilities and shareholder equity. Helps assess financial resilience.",
  ],
  [
    "Median earnings",
    "medianEarnings",
    "The middle earnings result across a series of years. Reduces the effect of unusually strong or weak years.",
  ],
];
function stockProfile() {
  const q = quote(symbol),
    p = profileData[symbol] || {},
    m = { ...p.metric, previousClose: q?.previousClose };
  return `${marketNotice()}<div class="two-col">${panel(`${esc(companyName(symbol))} · ${esc(symbol)}`, `<div class="eyebrow">${esc(q?.sector || p.finnhubIndustry || "US LISTED EQUITY")} / USD</div><div class="big-value">${q ? money(q.price, "USD") : "No quote"}</div><p class="note">${quoteLabel(symbol)}</p><div class="toolbar">${button("Load company data", "load-profile", "repeat", "primary")}${button("Load price history", "load-history", "chart")}${button("Add holding", "holding", "plus", "", `data-symbol="${esc(symbol)}"`)}</div>${p.weburl ? `<p><a href="${esc(safeUrl(p.weburl))}" target="_blank" rel="noopener">Company website ↗</a></p>` : ""}<p class="note">${esc(p.name || "")} ${esc(p.country || "")} ${esc(p.exchange || "")}</p>`)}${panel("Price timeline", stockChart([symbol]))}</div><div style="height:22px"></div>${panel("The numbers behind the company", `<div class="metric-list">${metricDefs.map(([label, key, explanation]) => `<div class="metric"><label>${label}<button class="help" data-action="explain" data-title="${esc(label)}" data-text="${esc(explanation)}" aria-label="Explain ${label}">?</button></label><strong>${m[key] != null ? esc(num(m[key])) : "—"}</strong></div>`).join("")}</div><div class="info-box">Unavailable data is shown as —. Availability and units depend on the selected provider and plan. Detailed annual statements and median earnings are not connected. Values are returned in the provider’s units; check the source before comparing.</div>`)}<div style="height:22px"></div>${panel("Company news & research", `<p class="note">Read source articles to understand the context behind price movements.</p>${link("Open market news", "news")}`)}`;
}
function news() {
  return `${marketNotice()}${panel("Your market briefing", `<div class="toolbar">${button("Refresh general news", "load-news", "repeat", "primary")}${button("News for " + esc(symbol), "company-news", "news")}</div><div class="info-box">${providerConnected ? "Headlines link to the original publisher. No sample news is displayed." : "Connect a provider in Settings to load general financial news and company-specific stories."}</div>${newsError ? `<p class="negative note">${esc(newsError)}</p>` : ""}${newsItems.map((n) => `<article class="news-card"><small>${esc(n.source)} · ${new Date(n.datetime * 1000).toLocaleString("en-GB")}</small><h3><a href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">${esc(n.headline)} ↗</a></h3><p>${esc(n.summary)}</p></article>`).join("") || empty(newsLoaded ? "No news returned" : "Your briefing is ready to connect", "Use the news controls above once your provider is connected.")}`)}`;
}
function notifications() {
  return `${state.settings.monthlyInsights ? panel("Monthly spending insight", `<div class="info-box">${monthlyInsight()}</div><p class="note">Insights are calculated from your saved expenses and subscription equivalents. Desktop sessions can check quotes and show alerts while the app is open. Background checks, push, email and news-sensitivity alerts require a server and are not active.</p>`) : ""}<div style="height:20px"></div>${panel(
    "Recent alerts",
    state.notifications.length
      ? state.notifications
          .slice()
          .reverse()
          .map(
            (n) =>
              `<div class="rule"><div><strong>${esc(n.title)}</strong><small>${esc(n.text)} · ${new Date(n.at).toLocaleString("en-GB")}</small></div>${button("Dismiss", "dismiss-notification", "close", "quiet", `data-id="${n.id}"`)}</div>`,
          )
          .join("")
      : empty("All caught up", "Configure price thresholds in Settings."),
  )}`;
}
function monthlyInsight() {
  const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1),
    prev = monthStats(state, dateISO(d).slice(0, 7)),
    cur = monthStats(state, month);
  return `This month: ${money(cur.expenses)} in expenses, including ${money(cur.recurring)} in subscription equivalents. ${prev.expenses ? "That’s " + money(Math.abs(cur.expenses - prev.expenses)) + " " + (cur.expenses >= prev.expenses ? "more" : "less") + " than the previous month." : "Add a previous month to compare your spending."}`;
}
function settings() {
  return `<div class="two-col"><div class="stack">${panel(
    "Your market connection",
    `<form id="provider-form">${select(
      "Market data provider",
      "connection",
      [
        ["shared", "Alpha Vantage - shared (awaiting backend setup)"],
        ["alphavantage", "Alpha Vantage - personal key"],
        ["finnhub", "Finnhub - personal key"],
        ["twelvedata", "Twelve Data - personal key (quotes only)"],
        ["fmp", "Financial Modeling Prep - personal key (quotes only)"],
        ["marketstack", "Marketstack - personal key (end-of-day quotes only)"],
      ],
      marketSource === "shared" ? "shared" : provider,
    )}<p class="note">${providerConnected ? providerName() + " is configured." : "Shared Alpha Vantage awaits backend setup. Choose a personal connection to use your own key."}</p><label>Personal API key (session only; leave blank for shared)<input name="key" type="password" autocomplete="off" placeholder="Enter the selected provider’s key"></label><div class="toolbar"><button type="submit" class="primary">Connect provider</button>${button("Disconnect", "disconnect")}</div></form><div class="info-box">Providers offer limited free tiers and paid datasets; users must check their own plan and permissions. Twelve Data, Financial Modeling Prep and Marketstack currently support quote refresh only in this app; search, history, company data and news use Alpha Vantage or Finnhub. These additional personal providers default to manual refresh. Marketstack is end-of-day with a small monthly allowance. Alpha Vantage’s standard free tier allows 25 requests per day; standard quotes are daily, not streaming. Alpha Vantage quote refresh is locked to 24 hours. Repeated refreshes reuse the running app's quote cache. The 25-request allowance is per key, shared across everyone using it; searches and company data also count. Finnhub may restrict history and other datasets. No paid plan is purchased or enabled by this app.</div><p class="note">Keys are passed to the desktop connection in memory, excluded from backups and never bundled with the app. Shared Alpha Vantage is the default selection, awaiting a hosted service and provider permission. No shared key is included in this build.</p><div class="link-row"><a href="https://finnhub.io/" target="_blank" rel="noopener">Finnhub</a><a href="https://www.alphavantage.co/support/" target="_blank" rel="noopener">Alpha Vantage free tier</a></div>${button("Add manual USD quote", "manual-quote", "plus")}`,
  )}${panel("Data & workspace", `<p class="note">Finance data is stored on this device only. This version has no cloud sync or bank access. Removing the app’s data folder removes local records.</p><div class="toolbar">${button("Export finance CSV", "export", "download")}${button("Export JSON backup", "backup", "download")}${button("Import backup", "import", "plus")}</div><input id="backup-file" type="file" accept="application/json,.json" hidden><div class="rule"><div><strong>${mode === "demo" ? "Demo workspace" : "Personal workspace"}</strong><small>Sample and personal data are stored separately.</small></div>${button(mode === "demo" ? "Use personal" : "View demo", "toggle-mode")}</div>${button("Reset this workspace", "reset", "trash", "danger")}`)}</div><div class="stack">${panel(
    "Quote checks & market alerts",
    `<form id="settings-form">${
      provider === "alphavantage"
        ? '<label>Quote refresh<input value="Every 24 hours (locked)" disabled></label>'
        : select(
            "While this app is open",
            "refresh",
            [
              ["manual", "Manual refresh only"],
              ["60", "Check every minute"],
              ["300", "Check every 5 minutes"],
              ["900", "Check every 15 minutes"],
            ],
            state.settings.refresh,
          )
    }${amount("Large fall threshold (%)", "crashPercent", state.settings.crashPercent, 'max="100"')}<label style="margin:10px 0 20px"><input type="checkbox" name="monthlyInsights" ${state.settings.monthlyInsights ? "checked" : ""}> Show monthly spending insights</label><button type="submit" class="primary">Save preferences</button></form><p class="note">Large-fall alerts use the daily movement of your followed stocks, not a market-wide crash feed. Automatic checks pause when you close the page.</p>`,
  )}${panel("Stock price alerts", `<p class="note">Get an in-app notification when a fetched quote reaches your threshold. An alert describes a condition; it does not recommend or execute a trade.</p>${state.alerts.map((a) => `<div class="rule"><div><strong>${esc(a.symbol)} ${a.direction === "above" ? "≥" : "≤"} ${money(a.price, "USD")}</strong><small>${a.triggered ? "Triggered · edit to re-arm" : "Armed for next quote check"}</small></div><div>${button("", "alert", "edit", "quiet", `data-id="${a.id}" aria-label="Edit alert"`)}${button("", "delete-alert", "trash", "quiet danger", `data-id="${a.id}" aria-label="Delete alert"`)}</div></div>`).join("")}<div style="margin-top:15px">${button("Add price alert", "alert", "plus")}</div>`)}${panel("Coming later", `<p class="note">Bank linking, cloud sync, background notification delivery, configurable news sensitivity, a complete Top 100 feed and financial-statement history are planned integrations.</p>`)}</div></div>`;
}
function helpPage() {
  const article = kbArticles.find((a) => a.id === helpArticleId);
  if (article)
    return panel(
      esc(article.id + " " + article.title),
      button("Back to KB index", "kb-index", "arrow") +
        article.sections
          .map(
            ([heading, text]) =>
              `<h3 style="margin-top:24px">${esc(heading)}</h3><p class="note">${esc(text)}</p>`,
          )
          .join("") +
        article.links
          .map(
            ([label, url]) =>
              `<p><a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a></p>`,
          )
          .join("") +
        `<p class="note">Applies to version 0.1.3. Provider information checked 21 October 2026.</p>`,
    );
  const matches = kbArticles.filter((a) =>
    JSON.stringify(a).toLowerCase().includes(kbQuery.toLowerCase()),
  );
  return panel(
    "Find a guide",
    `<form id="kb-search" class="toolbar"><label>Search guides<input name="query" value="${esc(kbQuery)}" placeholder="Provider name, setup, quota or profile"></label><button type="submit" class="primary">Search</button></form><p class="note">Alpha Vantage is the only shared default, awaiting backend setup. All guides are available offline; provider websites need an internet connection.</p>` +
      matches
        .map(
          (a) =>
            `<div class="rule"><div><strong>${esc(a.id)}</strong><small>${esc(a.title)}</small></div>${button("Read guide", "kb-open", "info", "", `data-id="${a.id}"`)}</div>`,
        )
        .join("") +
      (!matches.length
        ? `<p class="note">No guides match this search.</p>`
        : ""),
  );
}
const pages = {
  help: helpPage,
  dashboard,
  budget,
  subscriptions,
  savings,
  tax,
  currency,
  investing: portfolio,
  markets,
  watchlist,
  stock: stockProfile,
  news,
  settings,
  notifications,
};
function openModal(title, description, content, formName) {
  const modal = $("#modal");
  modal.innerHTML = `${button("", "close-modal", "close", "quiet close", 'aria-label="Close dialog"')}<h2>${esc(title)}</h2><p class="subtext">${description}</p>${formName ? `<form id="modal-form" data-form="${formName}">${content}<div class="form-foot">${button("Cancel", "close-modal")}<button type="submit" class="primary">Save ${icon("check")}</button></div></form>` : content}`;
  modal.showModal();
}
function modalId(id) {
  return `<input type="hidden" name="id" value="${id || ""}">`;
}
function editExpense(id) {
  const t = state.transactions.find((t) => t.id === id) || {
    name: "",
    category: "Food",
    amount: "",
    date:
      month +
      "-" +
      (month === dateISO().slice(0, 7) ? dateISO().slice(-2) : "01"),
  };
  openModal(
    id ? "Edit expense" : "Add an expense",
    "One more piece of your monthly picture.",
    `${modalId(id)}${field("What was it for?", "name", t.name, "text", 'required maxlength="100"')}<div class="form-grid">${amount("Amount (£)", "amount", t.amount, 'min="0.01"')}${select("Category", "category", categories, t.category)}</div>${field("Date", "date", t.date, "date", "required")}${field("Notes (optional)", "notes", t.notes, "text", 'maxlength="250"')}`,
    "expense",
  );
}
function editSubscription(id) {
  const s = state.subscriptions.find((s) => s.id === id) || {
    name: "",
    cost: "",
    category: "Entertainment",
    cycle: "Monthly",
    start: dateISO(),
    end: "",
    renewal: dateISO(),
    active: true,
  };
  openModal(
    id ? "Edit subscription" : "Add a subscription",
    "Keep every commitment in view.",
    `${modalId(id)}${field("Subscription name", "name", s.name, "text", 'required maxlength="100"')}<div class="form-grid">${amount("Cost per billing cycle (£)", "cost", s.cost)}${select("Billing cycle", "cycle", ["Monthly", "Quarterly", "Yearly"], s.cycle)}${select("Category", "category", ["Entertainment", "Software", "Storage", "Fitness", "Other"], s.category)}${field("Start date", "start", s.start, "date", "required")}${field("Next renewal (optional)", "renewal", s.renewal, "date")}${field("Contract end (optional)", "end", s.end, "date")}</div>${field("Notes (optional)", "notes", s.notes, "text", 'maxlength="250"')}<label><input type="checkbox" name="active" ${s.active !== false ? "checked" : ""}> Active subscription</label>`,
    "subscription",
  );
}
function editGoal(id) {
  const g = state.goals.find((g) => g.id === id) || {
    name: "",
    target: "",
    saved: 0,
    deadline: dateISO(
      new Date(new Date().getFullYear() + 1, new Date().getMonth(), 1),
    ),
    icon: "target",
  };
  openModal(
    id ? "Edit your savings pot" : "Create a savings pot",
    "A name, a number and a date. Let’s make it happen.",
    `${modalId(id)}${field("What are you saving for?", "name", g.name, "text", 'required maxlength="100"')}<div class="form-grid">${amount("Target (£)", "target", g.target, 'min="0.01"')}${amount("Already saved (£)", "saved", g.saved)}${field("Target date", "deadline", g.deadline, "date", "required")}${select("Icon", "icon", ["target", "home", "plane", "leaf"], g.icon)}</div>`,
    "goal",
  );
}
function editHolding(id, preSymbol) {
  const h = state.holdings.find((h) => h.id === id) || {
    symbol: preSymbol || "",
    quantity: "",
    cost: "",
  };
  openModal(
    id ? "Edit holding" : "Add a holding",
    "Record your shares and average purchase cost in USD.",
    `${modalId(id)}${field("US stock ticker", "symbol", h.symbol, "text", 'required pattern="[A-Za-z0-9.\\-]{1,15}" maxlength="15" placeholder="AAPL"')}<div class="form-grid">${field("Number of shares", "quantity", h.quantity, "number", 'required min="0.000001" step="any"')}${amount("Average cost per share (USD)", "cost", h.cost)}</div>`,
    "holding",
  );
}
function editAlert(id) {
  const a = state.alerts.find((a) => a.id === id) || {
    symbol: "",
    direction: "above",
    price: "",
  };
  openModal(
    "Stock price alert",
    "A notification when a fetched USD quote meets your condition.",
    `${modalId(id)}${field("US stock ticker", "symbol", a.symbol, "text", 'required pattern="[A-Za-z0-9.\\-]{1,15}" maxlength="15"')}${select(
      "Notify when price is",
      "direction",
      [
        ["above", "At or above"],
        ["below", "At or below"],
      ],
      a.direction,
    )}${amount("Threshold (USD)", "price", a.price, 'min="0.01"')}`,
    "alert",
  );
}
function upsert(collection, record) {
  const i = collection.findIndex((e) => e.id === record.id);
  if (i < 0) collection.push(record);
  else collection[i] = record;
}
function formValues(form) {
  return Object.fromEntries(new FormData(form));
}
function bindLocalForms() {
  const bind = (id, fn) => {
    const f = $(id);
    if (f)
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        await fn(f);
      });
  };
  bind("#kb-search", (f) => {
    kbQuery = formValues(f).query.trim();
    render();
  });
  bind("#budget-form", (f) => {
    const v = formValues(f);
    state.budgets[month] = { income: +v.income, limit: +v.limit };
    save();
    render();
    toast("Monthly plan saved.");
  });
  bind("#tax-form", (f) => {
    taxValues = formValues(f);
    render();
  });
  bind("#fx-form", convert);
  bind("#provider-form", async (f) => {
    const v = formValues(f);
    if (!window.desktop?.market) {
      toast(
        "Market connections are available in the desktop app. Open TMA-Finance.exe.",
      );
      return;
    }
    try {
      const source = v.connection === "shared" ? "shared" : "personal";
      const selected = source === "shared" ? "alphavantage" : v.connection;
      const status = await window.desktop.market({
        action: source === "personal" && v.key.trim() ? "connect" : "status",
        source,
        provider: selected,
        key: source === "personal" ? v.key.trim() : undefined,
      });
      f.reset();
      provider = selected;
      marketSource = source;
      if (["twelvedata", "fmp", "marketstack"].includes(selected))
        state.settings.refresh = "manual";
      state.settings.marketSource = source;
      providerConnected = status.configured;
      state.settings.provider = provider;
      save();
      setupPolling();
      if (!providerConnected) {
        render();
        toast(
          marketSource === "shared"
            ? "Shared Alpha Vantage is awaiting backend setup. Choose a personal key to connect now."
            : "Enter a key for " + providerName() + ".",
        );
        return;
      }
      toast("Checking " + providerName() + "…");
      await refreshQuotes();
    } catch (e) {
      toast(e.message);
    }
    render();
  });
  bind("#settings-form", (f) => {
    const v = formValues(f);
    state.settings = {
      ...state.settings,
      refresh: v.refresh || state.settings.refresh,
      crashPercent: +v.crashPercent,
      monthlyInsights: !!v.monthlyInsights,
    };
    save();
    setupPolling();
    render();
    toast("Preferences saved.");
  });
  bind("#market-search", async (f) => {
    const v = formValues(f);
    marketFilter = v.query;
    marketSector = v.sector;
    marketSort = v.sort;
    render();
    if (providerConnected && marketFilter) await searchStocks(marketFilter);
  });
  const monthInput = $("#month-select");
  if (monthInput)
    monthInput.addEventListener("change", (e) => {
      if (e.target.value) {
        month = e.target.value;
        render();
      }
    });
  const range = $("#history-range");
  if (range)
    range.addEventListener("change", (e) => {
      historyRange = e.target.value;
      render();
    });
  const file = $("#backup-file");
  if (file) file.addEventListener("change", importBackup);
}
$("#modal").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target,
    v = formValues(form),
    id = v.id || uid();
  switch (form.dataset.form) {
    case "personal-profile":
      state.profile = { name: v.name.trim(), email: v.email.trim() };
      break;
    case "expense":
      upsert(state.transactions, {
        id,
        name: v.name.trim(),
        category: v.category,
        amount: +v.amount,
        date: v.date,
        notes: v.notes.trim(),
      });
      break;
    case "subscription":
      if (v.end && v.end < v.start) {
        toast("Contract end must be on or after the start date.");
        return;
      }
      upsert(state.subscriptions, {
        id,
        name: v.name.trim(),
        cost: +v.cost,
        cycle: v.cycle,
        category: v.category,
        start: v.start,
        end: v.end,
        renewal: v.renewal,
        notes: v.notes.trim(),
        active: !!v.active,
      });
      break;
    case "goal":
      upsert(state.goals, {
        id,
        name: v.name.trim(),
        target: +v.target,
        saved: +v.saved,
        deadline: v.deadline,
        icon: v.icon,
      });
      break;
    case "holding":
      upsert(state.holdings, {
        id,
        symbol: v.symbol.toUpperCase(),
        quantity: +v.quantity,
        cost: +v.cost,
      });
      break;
    case "contribute": {
      const g = state.goals.find((g) => g.id === v.id);
      g.saved = Math.round((g.saved + Number(v.amount)) * 100) / 100;
      break;
    }
    case "widget":
      if (!state.widgets.includes(v.widget)) state.widgets.push(v.widget);
      break;
    case "investment-widget":
      state.investmentWidgets.push({
        id,
        symbol: v.symbol.toUpperCase(),
        type: v.type,
      });
      break;
    case "alert":
      upsert(state.alerts, {
        id,
        symbol: v.symbol.toUpperCase(),
        direction: v.direction,
        price: +v.price,
        triggered: false,
      });
      break;
    case "manual-quote": {
      const sym = v.symbol.toUpperCase();
      state.quotes[sym] = {
        symbol: sym,
        name: v.name.trim(),
        sector: v.sector,
        price: +v.price,
        change: +v.change,
        at: Date.now(),
        manual: true,
      };
      evaluateAlerts();
      break;
    }
  }
  save();
  $("#modal").close();
  render();
  toast("Saved. A little more clarity.");
});
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action,
    id = el.dataset.id,
    sym = el.dataset.symbol;
  switch (a) {
    case "nav":
      go(el.dataset.page);
      break;
    case "menu":
      $(".sidebar").classList.toggle("open");
      break;
    case "close-modal":
      $("#modal").close();
      break;
    case "kb-open":
      helpArticleId = id;
      go("help");
      break;
    case "kb-index":
      helpArticleId = "";
      render();
      break;
    case "edit-profile":
      openModal(
        "Your profile",
        "Personal details stored on this device. This does not sign in to a bank or an online account.",
        `${field("Display name", "name", state.profile?.name || "", "text", 'maxlength="80"')}${field("Email (optional)", "email", state.profile?.email || "", "email", 'maxlength="254"')}`,
        "personal-profile",
      );
      break;
    case "expense":
      editExpense(id);
      break;
    case "subscription":
      editSubscription(id);
      break;
    case "goal":
      editGoal(id);
      break;
    case "holding":
      editHolding(id, sym);
      break;
    case "alert":
      editAlert(id);
      break;
    case "contribute":
      openModal(
        "Add to your savings",
        "Record the money you’ve put aside.",
        `${modalId(id)}${amount("Amount to add (£)", "amount", "", 'min="0.01"')}`,
        "contribute",
      );
      break;
    case "widget": {
      const available = Object.keys(widgets).filter(
        (k) => !state.widgets.includes(k),
      );
      if (!available.length) {
        toast("All available widgets are already on your dashboard.");
        return;
      }
      openModal(
        "Add a dashboard widget",
        "Choose another way to see your money.",
        select(
          "Widget",
          "widget",
          available.map((k) => [k, widgets[k].name]),
          available[0],
        ),
        "widget",
      );
      break;
    }
    case "remove-widget":
      state.widgets = state.widgets.filter((k) => k !== el.dataset.key);
      save();
      render();
      break;
    case "move-widget": {
      const i = state.widgets.indexOf(el.dataset.key);
      if (i > 0)
        [state.widgets[i - 1], state.widgets[i]] = [
          state.widgets[i],
          state.widgets[i - 1],
        ];
      save();
      render();
      break;
    }
    case "investment-widget":
      openModal(
        "Add a stock widget",
        "Choose a company and the data you want to see.",
        `${field("US stock ticker", "symbol", "", "text", 'required pattern="[A-Za-z0-9.\\-]{1,15}" maxlength="15"')}${select(
          "Display",
          "type",
          [
            ["price", "Latest price"],
            ["chart", "Price history"],
          ],
          "price",
        )}`,
        "investment-widget",
      );
      break;
    case "remove-investment-widget":
      state.investmentWidgets = state.investmentWidgets.filter(
        (w) => w.id !== id,
      );
      save();
      render();
      break;
    case "portfolio-tab":
      portfolioTab = el.dataset.tab;
      render();
      break;
    case "personal":
      mode = "personal";
      switchMode();
      break;
    case "toggle-mode":
      mode = mode === "demo" ? "personal" : "demo";
      switchMode();
      break;
    case "profile":
      symbol = sym;
      go("stock");
      break;
    case "watch":
      if (state.watchlist.includes(sym))
        state.watchlist = state.watchlist.filter((s) => s !== sym);
      else state.watchlist.push(sym);
      save();
      render();
      break;
    case "refresh":
      await refreshQuotes();
      break;
    case "load-profile":
      await loadProfile();
      break;
    case "load-history":
      await loadHistory();
      break;
    case "load-news":
      await loadNews(false);
      break;
    case "company-news":
      await loadNews(true);
      break;
    case "export":
      exportCsv();
      break;
    case "backup":
      download(
        JSON.stringify(state, null, 2),
        "tma-finance-" + mode + "-" + dateISO() + ".json",
        "application/json",
      );
      break;
    case "import":
      if (window.desktop) {
        try {
          const content = await window.desktop.openBackup();
          if (content) importContent(content);
        } catch (e) {
          toast("Could not import: " + e.message);
        }
      } else $("#backup-file").click();
      break;
    case "disconnect":
      if (window.desktop?.market)
        await window.desktop.market({
          action: "disconnect",
          provider,
          source: marketSource,
        });
      providerConnected = false;
      setupPolling();
      render();
      toast("Provider disconnected.");
      break;
    case "swap-fx":
      [fxValues.from, fxValues.to] = [fxValues.to, fxValues.from];
      fxResult = null;
      render();
      break;
    case "manual-quote":
      openModal(
        "Add a manual quote",
        "A manually entered USD price, labelled with its entry time.",
        `${field("US stock ticker", "symbol", "", "text", 'required pattern="[A-Za-z0-9.\\-]{1,15}" maxlength="15"')}${field("Company name", "name", "", "text", 'required maxlength="100"')}${select("Sector", "sector", ["Technology", "Consumer", "Automotive", "Financials", "Healthcare", "Energy", "Other"], "Technology")}${amount("Share price (USD)", "price", "", 'min="0.01"')}${field("Daily change (%)", "change", 0, "number", 'required step="0.01"')}`,
        "manual-quote",
      );
      break;
    case "explain":
      openModal(
        el.dataset.title,
        "",
        `<p class="note">${esc(el.dataset.text)}</p>${button("Got it", "close-modal", "", "primary")}`,
      );
      break;
    case "dismiss-notification":
      state.notifications = state.notifications.filter((n) => n.id !== id);
      save();
      render();
      break;
    case "reset":
      confirmAction(
        "Reset this workspace?",
        "This removes the current " +
          mode +
          " records from this device. Export a backup first if you need them.",
        () => {
          state = mode === "demo" ? demoState() : emptyState();
          save();
          render();
          toast("Workspace reset.");
        },
      );
      break;
    default:
      if (a.startsWith("delete-")) {
        const collection = {
          expense: "transactions",
          subscription: "subscriptions",
          goal: "goals",
          holding: "holdings",
          alert: "alerts",
        }[a.slice(7)];
        if (collection)
          confirmAction(
            "Delete this record?",
            "This will remove the record and update your totals.",
            () => {
              state[collection] = state[collection].filter((v) => v.id !== id);
              save();
              render();
              toast("Record deleted.");
            },
          );
      }
  }
});
function confirmAction(title, description, fn) {
  openModal(
    title,
    description,
    `<div class="form-foot">${button("Keep it", "close-modal")}<button class="primary" id="confirm-delete">Confirm</button></div>`,
  );
  $("#confirm-delete").onclick = () => {
    $("#modal").close();
    fn();
  };
}
function switchMode() {
  state = readState();
  histories = {};
  profileData = {};
  newsItems = [];
  setupPolling();
  render();
  toast(
    mode === "demo"
      ? "Exploring sample data."
      : "Your personal workspace is ready.",
  );
}
async function download(data, name, type) {
  if (window.desktop) {
    try {
      return await window.desktop.saveFile({ data, name });
    } catch (e) {
      toast("Export failed: " + e.message);
      return false;
    }
  }
  const blob = new Blob([data], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
async function exportCsv() {
  const rows = [
    [
      "Record type",
      "ID",
      "Name",
      "Category",
      "Amount GBP",
      "Date",
      "Billing cycle",
      "Start date",
      "End date",
      "Active",
      "Notes",
    ],
  ];
  state.transactions.forEach((t) =>
    rows.push([
      "Expense",
      t.id,
      t.name,
      t.category,
      t.amount,
      t.date,
      "",
      "",
      "",
      "",
      t.notes,
    ]),
  );
  state.subscriptions.forEach((s) =>
    rows.push([
      "Subscription",
      s.id,
      s.name,
      s.category,
      s.cost,
      s.renewal,
      s.cycle,
      s.start,
      s.end,
      s.active,
      s.notes,
    ]),
  );
  Object.entries(state.budgets).forEach(([m, b]) => {
    rows.push(["Monthly income", m, "Income", "", b.income, m]);
    rows.push(["Monthly budget", m, "Budget", "", b.limit, m]);
  });
  state.goals.forEach((g) => {
    rows.push(["Savings target", g.id, g.name, "", g.target, g.deadline]);
    rows.push(["Savings balance", g.id, g.name, "", g.saved, dateISO()]);
  });
  if (
    await download(
      csv(rows),
      "tma-finance-" + mode + "-" + dateISO() + ".csv",
      "text/csv;charset=utf-8",
    )
  )
    toast("Finance data exported.");
}
function validateBackup(s) {
  if (s?.version !== 1 || !s.budgets || !s.settings)
    throw Error("Not a TMA-Finance backup.");
  const finite = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
    txt = (t) => typeof t === "string" && t.length <= 1000,
    dt = (t) => /^\d{4}-\d{2}-\d{2}$/.test(t) && Number.isFinite(Date.parse(t)),
    id = (r) => txt(r.id),
    sym = (t) => /^[A-Z0-9.\-]{1,15}$/.test(t);
  for (const k of [
    "transactions",
    "subscriptions",
    "goals",
    "holdings",
    "watchlist",
    "widgets",
    "investmentWidgets",
    "alerts",
    "notifications",
  ])
    if (!Array.isArray(s[k]) || s[k].length > 20000)
      throw Error("Invalid collection: " + k);
  if (
    !Object.entries(s.budgets).every(
      ([m, b]) =>
        /^\d{4}-\d{2}$/.test(m) && finite(b.income) && finite(b.limit),
    )
  )
    throw Error("Invalid budgets.");
  if (
    !s.transactions.every(
      (t) =>
        id(t) &&
        txt(t.name) &&
        categories.includes(t.category) &&
        finite(t.amount) &&
        dt(t.date) &&
        txt(t.notes),
    )
  )
    throw Error("Invalid expenses.");
  if (
    !s.subscriptions.every(
      (t) =>
        id(t) &&
        txt(t.name) &&
        txt(t.category) &&
        finite(t.cost) &&
        ["Monthly", "Quarterly", "Yearly"].includes(t.cycle) &&
        dt(t.start) &&
        (!t.end || dt(t.end)) &&
        (!t.renewal || dt(t.renewal)) &&
        txt(t.notes),
    )
  )
    throw Error("Invalid subscriptions.");
  if (
    !s.goals.every(
      (g) =>
        id(g) &&
        txt(g.name) &&
        finite(g.target) &&
        g.target > 0 &&
        finite(g.saved) &&
        dt(g.deadline),
    )
  )
    throw Error("Invalid goals.");
  if (
    !s.holdings.every(
      (h) =>
        id(h) &&
        sym(h.symbol) &&
        finite(h.quantity) &&
        h.quantity > 0 &&
        finite(h.cost),
    )
  )
    throw Error("Invalid holdings.");
  if (
    !s.watchlist.every(sym) ||
    !s.widgets.every((k) => Object.hasOwn(widgets, k)) ||
    !s.investmentWidgets.every(
      (w) => id(w) && sym(w.symbol) && ["price", "chart"].includes(w.type),
    )
  )
    throw Error("Invalid widgets.");
  if (
    !s.alerts.every(
      (a) =>
        id(a) &&
        sym(a.symbol) &&
        finite(a.price) &&
        ["above", "below"].includes(a.direction),
    )
  )
    throw Error("Invalid alerts.");
  if (
    !s.notifications.every(
      (n) => id(n) && txt(n.title) && txt(n.text) && finite(n.at),
    )
  )
    throw Error("Invalid notifications.");
  if (
    !s.quotes ||
    !Object.entries(s.quotes).every(
      ([k, q]) =>
        sym(k) &&
        q.symbol === k &&
        txt(q.name) &&
        finite(q.price) &&
        typeof q.change === "number" &&
        Number.isFinite(q.change) &&
        finite(q.at),
    )
  )
    throw Error("Invalid quotes.");
  if (
    !["manual", "60", "300", "900"].includes(s.settings.refresh) ||
    !finite(s.settings.crashPercent) ||
    s.settings.crashPercent > 100
  )
    throw Error("Invalid preferences.");
  if (
    s.settings.provider != null &&
    !["alphavantage", "finnhub", "twelvedata", "fmp", "marketstack"].includes(
      s.settings.provider,
    )
  )
    throw Error("Invalid market provider.");
  if (
    s.settings.marketSource != null &&
    !["shared", "personal"].includes(s.settings.marketSource)
  )
    throw Error("Invalid market connection.");
  return s;
}
async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5000000) throw Error("Backups must be smaller than 5 MB.");
    importContent(await file.text());
  } catch (err) {
    toast("Could not import: " + err.message);
  }
}
function importContent(content) {
  try {
    const s = validateBackup(JSON.parse(content));
    confirmAction(
      "Replace this workspace?",
      "The imported backup replaces your current " +
        mode +
        " records. Export a backup first if needed.",
      () => {
        state = s;
        save();
        setupPolling();
        render();
        toast("Backup imported.");
      },
    );
  } catch (err) {
    toast("Could not import: " + err.message);
  }
}
async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok)
    throw Error(
      res.status === 429
        ? "Provider rate limit reached. Try again later."
        : res.status === 403
          ? "Your provider plan does not include this data."
          : "Data provider returned HTTP " + res.status,
    );
  const data = await res.json();
  if (data.error) throw Error(data.error);
  return data;
}
async function api(path, params = {}) {
  if (!window.desktop?.market)
    throw Error("Open the desktop app to connect to market data.");
  if (!providerConnected)
    throw Error("Connect " + providerName() + " in Settings first.");
  return window.desktop.market({
    action: "request",
    source: marketSource,
    provider,
    operation: path,
    params,
  });
}
async function restoreProvider() {
  if (!window.desktop?.market) return;
  try {
    const status = await window.desktop.market({
      action: "status",
      provider,
      source: marketSource,
    });
    providerConnected = status.configured;
    setupPolling();
    render();
  } catch {
    providerConnected = false;
  }
}
async function refreshQuotes() {
  if (!providerConnected) {
    toast("Connect a provider in Settings to refresh quotes.");
    return;
  }
  if (refreshing) return;
  refreshing = true;
  render();
  const symbols = [
    ...new Set([
      ...state.watchlist,
      ...state.holdings.map((h) => h.symbol),
      ...state.alerts.map((a) => a.symbol),
      ...state.investmentWidgets.map((w) => w.symbol),
    ]),
  ];
  if (!symbols.length) symbols.push("AAPL");
  const targetState = state;
  const requestProvider = provider;
  const requestSource = marketSource;
  let loaded = 0,
    error = "";
  for (const sym of symbols.slice(0, provider === "finnhub" ? 25 : 5)) {
    try {
      if (provider !== requestProvider || marketSource !== requestSource) break;
      const q = await api("quote", { symbol: sym });
      if (provider !== requestProvider || marketSource !== requestSource) break;
      if (!Number.isFinite(q.c) || q.c <= 0)
        throw Error("No quote returned for " + sym);
      if (state !== targetState) break;
      targetState.quotes[sym] = {
        ...targetState.quotes[sym],
        symbol: sym,
        name: companyName(sym),
        sector: quote(sym)?.sector || getCompany(sym)?.[2] || "",
        price: q.c,
        change: q.dp || 0,
        previousClose: q.pc,
        at: Date.now(),
        marketAt: q.t,
        demo: false,
        manual: false,
        providerName: providerName(),
      };
      loaded++;
    } catch (e) {
      error = e.message;
      break;
    }
  }
  if (state === targetState) {
    evaluateAlerts();
    save();
  }
  refreshing = false;
  render();
  toast(
    error && !loaded
      ? "Connection failed: " + error
      : loaded + " quotes updated." + (error ? " " + error : ""),
  );
}
function evaluateAlerts() {
  for (const a of state.alerts) {
    const q = quote(a.symbol);
    if (!q || q.demo) continue;
    if (
      !a.triggered &&
      (a.direction === "above" ? q.price >= a.price : q.price <= a.price)
    ) {
      a.triggered = true;
      state.notifications.push({
        id: uid(),
        title: a.symbol + " price condition reached",
        text:
          money(q.price, "USD") +
          " " +
          (a.direction === "above" ? "≥" : "≤") +
          " " +
          money(a.price, "USD"),
        at: Date.now(),
      });
    }
  }
  for (const sym of state.watchlist) {
    const q = quote(sym);
    if (!q || q.demo || q.change > -state.settings.crashPercent) continue;
    const marker = "fall:" + sym + ":" + dateISO();
    if (!state.notifications.some((n) => n.marker === marker))
      state.notifications.push({
        id: uid(),
        title: sym + " large daily fall",
        text: num(q.change) + "% change at latest quote check.",
        at: Date.now(),
        marker,
      });
  }
  state.notifications = state.notifications.slice(-100);
}
function setupPolling() {
  clearInterval(pollTimer);
  if (
    providerConnected &&
    (provider === "alphavantage" || state.settings.refresh !== "manual")
  )
    pollTimer = setInterval(
      () => {
        if (!document.hidden) refreshQuotes();
      },
      provider === "alphavantage"
        ? 86400000
        : Number(state.settings.refresh) * 1000,
    );
}
async function loadProfile() {
  const target = symbol;
  toast("Loading company data…");
  try {
    const p = await api("stock/profile2", { symbol: target });
    if (!p.name) throw Error("No company profile returned.");
    if (p.currency && p.currency !== "USD")
      throw Error("This version supports USD-listed equities only.");
    profileData[target] = p;
    if (quote(target)) {
      state.quotes[target].name = p.name;
      state.quotes[target].sector = p.finnhubIndustry;
      save();
    }
    let extraError = "";
    try {
      const data = await api("stock/metric", { symbol: target, metric: "all" });
      profileData[target].metric = data.metric || {};
    } catch (e) {
      extraError = " Fundamentals: " + e.message;
    }
    render();
    toast("Company profile loaded." + extraError);
  } catch (e) {
    toast(e.message);
  }
}
async function loadHistory() {
  const target = symbol;
  toast("Loading price history…");
  try {
    const now = Math.floor(Date.now() / 1000),
      h = await api("stock/candle", {
        symbol: target,
        resolution: "D",
        from: now - 86400 * 365 * 5,
        to: now,
      });
    if (h.s !== "ok" || !Array.isArray(h.c) || h.c.length < 2)
      throw Error("No price history returned. Check provider plan coverage.");
    histories[target] = h;
    render();
    toast("Price history loaded.");
  } catch (e) {
    toast(e.message);
  }
}
async function loadNews(company) {
  toast("Loading news…");
  newsError = "";
  try {
    const to = dateISO(),
      from = dateISO(new Date(Date.now() - 86400000 * 7));
    const items = await api(
      company ? "company-news" : "news",
      company ? { symbol, from, to } : { category: "general" },
    );
    if (!Array.isArray(items)) throw Error("Unexpected news response.");
    newsItems = items.slice(0, 30);
    newsLoaded = true;
    render();
    toast("News updated.");
  } catch (e) {
    newsError = e.message;
    render();
    toast(e.message);
  }
}
async function searchStocks(query) {
  try {
    const results = await api("search", { q: query });
    const container = $("#search-results");
    if (container)
      container.innerHTML = `<h3 style="margin-top:25px">Provider search results</h3>${
        (results.result || [])
          .filter((r) => !r.symbol.includes(":"))
          .slice(0, 20)
          .map(
            (r) =>
              `<div class="watch-row"><strong>${esc(r.symbol)}</strong>${esc(r.description)}<span>${button("Open profile", "profile", "arrow", "quiet", `data-symbol="${esc(r.symbol)}"`)}</span></div>`,
          )
          .join("") || '<p class="note">No results found.</p>'
      }`;
  } catch (e) {
    toast(e.message);
  }
}
async function convert(form) {
  const v = formValues(form);
  fxValues = { amount: +v.amount, from: v.from, to: v.to };
  const request = { ...fxValues };
  fxBusy = true;
  fxResult = null;
  render();
  try {
    let rate = 1,
      date = dateISO();
    if (request.from !== request.to) {
      const d = await fetchJson(
        `https://api.frankfurter.dev/v1/latest?base=${request.from}&symbols=${request.to}`,
      );
      rate = d.rates?.[request.to];
      date = d.date;
      if (!Number.isFinite(rate) || rate <= 0)
        throw Error("No valid exchange rate returned.");
    }
    fxResult = { ...request, rate, date, value: request.amount * rate };
  } catch (e) {
    toast("Conversion unavailable: " + e.message);
  }
  fxBusy = false;
  render();
}
window.desktop?.onExport(() => exportCsv());
save();
render();

restoreProvider();
