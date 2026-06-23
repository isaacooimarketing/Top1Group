const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "app-data.json");
const state = JSON.parse(fs.readFileSync(file, "utf8"));

const daily = [
  ["2026-05-07", "Bolt", 70.4, 0, 70.4, 0, 0, 0, 0, 0, 0, 0, "Bolt tng collected"],
  ["2026-05-08", "Grab", 291.82, 129.56, 162.26, 8, 13, 69.56, 0, 0, 58, 5.5, "Insurance excluded from corrected cost"],
  ["2026-05-10", "Grab", 312.71, 47.44, 265.27, 11, 28, 47.44, 0, 0, 324, 5.5, "Wallet decrease reflected in sales"],
  ["2026-05-12", "Grab", 209.64, 49.5, 160.14, 11, 30, 49.5, 0, 0, 92, 5.5, "Insurance excluded"],
  ["2026-05-13", "Grab", 294.3, 43.85, 250.45, 10.5, 24, 43.85, 0, 0, 90, 5.5, "Refund separated"],
  ["2026-05-14", "Bolt", 233, 51.36, 181.64, 10, 14, 51.36, 0, 0, 127, 0, "Bolt day"],
  ["2026-05-15", "Grab", 310.36, 50.67, 259.69, 11, 23, 50.67, 0, 0, 70, 5.5, "Summary cost already excluded insurance"],
  ["2026-05-16", "Grab", 401.26, 53.73, 347.53, 14, 33, 53.73, 0, 0, 158, 5.5, "Insurance excluded"],
  ["2026-05-17", "Grab", 111.2, 127.59, -16.39, 3, 7, 27.59, 0, 100, 45, 5.5, "Credit wallet top up counted as cost"],
  ["2026-05-18", "Grab", 260.73, 156.11, 104.62, 11.5, 27, 53.07, 3.04, 100, 157, 5.5, "Credit wallet top up counted as cost"],
  ["2026-05-19", "Bolt", 381.12, 50.86, 330.26, 11.25, 17, 49.94, 0.98, 0, 166, 0, "Bolt day"],
  ["2026-05-20", "Bolt", 244.67, 53.39, 191.28, 12, 16, 51.83, 1.56, 0, 117, 0, "Bolt day"],
  ["2026-05-23", "Bolt", 344.94, 61.18, 283.76, 10, 10, 53.81, 7.37, 0, 35, 0, "Bolt day"],
  ["2026-05-24", "Bolt", 263.76, 62.8, 200.96, 11, 14, 52.71, 10.09, 0, 124, 0, "Bolt day"],
  ["2026-05-26", "Bolt", 243, 55.47, 187.53, 9.5, 12, 49.57, 5.9, 0, 113, 0, "Bolt day"],
  ["2026-05-27", "Bolt", 180.44, 54.38, 126.06, 6, 7, 35.85, 18.53, 0, 116, 0, "Bolt tng negative counted in cost"],
  ["2026-05-30", "Bolt", 98.01, 50.45, 47.56, 5, 8, 39.03, 11.42, 0, 80, 0, "Bolt tng negative counted in cost"],
  ["2026-05-31", "Bolt", 401.6, 65.2, 336.4, 12, 18, 58.56, 6.64, 0, 127, 0, "Bolt day"],
  ["2026-06-01", "Bolt", 192.83, 80.8, 112.03, 5, 6, 54.34, 26.46, 0, 131, 0, "Bolt tng negative counted in cost"],
  ["2026-06-03", "Bolt", 48.9, 45.97, 2.93, 1.5, 1, 45.97, 0, 0, 44, 0, "Solar appointment toll excluded"],
  ["2026-06-04", "Bolt", 349.77, 33.39, 316.38, 12, 12, 12.95, 20.44, 0, 160, 0, "Free petrol noted but not costed"],
  ["2026-06-06", "Bolt", 171.32, 19.99, 151.33, 7, 9, 18.19, 1.8, 0, 71, 0, "Free petrol noted but not costed"],
  ["2026-06-07", "Grab", 264.45, 43.85, 220.6, 7, 18, 40.21, 3.64, 0, 141, 5.5, "Insurance excluded"],
  ["2026-06-08", "Grab", 487.66, 76.69, 410.97, 13, 29, 61.93, 14.76, 0, 360, 5.5, "Insurance excluded"],
  ["2026-06-09", "Grab", 163.96, 44.38, 119.58, 6, 15, 38.78, 5.6, 0, 50, 5.5, "Insurance excluded"],
  ["2026-06-11", "Grab", 263.97, 44.8, 219.17, 9, 24, 43.8, 1, 0, 68, 5.5, "Summary cost excludes insurance"],
  ["2026-06-12", "Grab", 186.79, 62.33, 124.46, 6, 13, 38.6, 23.73, 0, 171, 5.5, "TNG negative counted in cost"],
  ["2026-06-14", "Grab", 247.78, 49.04, 198.74, 9, 25, 47.73, 1.31, 0, 140, 5.5, "Summary cost excludes insurance"],
  ["2026-06-15", "Grab", 331.18, 69.95, 261.23, 11, 24, 57.47, 12.48, 0, 65, 5.5, "Summary cost excludes insurance"],
  ["2026-06-16", "Grab", 355.72, 54.84, 300.88, 11, 26, 47.95, 6.89, 0, 72, 5.5, "Summary cost excludes insurance"],
  ["2026-06-17", "Grab", 438.14, 69.63, 368.51, 16, 51, 68.63, 1, 0, 211, 5.5, "Summary cost excludes insurance"],
  ["2026-06-19", "Grab", 321.76, 49.97, 271.79, 10, 24, 49.97, 0, 0, 45, 5.5, "Summary cost excludes insurance"],
  ["2026-06-20", "Grab", 316.8, 61.48, 255.32, 12, 27, 59.66, 1.82, 0, 139, 5.5, "Summary cost excludes insurance"],
  ["2026-06-21", "Grab", 456.34, 70.87, 385.47, 15, 38, 66.74, 4.13, 0, 210, 5.5, "Summary cost excludes insurance"],
  ["2026-06-22", "Grab", 397.57, 56.46, 341.11, 12, 29, 56.46, 0, 0, 41, 5.5, "Summary cost excludes insurance"]
];

