const test = require("node:test");
const assert = require("node:assert/strict");

const {
  toISODate,
  recordsThroughSelectedDate
} = require("../public/date-utils");

test("toISODate keeps the local calendar date in Malaysia timezone", () => {
  const localMidnight = new Date(2026, 5, 15);
  assert.equal(toISODate(localMidnight), "2026-06-15");
});

test("weekly records stop at the selected date", () => {
  const records = [
    { date: "2026-06-15", correctedNet: 261.23 },
    { date: "2026-06-16", correctedNet: 300.88 },
    { date: "2026-06-17", correctedNet: 368.51 }
  ];

  assert.deepEqual(
    recordsThroughSelectedDate(records, "2026-06-15"),
    [records[0]]
  );
});
