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
  assert.equal(byDate("2026-06-28").net, 203.6);
  assert.equal(byDate("2026-06-29"), undefined);
  assert.equal(byDate("2026-06-30").net, 328.69);
  assert.equal(byDate("2026-07-02").net, 275.2);
});

test("latest Grab records exclude RM5.50 insurance from corrected cost", () => {
  for (const date of ["2026-06-23", "2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28", "2026-06-30", "2026-07-02"]) {
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
      ["2026-06-28", 49.66],
      ["2026-06-30", 62.82],
      ["2026-06-30", 221.84],
      ["2026-07-02", 156.55]
    ]
  );
  assert.deepEqual(cashWithdrawals.find(item => item.date === "2026-06-28"), {
    date: "2026-06-28",
    fromAccount: "cash_at_home",
    amount: 400,
    category: "pocket money"
  });
});

test("timeline totals reconcile through 2 July 2026", () => {
  assert.equal(timelineTotals.scope, "timeline_import_2026_05_07_to_2026_07_02");
  assert.equal(timelineTotals.operatingSales, 11575.83);
  assert.equal(timelineTotals.salesWithRefunds, 11745.83);
  assert.equal(timelineTotals.operatingCost, 2453.19);
  assert.equal(timelineTotals.operatingNet, 9122.64);
  assert.equal(timelineTotals.netAfterPreGrabExpenses, 8467.28);
  assert.equal(timelineTotals.netAfterPreGrabExpensesAndRefunds, 8637.28);
});
