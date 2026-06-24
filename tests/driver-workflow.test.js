const test = require("node:test");
const assert = require("node:assert/strict");

const { recordChanges } = require("../public/record-utils");
const { buildDailySummary } = require("../public/summary-utils");
const {
  normalizePetrolEntry,
  petrolTotals
} = require("../public/petrol-utils");

test("recordChanges reports only changed operational fields", () => {
  const changes = recordChanges(
    { cashCollected: 120, totalTrips: 18, remark: "same" },
    { cashCollected: 150, totalTrips: 21, remark: "same" }
  );
  assert.deepEqual(changes, [
    { label: "Cash Collected", before: 120, after: 150, format: "money" },
    { label: "Total Trips", before: 18, after: 21, format: "number" }
  ]);
});

test("buildDailySummary includes execution, income, cost, and cash movement", () => {
  const summary = buildDailySummary({
    record: { date: "2026-06-23", totalTrips: 20 },
    metrics: {
      hours: 8,
      trips: 20,
      income: 400,
      cost: 80,
      net: 320,
      incomePerHour: 50,
      cashIncome: 140,
      tngIncome: 60,
      grabWalletIncome: 200,
      petrol: 55,
      toll: 25,
      grabWalletTopUp: 0
    },
    cashBefore: 500,
    confirmedCash: 140,
    pettyCash: 440,
    cashAtHome: 200
  });

  assert.equal(summary.cashAfter, 640);
  assert.equal(summary.totalCash, 640);
  assert.equal(summary.net, 320);
});

test("petrolTotals separates operating cost from credit-card liability", () => {
  const entries = [
    normalizePetrolEntry({ amount: 100, station: "Petron", paymentMethod: "Credit Card" }),
    normalizePetrolEntry({ amount: 40, station: "Shell", paymentMethod: "Cash" }),
    normalizePetrolEntry({ amount: 20, station: "Petron", paymentMethod: "Points / Rewards" })
  ];
  const totals = petrolTotals(entries, [{ amount: 65 }]);

  assert.equal(totals.operatingCost, 140);
  assert.equal(totals.cardCharged, 100);
  assert.equal(totals.cardPaid, 65);
  assert.equal(totals.cardOutstanding, 35);
  assert.equal(totals.rewardsValue, 20);
});
