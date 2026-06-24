(function exposeDateUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Top1DateUtils = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createDateUtils() {
  function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function weekRange(dateIso) {
    const date = parseDate(dateIso);
    const day = (date.getDay() + 6) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [toISODate(start), toISODate(end)];
  }

  function recordsThroughSelectedDate(records, selectedDate) {
    const [weekStart] = weekRange(selectedDate);
    return records.filter(item => item.date >= weekStart && item.date <= selectedDate);
  }

  return {
    toISODate,
    parseDate,
    weekRange,
    recordsThroughSelectedDate
  };
}));
