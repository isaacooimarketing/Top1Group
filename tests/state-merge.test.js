const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mergeBundledTimelineState,
  shouldHydrateBundledTimeline
} = require("../api/state");

test("owner cloud state receives missing bundled timeline records without deleting manual records", () => {
  const cloudState = {
    driverSessions: [
      { id: "drive_timeline_2026_06_28", date: "2026-06-28", correctedNet: 140.78 },
      { id: "manual_today", date: "2026-07-03", correctedNet: 88 }
    ],
    driverRawRecords: [],
    bankTransfers: [],
    cashLedger: [],
    driverAnalytics: { scope: "old" }
  };
  const bundledState = {
    driverSessions: [
      { id: "drive_timeline_2026_06_28", date: "2026-06-28", correctedNet: 203.6 },
      { id: "drive_timeline_2026_06_30", date: "2026-06-30", correctedNet: 328.69 },
      { id: "drive_timeline_2026_07_02", date: "2026-07-02", correctedNet: 275.2 }
    ],
    driverRawRecords: [{ id: "raw_timeline_2026-06-30", date: "2026-06-30" }],
    bankTransfers: [{ id: "bank_timeline_2026_06_30_grab_wallet_221_84", date: "2026-06-30", amount: 221.84 }],
    cashLedger: [{ id: "cash_timeline_2026_07_01_bank_in", date: "2026-07-01", amount: 1000 }],
    driverAnalytics: { scope: "timeline_import_2026_05_07_to_2026_07_02" }
  };

  const merged = mergeBundledTimelineState(cloudState, bundledState);

  assert.equal(merged.driverSessions.find(item => item.id === "drive_timeline_2026_06_28").correctedNet, 203.6);
  assert.equal(merged.driverSessions.find(item => item.id === "drive_timeline_2026_06_30").correctedNet, 328.69);
  assert.equal(merged.driverSessions.find(item => item.id === "drive_timeline_2026_07_02").correctedNet, 275.2);
  assert.equal(merged.driverSessions.find(item => item.id === "manual_today").correctedNet, 88);
  assert.equal(merged.bankTransfers.find(item => item.id === "bank_timeline_2026_06_30_grab_wallet_221_84").amount, 221.84);
  assert.equal(merged.cashLedger.find(item => item.id === "cash_timeline_2026_07_01_bank_in").amount, 1000);
  assert.equal(merged.driverAnalytics.scope, "timeline_import_2026_05_07_to_2026_07_02");
});

test("only Isaac owner account receives bundled personal timeline hydration", () => {
  assert.equal(shouldHydrateBundledTimeline({ email: "isaac@top1group.com" }), true);
  assert.equal(shouldHydrateBundledTimeline({ email: "demo@top1group.com" }), false);
  assert.equal(shouldHydrateBundledTimeline({ email: "driver@example.com" }), false);
});

test("owner imported timeline dates replace cloud duplicates by date", () => {
  const cloudState = {
    driverSessions: [
      {
        id: "cloud_finished_2026_07_02",
        date: "2026-07-02",
        correctedNet: 317.76,
        totalDrivingHours: 10,
        totalTrips: 23
      }
    ],
    driverRawRecords: [],
    bankTransfers: [],
    cashLedger: []
  };
  const bundledState = {
    driverSessions: [
      {
        id: "drive_timeline_2026_07_02",
        date: "2026-07-02",
        correctedIncome: 328.99,
        correctedCost: 53.79,
        correctedNet: 275.2,
        totalDrivingHours: 10,
        totalTrips: 23
      }
    ],
    driverRawRecords: [],
    bankTransfers: [],
    cashLedger: []
  };

  const merged = mergeBundledTimelineState(cloudState, bundledState);
  const july2Records = merged.driverSessions.filter(item => item.date === "2026-07-02");

  assert.equal(july2Records.length, 1);
  assert.equal(july2Records[0].id, "drive_timeline_2026_07_02");
  assert.equal(july2Records[0].correctedNet, 275.2);
  assert.equal(july2Records[0].totalDrivingHours, 10);
  assert.equal(july2Records[0].totalTrips, 23);
});
