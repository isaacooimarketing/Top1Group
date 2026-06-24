(function exposeCalendarUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Top1CalendarUtils = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createCalendarUtils() {
  function profitTier(net) {
    const value = Number(net) || 0;
    if (value < 0) return "net-loss";
    if (value < 100) return "net-neutral";
    if (value < 150) return "net-blue-light";
    if (value < 200) return "net-blue-deep";
    if (value < 250) return "net-cyan-light";
    if (value < 300) return "net-cyan-deep";
    return "net-gold";
  }

  return { profitTier };
}));
