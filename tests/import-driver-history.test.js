const test = require("node:test");
const assert = require("node:assert/strict");

const {
  daily,
  bankTransfers,
  cashWithdrawals,
  timelineTotals
} = require("../scripts/driver-history-fixture");

const byDate = date => daily.find(item => item.date === date);

test("driver history fixture includes latest June 2026 records", () => {
  assert.equal(byDate("2026-06-23").net, 291.71);
  assert.equal(byDate("2026-06-25").net, 104.99);
  assert.equal(byDate("2026-06-26").net, 278.57);
  assert.equal(byDate("2026-06-27").net, 89.96);
  assert.equal(byDate("2026-06-28").net, 140.78);
  assert.equal(byDate("2026-06-29"), undefined);
});

test("latest Grab records exclude RM5.50 insurance from corrected cost", () => {
  for (const date of ["2026-06-23", "2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28"]) {
    const record = byDate(date);
    assert.equal(record.ignoredGrabInsurance, 5.5);
    assert.equal(record.cost, Number((record.petrol + record.toll + record.topUp).toFixed(2)));
  }
});

test("latest Grab wallet transfers and cash withdrawals are preserved", () => {
  const grabTransfers = bankTransfers.filter(item => item.source === "grab_wallet");
  assert.deepEqual(
    grabTransfers.filter(item => item.date >= "2026-06-24").map(item => [item.date, item.amount]),
    [
      ["2026-06-24", 179],
      ["2026-06-24", 55.59],
      ["2026-06-25", 93.49],
      ["2026-06-26", 159.93],
      ["2026-06-27", 28.13],
      ["2026-06-28", 49.66]
    ]
  );
  assert.deepEqual(cashWithdrawals.find(item => item.date === "2026-06-28"), {
    date: "2026-06-28",
    fromAccount: "cash_at_home",
    amount: 400,
    category: "pocket money"
  });
});

test("timeline totals reconcile through 28 June 2026", () => {
  assert.equal(timelineTotals.scope, "timeline_import_2026_05_07_to_2026_06_28");
  assert.equal(timelineTotals.operatingSales, 10812.47);
  assert.equal(timelineTotals.salesWithRefunds, 10982.47);
  assert.equal(timelineTotals.operatingCost, 2356.54);
  assert.equal(timelineTotals.operatingNet, 8455.93);
  assert.equal(timelineTotals.netAfterPreGrabExpenses, 7800.57);
  assert.equal(timelineTotals.netAfterPreGrabExpensesAndRefunds, 7970.57);
});
