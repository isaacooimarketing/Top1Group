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

  function lunarVegetarianReminder(dateIso) {
    const date = parseIsoDate(dateIso);
    if (!date || typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") {
      return { lunarLabel: "", reminder: "" };
    }

    try {
      const parts = new Intl.DateTimeFormat("zh-u-ca-chinese", {
        month: "numeric",
        day: "numeric"
      }).formatToParts(date);
      const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
      const lunarMonth = Number.parseInt(values.month, 10);
      const lunarDay = Number.parseInt(values.day, 10);
      const lunarLabel = Number.isFinite(lunarMonth) && Number.isFinite(lunarDay)
        ? `Lunar ${lunarMonth}/${lunarDay}`
        : "";
      const isVegetarianDay = lunarDay === 1 || lunarDay === 15;
      const isGuanYinDay = [2, 3, 6, 9].includes(lunarMonth) && lunarDay === 19;

      return {
        lunarLabel,
        reminder: isGuanYinDay ? "Guan Yin Day" : isVegetarianDay ? "Vegetarian" : ""
      };
    } catch (_error) {
      return { lunarLabel: "", reminder: "" };
    }
  }

  function parseIsoDate(dateIso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso))) return null;
    const [year, month, day] = dateIso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return { profitTier, lunarVegetarianReminder };
}));
