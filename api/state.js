const fs = require("fs");
const path = require("path");

const dataFile = path.join(process.cwd(), "data", "app-data.json");

function readBundledState() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return {
      businesses: [],
      people: [],
      events: [],
      tasks: [],
      incomeEntries: [],
      locations: [],
      activityLogs: [],
      driverRawRecords: [],
      driverAnalytics: {},
      grabSettings: {
        carRentalTarget: 390,
        housingLoanTarget: 1000,
        grabWalletBase: 500,
        pettyCashOpening: 0,
        cashAtHomeOpening: 0,
        cashCategories: ["bank in", "pocket money", "service car"]
      },
      cashLedger: [],
      pendingCashActions: [],
      bankTransfers: [],
      driverSessions: [],
      solarEvents: [],
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    res.status(200).json(readBundledState());
    return;
  }

  if (req.method === "POST") {
    // Vercel serverless functions cannot safely persist local JSON files.
    // Echo the submitted state so the app remains usable with localStorage
    // until the production cloud database is connected.
    res.status(200).json({
      ...(req.body || {}),
      updatedAt: new Date().toISOString()
    });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed" });
};
