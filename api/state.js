const fs = require("fs");
const path = require("path");
const { bearerToken, stateQueryForUser } = require("./auth-utils");

const dataFile = path.join(process.cwd(), "data", "app-data.json");
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

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
        defaultPetrolStation: "Petron",
        defaultPetrolPaymentMethod: "Credit Card",
        cashCategories: ["bank in", "pocket money", "service car"]
      },
      cashLedger: [],
      pendingCashActions: [],
      bankTransfers: [],
      petrolCardPayments: [],
      driverSessions: [],
      solarEvents: [],
      updatedAt: new Date().toISOString()
    };
  }
}

function newWorkspaceState() {
  return {
    businesses: [
      { id: "business_driver", name: "Driver", type: "service", color: "green", active: true },
      { id: "business_solar", name: "Solar", type: "sales", color: "blue", active: false }
    ],
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
      defaultPetrolStation: "Petron",
      defaultPetrolPaymentMethod: "Credit Card",
      cashCategories: ["bank in", "pocket money", "service car"]
    },
    cashLedger: [],
    pendingCashActions: [],
    bankTransfers: [],
    petrolCardPayments: [],
    driverSessions: [],
    solarEvents: [],
    updatedAt: new Date().toISOString()
  };
}

function hasIdPrefix(item, prefixes) {
  const id = String(item?.id || "");
  return prefixes.some(prefix => id.startsWith(prefix));
}

function mergeListByImportedPrefixes(cloudList = [], bundledList = [], prefixes = []) {
  const bundledImported = (bundledList || []).filter(item => hasIdPrefix(item, prefixes));
  const bundledIds = new Set(bundledImported.map(item => item.id));
  const keptCloud = (cloudList || []).filter(item => {
    if (!item?.id) return true;
    return !hasIdPrefix(item, prefixes) && !bundledIds.has(item.id);
  });
  return [...keptCloud, ...bundledImported];
}

function shouldHydrateBundledTimeline(user) {
  return String(user?.email || "").toLowerCase() === "isaac@top1group.com";
}

function mergeBundledTimelineState(cloudState = {}, bundledState = readBundledState()) {
  const base = cloudState && typeof cloudState === "object" ? cloudState : {};
  const bundled = bundledState && typeof bundledState === "object" ? bundledState : readBundledState();

  return {
    ...base,
    businesses: base.businesses?.length ? base.businesses : bundled.businesses,
    driverSessions: mergeListByImportedPrefixes(base.driverSessions, bundled.driverSessions, [
      "drive_timeline_",
      "drive_import_2026_06_"
    ]),
    driverRawRecords: mergeListByImportedPrefixes(base.driverRawRecords, bundled.driverRawRecords, [
      "raw_timeline_",
      "refund_grab_"
    ]),
    events: mergeListByImportedPrefixes(base.events, bundled.events, [
      "event_legacy_driver_drive_timeline_",
      "event_legacy_driver_drive_import_2026_06_"
    ]),
    incomeEntries: mergeListByImportedPrefixes(base.incomeEntries, bundled.incomeEntries, [
      "income_legacy_driver_drive_timeline_",
      "income_legacy_driver_drive_import_2026_06_"
    ]),
    activityLogs: mergeListByImportedPrefixes(base.activityLogs, bundled.activityLogs, [
      "log_driver_timeline_"
    ]),
    bankTransfers: mergeListByImportedPrefixes(base.bankTransfers, bundled.bankTransfers, [
      "bank_timeline_"
    ]),
    cashLedger: mergeListByImportedPrefixes(base.cashLedger, bundled.cashLedger, [
      "cash_timeline_"
    ]),
    driverAnalytics: bundled.driverAnalytics && Object.keys(bundled.driverAnalytics).length
      ? bundled.driverAnalytics
      : base.driverAnalytics,
    grabSettings: {
      ...(bundled.grabSettings || {}),
      ...(base.grabSettings || {})
    }
  };
}

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseKey);
}

function supabaseHeaders(accessToken, extra = {}) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function authenticatedUser(accessToken) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: supabaseHeaders(accessToken)
  });
  if (!response.ok) return null;
  return response.json();
}

async function readCloudState(user, accessToken) {
  const url = `${supabaseUrl}/rest/v1/app_state?${stateQueryForUser(user.id)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders(accessToken)
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows[0]?.state || null;
}

async function writeCloudState(user, accessToken, nextState) {
  const cleanState = {
    ...(nextState || {}),
    updatedAt: new Date().toISOString()
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/app_state`, {
    method: "POST",
    headers: supabaseHeaders(accessToken, { Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify({
      id: user.id,
      user_id: user.id,
      state: cleanState
    })
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows[0]?.state || cleanState;
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const accessToken = bearerToken(req.headers.authorization);

  if (hasSupabaseConfig() && !accessToken) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const user = hasSupabaseConfig() ? await authenticatedUser(accessToken) : null;
  if (hasSupabaseConfig() && !user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  if (req.method === "GET") {
    try {
      const bundledState = readBundledState();
      const cloudState = hasSupabaseConfig() ? await readCloudState(user, accessToken) : bundledState;
      const fallbackState = shouldHydrateBundledTimeline(user) ? bundledState : newWorkspaceState();
      const state = cloudState || fallbackState;
      res.status(200).json(
        shouldHydrateBundledTimeline(user)
          ? mergeBundledTimelineState(state, bundledState)
          : state
      );
    } catch (error) {
      res.status(502).json({ error: "Unable to read cloud state", detail: error.message });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      if (hasSupabaseConfig()) {
        res.status(200).json(await writeCloudState(user, accessToken, req.body || {}));
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
}

module.exports = handler;
module.exports.mergeBundledTimelineState = mergeBundledTimelineState;
module.exports.shouldHydrateBundledTimeline = shouldHydrateBundledTimeline;
