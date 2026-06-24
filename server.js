const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "app-data.json");
const port = process.env.PORT || 3000;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function defaultState() {
  return {
    businesses: defaultBusinesses(),
    people: [],
    events: [],
    tasks: [],
    incomeEntries: [],
    locations: [],
    activityLogs: [],
    driverRawRecords: [],
    driverAnalytics: {},
    grabSettings: defaultGrabSettings(),
    cashLedger: [],
    pendingCashActions: [],
    bankTransfers: [],
    petrolCardPayments: [],
    driverSessions: [],
    solarEvents: [],
    updatedAt: new Date().toISOString()
  };
}

function defaultGrabSettings() {
  return {
    carRentalTarget: 390,
    housingLoanTarget: 1000,
    grabWalletBase: 500,
    pettyCashOpening: 0,
    cashAtHomeOpening: 0,
    defaultPetrolStation: "Petron",
    defaultPetrolPaymentMethod: "Credit Card",
    cashCategories: ["bank in", "pocket money", "service car"]
  };
}

function defaultBusinesses() {
  return [
    { id: "business_driver", name: "Driver", type: "service", color: "green", active: true },
    { id: "business_solar", name: "Solar", type: "sales", color: "blue", active: true },
    { id: "business_marketing", name: "Marketing", type: "future", color: "purple", active: false },
    { id: "business_webinar", name: "Webinar", type: "future", color: "orange", active: false },
    { id: "business_pilates", name: "Pilates", type: "future", color: "pink", active: false },
    { id: "business_emba", name: "EMBA", type: "future", color: "slate", active: false }
  ];
}

function mergeBusinesses(businesses) {
  const byId = new Map(defaultBusinesses().map(item => [item.id, item]));
  if (Array.isArray(businesses)) {
    businesses.forEach(item => {
      if (item && item.id) byId.set(item.id, { ...byId.get(item.id), ...item });
    });
  }
  return [...byId.values()];
}

function readState() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(defaultState(), null, 2));
  }
  try {
    return normalizeState(JSON.parse(fs.readFileSync(dataFile, "utf8")));
  } catch {
    return defaultState();
  }
}

function normalizeState(state) {
  return {
    ...defaultState(),
    ...state,
    businesses: mergeBusinesses(state.businesses),
    people: Array.isArray(state.people) ? state.people : [],
    events: Array.isArray(state.events) ? state.events : [],
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    incomeEntries: Array.isArray(state.incomeEntries) ? state.incomeEntries : [],
    locations: Array.isArray(state.locations) ? state.locations : [],
    activityLogs: Array.isArray(state.activityLogs) ? state.activityLogs : [],
    driverRawRecords: Array.isArray(state.driverRawRecords) ? state.driverRawRecords : [],
    driverAnalytics: state.driverAnalytics && typeof state.driverAnalytics === "object" ? state.driverAnalytics : {},
    grabSettings: { ...defaultGrabSettings(), ...(state.grabSettings || {}) },
    cashLedger: Array.isArray(state.cashLedger) ? state.cashLedger : [],
    pendingCashActions: Array.isArray(state.pendingCashActions) ? state.pendingCashActions : [],
    bankTransfers: Array.isArray(state.bankTransfers) ? state.bankTransfers : [],
    petrolCardPayments: Array.isArray(state.petrolCardPayments) ? state.petrolCardPayments : [],
    driverSessions: Array.isArray(state.driverSessions) ? state.driverSessions : [],
    solarEvents: Array.isArray(state.solarEvents) ? state.solarEvents : []
  };
}

function writeState(state) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const cleanState = {
    businesses: mergeBusinesses(state.businesses),
    people: Array.isArray(state.people) ? state.people : [],
    events: Array.isArray(state.events) ? state.events : [],
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    incomeEntries: Array.isArray(state.incomeEntries) ? state.incomeEntries : [],
    locations: Array.isArray(state.locations) ? state.locations : [],
    activityLogs: Array.isArray(state.activityLogs) ? state.activityLogs : [],
    driverRawRecords: Array.isArray(state.driverRawRecords) ? state.driverRawRecords : [],
    driverAnalytics: state.driverAnalytics && typeof state.driverAnalytics === "object" ? state.driverAnalytics : {},
    grabSettings: { ...defaultGrabSettings(), ...(state.grabSettings || {}) },
    cashLedger: Array.isArray(state.cashLedger) ? state.cashLedger : [],
    pendingCashActions: Array.isArray(state.pendingCashActions) ? state.pendingCashActions : [],
    bankTransfers: Array.isArray(state.bankTransfers) ? state.bankTransfers : [],
    petrolCardPayments: Array.isArray(state.petrolCardPayments) ? state.petrolCardPayments : [],
    driverSessions: Array.isArray(state.driverSessions) ? state.driverSessions : [],
    solarEvents: Array.isArray(state.solarEvents) ? state.solarEvents : [],
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(dataFile, JSON.stringify(cleanState, null, 2));
  return cleanState;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  if (req.url === "/api/config" && req.method === "GET") {
    send(res, 200, JSON.stringify({
      supabaseUrl: "",
      supabaseKey: "",
      authEnabled: false
    }));
    return;
  }

  if (req.url === "/api/state" && req.method === "GET") {
    send(res, 200, JSON.stringify(readState()));
    return;
  }

  if (req.url === "/api/state" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        send(res, 200, JSON.stringify(writeState(JSON.parse(body || "{}"))));
      } catch {
        send(res, 400, JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  const safeUrl = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.normalize(path.join(publicDir, safeUrl));
  if (!filePath.startsWith(publicDir)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    send(res, 200, content, mime[path.extname(filePath)] || "application/octet-stream");
  });
});

server.listen(port, () => {
  console.log(`Top One Group OS V1 running at http://localhost:${port}`);
});
