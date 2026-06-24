(function exposeRecordUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Top1RecordUtils = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createRecordUtils() {
  const trackedFields = [
    ["cashCollected", "Cash Collected", "money"],
    ["totalTrips", "Total Trips", "number"],
    ["tngOpening", "TNG Opening", "money"],
    ["tngClosing", "TNG Closing", "money"],
    ["smartTagOpening", "SmartTAG Opening", "money"],
    ["smartTagClosing", "SmartTAG Closing", "money"],
    ["grabCashWalletOpening", "Grab Wallet Opening", "money"],
    ["grabCashWalletEnding", "Grab Wallet Ending", "money"],
    ["totalDrivingHours", "Driving Hours", "hours"],
    ["status", "Status", "text"]
  ];

  function comparable(value) {
    if (value === null || value === undefined || value === "") return "";
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : String(value);
  }

  function recordChanges(before = {}, after = {}) {
    return trackedFields.reduce((changes, [key, label, format]) => {
      const oldValue = comparable(before[key]);
      const newValue = comparable(after[key]);
      if (oldValue !== newValue) {
        changes.push({ label, before: oldValue, after: newValue, format });
      }
      return changes;
    }, []);
  }

  function resolvedDrivingHours(calculatedHours, existingHours) {
    return Number(calculatedHours) || Number(existingHours) || 0;
  }

  function resolvedStatus(existingStatus, requestedStatus) {
    if (existingStatus === "Finished" && requestedStatus === "In Progress") return "Finished";
    return requestedStatus;
  }

  return { recordChanges, resolvedDrivingHours, resolvedStatus };
}));
