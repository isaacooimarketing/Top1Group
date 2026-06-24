(function exposePetrolUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Top1PetrolUtils = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createPetrolUtils() {
  function number(value) {
    return Number(value) || 0;
  }

  function normalizePetrolEntry(entry, defaults = {}) {
    if (typeof entry === "number" || typeof entry === "string") {
      return {
        amount: number(entry),
        station: defaults.station || "Petron",
        paymentMethod: defaults.paymentMethod || "Legacy / Settled",
        note: ""
      };
    }
    return {
      amount: number(entry?.amount),
      station: entry?.station || defaults.station || "Petron",
      paymentMethod: entry?.paymentMethod || defaults.paymentMethod || "Credit Card",
      note: entry?.note || ""
    };
  }

  function petrolTotals(entries = [], payments = []) {
    const normalized = entries.map(entry => normalizePetrolEntry(entry));
    const operatingEntries = normalized.filter(entry => entry.paymentMethod !== "Points / Rewards");
    const operatingCost = operatingEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const cardCharged = normalized
      .filter(entry => entry.paymentMethod === "Credit Card")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const rewardsValue = normalized
      .filter(entry => entry.paymentMethod === "Points / Rewards")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const cardPaid = payments.reduce((sum, payment) => sum + number(payment.amount), 0);
    return {
      operatingCost,
      cardCharged,
      cardPaid,
      cardOutstanding: Math.max(0, cardCharged - cardPaid),
      rewardsValue
    };
  }

  return { normalizePetrolEntry, petrolTotals };
}));
