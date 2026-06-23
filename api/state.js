const fs = require("fs");
const path = require("path");

const dataFile = path.join(process.cwd(), "data", "app-data.json");
const stateId = process.env.TOP1GROUP_STATE_ID || "top1group";
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

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

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseKey);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function readCloudState() {
  const url = `${supabaseUrl}/rest/v1/app_state?id=eq.${encodeURIComponent(stateId)}&select=state`;
  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders()
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows[0]?.state || readBundledState();
}

async function writeCloudState(nextState) {
  const cleanState = {
    ...(nextState || {}),
    updatedAt: new Date().toISOString()
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/app_state`, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify({
      id: stateId,
      state: cleanState
    })
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows[0]?.state || cleanState;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    try {
      res.status(200).json(hasSupabaseConfig() ? await readCloudState() : readBundledState());
    } catch (error) {
      res.status(502).json({ error: "Unable to read cloud state", detail: error.message });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      if (hasSupabaseConfig()) {
        res.status(200).json(await writeCloudState(req.body || {}));
        return;
      }

      // Vercel serverless functions cannot safely persist local JSON files.
      // Without Supabase env vars, echo the submitted state so the app remains usable.
      res.status(200).json({
        ...(req.body || {}),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(502).json({ error: "Unable to save cloud state", detail: error.message });
    }
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed" });
};
