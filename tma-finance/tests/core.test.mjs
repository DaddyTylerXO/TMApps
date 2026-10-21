import test from "node:test";
import assert from "node:assert/strict";
import {
  taxEstimate,
  goalStats,
  monthStats,
  monthly,
  csv,
  emptyState,
} from "../dist/core.js";
test("UK 2026/27 personal allowance and Class 4 thresholds", () => {
  assert.equal(taxEstimate(12570, 0).total, 0);
  assert.deepEqual(taxEstimate(50270, 0), {
    profit: 50270,
    allowance: 12570,
    tax: 7540,
    ni: 2262,
    total: 9802,
    takeHome: 40468,
  });
  assert.equal(taxEstimate(100000, 0).tax, 27432);
  assert.equal(taxEstimate(110000, 0).allowance, 7570);
  assert.equal(taxEstimate(110000, 0).tax, 33432);
  assert.equal(taxEstimate(125140, 0).tax, 42516);
  assert.equal(taxEstimate(150000, 0).tax, 53703);
  assert.equal(taxEstimate(500, 1000).total, 0);
});
test("Scottish 2026/27 bands and allowance taper", () => {
  assert.equal(taxEstimate(16537, 0, "scotland").tax, 753.73);
  assert.equal(taxEstimate(29526, 0, "scotland").tax, 3351.53);
  assert.equal(taxEstimate(43662, 0, "scotland").tax, 6320.09);
  assert.equal(taxEstimate(75000, 0, "scotland").tax, 19482.05);
  assert.equal(taxEstimate(100000, 0, "scotland").tax, 30732.05);
  assert.equal(taxEstimate(110000, 0, "scotland").tax, 37482.05);
  assert.equal(taxEstimate(150000, 0, "scotland").tax, 59634.35);
});
test("subscriptions normalise billing and exclude inactive contracts", () => {
  assert.equal(monthly({ cost: 120, cycle: "Yearly" }), 10);
  assert.equal(monthly({ cost: 30, cycle: "Quarterly" }), 10);
  assert.equal(monthly({ cost: 20, cycle: "Monthly", active: false }), 0);
  const s = emptyState();
  s.budgets["2026-10"] = { income: 2000, limit: 1000 };
  s.transactions = [
    { date: "2026-10-21", amount: 100 },
    { date: "2026-09-01", amount: 500 },
  ];
  s.subscriptions = [
    { start: "2026-01-01", end: "", cost: 120, cycle: "Yearly" },
    { start: "2027-01-01", cost: 100, cycle: "Monthly" },
    { start: "2025-01-01", end: "2026-09-30", cost: 100, cycle: "Monthly" },
  ];
  const n = monthStats(s, "2026-10");
  assert.equal(n.expenses, 110);
  assert.equal(n.remaining, 890);
  assert.equal(n.cashRemaining, 1890);
});
test("goal planning handles future, expired and completed goals", () => {
  assert.equal(
    goalStats({ target: 100, saved: 50, deadline: "2026-10-31" }, "2026-10-21")
      .daily,
    5,
  );
  assert.equal(
    goalStats({ target: 100, saved: 50, deadline: "2026-10-20" }, "2026-10-21")
      .daily,
    null,
  );
  assert.equal(
    goalStats({ target: 100, saved: 120, deadline: "2026-10-31" }, "2026-10-21")
      .percent,
    100,
  );
});
test("CSV preserves quoted fields and prevents formula execution", () => {
  const result = csv([['=HYPERLINK("bad")', "a,b", "multi\nline", "normal"]]);
  assert.ok(result.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(result.includes('"a,b"'));
  assert.ok(result.includes('"multi\nline"'));
});
