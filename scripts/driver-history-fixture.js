const daily = [
  record("2026-05-07", "Bolt", 70.4, 0, 70.4, 0, 0, 0, 0, 0, 0, 0, "Bolt tng collected"),
  record("2026-05-08", "Grab", 291.82, 129.56, 162.26, 8, 13, 69.56, 0, 0, 58, 5.5, "Insurance excluded from corrected cost"),
  record("2026-05-10", "Grab", 312.71, 47.44, 265.27, 11, 28, 47.44, 0, 0, 324, 5.5, "Wallet decrease reflected in sales"),
  record("2026-05-12", "Grab", 209.64, 49.5, 160.14, 11, 30, 49.5, 0, 0, 92, 5.5, "Insurance excluded"),
  record("2026-05-13", "Grab", 294.3, 43.85, 250.45, 10.5, 24, 43.85, 0, 0, 90, 5.5, "Refund separated"),
  record("2026-05-14", "Bolt", 233, 51.36, 181.64, 10, 14, 51.36, 0, 0, 127, 0, "Bolt day"),
  record("2026-05-15", "Grab", 310.36, 50.67, 259.69, 11, 23, 50.67, 0, 0, 70, 5.5, "Summary cost already excluded insurance"),
  record("2026-05-16", "Grab", 401.26, 53.73, 347.53, 14, 33, 53.73, 0, 0, 158, 5.5, "Insurance excluded"),
  record("2026-05-17", "Grab", 111.2, 127.59, -16.39, 3, 7, 27.59, 0, 100, 45, 5.5, "Credit wallet top up counted as cost"),
  record("2026-05-18", "Grab", 260.73, 156.11, 104.62, 11.5, 27, 53.07, 3.04, 100, 157, 5.5, "Credit wallet top up counted as cost"),
  record("2026-05-19", "Bolt", 381.12, 50.86, 330.26, 11.25, 17, 49.94, 0.98, 0, 166, 0, "Bolt day"),
  record("2026-05-20", "Bolt", 244.67, 53.39, 191.28, 12, 16, 51.83, 1.56, 0, 117, 0, "Bolt day"),
  record("2026-05-23", "Bolt", 344.94, 61.18, 283.76, 10, 10, 53.81, 7.37, 0, 35, 0, "Bolt day"),
  record("2026-05-24", "Bolt", 263.76, 62.8, 200.96, 11, 14, 52.71, 10.09, 0, 124, 0, "Bolt day"),
  record("2026-05-26", "Bolt", 243, 55.47, 187.53, 9.5, 12, 49.57, 5.9, 0, 113, 0, "Bolt day"),
  record("2026-05-27", "Bolt", 180.44, 54.38, 126.06, 6, 7, 35.85, 18.53, 0, 116, 0, "Bolt tng negative counted in cost"),
  record("2026-05-30", "Bolt", 98.01, 50.45, 47.56, 5, 8, 39.03, 11.42, 0, 80, 0, "Bolt tng negative counted in cost"),
  record("2026-05-31", "Bolt", 401.6, 65.2, 336.4, 12, 18, 58.56, 6.64, 0, 127, 0, "Bolt day"),
  record("2026-06-01", "Bolt", 192.83, 80.8, 112.03, 5, 6, 54.34, 26.46, 0, 131, 0, "Bolt tng negative counted in cost"),
  record("2026-06-03", "Bolt", 48.9, 45.97, 2.93, 1.5, 1, 45.97, 0, 0, 44, 0, "Solar appointment toll excluded"),
  record("2026-06-04", "Bolt", 349.77, 33.39, 316.38, 12, 12, 12.95, 20.44, 0, 160, 0, "Free petrol noted but not costed"),
  record("2026-06-06", "Bolt", 171.32, 19.99, 151.33, 7, 9, 18.19, 1.8, 0, 71, 0, "Free petrol noted but not costed"),
  record("2026-06-07", "Grab", 264.45, 43.85, 220.6, 7, 18, 40.21, 3.64, 0, 141, 5.5, "Insurance excluded"),
  record("2026-06-08", "Grab", 487.66, 76.69, 410.97, 13, 29, 61.93, 14.76, 0, 360, 5.5, "Insurance excluded"),
  record("2026-06-09", "Grab", 163.96, 44.38, 119.58, 6, 15, 38.78, 5.6, 0, 50, 5.5, "Insurance excluded"),
  record("2026-06-11", "Grab", 263.97, 44.8, 219.17, 9, 24, 43.8, 1, 0, 68, 5.5, "Summary cost excludes insurance"),
  record("2026-06-12", "Grab", 186.79, 62.33, 124.46, 6, 13, 38.6, 23.73, 0, 171, 5.5, "TNG negative counted in cost"),
  record("2026-06-14", "Grab", 247.78, 49.04, 198.74, 9, 25, 47.73, 1.31, 0, 140, 5.5, "Summary cost excludes insurance"),
  record("2026-06-15", "Grab", 331.18, 69.95, 261.23, 11, 24, 57.47, 12.48, 0, 65, 5.5, "Summary cost excludes insurance"),
  record("2026-06-16", "Grab", 355.72, 54.84, 300.88, 11, 26, 47.95, 6.89, 0, 72, 5.5, "Summary cost excludes insurance"),
  record("2026-06-17", "Grab", 438.14, 69.63, 368.51, 16, 51, 68.63, 1, 0, 211, 5.5, "Summary cost excludes insurance"),
  record("2026-06-19", "Grab", 321.76, 49.97, 271.79, 10, 24, 49.97, 0, 0, 45, 5.5, "Summary cost excludes insurance"),
  record("2026-06-20", "Grab", 316.8, 61.48, 255.32, 12, 27, 59.66, 1.82, 0, 139, 5.5, "Summary cost excludes insurance"),
  record("2026-06-21", "Grab", 456.34, 70.87, 385.47, 15, 38, 66.74, 4.13, 0, 210, 5.5, "Summary cost excludes insurance"),
  record("2026-06-22", "Grab", 397.57, 56.46, 341.11, 12, 29, 56.46, 0, 0, 41, 5.5, "Summary cost excludes insurance"),
  record("2026-06-23", "Grab", 362.43, 70.72, 291.71, 12, 25, 60.47, 10.25, 0, 125, 5.5, "Summary cost excludes insurance"),
  record("2026-06-25", "Grab", 148.29, 43.3, 104.99, 0, 0, 26.8, 16.5, 0, 34, 5.5, "Hours and trips missing in raw note"),
  record("2026-06-26", "Grab", 333.63, 55.06, 278.57, 13, 30, 55.06, 0, 0, 165, 5.5, "Summary cost excludes insurance"),
  record("2026-06-27", "Grab", 138.87, 48.91, 89.96, 5, 13, 44.81, 4.1, 0, 45, 5.5, "Summary cost excludes insurance"),
  record("2026-06-28", "Grab", 181.35, 40.57, 140.78, 5, 20, 40.57, 0, 0, 131, 5.5, "Summary cost excludes insurance")
];

