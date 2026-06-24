(function exposeSummaryUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Top1SummaryUtils = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createSummaryUtils() {
  function number(value) {
    return Number(value) || 0;
  }

  function buildDailySummary({ record = {}, metrics = {}, cashBefore = 0, confirmedCash = 0, pettyCash = 0, cashAtHome = 0 }) {
    return {
      date: record.date || "",
      trips: number(metrics.trips || record.totalTrips),
      hours: number(metrics.hours || record.totalDrivingHours),
      income: number(metrics.income),
      cost: number(metrics.cost),
      net: number(metrics.net),
      incomePerHour: number(metrics.incomePerHour),
      incomeSources: {
        cash: number(metrics.cashIncome),
        tng: number(metrics.tngIncome),
        grabWallet: number(metrics.grabWalletIncome)
      },
      costSources: {
        petrol: number(metrics.petrol),
        toll: number(metrics.toll),
        grabWalletTopUp: number(metrics.grabWalletTopUp)
      },
      cashBefore: number(cashBefore),
      confirmedCash: number(confirmedCash),
      cashAfter: number(cashBefore) + number(confirmedCash),
      pettyCash: number(pettyCash),
      cashAtHome: number(cashAtHome),
      totalCash: number(pettyCash) + number(cashAtHome)
    };
  }

  return { buildDailySummary };
}));
