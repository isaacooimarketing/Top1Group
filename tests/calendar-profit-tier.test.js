const test = require("node:test");
const assert = require("node:assert/strict");

const { profitTier, lunarVegetarianReminder } = require("../public/calendar-utils");

test("profitTier classifies every net-profit boundary", () => {
  const cases = [
    [-1, "net-loss"],
    [0, "net-neutral"],
    [99.99, "net-neutral"],
    [100, "net-blue-light"],
    [149.99, "net-blue-light"],
    [150, "net-blue-deep"],
    [199.99, "net-blue-deep"],
    [200, "net-cyan-light"],
    [249.99, "net-cyan-light"],
    [250, "net-cyan-deep"],
    [299.99, "net-cyan-deep"],
    [300, "net-gold"],
    [500, "net-gold"]
  ];

  cases.forEach(([net, expected]) => {
    assert.equal(profitTier(net), expected, `Expected RM${net} to be ${expected}`);
  });
});

test("lunarVegetarianReminder marks first, fifteenth, and Guan Yin lunar days", () => {
  assert.deepEqual(lunarVegetarianReminder("2026-06-15"), {
    lunarLabel: "Lunar 5/1",
    reminder: "Vegetarian"
  });
  assert.deepEqual(lunarVegetarianReminder("2026-06-29"), {
    lunarLabel: "Lunar 5/15",
    reminder: "Vegetarian"
  });
  assert.deepEqual(lunarVegetarianReminder("2026-04-06"), {
    lunarLabel: "Lunar 2/19",
    reminder: "Guan Yin Day"
  });
  assert.equal(lunarVegetarianReminder("2026-06-16").reminder, "");
});
