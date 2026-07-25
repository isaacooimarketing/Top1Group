const test = require("node:test");
const assert = require("node:assert/strict");

const {
  daily,
  bankTransfers,
  cashWithdrawals,
  timelineTotals
} = require("../scripts/driver-history-fixture");

const byDate = date => daily.find(item => item.date === date);

test("driver history fixture includes latest records through 24 July 2026", () => {
  assert.equal(byDate("2026-06-23").net, 291.71);
  assert.equal(byDate("2026-06-25").net, 104.99);
  assert.equal(byDate("2026-06-26").net, 278.57);
  assert.equal(byDate("2026-06-27").net, 89.96);
  assert.equal(byDate("2026-06-28").net, 203.6);
  assert.equal(byDate("2026-06-29"), undefined);
  assert.equal(byDate("2026-06-30").net, 328.69);
  assert.equal(byDate("2026-07-02").net, 275.2);
  assert.equal(byDate("2026-07-20").net, 230.69);
  assert.equal(byDate("2026-07-24").net, 234.9);
});

test("latest Grab records exclude RM5.50 insurance from corrected cost", () => {
  for (const date of ["2026-06-23", "2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28", "2026-06-30", "2026-07-02", "2026-07-20", "2026-07-24"]) {
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
      ["2026-07-02", 156.55],
      ["2026-07-03", 256.08],
      ["2026-07-04", 193.82],
      ["2026-07-07", 286.91],
      ["2026-07-08", 245.34],
      ["2026-07-09", 165.22],
      ["2026-07-10", 168.16],
      ["2026-07-12", 63.33],
      ["2026-07-15", 414.76],
      ["2026-07-16", 284.06],
      ["2026-07-17", 45.19],
      ["2026-07-18", 158.51],
      ["2026-07-19", 42.26],
      ["2026-07-20", 133.52],
      ["2026-07-21", 238.2],
      ["2026-07-22", 424.29],
      ["2026-07-23", 255.89],
      ["2026-07-24", 135.52]
    ]
  );
  assert.deepEqual(cashWithdrawals.find(item => item.date === "2026-06-28"), {
    date: "2026-06-28",
    fromAccount: "cash_at_home",
    amount: 400,
    category: "pocket money"
  });
  assert.deepEqual(cashWithdrawals.find(item => item.date === "2026-07-18"), {
    date: "2026-07-18",
    fromAccount: "cash_at_home",
    amount: 200,
    category: "pocket money"
  });
});

test("timeline totals reconcile through 24 July 2026", () => {
  assert.equal(timelineTotals.scope, "timeline_import_2026_05_07_to_2026_07_24");
  assert.equal(timelineTotals.operatingSales, 18245.64);
  assert.equal(timelineTotals.salesWithRefunds, 18415.64);
  assert.equal(timelineTotals.operatingCost, 3543.33);
  assert.equal(timelineTotals.operatingNet, 14702.31);
  assert.equal(timelineTotals.netAfterPreGrabExpenses, 14046.95);
  assert.equal(timelineTotals.netAfterPreGrabExpensesAndRefunds, 14216.95);
});