const setupExpenses = [
  setup("2026-05-01", "Training", 100),
  setup("2026-05-01", "Medical", 50),
  setup("2026-05-01", "PSV License", 20),
  setup("2026-05-05", "Petron", 47.76),
  setup("2026-05-05", "Rental for 2 weeks", 390),
  setup("2026-05-05", "E-hailing Stickers", 15),
  setup("2026-05-06", "MR DIY front seat cushion", 4.5),
  setup("2026-05-06", "MR DIY rear seat cushion", 13.9),
  setup("2026-05-07", "MR DIY car mirror", 8.9),
  setup("2026-05-07", "MR DIY sun shade", 5.3)
];

const bankTransfers = [
  transfer("2026-05-16", "grab_wallet", 926.84),
  transfer("2026-06-01", "cash_at_home_bank_in", 1600),
  transfer("2026-06-07", "cash_at_home_bank_in", 400),
  transfer("2026-06-09", "grab_wallet", 32.94),
  transfer("2026-06-10", "grab_wallet", 113.96),
  transfer("2026-06-11", "grab_wallet", 174.38),
  transfer("2026-06-12", "grab_wallet", 15.79),
  transfer("2026-06-14", "grab_wallet", 80.48),
  transfer("2026-06-15", "grab_wallet", 253.51),
  transfer("2026-06-16", "grab_wallet", 243.56),
  transfer("2026-06-17", "grab_wallet", 142.69),
  transfer("2026-06-19", "grab_wallet", 296.01),
  transfer("2026-06-20", "grab_wallet", 161.15),
  transfer("2026-06-21", "grab_wallet", 150.54),
  transfer("2026-06-22", "grab_wallet", 300.52),
  transfer("2026-06-24", "grab_wallet", 179),
  transfer("2026-06-24", "grab_wallet", 55.59),
  transfer("2026-06-25", "grab_wallet", 93.49),
  transfer("2026-06-26", "grab_wallet", 159.93),
  transfer("2026-06-27", "grab_wallet", 28.13),
  transfer("2026-06-28", "grab_wallet", 49.66)
];