const setupExpenses = [
  ["2026-05-01", "Training", 100],
  ["2026-05-01", "Medical", 50],
  ["2026-05-01", "PSV License", 20],
  ["2026-05-05", "Petron", 47.76],
  ["2026-05-05", "Rental for 2 weeks", 390],
  ["2026-05-05", "E-hailing Stickers", 15],
  ["2026-05-06", "MR DIY front seat cushion", 4.5],
  ["2026-05-06", "MR DIY rear seat cushion", 13.9],
  ["2026-05-07", "MR DIY car mirror", 8.9],
  ["2026-05-07", "MR DIY sun shade", 5.3]
];

const bankTransfers = [
  ["2026-05-16", "grab_wallet", 926.84],
  ["2026-06-01", "cash_at_home_bank_in", 1600],
  ["2026-06-07", "cash_at_home_bank_in", 400],
  ["2026-06-09", "grab_wallet", 32.94],
  ["2026-06-10", "grab_wallet", 113.96],
  ["2026-06-11", "grab_wallet", 174.38],
  ["2026-06-12", "grab_wallet", 15.79],
  ["2026-06-14", "grab_wallet", 80.48],
  ["2026-06-15", "grab_wallet", 253.51],
  ["2026-06-16", "grab_wallet", 243.56],
  ["2026-06-17", "grab_wallet", 142.69],
  ["2026-06-19", "grab_wallet", 296.01],
  ["2026-06-20", "grab_wallet", 161.15],
  ["2026-06-21", "grab_wallet", 150.54],
  ["2026-06-22", "grab_wallet", 300.52]
];

const cashWithdrawals = [
  ["2026-06-01", "cash_at_home", 1600, "bank in"],
  ["2026-06-07", "cash_at_home", 400, "bank in"],
  ["2026-06-18", "cash_at_home", 400, "service car"],
  ["2026-06-20", "cash_at_home", 200, "pocket money"]
];

const refund = { id: "refund_grab_2026_05_13", date: "2026-05-13", amount: 170, type: "refund_reimbursement", source: "Grab" };

state.driverSessions = (state.driverSessions || []).filter(item =>
  !String(item.id).startsWith("drive_timeline_") &&
  !String(item.id).startsWith("drive_import_2026_06_")
);
state.incomeEntries = (state.incomeEntries || []).filter(item =>
  !String(item.id).startsWith("income_legacy_driver_drive_timeline_") &&
  !String(item.id).startsWith("income_legacy_driver_drive_import_2026_06_")
);
state.events = (state.events || []).filter(item =>
  !String(item.id).startsWith("event_legacy_driver_drive_timeline_") &&
  !String(item.id).startsWith("event_legacy_driver_drive_import_2026_06_")
);
state.activityLogs = (state.activityLogs || []).filter(item => !String(item.id).startsWith("log_driver_timeline_"));
state.driverRawRecords = (state.driverRawRecords || []).filter(item => !String(item.id).startsWith("raw_timeline_") && item.id !== refund.id);
state.bankTransfers = (state.bankTransfers || []).filter(item => !String(item.id).startsWith("bank_timeline_"));
state.cashLedger = (state.cashLedger || []).filter(item => !String(item.id).startsWith("cash_timeline_"));

