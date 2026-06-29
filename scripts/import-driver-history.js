const fs = require("fs");
const path = require("path");
const {
  daily,
  setupExpenses,
  bankTransfers,
  cashWithdrawals,
  refund,
  timelineTotals,
  preGrabExpensesTotal
} = require("./driver-history-fixture");

const file = path.join(__dirname, "..", "data", "app-data.json");
const state = JSON.parse(fs.readFileSync(file, "utf8"));

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

for (const item of daily) {
  const id = `drive_timeline_${item.date.replaceAll("-", "_")}`;
  state.driverSessions.push({
    id,
    rawRecordId: `raw_timeline_${item.date}`,
    importSource: "user_manual_timeline",
    driverIncomeModel: "corrected_daily_summary_v1",
    date: item.date,
    platform: item.platform,
    startTime: "",
    endTime: "",
    status: "Finished",
    totalDrivingHours: item.hours,
    totalTrips: item.trips,
    correctedIncome: item.income,
    correctedCost: item.cost,
    correctedNet: item.net,
    originalCost: item.cost + item.ignoredGrabInsurance,
    ignoredGrabInsurance: item.ignoredGrabInsurance,
    petrolCost: item.petrol,
    smartTagReduction: item.toll,
    grabCreditWalletTopUp: item.topUp,
    walletIncreaseIncome: round(item.income - item.cashCollected),
    cashCollected: item.cashCollected,
    accountingNote: `${item.note}. RM5.50 Grab insurance kept as raw note only, not corrected cost.`,
    remark: item.note
  });
  state.driverRawRecords.push({
    id: `raw_timeline_${item.date}`,
    type: "driver_daily_record",
    source: "user_manual_timeline",
    date: item.date,
    platform: item.platform,
    income: item.income,
    correctedCost: item.cost,
    correctedNet: item.net,
    hours: item.hours,
    trips: item.trips,
    ignoredGrabInsurance: item.ignoredGrabInsurance,
    note: item.note
  });
}

for (const item of setupExpenses) {
  state.driverRawRecords.push({
    id: `raw_timeline_setup_${item.date}_${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    type: "pre_grab_expense",
    date: item.date,
    label: item.label,
    amount: item.amount
  });
}

state.driverRawRecords.push(refund);

for (const item of bankTransfers) {
  state.bankTransfers.push({
    id: `bank_timeline_${item.date}_${item.source}_${item.amount}`.replace(/[^a-z0-9_]+/gi, "_"),
    date: item.date,
    source: item.source,
    amount: item.amount
  });
}

for (const item of cashWithdrawals) {
  state.cashLedger.push({
    id: `cash_timeline_${item.date}_${item.category}`.replace(/[^a-z0-9_]+/gi, "_"),
    date: item.date,
    type: "cash_withdrawal",
    fromAccount: item.fromAccount,
    amount: item.amount,
    category: item.category
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

state.driverAnalytics = {
  generatedAt: new Date().toISOString(),
  scope: timelineTotals.scope,
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
    ...timelineTotals,
    averageIncomePerHour: round(timelineTotals.operatingSales / timelineTotals.totalHours),
    averageNetPerHour: round(timelineTotals.operatingNet / timelineTotals.totalHours),
    averageNetPerTrip: round(timelineTotals.operatingNet / timelineTotals.totalTrips)
  },
  preGrabExpenses: {
    total: round(preGrabExpensesTotal),
    items: setupExpenses
  },
  refundsAndReimbursements: {
    total: refund.amount,
    items: [refund]
  },
  bankTransfers: {
    total: round(bankTransfers.reduce((sum, item) => sum + item.amount, 0)),
    items: bankTransfers
  }
};

state.updatedAt = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(state, null, 2));
console.log(`Imported ${daily.length} timeline driver records, ${bankTransfers.length} bank transfers.`);

function round(value) {
  return Math.round(value * 100) / 100;
}