const cashWithdrawals = [
  cash("2026-06-01", "cash_at_home", 1600, "bank in"),
  cash("2026-06-07", "cash_at_home", 400, "bank in"),
  cash("2026-06-18", "cash_at_home", 400, "service car"),
  cash("2026-06-20", "cash_at_home", 200, "pocket money"),
  cash("2026-06-28", "cash_at_home", 400, "pocket money")
];

const refund = { id: "refund_grab_2026_05_13", date: "2026-05-13", amount: 170, type: "refund_reimbursement", source: "Grab" };

function record(date, platform, income, cost, net, hours, trips, petrol, toll, topUp, cashCollected, ignoredGrabInsurance, note) {
  return { date, platform, income, cost, net, hours, trips, petrol, toll, topUp, cashCollected, ignoredGrabInsurance, note };
}

function setup(date, label, amount) {
  return { date, label, amount };
}

function transfer(date, source, amount) {
  return { date, source, amount };
}

function cash(date, fromAccount, amount, category) {
  return { date, fromAccount, amount, category };
}

const round = value => Math.round(value * 100) / 100;
const baseTotals = daily.reduce((acc, item) => {
  acc.operatingSales += item.income;
  acc.operatingCost += item.cost;
  acc.operatingNet += item.net;
  acc.totalHours += item.hours;
  acc.totalTrips += item.trips;
  acc.ignoredGrabInsurance += item.ignoredGrabInsurance;
  return acc;
}, { operatingSales: 0, operatingCost: 0, operatingNet: 0, totalHours: 0, totalTrips: 0, ignoredGrabInsurance: 0 });

const preGrabExpensesTotal = setupExpenses.reduce((sum, item) => sum + item.amount, 0);
const timelineTotals = {
  scope: "timeline_import_2026_05_07_to_2026_06_28",
  operatingSales: round(baseTotals.operatingSales),
  salesWithRefunds: round(baseTotals.operatingSales + refund.amount),
  operatingCost: round(baseTotals.operatingCost),
  operatingNet: round(baseTotals.operatingNet),
  netAfterPreGrabExpenses: round(baseTotals.operatingNet - preGrabExpensesTotal),
  netAfterPreGrabExpensesAndRefunds: round(baseTotals.operatingNet - preGrabExpensesTotal + refund.amount),
  totalHours: round(baseTotals.totalHours),
  totalTrips: baseTotals.totalTrips,
  ignoredGrabInsurance: round(baseTotals.ignoredGrabInsurance)
};

module.exports = {
  daily,
  setupExpenses,
  bankTransfers,
  cashWithdrawals,
  refund,
  timelineTotals,
  preGrabExpensesTotal
};