for (const row of daily) {
  const [date, platform, income, cost, net, hours, trips, petrol, toll, topUp, cashCollected, ignoredGrabInsurance, note] = row;
  const id = `drive_timeline_${date.replaceAll("-", "_")}`;
  state.driverSessions.push({
    id,
    rawRecordId: `raw_timeline_${date}`,
    importSource: "user_manual_timeline",
    driverIncomeModel: "corrected_daily_summary_v1",
    date,
    platform,
    startTime: "",
    endTime: "",
    status: "Finished",
    totalDrivingHours: hours,
    totalTrips: trips,
    correctedIncome: income,
    correctedCost: cost,
    correctedNet: net,
    originalCost: cost + ignoredGrabInsurance,
    ignoredGrabInsurance,
    petrolCost: petrol,
    smartTagReduction: toll,
    grabCreditWalletTopUp: topUp,
    walletIncreaseIncome: income - cashCollected,
    cashCollected,
    accountingNote: `${note}. RM5.50 Grab insurance kept as raw note only, not corrected cost.`,
    remark: note
  });
  state.driverRawRecords.push({
    id: `raw_timeline_${date}`,
    type: "driver_daily_record",
    source: "user_manual_timeline",
    date,
    platform,
    income,
    correctedCost: cost,
    correctedNet: net,
    hours,
    trips,
    ignoredGrabInsurance,
    note
  });
}

for (const [date, label, amount] of setupExpenses) {
  state.driverRawRecords.push({
    id: `raw_timeline_setup_${date}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    type: "pre_grab_expense",
    date,
    label,
    amount
  });
}

state.driverRawRecords.push(refund);

for (const [date, source, amount] of bankTransfers) {
  state.bankTransfers.push({ id: `bank_timeline_${date}_${source}_${amount}`.replace(/[^a-z0-9_]+/gi, "_"), date, source, amount });
}

for (const [date, fromAccount, amount, category] of cashWithdrawals) {
  state.cashLedger.push({
    id: `cash_timeline_${date}_${category}`.replace(/[^a-z0-9_]+/gi, "_"),
    date,
    type: "cash_withdrawal",
    fromAccount,
    amount,
    category
  });
}

state.grabSettings = {
  carRentalTarget: 390,
  housingLoanTarget: 1000,
  grabWalletBase: 500,
  pettyCashOpening: 0,
  cashAtHomeOpening: 0,
  cashCategories: ["bank in", "pocket money", "service car"]
};

const totals = daily.reduce((acc, row) => {
  acc.totalSales += row[2];
  acc.totalCost += row[3];
  acc.totalNetIncome += row[4];
  acc.totalHours += row[5];
  acc.totalTrips += row[6];
  acc.ignoredGrabInsurance += row[11];
  return acc;
}, { totalSales: 0, totalCost: 0, totalNetIncome: 0, totalHours: 0, totalTrips: 0, ignoredGrabInsurance: 0 });

const round = value => Math.round(value * 100) / 100;
state.driverAnalytics = {
  generatedAt: new Date().toISOString(),
  scope: "timeline_import_2026_05_07_to_2026_06_22",
  accountingRules: {
    grabInsuranceCountedAsCost: false,
    grabCreditWalletTopUpCountedAsCost: true,
    petrolCountedAsCost: true,
    tollCountedAsCost: true,
    walletIncreaseCountedAsIncome: true,
    refundSeparatedFromDailySales: true,
    cashWithdrawalsSeparatedFromGrabProfit: true
  },
  timelineTotals: {
    ...totals,
    totalSales: round(totals.totalSales),
    totalCost: round(totals.totalCost),
    totalNetIncome: round(totals.totalNetIncome),
    averageIncomePerHour: round(totals.totalSales / totals.totalHours),
    averageNetPerHour: round(totals.totalNetIncome / totals.totalHours),
    averageNetPerTrip: round(totals.totalNetIncome / totals.totalTrips),
    ignoredGrabInsurance: round(totals.ignoredGrabInsurance)
  },
  preGrabExpenses: {
    total: round(setupExpenses.reduce((sum, item) => sum + item[2], 0)),
    items: setupExpenses.map(([date, label, amount]) => ({ date, label, amount }))
  },
  refundsAndReimbursements: {
    total: refund.amount,
    items: [refund]
  },
  bankTransfers: {
    total: round(bankTransfers.reduce((sum, item) => sum + item[2], 0)),
    items: bankTransfers.map(([date, source, amount]) => ({ date, source, amount }))
  }
};

state.updatedAt = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(state, null, 2));
console.log(`Imported ${daily.length} timeline driver records, ${bankTransfers.length} bank transfers.`);
