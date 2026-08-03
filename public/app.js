const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
const moneyCompact = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });
let language = Top1UI.normalizeLanguage(localStorage.getItem("top1groupLanguage") || "en");
let dateFmt = new Intl.DateTimeFormat(Top1UI.localeForLanguage(language), { weekday: "short", day: "numeric", month: "short" });
let monthFmt = new Intl.DateTimeFormat(Top1UI.localeForLanguage(language), { month: "long", year: "numeric" });
const {
  toISODate,
  parseDate,
  weekRange,
  recordsThroughSelectedDate
} = window.Top1DateUtils;
const { profitTier, lunarVegetarianReminder } = window.Top1CalendarUtils;

let state = defaultOSState();
let mode = "driver";
let visibleDate = new Date();
let selectedDate = toISODate(new Date());
let editingDriverId = null;
let editingSolarId = null;
let saving = false;
let theme = "light";
let todayOS = null;
let authManager = null;
let appStarted = false;
let driverFormDirty = false;
let summaryRecordId = null;
let selectedForecastDate = selectedDate;
const { recordChanges, resolvedDrivingHours, resolvedStatus } = Top1RecordUtils;
const { buildDailySummary } = Top1SummaryUtils;
const { normalizePetrolEntry, petrolTotals } = Top1PetrolUtils;

const $ = selector => document.querySelector(selector);

function updateLanguage(nextLanguage) {
  language = Top1UI.normalizeLanguage(nextLanguage);
  localStorage.setItem("top1groupLanguage", language);
  const locale = Top1UI.localeForLanguage(language);
  dateFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
}

function applyAccountCapabilities() {
  mode = "driver";
}

function localizeUI() {
  Top1UI.applyTranslations(document.body, language);
  document.querySelectorAll("[data-language]").forEach(button => {
    button.classList.toggle("active", button.dataset.language === language);
  });
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function num(value) {
  return Number.parseFloat(value || "0") || 0;
}

function moneySafe(value) {
  const parsed = Number(value);
  return money.format(Number.isFinite(parsed) ? parsed : 0);
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  return Math.max(0, (endMinutes - startMinutes) / 60);
}

function positiveDelta(opening, closing) {
  if (!hasValue(opening) || !hasValue(closing)) return 0;
  return Math.max(0, num(closing) - num(opening));
}

function reduction(opening, closing) {
  if (!hasValue(opening) || !hasValue(closing)) return 0;
  return Math.max(0, num(opening) - num(closing));
}

function driverMetrics(session) {
  if (session.driverIncomeModel === "grab_v13") {
    const detail = grabDailyMetrics(session);
    return { income: detail.income, cost: detail.cost, net: detail.net, hours: detail.hours, trips: detail.trips, incomePerHour: detail.incomePerHour };
  }

  if (session.driverIncomeModel === "corrected_daily_summary_v1") {
    const income = num(session.correctedIncome);
    const cost = num(session.correctedCost);
    const hours = num(session.totalDrivingHours);
    return { income, cost, net: income - cost, hours, trips: num(session.totalTrips), incomePerHour: hours ? income / hours : 0 };
  }

  if ("income" in session || "cost" in session) {
    const income = num(session.income);
    const cost = num(session.cost);
    const hours = hoursBetween(session.startTime, session.endTime);
    return { income, cost, net: income - cost, hours, trips: num(session.totalTrips), incomePerHour: hours ? income / hours : 0 };
  }

  if (session.driverIncomeModel === "wallet_cash_tng_v2") {
    const grabTng = num(session.grabTngCollected);
    const boltTng = num(session.boltTngCollected);
    const income =
      positiveDelta(session.grabCashWalletOpening, session.grabCashWalletClosing) +
      num(session.grabCashCollected) +
      Math.max(0, grabTng) +
      num(session.boltWalletPaidProfit) +
      num(session.boltCashCollected) +
      Math.max(0, boltTng);
    const cost =
      num(session.petrolCost) +
      reduction(session.smartTagOpening, session.smartTagClosing) +
      Math.max(0, -grabTng) +
      Math.max(0, -boltTng) +
      num(session.externalCost);
    const hours = hasValue(session.totalDrivingHours)
      ? num(session.totalDrivingHours)
      : hoursBetween(session.startTime, session.endTime);
    return { income, cost, net: income - cost, hours };
  }

  const appDiff = hasValue(session.appWalletOpening) && hasValue(session.appWalletClosing)
    ? num(session.appWalletClosing) - num(session.appWalletOpening)
    : 0;
  const income =
    num(session.cashReceived) +
    positiveDelta(session.tngOpening, session.tngClosing) +
    Math.max(0, appDiff);
  const cost =
    num(session.petrolCost) +
    reduction(session.smartTagOpening, session.smartTagClosing) +
    Math.max(0, -appDiff);
  const hours = hoursBetween(session.startTime, session.endTime);
  return { income, cost, net: income - cost, hours };
}

// TOP 1 GROUP MALAYSIA operating architecture:
// Legacy Driver/Solar arrays are kept for V1 compatibility, but the operating
// model is now universal. Businesses create Events, Tasks, People, Income,
// Locations, and Activity Logs. Future businesses only add new records/types.
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

function defaultOSState() {
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
    updatedAt: ""
  };
}

function dedupeByKey(items, keyForItem) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyForItem(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function defaultGrabSettings() {
  return {
    carRentalTarget: 390,
    housingLoanTarget: 1000,
    grabWalletBase: 500,
    pettyCashOpening: 0,
    cashAtHomeOpening: 0,
    cashCategories: ["bank in", "pocket money", "service car"]
    ,
    defaultPetrolStation: "Petron",
    defaultPetrolPaymentMethod: "Credit Card"
  };
}

function normalizeOSState(input = {}) {
  const base = defaultOSState();
  const businesses = mergeById(base.businesses, Array.isArray(input.businesses) ? input.businesses : []);
  return {
    ...base,
    ...input,
    businesses,
    people: Array.isArray(input.people) ? input.people : [],
    events: Array.isArray(input.events) ? input.events : [],
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    incomeEntries: Array.isArray(input.incomeEntries) ? input.incomeEntries : [],
    locations: Array.isArray(input.locations) ? input.locations : [],
    activityLogs: Array.isArray(input.activityLogs) ? input.activityLogs : [],
    driverRawRecords: Array.isArray(input.driverRawRecords) ? input.driverRawRecords : [],
    driverAnalytics: input.driverAnalytics && typeof input.driverAnalytics === "object" ? input.driverAnalytics : {},
    grabSettings: { ...defaultGrabSettings(), ...(input.grabSettings || {}) },
    cashLedger: Array.isArray(input.cashLedger) ? input.cashLedger : [],
    pendingCashActions: dedupeByKey(Array.isArray(input.pendingCashActions) ? input.pendingCashActions : [], item => item.id || `${item.type}_${item.sourceId}_${item.date}_${num(item.amount).toFixed(2)}`),
    bankTransfers: dedupeByKey(Array.isArray(input.bankTransfers) ? input.bankTransfers : [], item => `${item.sourceId || item.id}_${item.date}_${item.source}_${num(item.amount).toFixed(2)}`),
    petrolCardPayments: Array.isArray(input.petrolCardPayments) ? input.petrolCardPayments : [],
    driverSessions: Array.isArray(input.driverSessions) ? input.driverSessions : [],
    solarEvents: Array.isArray(input.solarEvents) ? input.solarEvents : []
  };
}

function mergeById(...lists) {
  const byId = new Map();
  lists.flat().forEach(item => {
    if (item && item.id) byId.set(item.id, { ...byId.get(item.id), ...item });
  });
  return [...byId.values()];
}

function replaceGenerated(existing, generated, prefixes) {
  return mergeById(
    existing.filter(item => !prefixes.some(prefix => item.id && item.id.startsWith(prefix))),
    generated
  );
}

function syncUniversalObjects() {
  const normalized = normalizeOSState(state);
  const driverEvents = normalized.driverSessions.map(driverSessionToEvent);
  const driverIncome = normalized.driverSessions.map(driverSessionToIncomeEntry);
  const driverTasks = normalized.driverSessions.flatMap(driverSessionToTasks);
  const solarPeople = normalized.solarEvents.map(solarEventToPerson);
  const solarLocations = normalized.solarEvents.map(solarEventToLocation);
  const solarEvents = normalized.solarEvents.map(solarEventToEvent);
  const solarTasks = normalized.solarEvents.flatMap(solarEventToTasks);
  const activityLogs = [
    ...normalized.driverSessions.map(driverSessionToActivityLog),
    ...normalized.solarEvents.map(solarEventToActivityLog)
  ];

  state = {
    ...normalized,
    people: replaceGenerated(normalized.people, solarPeople, ["person_legacy_solar_"]),
    locations: replaceGenerated(normalized.locations, solarLocations, ["location_legacy_solar_"]),
    events: replaceGenerated(normalized.events, [...driverEvents, ...solarEvents], ["event_legacy_driver_", "event_legacy_solar_"]),
    tasks: replaceGenerated(normalized.tasks, [...driverTasks, ...solarTasks], ["task_legacy_driver_", "task_legacy_solar_"]),
    incomeEntries: replaceGenerated(normalized.incomeEntries, driverIncome, ["income_legacy_driver_"]),
    activityLogs: replaceGenerated(normalized.activityLogs, activityLogs, ["log_legacy_driver_", "log_legacy_solar_"])
  };
}

function driverSessionToEvent(session) {
  const metrics = driverMetrics(session);
  return {
    id: `event_legacy_driver_${session.id}`,
    source: "legacy_driverSessions",
    sourceId: session.id,
    businessId: "business_driver",
    personId: null,
    locationId: null,
    type: "driver_session",
    title: `${session.platform || "Driver"} Driving Session`,
    date: session.date,
    startTime: session.startTime || "",
    endTime: session.endTime || "",
    status: session.status === "Finished" ? "completed" : "active",
    priority: session.status === "Finished" ? "normal" : "high",
    notes: session.remark || "",
    metadata: {
      platform: session.platform || "Driver",
      drivingHours: metrics.hours,
      totalTrips: num(session.totalTrips)
    }
  };
}

function driverSessionToIncomeEntry(session) {
  const metrics = driverMetrics(session);
  if (session.driverIncomeModel === "grab_v13") {
    const detail = grabDailyMetrics(session);
    return {
      id: `income_legacy_driver_${session.id}`,
      source: "legacy_driverSessions",
      sourceId: session.id,
      businessId: "business_driver",
      eventId: `event_legacy_driver_${session.id}`,
      personId: null,
      date: session.date,
      type: "driver_income",
      grossIncome: detail.income,
      cost: detail.cost,
      netIncome: detail.net,
      paymentMethod: "mixed",
      metadata: {
        platform: "Grab",
        totalTrips: detail.trips,
        drivingHours: detail.hours,
        cashCollected: detail.cash,
        tngIncome: detail.tngIncome,
        tollCost: detail.toll,
        petrolCost: detail.petrol,
        smartTagReduction: detail.smartTagCost,
        grabWalletIncome: detail.grabWalletIncome,
        grabWalletTopUp: detail.grabWalletTopUp,
        grabTransferToBank: detail.transferToBank,
        accountingNote: "Grab V1.3. Insurance RM5.50 is not counted separately."
      }
    };
  }

  if (session.driverIncomeModel === "corrected_daily_summary_v1") {
    return {
      id: `income_legacy_driver_${session.id}`,
      source: "legacy_driverSessions",
      sourceId: session.id,
      businessId: "business_driver",
      eventId: `event_legacy_driver_${session.id}`,
      personId: null,
      date: session.date,
      type: "driver_income",
      grossIncome: metrics.income,
      cost: metrics.cost,
      netIncome: metrics.net,
      paymentMethod: "mixed",
      metadata: {
        platform: session.platform || "Driver",
        totalTrips: num(session.totalTrips),
        drivingHours: num(session.totalDrivingHours),
        originalCost: num(session.originalCost),
        correctedCost: num(session.correctedCost),
        correctedNet: num(session.correctedNet),
        ignoredGrabInsurance: num(session.ignoredGrabInsurance),
        grabCreditWalletTopUp: num(session.grabCreditWalletTopUp),
        petrolCost: num(session.petrolCost),
        smartTagReduction: num(session.smartTagReduction),
        walletIncreaseIncome: num(session.walletIncreaseIncome),
        rawRecordId: session.rawRecordId || "",
        accountingNote: session.accountingNote || ""
      }
    };
  }

  if (session.driverIncomeModel === "wallet_cash_tng_v2") {
    return {
      id: `income_legacy_driver_${session.id}`,
      source: "legacy_driverSessions",
      sourceId: session.id,
      businessId: "business_driver",
      eventId: `event_legacy_driver_${session.id}`,
      personId: null,
      date: session.date,
      type: "driver_income",
      grossIncome: metrics.income,
      cost: metrics.cost,
      netIncome: metrics.net,
      paymentMethod: "mixed",
      metadata: {
        platform: session.platform || "Driver",
        grabCashWalletOpening: num(session.grabCashWalletOpening),
        grabCashWalletClosing: num(session.grabCashWalletClosing),
        grabCashWalletIncrease: positiveDelta(session.grabCashWalletOpening, session.grabCashWalletClosing),
        grabCashCollected: num(session.grabCashCollected),
        grabTngCollected: num(session.grabTngCollected),
        grabTotalSales: num(session.grabTotalSales),
        boltWalletPaidProfit: num(session.boltWalletPaidProfit),
        boltCashCollected: num(session.boltCashCollected),
        boltTngCollected: num(session.boltTngCollected),
        boltTotalSales: num(session.boltTotalSales),
        smartTagOpening: num(session.smartTagOpening),
        smartTagClosing: num(session.smartTagClosing),
        petrolCost: num(session.petrolCost),
        smartTagReduction: reduction(session.smartTagOpening, session.smartTagClosing),
        externalCost: num(session.externalCost),
        ignoredGrabInsurance: num(session.ignoredGrabInsurance),
        totalTrips: num(session.totalTrips),
        correctionNote: session.correctionNote || ""
      }
    };
  }
  const appDiff = hasValue(session.appWalletOpening) && hasValue(session.appWalletClosing)
    ? num(session.appWalletClosing) - num(session.appWalletOpening)
    : 0;
  return {
    id: `income_legacy_driver_${session.id}`,
    source: "legacy_driverSessions",
    sourceId: session.id,
    businessId: "business_driver",
    eventId: `event_legacy_driver_${session.id}`,
    personId: null,
    date: session.date,
    type: "driver_income",
    grossIncome: metrics.income,
    cost: metrics.cost,
    netIncome: metrics.net,
    paymentMethod: "mixed",
    metadata: {
      platform: session.platform || "Driver",
      cashReceived: num(session.cashReceived),
      tngIncrease: positiveDelta(session.tngOpening, session.tngClosing),
      appWalletIncrease: Math.max(0, appDiff),
      petrolCost: num(session.petrolCost),
      smartTagReduction: reduction(session.smartTagOpening, session.smartTagClosing),
      appWalletReduction: Math.max(0, -appDiff),
      totalTrips: num(session.totalTrips)
    }
  };
}

function driverSessionToTasks(session) {
  const importedFinished = ["manual_corrected_driver_import", "phase1_historical_driver_import"].includes(session.importSource) && session.status === "Finished";
  const morningDone = importedFinished || hasValue(session.startTime)
    && hasValue(session.tngOpening)
    && hasValue(session.smartTagOpening)
    && hasValue(session.appWalletOpening);
  const finishDone = session.status === "Finished" && hasValue(session.endTime);
  return [
    {
      id: `task_legacy_driver_${session.id}_morning_save`,
      source: "legacy_driverSessions",
      sourceId: session.id,
      businessId: "business_driver",
      eventId: `event_legacy_driver_${session.id}`,
      personId: null,
      type: "morning_temp_save",
      title: `Morning temporary save - ${session.platform || "Driver"}`,
      dueDate: session.date,
      dueTime: session.startTime || "08:00",
      status: morningDone ? "completed" : "open",
      priority: "high",
      completedAt: morningDone ? `${session.date}T${session.startTime || "00:00"}:00` : null,
      notes: session.remark || ""
    },
    {
      id: `task_legacy_driver_${session.id}_finish_today`,
      source: "legacy_driverSessions",
      sourceId: session.id,
      businessId: "business_driver",
      eventId: `event_legacy_driver_${session.id}`,
      personId: null,
      type: "finish_today",
      title: `Finish driver report - ${session.platform || "Driver"}`,
      dueDate: session.date,
      dueTime: session.endTime || "18:00",
      status: finishDone ? "completed" : "open",
      priority: "high",
      completedAt: finishDone ? `${session.date}T${session.endTime}:00` : null,
      notes: session.remark || ""
    }
  ];
}

function solarEventToPerson(event) {
  return {
    id: `person_legacy_solar_${event.id}`,
    source: "legacy_solarEvents",
    sourceId: event.id,
    name: event.customerName || "Unnamed",
    phone: event.phone || "",
    address: event.address || "",
    postcode: event.postcode || "",
    area: event.area || "",
    type: "lead",
    sourceBusinessId: "business_solar",
    status: event.status || "New",
    notes: event.remark || ""
  };
}

function solarEventToLocation(event) {
  return {
    id: `location_legacy_solar_${event.id}`,
    source: "legacy_solarEvents",
    sourceId: event.id,
    name: event.customerName ? `${event.customerName} Location` : "Solar Location",
    address: event.address || "",
    postcode: event.postcode || "",
    area: event.area || "",
    mapUrl: ""
  };
}

function solarEventToEvent(event) {
  return {
    id: `event_legacy_solar_${event.id}`,
    source: "legacy_solarEvents",
    sourceId: event.id,
    businessId: "business_solar",
    personId: `person_legacy_solar_${event.id}`,
    locationId: `location_legacy_solar_${event.id}`,
    type: event.status === "New" ? "follow_up" : "solar_appointment",
    title: `${event.customerName || "Solar Lead"} - ${event.status || "New"}`,
    date: event.appointmentDate,
    startTime: event.appointmentTime || "",
    endTime: "",
    status: normalizeSolarStatus(event.status),
    priority: event.status === "Appointed" ? "high" : "normal",
    notes: event.remark || "",
    metadata: {
      phaseType: event.phaseType || "",
      batteryUnits: num(event.batteryUnits),
      systemSize: event.systemSize || "",
      financing: event.financing || "",
      originalStatus: event.status || "New"
    }
  };
}

function solarEventToTasks(event) {
  const closed = ["Closed", "Lost"].includes(event.status);
  const tasks = [];
  if (!closed) {
    tasks.push({
      id: `task_legacy_solar_${event.id}_follow_up`,
      source: "legacy_solarEvents",
      sourceId: event.id,
      businessId: "business_solar",
      eventId: `event_legacy_solar_${event.id}`,
      personId: `person_legacy_solar_${event.id}`,
      type: "follow_up_customer",
      title: `Follow up ${event.customerName || "solar lead"}`,
      dueDate: event.appointmentDate,
      dueTime: event.appointmentTime || "09:00",
      status: "open",
      priority: event.status === "Appointed" ? "high" : "normal",
      completedAt: null,
      notes: event.remark || ""
    });
  }
  if (event.status === "Appointed") {
    tasks.push({
      id: `task_legacy_solar_${event.id}_send_quotation`,
      source: "legacy_solarEvents",
      sourceId: event.id,
      businessId: "business_solar",
      eventId: `event_legacy_solar_${event.id}`,
      personId: `person_legacy_solar_${event.id}`,
      type: "send_quotation",
      title: `Prepare quotation for ${event.customerName || "solar lead"}`,
      dueDate: event.appointmentDate,
      dueTime: event.appointmentTime || "17:00",
      status: "open",
      priority: "normal",
      completedAt: null,
      notes: event.remark || ""
    });
  }
  return tasks;
}

function driverSessionToActivityLog(session) {
  const metrics = driverMetrics(session);
  return {
    id: `log_legacy_driver_${session.id}`,
    timestamp: `${session.date}T${session.startTime || "00:00"}:00`,
    businessId: "business_driver",
    personId: null,
    eventId: `event_legacy_driver_${session.id}`,
    taskId: null,
    action: ["manual_corrected_driver_import", "phase1_historical_driver_import"].includes(session.importSource) ? "driver_record_imported" : session.status === "Finished" ? "driver_session_finished" : "driver_session_saved",
    message: ["manual_corrected_driver_import", "phase1_historical_driver_import"].includes(session.importSource)
      ? `Imported corrected ${session.date} driver record. Net ${money.format(metrics.net)}. Grab insurance not counted separately.`
      : `${session.platform || "Driver"} session ${session.status || "saved"}`
  };
}

function solarEventToActivityLog(event) {
  return {
    id: `log_legacy_solar_${event.id}`,
    timestamp: `${event.appointmentDate}T${event.appointmentTime || "00:00"}:00`,
    businessId: "business_solar",
    personId: `person_legacy_solar_${event.id}`,
    eventId: `event_legacy_solar_${event.id}`,
    taskId: null,
    action: "solar_event_saved",
    message: `${event.customerName || "Solar lead"} saved as ${event.status || "New"}`
  };
}

function normalizeSolarStatus(status) {
  if (status === "Closed") return "closed_won";
  if (status === "Lost") return "closed_lost";
  if (status === "Appointed") return "scheduled";
  return "open";
}

function buildDerivedTodayData(date = selectedDate) {
  syncUniversalObjects();
  const todaySchedule = state.events
    .filter(event => event.date === date)
    .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
  const persistedTasks = state.tasks
    .filter(task => task.dueDate === date && task.status !== "completed")
    .sort((a, b) => taskScore(a) - taskScore(b));
  const preliminaryPulse = pulseForDate(date, todaySchedule, persistedTasks);
  const todayTasks = [
    ...persistedTasks,
    ...operatingTasksForDate(date, todaySchedule, persistedTasks, preliminaryPulse)
  ].sort((a, b) => taskScore(a) - taskScore(b));
  const peopleToMoveToday = peopleForToday(todaySchedule, todayTasks);
  const todayPulse = pulseForDate(date, todaySchedule, todayTasks);
  return {
    todaySchedule,
    todayTasks,
    nextAction: chooseNextAction(todaySchedule, todayTasks),
    peopleToMoveToday,
    todayPulse,
    calendarDayIndicators: calendarDayIndicators(date)
  };
}

function operatingTasksForDate(date, events, tasks, pulse) {
  if (date !== toISODate(new Date())) return [];
  const hasOpenDriverTask = tasks.some(task => task.businessId === "business_driver");
  const hasDriverEvent = events.some(event => event.businessId === "business_driver");
  const virtualTasks = [];

  if (!hasOpenDriverTask && !hasDriverEvent) {
    virtualTasks.push(virtualTask("start_driver_session", "Start today's driver session", date, "08:00", "business_driver", "high"));
  }

  return virtualTasks;
}

function virtualTask(id, title, dueDate, dueTime, businessId, priority) {
  return {
    id: `virtual_${id}_${dueDate}`,
    virtual: true,
    businessId,
    eventId: null,
    personId: null,
    type: id,
    title,
    dueDate,
    dueTime,
    status: "open",
    priority,
    completedAt: null,
    notes: "Generated by Today Command Center."
  };
}

function taskScore(task) {
  const priority = task.priority === "high" ? 0 : 10;
  return priority + Number((task.dueTime || "99:99").replace(":", ""));
}

function chooseNextAction(events, tasks) {
  const openTasks = tasks.map(task => ({ kind: "task", time: task.dueTime || "99:99", priority: task.priority, item: task }));
  const activeEvents = events
    .filter(event => !["completed", "closed_won", "closed_lost"].includes(event.status))
    .map(event => ({ kind: "event", time: event.startTime || "99:99", priority: event.priority, item: event }));
  return [...openTasks, ...activeEvents]
    .sort((a, b) => taskScore({ dueTime: a.time, priority: a.priority }) - taskScore({ dueTime: b.time, priority: b.priority }))[0] || null;
}

function peopleForToday(events, tasks) {
  const ids = new Set([...events, ...tasks].map(item => item.personId).filter(Boolean));
  return state.people.filter(person => ids.has(person.id));
}

function pulseForDate(date, events, tasks) {
  const incomeEntries = state.incomeEntries.filter(entry => entry.date === date);
  const grossIncome = incomeEntries.reduce((sum, entry) => sum + num(entry.grossIncome), 0);
  const cost = incomeEntries.reduce((sum, entry) => sum + num(entry.cost), 0);
  const netIncome = incomeEntries.reduce((sum, entry) => sum + num(entry.netIncome), 0);
  const driverEvents = events.filter(event => event.type === "driver_session");
  const drivingHours = driverEvents.reduce((sum, event) => sum + num(event.metadata?.drivingHours), 0);
  const trips = incomeEntries.reduce((sum, entry) => sum + num(entry.metadata?.totalTrips), 0);
  return {
    grossIncome,
    cost,
    netIncome,
    drivingHours,
    trips,
    appointments: events.filter(event => event.type === "solar_appointment").length,
    followUps: tasks.filter(task => task.type === "follow_up_customer").length,
    incomplete: tasks.length,
    targetGap: Math.max(0, 1390 / 7 - netIncome)
  };
}

function driverIncomeEntries() {
  return state.incomeEntries.filter(entry => entry.businessId === "business_driver" && entry.type === "driver_income");
}

function driverEvents() {
  return state.events.filter(event => event.businessId === "business_driver" && event.type === "driver_session");
}

function driverAnalytics(entries = driverIncomeEntries(), events = driverEvents()) {
  const daily = new Map();
  entries.forEach(entry => {
    if (!daily.has(entry.date)) {
      daily.set(entry.date, {
        date: entry.date,
        sales: 0,
        cost: 0,
        net: 0,
        trips: 0,
        hours: 0,
        platforms: {}
      });
    }
    const day = daily.get(entry.date);
    const platform = entry.metadata?.platform || "Driver";
    day.sales += num(entry.grossIncome);
    day.cost += num(entry.cost);
    day.net += num(entry.netIncome);
    day.trips += num(entry.metadata?.totalTrips);
    day.platforms[platform] = (day.platforms[platform] || 0) + num(entry.netIncome);
  });

  events.forEach(event => {
    const day = daily.get(event.date);
    if (day) day.hours += num(event.metadata?.drivingHours);
  });

  const days = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totals = days.reduce((acc, day) => {
    acc.sales += day.sales;
    acc.cost += day.cost;
    acc.net += day.net;
    acc.trips += day.trips;
    acc.hours += day.hours;
    Object.entries(day.platforms).forEach(([platform, value]) => {
      acc.platforms[platform] = (acc.platforms[platform] || 0) + value;
    });
    return acc;
  }, { sales: 0, cost: 0, net: 0, trips: 0, hours: 0, platforms: {} });

  const monthly = groupPeriods(days, 7);
  const weekly = groupWeeks(days);
  const bestDays = [...days].sort((a, b) => b.net - a.net).slice(0, 5);
  const worstDays = [...days].sort((a, b) => a.net - b.net).slice(0, 5);
  const longestDrivingDay = [...days].sort((a, b) => b.hours - a.hours)[0] || null;
  const highestRmPerHourDay = [...days].filter(day => day.hours > 0).sort((a, b) => (b.net / b.hours) - (a.net / a.hours))[0] || null;

  return {
    generatedAt: new Date().toISOString(),
    verifiedTotals: state.driverAnalytics?.verifiedTotalsAsOf2026_06_09 || null,
    importedJuneTotals: state.driverAnalytics?.importedJuneTotals || null,
    missingMayAndUnprovidedDetail: state.driverAnalytics?.missingMayAndUnprovidedDetail || null,
    totals: roundMoneyObject(totals),
    averageIncomePerDay: days.length ? round(totals.net / days.length) : 0,
    averageIncomePerHour: totals.hours ? round(totals.net / totals.hours) : 0,
    averageIncomePerTrip: totals.trips ? round(totals.net / totals.trips) : 0,
    platformComparison: platformComparison(totals.platforms, totals.net),
    monthlyRevenueTrend: monthly.map(item => ({ period: item.period, value: round(item.sales) })),
    monthlyNetProfitTrend: monthly.map(item => ({ period: item.period, value: round(item.net) })),
    top5BestDays: bestDays.map(dayAnalyticsSummary),
    top5WorstDays: worstDays.map(dayAnalyticsSummary),
    weeklySummary: weekly.map(item => roundMoneyObject(item)),
    dailyHeatmap: days.map(day => ({ date: day.date, net: round(day.net), sales: round(day.sales), trips: day.trips, hours: round(day.hours) })),
    longestDrivingDay: longestDrivingDay ? dayAnalyticsSummary(longestDrivingDay) : null,
    highestRmPerHourDay: highestRmPerHourDay ? { ...dayAnalyticsSummary(highestRmPerHourDay), rmPerHour: round(highestRmPerHourDay.net / highestRmPerHourDay.hours) } : null,
    importedDayCount: days.length
  };
}

function groupPeriods(days, sliceLength) {
  const periods = new Map();
  days.forEach(day => {
    const period = day.date.slice(0, sliceLength);
    if (!periods.has(period)) periods.set(period, { period, sales: 0, cost: 0, net: 0, trips: 0, hours: 0 });
    const row = periods.get(period);
    row.sales += day.sales;
    row.cost += day.cost;
    row.net += day.net;
    row.trips += day.trips;
    row.hours += day.hours;
  });
  return [...periods.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function groupWeeks(days) {
  const weeks = new Map();
  days.forEach(day => {
    const [start, end] = weekRange(day.date);
    const period = `${start} to ${end}`;
    if (!weeks.has(period)) weeks.set(period, { period, sales: 0, cost: 0, net: 0, trips: 0, hours: 0 });
    const row = weeks.get(period);
    row.sales += day.sales;
    row.cost += day.cost;
    row.net += day.net;
    row.trips += day.trips;
    row.hours += day.hours;
  });
  return [...weeks.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function platformComparison(platforms, totalNet) {
  return Object.entries(platforms).map(([platform, net]) => ({
    platform,
    net: round(net),
    share: totalNet ? round((net / totalNet) * 100) : 0
  })).sort((a, b) => b.net - a.net);
}

function dayAnalyticsSummary(day) {
  return {
    date: day.date,
    sales: round(day.sales),
    cost: round(day.cost),
    net: round(day.net),
    trips: day.trips,
    hours: round(day.hours),
    rmPerHour: day.hours ? round(day.net / day.hours) : 0,
    rmPerTrip: day.trips ? round(day.net / day.trips) : 0
  };
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundMoneyObject(item) {
  return {
    ...item,
    sales: round(item.sales),
    cost: round(item.cost),
    net: round(item.net),
    hours: round(item.hours)
  };
}

function realDriverInsight() {
  const analytics = driverAnalytics();
  const best = analytics.top5BestDays[0];
  const platform = analytics.platformComparison[0];
  if (analytics.verifiedTotals?.netIncome) return `Current net profit ${money.format(analytics.verifiedTotals.netIncome)}`;
  if (best) return `Best day: ${money.format(best.net)} on ${dateFmt.format(parseDate(best.date))}`;
  if (platform) return `${platform.platform} generated ${platform.share}% of net income`;
  if (analytics.averageIncomePerHour) return `Average ${money.format(analytics.averageIncomePerHour)}/hour`;
  return "No imported driver records yet";
}

function calendarDayIndicators(date) {
  const events = state.events.filter(event => event.date === date);
  const tasks = state.tasks.filter(task => task.dueDate === date && task.status !== "completed");
  const income = state.incomeEntries
    .filter(entry => entry.date === date)
    .reduce((sum, entry) => sum + num(entry.netIncome), 0);
  return {
    date,
    events: events.length,
    tasks: tasks.length,
    income,
    businesses: [...new Set(events.map(event => event.businessId))]
  };
}

function businessName(businessId) {
  return state.businesses.find(business => business.id === businessId)?.name || "OS";
}

function displayTime(value) {
  return value || "--:--";
}

function formatActionTitle(action) {
  if (!action) {
    const pulse = todayOS?.todayPulse;
    if (pulse?.netIncome > 0) return `Net income ${money.format(pulse.netIncome)}`;
    return realDriverInsight();
  }
  return action.item.title || "Next action";
}

function formatActionMeta(action) {
  if (!action) {
    const pulse = todayOS?.todayPulse || {};
    const analytics = driverAnalytics();
    return `Current net ${money.format(analytics.totals.net)} - Average ${money.format(analytics.averageIncomePerHour)}/hour - ${analytics.totals.trips} trips imported`;
  }
  const item = action.item;
  const time = action.kind === "task" ? item.dueTime : item.startTime;
  return `${displayTime(time)} - ${businessName(item.businessId)} - ${item.priority || "normal"} priority`;
}

function actionTime(action) {
  if (!action) return "";
  return action.kind === "task" ? action.item.dueTime : action.item.startTime;
}

function countdownTo(date, time) {
  if (!time) return "Ready";
  const [hours, minutes] = time.split(":").map(Number);
  const target = parseDate(date);
  target.setHours(hours || 0, minutes || 0, 0, 0);
  const diff = target - new Date();
  if (diff <= 0) return "Now";
  const totalMinutes = Math.ceil(diff / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function countValue(value, format = "number") {
  return `<strong class="count-up" data-value="${Number(value) || 0}" data-format="${format}">0</strong>`;
}

async function loadState() {
  if (hasUnsavedDriverFormEdits()) return;
  let correctedCashBaseline = false;
  let reconciledManualTotals = false;
  try {
    let response = await fetch("/api/state", {
      cache: "no-store",
      headers: authManager?.authHeaders() || {}
    });
    if (response.status === 401) {
      const recovered = await authManager?.handleUnauthorized?.();
      if (!recovered) return;
      response = await fetch("/api/state", {
        cache: "no-store",
        headers: authManager?.authHeaders() || {}
      });
    }
    if (!response.ok) throw new Error("Unable to load state");
    state = normalizeOSState(await response.json());
    correctedCashBaseline = applyOwnerCashBaselineCorrections();
    reconciledManualTotals = applyOwnerManualTotalReconciliation();
  } catch {
    state = normalizeOSState(JSON.parse(localStorage.getItem("topOneGroupState") || JSON.stringify(state)));
    correctedCashBaseline = applyOwnerCashBaselineCorrections();
    reconciledManualTotals = applyOwnerManualTotalReconciliation();
  }
  syncUniversalObjects();
  render();
  if (correctedCashBaseline || reconciledManualTotals) await persistState();
}

function renderPreservingViewport() {
  const x = window.scrollX;
  const y = window.scrollY;
  const activeName = document.activeElement?.name || "";
  render();
  requestAnimationFrame(() => {
    window.scrollTo(x, y);
    if (activeName) {
      const safeName = window.CSS?.escape ? CSS.escape(activeName) : activeName;
      document.querySelector(`[name="${safeName}"]`)?.focus?.({ preventScroll: true });
    }
  });
}

function hasUnsavedDriverFormEdits() {
  return driverFormDirty && Boolean($("#driverForm"));
}

async function persistState() {
  syncUniversalObjects();
  state.updatedAt = new Date().toISOString();
  localStorage.setItem("topOneGroupState", JSON.stringify(state));
  if (saving) return;
  saving = true;
  let cloudSaved = false;
  try {
    let response = await fetch("/api/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authManager?.authHeaders() || {})
      },
      body: JSON.stringify(state)
    });
    if (response.status === 401) {
      const recovered = await authManager?.handleUnauthorized?.();
      if (!recovered) return false;
      response = await fetch("/api/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authManager?.authHeaders() || {})
        },
        body: JSON.stringify(state)
      });
    }
    if (!response.ok) throw new Error("Unable to save state");
    state = normalizeOSState(await response.json());
    syncUniversalObjects();
    cloudSaved = true;
  } catch {
    // Local storage keeps the app usable if the data server is offline.
  } finally {
    saving = false;
    renderPreservingViewport();
  }
  return cloudSaved;
}

function sessionsForDate(date) {
  return state.driverSessions.filter(item => item.date === date);
}

function eventsForDate(date) {
  return state.solarEvents.filter(item => item.appointmentDate === date);
}

function driverTotals(sessions) {
  return sessions.reduce((acc, session) => {
    const metrics = driverMetrics(session);
    acc.income += metrics.income;
    acc.cost += metrics.cost;
    acc.hours += metrics.hours;
    acc.net += metrics.net;
    acc.trips += num(session.totalTrips || session.metadata?.totalTrips);
    if (session.driverIncomeModel === "wallet_cash_tng_v2") {
      acc.grab += num(session.grabTotalSales);
      acc.bolt += num(session.boltTotalSales);
    } else {
      if (session.platform === "Grab") acc.grab += metrics.income;
      if (session.platform === "Bolt") acc.bolt += metrics.income;
    }
    return acc;
  }, { income: 0, cost: 0, hours: 0, net: 0, grab: 0, bolt: 0, trips: 0 });
}

function monthDriverSessions() {
  const y = visibleDate.getFullYear();
  const m = visibleDate.getMonth();
  return state.driverSessions.filter(item => {
    const d = parseDate(item.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

function renderKpis() {
  const strip = $("#kpiStrip");
  if (mode === "driver") {
    const monthTotals = driverTotals(monthDriverSessions());
    const [weekStart, weekEnd] = weekRange(selectedDate);
    const weekSessions = state.driverSessions.filter(item => item.date >= weekStart && item.date <= weekEnd);
    const weekTotals = driverTotals(weekSessions);
    const target = 1390;
    const remaining = Math.max(0, target - weekTotals.net);
    const today = parseDate(selectedDate);
    const weekEndDate = parseDate(weekEnd);
    const remainingDays = Math.max(1, Math.floor((weekEndDate - today) / 86400000) + 1);
    const perDay = remaining / remainingDays;
    strip.innerHTML = [
      kpi("Total Earning", money.format(monthTotals.income), `Grab ${money.format(monthTotals.grab)} - Bolt ${money.format(monthTotals.bolt)}`),
      kpi("Total Costing", money.format(monthTotals.cost), "This visible month"),
      kpi("Net Profit", money.format(monthTotals.net), "Income minus cost"),
      kpi("Weekly Target", `${Math.min(100, Math.round((weekTotals.net / target) * 100))}%`, `${money.format(weekTotals.net)} / ${money.format(target)}`),
      kpi("Required Per Day", money.format(perDay), "Remaining weekly target")
    ].join("");
  } else {
    const monthEvents = monthSolarEvents();
    const appointed = monthEvents.filter(e => e.status === "Appointed").length;
    const closed = monthEvents.filter(e => e.status === "Closed").length;
    strip.innerHTML = [
      kpi("Solar Leads", monthEvents.length, "This visible month"),
      kpi("Appointments", appointed, "Booked visits"),
      kpi("Closed", closed, "Confirmed jobs"),
      kpi("Selected Date", eventsForDate(selectedDate).length, dateFmt.format(parseDate(selectedDate))),
      kpi("Sync", state.updatedAt ? "Saved" : "Ready", state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString() : "Waiting")
    ].join("");
  }
}

function kpi(label, value, detail) {
  return `<article class="kpi-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function monthSolarEvents() {
  const y = visibleDate.getFullYear();
  const m = visibleDate.getMonth();
  return state.solarEvents.filter(item => {
    const d = parseDate(item.appointmentDate);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

function grabRecords() {
  return state.driverSessions.filter(item => item.platform === "Grab" || item.driverIncomeModel === "grab_v13");
}

function recordsForDate(date) {
  return state.driverSessions.filter(item => item.date === date);
}

function selectedGrabRecord() {
  if (editingDriverId) {
    return state.driverSessions.find(item => item.id === editingDriverId) || null;
  }
  const record = recordsForDate(selectedDate).find(item => item.driverIncomeModel === "grab_v13")
    || recordsForDate(selectedDate).find(item => item.platform === "Grab")
    || null;
  return record && record.status === "In Progress" ? record : null;
}

function summaryGrabRecord(date = selectedDate) {
  const records = recordsForDate(date);
  return records.find(item => item.driverIncomeModel === "grab_v13")
    || records.find(item => item.platform === "Grab")
    || records[0]
    || null;
}

function sessionHours(sessions = []) {
  return sessions.reduce((sum, item) => sum + hoursBetween(item.startTime, item.endTime), 0);
}

function petrolTotal(entries = []) {
  return petrolTotals(entries).operatingCost;
}

function grabDailyMetrics(record = {}) {
  const sessions = Array.isArray(record.drivingSessions) && record.drivingSessions.length
    ? record.drivingSessions
    : [{ startTime: record.startTime || "", endTime: record.endTime || "" }];
  const hours = hasValue(record.totalDrivingHours) ? num(record.totalDrivingHours) : sessionHours(sessions);
  const tngMove = hasValue(record.tngOpening) && hasValue(record.tngClosing)
    ? num(record.tngClosing) - num(record.tngOpening)
    : 0;
  const smartTagCost = hasValue(record.smartTagOpening) && hasValue(record.smartTagClosing)
    ? Math.max(0, num(record.smartTagOpening) - num(record.smartTagClosing))
    : num(record.smartTagReduction);
  const base = num(record.grabWalletBase || state.grabSettings?.grabWalletBase || 500);
  const walletOpening = hasValue(record.grabCashWalletOpening) ? num(record.grabCashWalletOpening) : base;
  const walletEnding = hasValue(record.grabCashWalletEnding) ? num(record.grabCashWalletEnding) : walletOpening;
  const walletMove = walletEnding - walletOpening;
  const petrol = Array.isArray(record.petrolEntries) ? petrolTotal(record.petrolEntries) : num(record.petrolCost);
  const cash = num(record.cashCollected ?? record.cashReceived);
  const tngIncome = Math.max(0, tngMove);
  const tngCost = Math.max(0, -tngMove);
  const grabWalletIncome = Math.max(0, walletMove);
  const income = cash + tngIncome + grabWalletIncome;
  const toll = smartTagCost + tngCost;
  const cost = petrol + toll;
  return {
    hours,
    trips: num(record.totalTrips),
    income,
    cost,
    net: income - cost,
    incomePerHour: hours ? income / hours : 0,
    netPerHour: hours ? (income - cost) / hours : 0,
    cash,
    tngIncome,
    tngCost,
    smartTagCost,
    toll,
    petrol,
    grabWalletIncome,
    grabWalletTopUp: 0,
    walletOpening,
    walletEnding,
    walletMove,
    walletBase: base,
    transferToBank: Math.max(0, walletEnding - base)
  };
}

function dayStatus(date) {
  const records = recordsForDate(date);
  if (!records.length) return "Rest";
  if (records.some(item => item.status === "Finished")) return "Finished";
  return "In Progress";
}

function totalsForRecords(records) {
  return records.reduce((acc, item) => {
    const metrics = item.driverIncomeModel === "grab_v13" ? grabDailyMetrics(item) : driverMetrics(item);
    acc.income += metrics.income;
    acc.cost += metrics.cost;
    acc.net += metrics.net;
    acc.hours += metrics.hours;
    acc.trips += num(item.totalTrips);
    acc.petrol += item.driverIncomeModel === "grab_v13" ? metrics.petrol : num(item.petrolCost || item.metadata?.petrolCost);
    acc.toll += item.driverIncomeModel === "grab_v13" ? metrics.toll : num(item.smartTagReduction || item.metadata?.smartTagReduction);
    return acc;
  }, { income: 0, cost: 0, net: 0, hours: 0, trips: 0, petrol: 0, toll: 0 });
}

function driverAccountingAdjustments() {
  const analytics = state.driverAnalytics || {};
  const rawRecords = Array.isArray(state.driverRawRecords) ? state.driverRawRecords : [];
  const preGrabExpenses = hasValue(analytics.preGrabExpenses?.total)
    ? num(analytics.preGrabExpenses.total)
    : rawRecords
        .filter(item => item.type === "pre_grab_expense")
        .reduce((sum, item) => sum + num(item.amount), 0);
  const refunds = hasValue(analytics.refundsAndReimbursements?.total)
    ? num(analytics.refundsAndReimbursements.total)
    : rawRecords
        .filter(item => item.type === "refund_reimbursement" || String(item.id || "").startsWith("refund_grab_"))
        .reduce((sum, item) => sum + num(item.amount), 0);
  return { preGrabExpenses, refunds };
}

function applyOwnerManualTotalReconciliation() {
  if (authManager?.accountType?.() !== "owner") return false;
  const analytics = state.driverAnalytics || {};
  const existing = analytics.manualAllTimeReconciliation;
  let changed = false;
  const target = {
    asOf: "2026-07-30",
    boltSales: 3231.46,
    grabSales: 15568.96,
    refund: 170,
    income: 18970.42,
    cost: 4496.64,
    net: 14473.78,
    adjustmentLoss: 280.05,
    label: "adjustment loss"
  };
  if (!state.grabSettings?.cashCategories?.includes("money bank in")) {
    state.grabSettings = {
      ...(state.grabSettings || defaultGrabSettings()),
      cashCategories: [...(state.grabSettings?.cashCategories || defaultGrabSettings().cashCategories), "money bank in"]
    };
    changed = true;
  }

  if (
    existing &&
    Number(existing.income) === target.income &&
    Number(existing.cost) === target.cost &&
    Number(existing.net) === target.net &&
    Number(existing.adjustmentLoss) === target.adjustmentLoss
  ) {
    return changed;
  }

  state.driverAnalytics = {
    ...analytics,
    manualAllTimeReconciliation: target
  };
  changed = true;
  const adjustmentId = "raw_adjustment_loss_2026_07_30_manual_reconciliation";
  if (!state.driverRawRecords.some(item => item.id === adjustmentId)) {
    state.driverRawRecords.push({
      id: adjustmentId,
      date: "2026-07-30",
      type: "adjustment_loss",
      amount: target.adjustmentLoss,
      category: "adjustment loss",
      remark: "Manual Notepad total reconciliation difference"
    });
  }
  return changed;
}

function allTimeFinancialSummary() {
  const totals = totalsForRecords(state.driverSessions);
  const adjustments = driverAccountingAdjustments();
  const systemCost = totals.cost + adjustments.preGrabExpenses;
  const systemNet = totals.income - systemCost;
  const manual = state.driverAnalytics?.manualAllTimeReconciliation;
  if (manual && hasValue(manual.net)) {
    return {
      income: num(manual.income),
      cost: num(manual.cost),
      net: num(manual.net),
      refund: num(manual.refund),
      adjustmentLoss: num(manual.adjustmentLoss || (systemNet - num(manual.net))),
      systemIncome: totals.income,
      systemCost,
      systemNet,
      manual: true
    };
  }
  return {
    income: totals.income,
    cost: systemCost,
    net: systemNet,
    refund: adjustments.refunds,
    adjustmentLoss: 0,
    systemIncome: totals.income,
    systemCost,
    systemNet,
    manual: false
  };
}

function monthlyCommitments() {
  const analytics = state.driverAnalytics || {};
  return Array.isArray(analytics.monthlyCommitments)
    ? analytics.monthlyCommitments
    : [];
}

function monthlyCommitmentTotal() {
  return monthlyCommitments()
    .filter(item => item.active !== false)
    .reduce((sum, item) => sum + num(item.amount), 0);
}

function addMonthlyCommitment(data) {
  const name = String(data.name || "").trim();
  const amount = num(data.amount);
  if (!name || amount <= 0) return;
  state.driverAnalytics = {
    ...(state.driverAnalytics || {}),
    monthlyCommitments: [
      ...monthlyCommitments(),
      {
        id: uid("commitment"),
        name,
        amount,
        remark: String(data.remark || "").trim(),
        active: true
      }
    ]
  };
}

function removeMonthlyCommitment(id) {
  state.driverAnalytics = {
    ...(state.driverAnalytics || {}),
    monthlyCommitments: monthlyCommitments().filter(item => item.id !== id)
  };
}

const forecastPresets = {
  full_work: { label: "Full Work", title: "Grab full day", hours: 13.5, gross: 350, cost: 55, net: 295, color: "#148d5b" },
  half_day: { label: "Half Day", title: "Grab half day", hours: 6, gross: 180, cost: 30, net: 150, color: "#1c9ba0" },
  rest: { label: "Rest", title: "Rest", hours: 0, gross: 0, cost: 0, net: 0, color: "#8a948d" },
  shooting: { label: "Shooting", title: "Shooting", hours: 0, gross: 0, cost: 0, net: 0, color: "#8562d6" },
  marketing: { label: "Marketing", title: "Marketing job", hours: 0, gross: 0, cost: 0, net: 0, color: "#c57924" },
  webinar: { label: "Webinar", title: "Webinar", hours: 0, gross: 0, cost: 0, net: 0, color: "#2f72b8" },
  custom: { label: "Custom", title: "Custom plan", hours: 0, gross: 0, cost: 0, net: 0, color: "#b38b16" }
};

function forecastPlans() {
  const analytics = state.driverAnalytics || {};
  return analytics.forecastPlans && typeof analytics.forecastPlans === "object"
    ? analytics.forecastPlans
    : {};
}

function forecastPlansForMonth(monthKey = selectedMonthKey()) {
  const allPlans = forecastPlans();
  return allPlans[monthKey] && typeof allPlans[monthKey] === "object" ? allPlans[monthKey] : {};
}

function forecastDefaultPlanForDate(dateIso) {
  return normalizeForecastPlan(dateIso, { type: "full_work" });
}

function forecastPlanForDate(dateIso) {
  const monthKey = String(dateIso || "").slice(0, 7);
  return forecastPlansForMonth(monthKey)[dateIso] || forecastDefaultPlanForDate(dateIso);
}

function forecastPlansForMonthWithDefaults(monthKey = selectedMonthKey()) {
  const monthDate = parseDate(`${monthKey}-01`);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const iso = `${monthKey}-${String(index + 1).padStart(2, "0")}`;
    return [iso, forecastPlanForDate(iso)];
  }).reduce((acc, [iso, plan]) => {
    acc[iso] = plan;
    return acc;
  }, {});
}

function normalizeForecastPlan(dateIso, data = {}) {
  const type = forecastPresets[data.type] ? data.type : "custom";
  const preset = forecastPresets[type];
  const gross = hasValue(data.gross) ? num(data.gross) : preset.gross;
  const cost = hasValue(data.cost) ? num(data.cost) : preset.cost;
  const net = hasValue(data.net) ? num(data.net) : gross - cost;
  return {
    date: dateIso,
    type,
    title: String(data.title || preset.title).trim(),
    hours: hasValue(data.hours) ? num(data.hours) : preset.hours,
    gross,
    cost,
    net,
    note: String(data.note || "").trim(),
    color: data.color || preset.color
  };
}

function saveForecastPlan(dateIso, data = {}) {
  if (!dateIso) return;
  const monthKey = dateIso.slice(0, 7);
  const currentMonth = forecastPlansForMonth(monthKey);
  state.driverAnalytics = {
    ...(state.driverAnalytics || {}),
    forecastPlans: {
      ...forecastPlans(),
      [monthKey]: {
        ...currentMonth,
        [dateIso]: normalizeForecastPlan(dateIso, data)
      }
    }
  };
}

function removeForecastPlan(dateIso) {
  if (!dateIso) return;
  const monthKey = dateIso.slice(0, 7);
  const currentMonth = { ...forecastPlansForMonth(monthKey) };
  delete currentMonth[dateIso];
  state.driverAnalytics = {
    ...(state.driverAnalytics || {}),
    forecastPlans: {
      ...forecastPlans(),
      [monthKey]: currentMonth
    }
  };
}

function monthWeekStarts(monthDate = visibleDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  const weeks = [];
  for (const weekStart = new Date(start); weekStart <= monthEnd; weekStart.setDate(weekStart.getDate() + 7)) {
    weeks.push(new Date(weekStart));
  }
  return weeks;
}

function forecastSummary(monthKey = selectedMonthKey()) {
  const plans = Object.values(forecastPlansForMonthWithDefaults(monthKey));
  return plans.reduce((acc, plan) => {
    const isGrab = plan.type === "full_work" || plan.type === "half_day";
    if (isGrab) acc.grabNet += num(plan.net);
    else acc.otherNet += num(plan.net);
    acc.totalNet += num(plan.net);
    acc.gross += num(plan.gross);
    acc.cost += num(plan.cost);
    acc.hours += num(plan.hours);
    if (plan.type === "rest") acc.restDays += 1;
    if (num(plan.net) !== 0 || num(plan.hours) > 0) acc.activeDays += 1;
    return acc;
  }, { grabNet: 0, otherNet: 0, totalNet: 0, gross: 0, cost: 0, hours: 0, activeDays: 0, restDays: 0 });
}

function forecastWeekNet(weekStartDate) {
  let total = 0;
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const day = new Date(weekStartDate);
    day.setDate(weekStartDate.getDate() + weekday);
    const plan = forecastPlanForDate(toISODate(day));
    total += plan ? num(plan.net) : 0;
  }
  return total;
}

function forecastOptions(selectedType = "full_work") {
  return Object.entries(forecastPresets).map(([value, preset]) =>
    `<option value="${value}" ${value === selectedType ? "selected" : ""}>${preset.label}</option>`
  ).join("");
}

function weekRecords(dateIso = selectedDate) {
  return recordsThroughSelectedDate(state.driverSessions, dateIso);
}

function monthRecords(monthKey = selectedMonthKey()) {
  return state.driverSessions.filter(item => String(item.date || "").startsWith(monthKey));
}

function dueCarRentalPayments(monthKey = selectedMonthKey(), throughDate = selectedDate) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return 0;
  const monthStart = parseDate(`${monthKey}-01`);
  const monthEnd = new Date(year, month, 0);
  const cutoff = String(throughDate || "").startsWith(monthKey)
    ? parseDate(throughDate)
    : monthEnd;
  const end = cutoff < monthStart ? monthStart : cutoff > monthEnd ? monthEnd : cutoff;
  let count = 0;
  for (const day = new Date(monthStart); day <= end; day.setDate(day.getDate() + 1)) {
    if (day.getDay() === 0) count += 1;
  }
  return count;
}

function duePetrolCost(monthKey = selectedMonthKey(), throughDate = selectedDate) {
  const cutoff = String(throughDate || "").startsWith(monthKey)
    ? throughDate
    : `${monthKey}-31`;
  return monthRecords(monthKey)
    .filter(item => item.date <= cutoff)
    .reduce((sum, item) => {
      const metrics = item.driverIncomeModel === "grab_v13" ? grabDailyMetrics(item) : null;
      return sum + (metrics ? metrics.petrol : num(item.petrolCost || item.metadata?.petrolCost));
    }, 0);
}

function latestGrabEndingBefore(dateIso = selectedDate, fieldName) {
  const records = grabRecords()
    .filter(item => item.date < dateIso && item.status === "Finished" && hasValue(item[fieldName]))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return records.length ? records[0][fieldName] : "";
}

function cashBalances() {
  const settings = state.grabSettings || defaultGrabSettings();
  return state.cashLedger.reduce((acc, item) => {
    const amount = num(item.amount);
    if (item.account === "petty_cash") acc.pettyCash += amount;
    if (item.account === "cash_at_home") acc.cashAtHome += amount;
    if (item.fromAccount === "petty_cash") acc.pettyCash -= amount;
    if (item.fromAccount === "cash_at_home") acc.cashAtHome -= amount;
    if (item.toAccount === "petty_cash") acc.pettyCash += amount;
    if (item.toAccount === "cash_at_home") acc.cashAtHome += amount;
    return acc;
  }, {
    pettyCash: num(settings.pettyCashOpening),
    cashAtHome: num(settings.cashAtHomeOpening)
  });
}

function applyOwnerCashBaselineCorrections() {
  if (authManager?.accountType?.() !== "owner") return false;
  if (state.cashLedger.some(item => item.id === "cash_manual_baseline_2026_07_26_home_2550")) return false;

  const balances = cashBalances();
  const staleHome = Math.abs(balances.cashAtHome - 2150) < 0.01;
  const stalePettyBeforeToday = Math.abs(balances.pettyCash - 165) < 0.01;
  const stalePettyAfterToday = Math.abs(balances.pettyCash - 190) < 0.01;
  if (!staleHome || (!stalePettyBeforeToday && !stalePettyAfterToday)) return false;

  const targetPetty = stalePettyBeforeToday ? 244 : 269;
  const targetHome = 2550;
  [
    {
      id: `cash_manual_baseline_2026_07_26_petty_${targetPetty}`,
      account: "petty_cash",
      amount: targetPetty - balances.pettyCash
    },
    {
      id: "cash_manual_baseline_2026_07_26_home_2550",
      account: "cash_at_home",
      amount: targetHome - balances.cashAtHome
    }
  ].filter(item => Math.abs(item.amount) > 0.004).forEach(item => {
    state.cashLedger.push({
      id: item.id,
      date: "2026-07-26",
      type: "cash_adjustment",
      account: item.account,
      amount: item.amount,
      category: "manual cash position update",
      remark: "Correct cash baseline before 2026-07-27"
    });
  });
  return true;
}

function cashLedgerEffect(item = {}) {
  const amount = num(item.amount);
  let effect = 0;
  if (item.account === "petty_cash" || item.account === "cash_at_home") effect += amount;
  if (item.fromAccount === "petty_cash" || item.fromAccount === "cash_at_home") effect -= amount;
  if (item.toAccount === "petty_cash" || item.toAccount === "cash_at_home") effect += amount;
  return effect;
}

function cashMonthMovement(monthKey = selectedMonthKey()) {
  return state.cashLedger
    .filter(item => String(item.date || "").startsWith(monthKey))
    .reduce((sum, item) => sum + cashLedgerEffect(item), 0);
}

function cashUsageTotals(monthKey = selectedMonthKey()) {
  return state.cashLedger
    .filter(item => String(item.date || "").startsWith(monthKey) && item.type === "cash_withdrawal")
    .reduce((acc, item) => {
      const category = String(item.category || "uncategorized").trim() || "uncategorized";
      const amount = num(item.amount);
      acc.total += amount;
      acc.byCategory[category] = (acc.byCategory[category] || 0) + amount;
      if (category.toLowerCase() === "pocket money") acc.pocketMoney += amount;
      if (category.toLowerCase() === "bank in") acc.bankIn += amount;
      return acc;
    }, { total: 0, pocketMoney: 0, bankIn: 0, byCategory: {} });
}

function setCashPosition(data, dateIso = selectedDate) {
  const current = cashBalances();
  const targetPetty = num(data.pettyCashCurrent);
  const targetHome = num(data.cashAtHomeCurrent);
  [
    { account: "petty_cash", amount: targetPetty - current.pettyCash },
    { account: "cash_at_home", amount: targetHome - current.cashAtHome }
  ].filter(item => Math.abs(item.amount) > 0.004).forEach(item => {
    state.cashLedger.push({
      id: uid("cash"),
      date: dateIso,
      type: "cash_adjustment",
      account: item.account,
      amount: item.amount,
      category: "manual cash position update",
      remark: "Set current cash position"
    });
  });
}

function bankTransferTotals() {
  const [weekStart, weekEnd] = weekRange(selectedDate);
  const month = selectedDate.slice(0, 7);
  return state.bankTransfers.reduce((acc, item) => {
    const amount = num(item.amount);
    if (item.date >= weekStart && item.date <= weekEnd) {
      acc.week += amount;
      acc.weekBySource[item.source] = (acc.weekBySource[item.source] || 0) + amount;
    }
    if (item.date.slice(0, 7) === month) {
      acc.month += amount;
      acc.monthBySource[item.source] = (acc.monthBySource[item.source] || 0) + amount;
    }
    return acc;
  }, { week: 0, month: 0, weekBySource: {}, monthBySource: {} });
}

function upsertPending(action) {
  const amount = num(action.amount);
  const index = state.pendingCashActions.findIndex(item => item.id === action.id);
  if (amount <= 0) {
    if (index >= 0) state.pendingCashActions.splice(index, 1);
    return;
  }
  if (index >= 0) {
    state.pendingCashActions[index] = { ...state.pendingCashActions[index], ...action, amount };
    return;
  }
  state.pendingCashActions.push({ ...action, amount });
}

function confirmedCashAmountForRecord(recordId) {
  return state.cashLedger
    .filter(item => item.sourceId === recordId && item.type === "cash_collected")
    .reduce((sum, item) => sum + cashLedgerEffect(item), 0);
}

function hasConfirmedCashForRecord(recordId, amount = null) {
  const matched = state.cashLedger.filter(item => item.sourceId === recordId && item.type === "cash_collected");
  if (!matched.length) return false;
  if (amount === null) return true;
  return Math.abs(confirmedCashAmountForRecord(recordId) - num(amount)) < 0.005;
}

function removeConfirmedCashForRecord(recordId) {
  state.cashLedger = state.cashLedger.filter(item => !(item.sourceId === recordId && item.type === "cash_collected"));
}

function hasAnyGrabBankTransferForRecord(recordId) {
  return state.bankTransfers.some(item => item.sourceId === recordId && item.source === "grab_wallet");
}

function hasConfirmedGrabBankTransfer(recordId, amount = null) {
  return state.bankTransfers.some(item =>
    item.sourceId === recordId
    && item.source === "grab_wallet"
    && (amount === null || Math.abs(num(item.amount) - num(amount)) < 0.005)
  );
}

function removeConfirmedGrabBankTransferForRecord(recordId) {
  state.bankTransfers = state.bankTransfers.filter(item => !(item.sourceId === recordId && item.source === "grab_wallet"));
}

function removePending(id) {
  state.pendingCashActions = state.pendingCashActions.filter(item => item.id !== id);
}

function createFinishPendingActions(record) {
  const metrics = grabDailyMetrics(record);
  if (hasConfirmedCashForRecord(record.id) && !hasConfirmedCashForRecord(record.id, metrics.cash)) {
    removeConfirmedCashForRecord(record.id);
  }
  if (!hasConfirmedCashForRecord(record.id, metrics.cash)) {
    upsertPending({
      id: `pending_cash_${record.id}`,
      date: record.date,
      type: "cash_collected_to_petty",
      amount: metrics.cash,
      label: "Add cash collected to Petty Cash",
      sourceId: record.id
    });
  } else {
    removePending(`pending_cash_${record.id}`);
  }
  if (hasAnyGrabBankTransferForRecord(record.id) && !hasConfirmedGrabBankTransfer(record.id, metrics.transferToBank)) {
    removeConfirmedGrabBankTransferForRecord(record.id);
  }
  if (!hasConfirmedGrabBankTransfer(record.id, metrics.transferToBank)) {
    upsertPending({
      id: `pending_grab_bank_${record.id}`,
      date: record.date,
      type: "grab_wallet_transfer_to_bank",
      amount: metrics.transferToBank,
      label: "Confirm Grab wallet transfer to bank",
      sourceId: record.id
    });
  } else {
    removePending(`pending_grab_bank_${record.id}`);
  }
}

function confirmPending(id, allocation = null) {
  const action = state.pendingCashActions.find(item => item.id === id);
  if (!action) return;
  if (action.type === "cash_collected_to_petty") {
    const total = num(action.amount);
    if (allocation && (hasValue(allocation.currentPettyCash) || hasValue(allocation.currentCashAtHome))) {
      const baseline = cashBalances();
      setCashPosition({
        pettyCashCurrent: hasValue(allocation.currentPettyCash) ? allocation.currentPettyCash : baseline.pettyCash,
        cashAtHomeCurrent: hasValue(allocation.currentCashAtHome) ? allocation.currentCashAtHome : baseline.cashAtHome
      }, action.date);
    }
    const current = cashBalances();
    const availablePettyCash = current.pettyCash + total;
    const requestedHome = allocation && hasValue(allocation.cashAtHome) ? num(allocation.cashAtHome) : 0;
    const requestedPetty = allocation && hasValue(allocation.pettyCash)
      ? num(allocation.pettyCash)
      : availablePettyCash - requestedHome;
    const lines = [
      { account: "petty_cash", amount: requestedPetty - current.pettyCash },
      { account: "cash_at_home", amount: requestedHome }
    ];
    lines.filter(item => Math.abs(item.amount) > 0.004).forEach(item => {
      state.cashLedger.push({
        id: uid("cash"),
        date: action.date,
        type: "cash_collected",
        account: item.account,
        amount: item.amount,
        category: "cash collected",
        sourceId: action.sourceId
      });
    });
  }
  if (action.type === "grab_wallet_transfer_to_bank") {
    if (!hasConfirmedGrabBankTransfer(action.sourceId, action.amount)) {
      state.bankTransfers.push({
        id: uid("bank"),
        date: action.date,
        source: "grab_wallet",
        amount: num(action.amount),
        sourceId: action.sourceId
      });
    }
  }
  state.pendingCashActions = state.pendingCashActions.filter(item => item.id !== id);
}

function renderWeeklyAchievements() {
  const settings = state.grabSettings || defaultGrabSettings();
  const totals = totalsForRecords(weekRecords());
  const carTarget = num(settings.carRentalTarget || 390);
  const housingTarget = num(settings.housingLoanTarget || 1000);
  const car = Math.min(totals.net, carTarget);
  const housing = Math.min(Math.max(totals.net - carTarget, 0), housingTarget);
  const pocket = Math.max(totals.net - carTarget - housingTarget, 0);
  $("#weeklyAchievements").innerHTML = [
    achievementCard("Car Rental", car, carTarget, "First weekly achievement"),
    achievementCard("Housing Loan", housing, housingTarget, "Second achievement"),
    `<article class="achievement-card pocket"><span>Pocket Money</span><strong>${money.format(pocket)}</strong><small>After weekly achievements</small></article>`,
    `<article class="achievement-card"><span>Weekly Net</span><strong>${money.format(totals.net)}</strong><small>${totals.hours.toFixed(1)}h - ${totals.trips} trips</small></article>`
  ].join("");
}

function achievementCard(label, value, target, detail) {
  const pct = target ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  return `<article class="achievement-card ${pct >= 100 ? "complete" : ""}">
    <span>${label}</span>
    <strong>${money.format(value)} / ${money.format(target)}</strong>
    <div class="progress-track"><i style="width:${pct}%"></i></div>
    <small>${pct >= 100 ? "Completed" : detail}</small>
  </article>`;
}

function renderCalendar() {
  $("#monthLabel").textContent = monthFmt.format(visibleDate);
  const grid = $("#calendarGrid");
  const todayIso = toISODate(new Date());
  const cards = [];

  monthWeekStarts(visibleDate).forEach(weekStartDate => {
    cards.push(weekSummaryMarkup(weekStartDate));

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const day = new Date(weekStartDate);
      day.setDate(weekStartDate.getDate() + weekday);
      const iso = toISODate(day);
      const outside = day.getMonth() !== visibleDate.getMonth() ? " outside" : "";
      const selected = iso === selectedDate ? " selected" : "";
      const indicators = calendarDayIndicators(iso);
      cards.push(`<button class="day-card${outside}${selected}" data-date="${iso}" data-events="${indicators.events}" data-tasks="${indicators.tasks}" data-income="${indicators.income}">
        <div class="day-number">
          <span class="${iso === todayIso ? "today-dot" : ""}">${day.getDate()}</span>
          ${lunarReminderMarkup(iso)}
        </div>
        <div class="mini-stack">${calendarIndicatorMarkup(indicators, iso)}</div>
      </button>`);
    }
  });
  grid.innerHTML = cards.join("");
  grid.querySelectorAll(".day-card").forEach(card => {
    card.addEventListener("click", () => {
      selectedDate = card.dataset.date;
      editingDriverId = null;
      editingSolarId = null;
      render();
      const summaryRecord = mode === "driver" ? summaryGrabRecord(selectedDate) : null;
      if (summaryRecord) showDailySummary(summaryRecord);
    });
  });
}

function weekSummaryMarkup(weekStartDate) {
  const weeklyTarget = 1390;
  const weekStartIso = toISODate(weekStartDate);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  const weekEndIso = toISODate(weekEndDate);
  const sessions = state.driverSessions.filter(item => item.date >= weekStartIso && item.date <= weekEndIso);
  const totals = driverTotals(sessions);
  const pct = Math.min(100, Math.max(0, (totals.net / weeklyTarget) * 100));
  const complete = pct >= 100 ? " complete" : "";
  return `<div class="week-summary-card${complete}">
    <span>Week Net</span>
    <strong>${moneyCompact.format(totals.net)}</strong>
    <small>/ ${moneyCompact.format(weeklyTarget)}</small>
    <i><b style="width:${pct}%"></b></i>
  </div>`;
}

function lunarReminderMarkup(iso) {
  const lunar = lunarVegetarianReminder(iso);
  if (!lunar.lunarLabel && !lunar.reminder) return "";
  const title = lunar.reminder ? ` title="${lunar.reminder}" aria-label="${lunar.reminder}"` : "";
  return `<small class="lunar-note${lunar.reminder ? " active" : ""}"${title}>
    <span>${lunar.lunarLabel}</span>
  </small>`;
}

function calendarIndicatorMarkup(indicators, iso) {
  const legacyMarkup = mode === "driver" ? driverDayMarkup(iso) : solarDayMarkup(iso);
  const rows = [];
  if (mode !== "driver" && indicators.events) rows.push(`<div class="calendar-signal">${indicators.events} events</div>`);
  if (mode !== "driver" && indicators.tasks) rows.push(`<div class="calendar-signal warning">${indicators.tasks} tasks</div>`);
  if (mode !== "driver" && indicators.income) rows.push(`<div class="calendar-signal income">${money.format(indicators.income)} net</div>`);
  return rows.length ? rows.join("") : legacyMarkup;
}

function driverDayMarkup(date) {
  const sessions = sessionsForDate(date);
  const status = dayStatus(date);
  if (!sessions.length) return `<div class="driver-mini rest"><div>Rest</div></div>`;
  const totals = driverTotals(sessions);
  const iph = totals.hours ? totals.income / totals.hours : 0;
  const platformClass = sessions.some(s => s.platform === "Bolt") && !sessions.some(s => s.platform === "Grab") ? "bolt" : "grab";
  const resultClass = totals.net < 0 ? "loss" : "profit";
  const tierClass = profitTier(totals.net);
  const statusClassName = status.toLowerCase().replace(/\s+/g, "-");
  const platforms = [...new Set(sessions.map(s => s.platform).filter(Boolean))].join(" + ");
  return `<div class="driver-mini ${platformClass} ${resultClass} ${tierClass} ${statusClassName}">
    <div class="day-status">${status}${platforms ? ` - ${platforms}` : ""}</div>
    <div class="net-profit">${moneyCompact.format(totals.net)}</div>
    <div>${moneyCompact.format(iph)}/h income</div>
    <div>${totals.hours.toFixed(1)}h - ${totals.trips || 0} trips</div>
  </div>`;
}

function solarDayMarkup(date) {
  return eventsForDate(date).slice(0, 4).map(event =>
    `<div class="solar-chip ${statusClass(event.status)}">${event.appointmentTime || ""} ${escapeHtml(event.customerName)}</div>`
  ).join("");
}

function renderSidebar() {
  $("#modeTitle").textContent = mode === "driver" ? "Grab Profit Calendar" : "Solar Appointment";
  $("#sidebarTitle").textContent = mode === "driver" ? "Grab Daily Record" : "Solar Appointment";
  $("#selectedDateLabel").textContent = dateFmt.format(parseDate(selectedDate));
  $("#sidebarBody").innerHTML = mode === "driver" ? driverSidebar() : solarSidebar();
  bindSidebar();
}

function renderNextActionHero() {
  const hero = $("#nextActionHero");
  const action = todayOS.nextAction;
  const pulse = todayOS.todayPulse;
  const analytics = driverAnalytics();
  const displayedNet = analytics.verifiedTotals?.netIncome || analytics.totals.net;
  const time = actionTime(action);
  hero.innerHTML = `<div class="hero-copy">
    <p class="eyebrow">Next Action</p>
    <h2>${escapeHtml(formatActionTitle(action))}</h2>
    <p>${escapeHtml(formatActionMeta(action))}</p>
    <div class="live-countdown">Live countdown <strong data-countdown-date="${selectedDate}" data-countdown-time="${time}">${countdownTo(selectedDate, time)}</strong></div>
  </div>
  <div class="hero-route" aria-hidden="true">
    <div class="route-orbit"></div>
    <div class="route-line"></div>
    <span class="route-marker start"></span>
    <span class="route-marker mid"></span>
    <span class="route-marker end"></span>
    <span class="route-label start">Now</span>
    <span class="route-label end">${escapeHtml(time || "Next")}</span>
  </div>
  <div class="hero-metrics">
    <span>${countValue(displayedNet, "money")} <em>Current Net</em></span>
    <span>${countValue(analytics.averageIncomePerHour, "money")} <em>Avg / Hour</em></span>
    <span>${countValue(analytics.totals.trips)} <em>Trips</em></span>
    <span>${countValue(analytics.totals.hours, "hours")} <em>Driving Hours</em></span>
    <span>${countValue(pulse.appointments)} <em>Appointments</em></span>
  </div>`;
}

function renderTodaySchedule() {
  const target = $("#todaySchedule");
  const schedule = todayOS.todaySchedule;
  target.innerHTML = schedule.length
    ? `<div class="timeline-list">${schedule.map(event => `<article class="timeline-item">
        <time>${displayTime(event.startTime)}</time>
        <div>
          <strong>${escapeHtml(event.title)}</strong>
          <span>${businessName(event.businessId)} - ${escapeHtml(event.status || "scheduled")}</span>
        </div>
      </article>`).join("")}</div>`
    : `<div class="empty-note">No scheduled events for this day.</div>`;
}

function renderTodayTasks() {
  const target = $("#todayTasks");
  const tasks = todayOS.todayTasks;
  target.innerHTML = tasks.length
    ? `<div class="task-list">${tasks.map(task => `<article class="task-item">
        <span class="task-dot"></span>
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <span>${displayTime(task.dueTime)} - ${businessName(task.businessId)}</span>
        </div>
      </article>`).join("")}</div>`
    : `<div class="empty-note">Nothing incomplete for this day.</div>`;
}

function renderTodayPulse() {
  const pulse = todayOS.todayPulse;
  const analytics = driverAnalytics();
  const verified = analytics.verifiedTotals;
  $("#todayPulse").innerHTML = `<div class="pulse-stack">
    ${pulseRow("Verified Sales", countValue(verified?.totalSales || analytics.totals.sales, "money"))}
    ${pulseRow("Verified Cost", countValue(verified?.totalCost || analytics.totals.cost, "money"))}
    ${pulseRow("Verified Net", countValue(verified?.netIncome || analytics.totals.net, "money"))}
    ${pulseRow("Avg / Hour", countValue(analytics.averageIncomePerHour, "money"))}
    ${pulseRow("Trips", countValue(analytics.totals.trips))}
    ${pulseRow("Appointments", countValue(pulse.appointments))}
    ${pulseRow("Follow Ups", countValue(pulse.followUps))}
  </div>`;
}

function pulseRow(label, value) {
  return `<div class="pulse-row"><span>${label}</span>${value}</div>`;
}

function renderPeopleToMoveToday() {
  const target = $("#peopleToMoveToday");
  if (!target) return;
  if (mode === "driver") {
    const totals = totalsForRecords(monthRecords());
    target.innerHTML = `<span>${money.format(totals.net)} month net</span>`;
    return;
  }
  const people = todayOS.peopleToMoveToday;
  target.innerHTML = people.length ? `<span>${people.length} people to move</span>` : `<span>No people queued</span>`;
}

function renderDriverDashboard() {
  const target = $("#driverDashboard");
  if (!target) return;
  const settings = state.grabSettings || defaultGrabSettings();
  const week = totalsForRecords(weekRecords());
  const records = weekRecords();
  const activeDays = new Set(records.filter(item => driverMetrics(item).net !== 0 || num(item.totalTrips) > 0).map(item => item.date)).size || 1;
  const weeklyTarget = num(settings.carRentalTarget) + num(settings.housingLoanTarget);
  const targetProgress = weeklyTarget ? Math.min(100, Math.max(0, (week.net / weeklyTarget) * 100)) : 0;
  const remaining = Math.max(0, weeklyTarget - week.net);
  const month = totalsForRecords(monthRecords());
  const allTime = allTimeFinancialSummary();
  const dueRental = dueCarRentalPayments() * num(settings.carRentalTarget);
  const duePetrol = duePetrolCost();
  const netAfterRental = month.net - dueRental;
  const netAfterRentalAndPetrol = month.net - dueRental - duePetrol;
  target.innerHTML = `
    <article class="dashboard-alltime-card">
      <span>All-Time Net Profit</span>
      <strong>${money.format(allTime.net)}</strong>
      <small>${money.format(allTime.income)} income - ${money.format(allTime.cost)} costing${allTime.refund ? ` · ${money.format(allTime.refund)} refund included` : ""}${allTime.adjustmentLoss ? ` · ${money.format(allTime.adjustmentLoss)} adjustment loss` : ""}</small>
    </article>
    <article class="dashboard-target-card">
      <div class="dashboard-card-head"><span>Weekly income target</span><strong>${targetProgress.toFixed(1)}%</strong></div>
      <div class="dashboard-progress"><i style="width:${targetProgress}%"></i></div>
      <p class="dashboard-target-line">
        <span>${money.format(week.net)} / ${money.format(weeklyTarget)}</span>
        <span class="target-remaining">Remaining: ${money.format(remaining)}</span>
      </p>
    </article>
    <article class="dashboard-net-card">
      <span>Week Net</span>
      <strong>${money.format(week.net)}</strong>
      <small>${activeDays} active days - ${week.trips} trips</small>
      <div class="dashboard-spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    </article>
    <article class="dashboard-mini-card"><span>After Car Rental</span><strong>${money.format(netAfterRental)}</strong><small>${money.format(month.net)} - ${money.format(dueRental)} rental</small></article>
    <article class="dashboard-mini-card"><span>After Rental + Petrol</span><strong>${money.format(netAfterRentalAndPetrol)}</strong><small>${money.format(month.net)} - ${money.format(dueRental)} rental - ${money.format(duePetrol)} petrol</small></article>
  `;
}

function renderForecastPlanner() {
  const target = $("#forecastSection");
  if (!target) return;
  const monthKey = selectedMonthKey();
  const monthLabel = monthFmt.format(parseDate(`${monthKey}-01`));
  if (!String(selectedForecastDate || "").startsWith(monthKey)) {
    selectedForecastDate = `${monthKey}-01`;
  }
  const summary = forecastSummary(monthKey);
  const selectedPlan = forecastPlanForDate(selectedForecastDate);
  const cards = [];
  const todayIso = toISODate(new Date());
  monthWeekStarts(visibleDate).forEach(weekStartDate => {
    const weekNet = forecastWeekNet(weekStartDate);
    cards.push(`<div class="forecast-week-summary"><span>Week Forecast</span><strong>${moneyCompact.format(weekNet)}</strong></div>`);
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const day = new Date(weekStartDate);
      day.setDate(weekStartDate.getDate() + weekday);
      const iso = toISODate(day);
      const plan = forecastPlanForDate(iso);
      const type = plan?.type || "empty";
      const outside = day.getMonth() !== visibleDate.getMonth() ? " outside" : "";
      const selected = iso === selectedForecastDate ? " selected" : "";
      const color = plan?.color || "#cbd4cc";
      cards.push(`<button class="forecast-day ${type}${outside}${selected}" type="button" data-forecast-date="${iso}" style="--forecast-color:${color}">
        <span class="forecast-day-number ${iso === todayIso ? "today-dot" : ""}">${day.getDate()}</span>
        <strong>${escapeHtml(plan.title)}</strong><small>${moneyCompact.format(plan.net)} - ${num(plan.hours).toFixed(1)}h</small>
      </button>`);
    }
  });

  target.innerHTML = `<div class="section-heading forecast-heading">
    <div>
      <p class="eyebrow">Standalone Tool</p>
      <h2>Forecast Planner</h2>
    </div>
    <button class="primary-action forecast-export-action" type="button" id="generateForecastImage">Generate Photo</button>
  </div>
  <div class="forecast-summary-grid">
    ${statCard("Grab Forecast", money.format(summary.grabNet), `${summary.activeDays} planned active days`)}
    ${statCard("Other Jobs", money.format(summary.otherNet), "Shooting, marketing, webinar, custom")}
    ${statCard("Total Forecast", money.format(summary.totalNet), `${summary.hours.toFixed(1)} planned hours`)}
  </div>
  <div class="forecast-workbench">
    <section class="forecast-calendar-card">
      <div class="forecast-calendar-head">
        <div><span>${monthLabel}</span><strong>Planning Calendar</strong></div>
        <small>Only planning data. Real income remains unchanged.</small>
      </div>
      <div class="forecast-calendar-scroll">
        <div class="forecast-weekday-row">
          <span>Week</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
        <div class="forecast-grid">${cards.join("")}</div>
      </div>
    </section>
    <section class="forecast-editor-card">
      <div><p class="eyebrow">Selected Plan</p><h3>${dateFmt.format(parseDate(selectedForecastDate))}</h3></div>
      <form id="forecastForm" class="forecast-form">
        <input type="hidden" name="date" value="${selectedForecastDate}">
        <div class="field full"><label>Plan Type</label><select name="type">${forecastOptions(selectedPlan.type)}</select></div>
        <div class="field full"><label>Title</label><input name="title" value="${escapeHtml(selectedPlan.title)}" placeholder="Grab full day, Shooting, Rest"></div>
        <div class="field"><label>Gross Income</label><input name="gross" type="number" step="0.01" value="${selectedPlan.gross}"></div>
        <div class="field"><label>Cost</label><input name="cost" type="number" step="0.01" value="${selectedPlan.cost}"></div>
        <div class="field"><label>Net</label><input name="net" type="number" step="0.01" value="${selectedPlan.net}"></div>
        <div class="field"><label>Hours</label><input name="hours" type="number" step="0.1" value="${selectedPlan.hours}"></div>
        <div class="field full"><label>Note</label><textarea name="note" placeholder="Streak, shooting, webinar, rest reason">${escapeHtml(selectedPlan.note)}</textarea></div>
        <div class="forecast-quick-row full">
          <button class="secondary-action compact-action" data-forecast-quick="weekdays" type="button">Weekdays Full</button>
          <button class="secondary-action compact-action" data-forecast-quick="weekend" type="button">Weekend Plan</button>
          <button class="secondary-action compact-action" data-forecast-quick="rest" type="button">Mark Rest</button>
        </div>
        <div class="action-row full">
          <button class="primary-action" type="submit">Save Forecast</button>
          <button class="secondary-action" id="clearForecastDay" type="button">Reset to Default</button>
        </div>
      </form>
    </section>
  </div>`;
  bindForecastPlanner(target);
}

function bindForecastPlanner(root = document) {
  root.querySelectorAll("[data-forecast-date]").forEach(button => {
    button.addEventListener("click", () => {
      selectedForecastDate = button.dataset.forecastDate;
      renderPreservingViewport();
    });
  });
  const form = root.querySelector("#forecastForm");
  if (form) {
    form.elements.type.addEventListener("change", () => {
      const preset = forecastPresets[form.elements.type.value] || forecastPresets.custom;
      if (!form.elements.title.value || Object.values(forecastPresets).some(item => item.title === form.elements.title.value)) {
        form.elements.title.value = preset.title;
      }
      form.elements.gross.value = preset.gross;
      form.elements.cost.value = preset.cost;
      form.elements.net.value = preset.net;
      form.elements.hours.value = preset.hours;
    });
    form.elements.gross.addEventListener("input", () => {
      form.elements.net.value = (num(form.elements.gross.value) - num(form.elements.cost.value)).toFixed(2);
    });
    form.elements.cost.addEventListener("input", () => {
      form.elements.net.value = (num(form.elements.gross.value) - num(form.elements.cost.value)).toFixed(2);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      saveForecastPlan(data.date, data);
      renderPreservingViewport();
      persistState();
    });
  }
  root.querySelector("#clearForecastDay")?.addEventListener("click", () => {
    removeForecastPlan(selectedForecastDate);
    renderPreservingViewport();
    persistState();
  });
  root.querySelectorAll("[data-forecast-quick]").forEach(button => {
    button.addEventListener("click", () => {
      applyForecastQuickPlan(button.dataset.forecastQuick);
      renderPreservingViewport();
      persistState();
    });
  });
  root.querySelector("#generateForecastImage")?.addEventListener("click", () => {
    generateForecastImage(selectedMonthKey());
  });
}

function applyForecastQuickPlan(kind) {
  const monthKey = selectedMonthKey();
  monthWeekStarts(visibleDate).forEach(weekStartDate => {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const day = new Date(weekStartDate);
      day.setDate(weekStartDate.getDate() + weekday);
      const iso = toISODate(day);
      if (!iso.startsWith(monthKey)) continue;
      if (kind === "weekdays" && weekday < 4) saveForecastPlan(iso, { type: "full_work" });
      if (kind === "weekend" && weekday === 5) saveForecastPlan(iso, { type: "half_day", title: "Saturday streak" });
      if (kind === "weekend" && weekday === 6) saveForecastPlan(iso, { type: "full_work", title: "Sunday streak" });
    }
  });
  if (kind === "rest") saveForecastPlan(selectedForecastDate, { type: "rest" });
}

function generateForecastImage(monthKey = selectedMonthKey()) {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  const summary = forecastSummary(monthKey);
  const monthDate = parseDate(`${monthKey}-01`);
  const title = monthFmt.format(monthDate);
  ctx.fillStyle = "#eef3ed";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#e2f0e7");
  roundRect(ctx, 46, 42, 1828, 996, 42, gradient, "rgba(18, 100, 63, 0.10)");
  ctx.fillStyle = "#102018";
  ctx.font = "800 54px Segoe UI, Arial, sans-serif";
  ctx.fillText(`${title} Forecast Plan`, 92, 128);
  drawForecastPhotoStat(ctx, "Grab Forecast", summary.grabNet, 92, 168, "#15784e");
  drawForecastPhotoStat(ctx, "Other Jobs", summary.otherNet, 430, 168, "#7c5ac8");
  drawForecastPhotoStat(ctx, "Total Forecast", summary.totalNet, 768, 168, "#b47d12");
  ctx.font = "700 22px Segoe UI, Arial, sans-serif";
  ctx.fillStyle = "#5c6f64";
  ctx.fillText(`${summary.activeDays} active days - ${summary.hours.toFixed(1)} planned hours - standalone forecast only`, 1104, 214);

  const left = 92;
  const top = 280;
  const weekWidth = 190;
  const dayWidth = 222;
  const rowHeight = 142;
  const headers = ["Week", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  ctx.font = "800 18px Segoe UI, Arial, sans-serif";
  headers.forEach((label, index) => {
    ctx.fillStyle = "#60736a";
    ctx.fillText(label, left + (index === 0 ? 22 : weekWidth + ((index - 1) * dayWidth) + 18), top - 22);
  });
  monthWeekStarts(monthDate).forEach((weekStartDate, row) => {
    const y = top + (row * rowHeight);
    const weekNet = forecastWeekNet(weekStartDate);
    roundRect(ctx, left, y, weekWidth - 12, rowHeight - 14, 22, "#e3f3eb", "rgba(18,100,63,.10)");
    ctx.fillStyle = "#176c4e";
    ctx.font = "800 18px Segoe UI, Arial, sans-serif";
    ctx.fillText("Week Net", left + 20, y + 36);
    ctx.font = "900 32px Segoe UI, Arial, sans-serif";
    ctx.fillText(moneyCompact.format(weekNet), left + 20, y + 78);
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const day = new Date(weekStartDate);
      day.setDate(weekStartDate.getDate() + weekday);
      const iso = toISODate(day);
      const plan = forecastPlanForDate(iso);
      const outside = day.getMonth() !== monthDate.getMonth();
      const x = left + weekWidth + (weekday * dayWidth);
      roundRect(ctx, x, y, dayWidth - 12, rowHeight - 14, 20, outside ? "#f4f6f2" : "#fffef9", "rgba(20,32,26,.08)");
      ctx.fillStyle = outside ? "#97a39b" : "#14201a";
      ctx.font = "900 26px Segoe UI, Arial, sans-serif";
      ctx.fillText(String(day.getDate()), x + 18, y + 34);
      if (plan) {
        ctx.fillStyle = plan.color || "#148d5b";
        ctx.fillRect(x + 18, y + 48, 6, 56);
        ctx.fillStyle = "#263c33";
        ctx.font = "800 21px Segoe UI, Arial, sans-serif";
        ctx.fillText(truncateCanvasText(ctx, plan.title, dayWidth - 54), x + 34, y + 62);
        ctx.fillStyle = "#5d6f65";
        ctx.font = "700 18px Segoe UI, Arial, sans-serif";
        ctx.fillText(`${moneyCompact.format(plan.net)} - ${num(plan.hours).toFixed(1)}h`, x + 34, y + 92);
        if (plan.note) ctx.fillText(truncateCanvasText(ctx, plan.note, dayWidth - 54), x + 34, y + 118);
      }
    }
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${monthKey}-forecast-plan.png`;
  link.click();
}

function drawForecastPhotoStat(ctx, label, value, x, y, color) {
  roundRect(ctx, x, y, 300, 84, 22, "#fffef9", "rgba(20,32,26,.08)");
  ctx.fillStyle = "#60736a";
  ctx.font = "700 18px Segoe UI, Arial, sans-serif";
  ctx.fillText(label, x + 22, y + 30);
  ctx.fillStyle = color;
  ctx.font = "900 32px Segoe UI, Arial, sans-serif";
  ctx.fillText(money.format(value), x + 22, y + 66);
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function truncateCanvasText(ctx, text, maxWidth) {
  const source = String(text || "");
  if (ctx.measureText(source).width <= maxWidth) return source;
  let output = source;
  while (output.length > 1 && ctx.measureText(`${output}...`).width > maxWidth) output = output.slice(0, -1);
  return `${output}...`;
}

function renderGrabStats() {
  const target = $("#grabStats");
  if (!target) return;
  const week = totalsForRecords(weekRecords());
  const month = totalsForRecords(monthRecords());
  const allTime = allTimeFinancialSummary();
  const bank = bankTransferTotals();
  const monthRecordsList = monthRecords();
  const monthActiveDays = new Set(monthRecordsList.filter(item => driverMetrics(item).net !== 0 || num(item.totalTrips) > 0).map(item => item.date)).size || 1;
  const monthIncomePerHour = month.hours ? month.income / month.hours : 0;
  const monthCostRatio = month.income ? (month.cost / month.income) * 100 : 0;
  const monthAverageDailyNet = month.net / monthActiveDays;
  const commitmentTotal = monthlyCommitmentTotal();
  const incomeBreakdown = weeklyBreakdown("income");
  const costBreakdown = weeklyBreakdown("cost");
  target.innerHTML = `<div class="section-heading">
    <p class="eyebrow">Reports</p>
    <h2>Income Summary</h2>
  </div>
  <section class="report-answer-card">
    <div>
      <span>${selectedMonthLabel()} Net Profit</span>
      <strong>${money.format(month.net)}</strong>
      <small>${money.format(month.income)} income - ${money.format(month.cost)} cost = ${money.format(month.net)} net</small>
    </div>
    <div class="report-answer-grid">
      <span><small>This Week</small><b>${money.format(week.net)}</b></span>
      <span><small>Bank Transfer</small><b>${money.format(bank.month)}</b></span>
      <span><small>All-Time Net</small><b>${money.format(allTime.net)}</b></span>
    </div>
  </section>
  <div class="stats-grid">
    ${statCard("Week Net", money.format(week.net), `${week.hours.toFixed(1)}h - ${week.trips} trips`)}
    ${statCard("Income/hour", money.format(week.hours ? week.income / week.hours : 0), "Based on total income")}
    ${statCard("Bank Transfer", money.format(bank.week), "This week")}
  </div>
  <div class="breakdown-grid">
    ${breakdownBars("Income Breakdown", incomeBreakdown)}
    ${breakdownBars("Cost Breakdown", costBreakdown)}
  </div>
  <div class="section-heading monthly-stat-heading">
    <p class="eyebrow">Monthly Overview</p>
    <h2>This Month</h2>
  </div>
  <div class="stats-grid monthly-stats-grid">
    ${statCard("Month Net", money.format(month.net), `${monthActiveDays} active days - ${month.trips} trips`)}
    ${statCard("Month Income", money.format(month.income), `${money.format(monthIncomePerHour)}/h`)}
    ${statCard("Online Hours", `${month.hours.toFixed(1)}h`, "This month")}
    ${statCard("Total Cost", money.format(month.cost), `${monthCostRatio.toFixed(1)}% cost ratio`)}
    ${statCard("Average Daily Net", money.format(monthAverageDailyNet), "This month")}
    ${statCard("Bank Transfer", money.format(bank.month), "This month")}
  </div>
  ${monthlyCommitmentsMarkup(commitmentTotal)}`;
  bindMonthlyCommitments(target);
}

function statCard(label, value, detail) {
  return `<article class="stat-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function monthlyCommitmentsMarkup(total = monthlyCommitmentTotal()) {
  const commitments = monthlyCommitments();
  return `<section class="commitment-panel">
    <div class="section-heading compact-heading">
      <p class="eyebrow">Standalone Tool</p>
      <h2>Monthly Commitments</h2>
    </div>
    <article class="commitment-summary-card">
      <span>Total Monthly Commitment</span>
      <strong>${money.format(total)}</strong>
      <small>Personal planning only - not included in Grab profit or costing.</small>
    </article>
    <div class="commitment-list">
      ${commitments.length ? commitments.map(item => `<article class="commitment-item">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          ${item.remark ? `<small>${escapeHtml(item.remark)}</small>` : ""}
        </div>
        <span>${money.format(num(item.amount))}</span>
        <button class="secondary-action compact-action" data-delete-commitment="${item.id}" type="button">Delete</button>
      </article>`).join("") : `<div class="empty-note">No monthly commitment recorded yet.</div>`}
    </div>
    <form class="commitment-form" id="monthlyCommitmentForm">
      <div class="field"><label>Name</label><input name="name" type="text" placeholder="Car loan, rental, phone bill"></div>
      <div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" placeholder="0.00"></div>
      <div class="field full"><label>Remark</label><input name="remark" type="text" placeholder="Optional note"></div>
      <div class="action-row full"><button class="primary-action" type="submit">Add Commitment</button></div>
    </form>
  </section>`;
}

function bindMonthlyCommitments(root = document) {
  root.querySelector("#monthlyCommitmentForm")?.addEventListener("submit", event => {
    event.preventDefault();
    addMonthlyCommitment(Object.fromEntries(new FormData(event.currentTarget).entries()));
    renderPreservingViewport();
    persistState();
  });
  root.querySelectorAll("[data-delete-commitment]").forEach(button => {
    button.addEventListener("click", () => {
      removeMonthlyCommitment(button.dataset.deleteCommitment);
      renderPreservingViewport();
      persistState();
    });
  });
}

function weeklyBreakdown(type) {
  return weekRecords().reduce((acc, item) => {
    const metrics = item.driverIncomeModel === "grab_v13" ? grabDailyMetrics(item) : null;
    if (metrics && type === "income") {
      acc["Cash"] += metrics.cash;
      acc["TNG QR"] += metrics.tngIncome;
      acc["Grab Wallet"] += metrics.grabWalletIncome;
    }
    if (metrics && type === "cost") {
      acc["Petrol"] += metrics.petrol;
      acc["Toll"] += metrics.toll;
    }
    if (!metrics && type === "income") acc["Imported Summary"] += driverMetrics(item).income;
    if (!metrics && type === "cost") acc["Imported Summary"] += driverMetrics(item).cost;
    return acc;
  }, type === "income"
    ? { "Cash": 0, "TNG QR": 0, "Grab Wallet": 0, "Imported Summary": 0 }
    : { "Petrol": 0, "Toll": 0, "Imported Summary": 0 });
}

function breakdownBars(title, data) {
  const max = Math.max(...Object.values(data), 1);
  return `<article class="breakdown-card"><h3>${title}</h3>
    ${Object.entries(data).filter(([, value]) => value > 0).map(([label, value]) => `
      <div class="bar-row">
        <span>${label}</span>
        <div><i style="width:${Math.max(4, (value / max) * 100)}%"></i></div>
        <strong>${money.format(value)}</strong>
      </div>`).join("") || `<div class="empty-note">No confirmed data this week.</div>`}
  </article>`;
}

function driverConsoleForDate(date) {
  const dayEntries = state.incomeEntries.filter(entry => entry.businessId === "business_driver" && entry.date === date);
  const entries = dayEntries.length ? dayEntries : latestDriverIncomeEntries();
  const sourceDate = entries[0]?.date || date;
  const events = state.events.filter(event => event.businessId === "business_driver" && event.date === sourceDate);
  const totals = entries.reduce((acc, entry) => {
    acc.gross += num(entry.grossIncome);
    acc.cost += num(entry.cost);
    acc.net += num(entry.netIncome);
    acc.cash += num(entry.metadata?.grabCashCollected) + num(entry.metadata?.boltCashCollected);
    acc.trips += num(entry.metadata?.totalTrips);
    acc.petrol += num(entry.metadata?.petrolCost);
    acc.smartTagCost += num(entry.metadata?.smartTagReduction);
    return acc;
  }, { gross: 0, cost: 0, net: 0, cash: 0, trips: 0, petrol: 0, smartTagCost: 0 });
  const hours = events.reduce((sum, event) => sum + num(event.metadata?.drivingHours), 0);
  const latest = entries.find(entry => num(entry.metadata?.grabCashWalletClosing) || num(entry.metadata?.smartTagClosing)) || entries[0];

  return {
    hasData: entries.length > 0,
    sourceDate,
    gross: totals.gross,
    cost: totals.cost,
    net: totals.net,
    cash: totals.cash,
    trips: totals.trips,
    petrol: totals.petrol,
    smartTagCost: totals.smartTagCost,
    hours,
    grabWallet: num(latest?.metadata?.grabCashWalletClosing),
    smartTag: num(latest?.metadata?.smartTagClosing),
    platform: latest?.metadata?.platform || "Driver"
  };
}

function latestDriverIncomeEntries() {
  const driverEntries = state.incomeEntries
    .filter(entry => entry.businessId === "business_driver")
    .sort((a, b) => `${b.date} ${b.id}`.localeCompare(`${a.date} ${a.id}`));
  if (!driverEntries.length) return [];
  const latestDate = driverEntries[0].date;
  return driverEntries.filter(entry => entry.date === latestDate);
}

function driverConsoleMarkup(date) {
  const consoleData = driverConsoleForDate(date);
  if (!consoleData.hasData) {
    return `<section class="driver-console">
      <div class="console-head">
        <div><p class="eyebrow">Driver Console</p><h3>No driver record yet</h3></div>
        <span>${date}</span>
      </div>
      <div class="empty-note">Start a driver session to power this console with live records.</div>
    </section>`;
  }

  return `<section class="driver-console">
    <div class="console-head">
      <div>
        <p class="eyebrow">Driver Console</p>
        <h3>${consoleData.sourceDate === date ? "Selected day" : "Latest record"} - ${escapeHtml(consoleData.platform)}</h3>
      </div>
      <span>${consoleData.sourceDate}</span>
    </div>
    <div class="console-grid">
      ${consoleMetric("Net", money.format(consoleData.net))}
      ${consoleMetric("Income", money.format(consoleData.gross))}
      ${consoleMetric("Cost", money.format(consoleData.cost))}
      ${consoleMetric("Hours", `${consoleData.hours.toFixed(1)}h`)}
      ${consoleMetric("Trips", consoleData.trips)}
      ${consoleMetric("Cash", money.format(consoleData.cash))}
      ${consoleMetric("Grab Wallet", money.format(consoleData.grabWallet))}
      ${consoleMetric("SmartTAG", money.format(consoleData.smartTag))}
      ${consoleMetric("Petrol", money.format(consoleData.petrol))}
    </div>
  </section>`;
}

function consoleMetric(label, value) {
  return `<div class="console-metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function animateCounters() {
  document.querySelectorAll(".count-up").forEach(node => {
    const target = Number(node.dataset.value) || 0;
    const format = node.dataset.format || "number";
    const start = performance.now();
    const duration = 900;
    const renderValue = value => {
      if (format === "money") return money.format(value);
      if (format === "hours") return `${value.toFixed(1)}h`;
      return Math.round(value).toLocaleString("en-MY");
    };
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = renderValue(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function updateLiveCountdowns() {
  document.querySelectorAll("[data-countdown-date]").forEach(node => {
    node.textContent = countdownTo(node.dataset.countdownDate, node.dataset.countdownTime);
  });
}

function driverSidebar() {
  const editing = selectedGrabRecord() || {};
  const summaryRecord = summaryGrabRecord(selectedDate);
  const metricRecord = editing.id ? editing : summaryRecord;
  const metrics = metricRecord ? (metricRecord.driverIncomeModel === "grab_v13" ? grabDailyMetrics(metricRecord) : driverMetrics(metricRecord)) : grabDailyMetrics({});
  const balances = cashBalances();
  const pending = state.pendingCashActions.filter(item => item.date === selectedDate);
  const bankTotals = bankTransferTotals();
  const settings = state.grabSettings || defaultGrabSettings();
  const defaultTngOpening = latestGrabEndingBefore(selectedDate, "tngClosing");
  const defaultSmartTagOpening = latestGrabEndingBefore(selectedDate, "smartTagClosing");
  return `${editing.id ? `<div class="existing-record-banner"><span>Existing Record</span><strong>${editing.status || "Saved"}</strong></div>` : ""}
  <section class="grab-day-summary">
    <div><span>Status</span><strong>${dayStatus(selectedDate)}</strong></div>
    <div><span>Net Profit</span><strong>${moneySafe(metrics.net)}</strong></div>
    <div><span>Income/hour</span><strong>${moneySafe(metrics.incomePerHour)}</strong></div>
    <div><span>Trips</span><strong>${metrics.trips || 0}</strong></div>
  </section>

  <form id="driverForm" class="form-grid grab-form">
    ${field("Date", "date", "date", editing.date || selectedDate)}
    <input type="hidden" name="platform" value="Grab">
    <input type="hidden" name="driverIncomeModel" value="grab_v13">
    <div class="form-section full">Driving Sessions</div>
    ${field("Total Trips", "totalTrips", "number", editing.totalTrips || "")}
    ${sessionFields(editing)}
    <div class="form-section full">Grab Cash Wallet Balance</div>
    ${field("Starting", "grabCashWalletOpening", "number", hasValue(editing.grabCashWalletOpening) ? editing.grabCashWalletOpening : editing.id ? "" : settings.grabWalletBase)}
    ${field("Ending Before Withdrawal", "grabCashWalletEnding", "number", editing.grabCashWalletEnding || "")}
    ${field("Wallet Base", "grabWalletBase", "number", editing.grabWalletBase || settings.grabWalletBase)}
    <div class="field"><label>Auto Transfer To Bank</label><input disabled value="${moneySafe(metrics.transferToBank)}"></div>
    <div class="form-section full">Cash Collected</div>
    ${field("Cash Collected Today", "cashCollected", "number", editing.cashCollected || editing.cashReceived || "")}
    <div class="form-section full">Touch & Go eWallet</div>
    ${field("Starting", "tngOpening", "number", hasValue(editing.tngOpening) ? editing.tngOpening : defaultTngOpening)}
    ${field("Ending", "tngClosing", "number", editing.tngClosing || "")}
    <div class="form-section full">SmartTAG / TNG Card</div>
    ${field("Starting", "smartTagOpening", "number", hasValue(editing.smartTagOpening) ? editing.smartTagOpening : defaultSmartTagOpening)}
    ${field("Ending", "smartTagClosing", "number", editing.smartTagClosing || "")}
    <div class="form-section full">Petrol</div>
    ${petrolFields(editing)}
    <div class="field full"><label>Remark</label><textarea name="remark">${escapeHtml(editing.remark || "")}</textarea></div>
    <div class="action-row full">
      <button class="secondary-action" name="saveTemp" type="submit">Temporarily Save</button>
      <button class="primary-action" name="finishToday" type="submit">Finish Today</button>
      ${editing.status === "Finished" ? `<button class="secondary-action" data-view-summary="${editing.id}" type="button">View Daily Summary</button>` : ""}
    </div>
  </form>

  <section class="cash-panel">
    <h3>Cash Position</h3>
    <div class="cash-equation">
      <span>Petty Cash <strong>${money.format(balances.pettyCash)}</strong></span>
      <span>Cash At Home <strong>${money.format(balances.cashAtHome)}</strong></span>
      <span>Total Cash <strong>${money.format(balances.pettyCash + balances.cashAtHome)}</strong></span>
    </div>
    ${pending.length ? `<div class="pending-list">${pending.map(pendingItem).join("")}</div>` : `<div class="empty-note">No pending cash confirmations for this date.</div>`}
    ${cashToolsMarkup()}
  </section>

  ${bankTransferPanel(bankTotals)}
  ${cashHistoryPanel()}

  ${petrolLiabilityMarkup()}`;
}

function sessionFields(editing) {
  const sessions = Array.isArray(editing.drivingSessions) && editing.drivingSessions.length
    ? editing.drivingSessions
    : [{ startTime: editing.startTime || "05:00", endTime: editing.endTime || "" }, { startTime: "", endTime: "" }];
  return [0, 1, 2].map(index => {
    const item = sessions[index] || {};
    return `${field(`Session ${index + 1} Start`, `sessionStart${index + 1}`, "time", item.startTime || "")}
      ${field(`Session ${index + 1} End`, `sessionEnd${index + 1}`, "time", item.endTime || "")}`;
  }).join("");
}

function petrolFields(editing) {
  const settings = state.grabSettings || defaultGrabSettings();
  const defaults = {
    station: settings.defaultPetrolStation || "Petron",
    paymentMethod: settings.defaultPetrolPaymentMethod || "Credit Card"
  };
  const sourceEntries = Array.isArray(editing.petrolEntries) && editing.petrolEntries.length
    ? editing.petrolEntries
    : editing.petrolCost
      ? [{ amount: editing.petrolCost, station: "Petron", paymentMethod: "Legacy / Settled" }, "", ""]
      : ["", "", ""];
  const entries = [0, 1, 2].map(index => normalizePetrolEntry(sourceEntries[index] || {}, defaults));
  const stations = ["Petron", "Petronas", "Shell", "BHPetrol", "Caltex", "Other"];
  const methods = ["Credit Card", "Cash", "Points / Rewards", "Other", "Legacy / Settled"];
  return entries.map((entry, index) => `<div class="petrol-entry full">
    <strong>Petrol ${index + 1}</strong>
    ${field("Amount", `petrolAmount${index + 1}`, "number", entry.amount || "")}
    ${field("Station", `petrolStation${index + 1}`, "select", entry.station, stations)}
    ${field("Payment", `petrolPayment${index + 1}`, "select", entry.paymentMethod, methods)}
  </div>`).join("");
}

function explicitPetrolEntries(records = state.driverSessions) {
  return records.flatMap(record => (Array.isArray(record.petrolEntries) ? record.petrolEntries : [])
    .filter(entry => entry && typeof entry === "object")
    .map(entry => ({ ...normalizePetrolEntry(entry), date: record.date, sourceId: record.id })));
}

function petrolMonthWeekBuckets(monthKey = selectedMonthKey()) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return [];
  const monthEnd = new Date(year, month, 0).getDate();
  const ranges = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, monthEnd]
  ];
  const entries = explicitPetrolEntries()
    .filter(entry => String(entry.date || "").startsWith(monthKey))
    .filter(entry => entry.paymentMethod === "Credit Card");
  return ranges.map(([startDay, endDay], index) => {
    const start = `${monthKey}-${String(startDay).padStart(2, "0")}`;
    const end = `${monthKey}-${String(endDay).padStart(2, "0")}`;
    const weekKey = `${monthKey}-w${index + 1}`;
    const amount = entries
      .filter(entry => entry.date >= start && entry.date <= end)
      .reduce((sum, entry) => sum + num(entry.amount), 0);
    const payment = (state.petrolCardPayments || []).find(item => item.source === "petrol_week" && item.weekKey === weekKey);
    return { label: `Week ${index + 1}`, weekKey, start, end, amount, payment };
  });
}

function petrolWeekSummaryMarkup(monthKey = selectedMonthKey()) {
  const weeks = petrolMonthWeekBuckets(monthKey);
  const total = weeks.reduce((sum, week) => sum + week.amount, 0);
  return `<section class="petrol-month-card">
    <div class="petrol-month-head">
      <span><small>Monthly Petrol</small><strong>${monthFmt.format(parseDate(`${monthKey}-01`))}</strong></span>
      <b>${money.format(total)}</b>
    </div>
    <div class="petrol-week-grid">
      ${weeks.map(week => {
        const paid = Boolean(week.payment);
        const disabled = week.amount <= 0;
        return `<button class="petrol-week-tile ${paid ? "is-paid" : ""}" type="button" data-pay-petrol-week="${week.weekKey}" ${disabled ? "disabled" : ""}>
          <span>${week.label}</span>
          <strong>${money.format(week.amount)}</strong>
          <small>${paid ? "Paid" : disabled ? "No petrol" : "Tap to paid"}</small>
        </button>`;
      }).join("")}
    </div>
  </section>`;
}

function petrolLiabilityMarkup() {
  const entries = explicitPetrolEntries();
  const payments = state.petrolCardPayments || [];
  const [weekStart, weekEnd] = weekRange(selectedDate);
  const month = selectedDate.slice(0, 7);
  const monthLabel = monthFmt.format(parseDate(`${month}-01`));
  const monthEntries = entries.filter(entry => String(entry.date || "").startsWith(month));
  const monthPayments = payments.filter(item => String(item.date || "").startsWith(month));
  const monthTotals = petrolTotals(monthEntries, monthPayments);
  const petrolCostForRecord = record => record.driverIncomeModel === "grab_v13"
    ? grabDailyMetrics(record).petrol
    : num(record.petrolCost || record.metadata?.petrolCost);
  const weekCost = state.driverSessions
    .filter(record => record.date >= weekStart && record.date <= weekEnd)
    .reduce((sum, record) => sum + petrolCostForRecord(record), 0);
  const monthCost = state.driverSessions
    .filter(record => record.date.startsWith(month))
    .reduce((sum, record) => sum + petrolCostForRecord(record), 0);
  const history = [...payments]
    .filter(item => String(item.date || "").startsWith(month))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 12);
  return `<section class="history-card petrol-liability">
    <details>
      <summary>
        <span><small>Petrol Credit Card</small><strong>${monthLabel}</strong></span>
        <b>${money.format(monthTotals.cardOutstanding)}</b>
      </summary>
      <div class="history-card-body">
        ${petrolWeekSummaryMarkup(month)}
        <div class="petrol-ledger-grid">
          <div><span>Week Cost</span><strong>${money.format(weekCost)}</strong></div>
          <div><span>Month Cost</span><strong>${money.format(monthCost)}</strong></div>
          <div><span>Card Charged</span><strong>${money.format(monthTotals.cardCharged)}</strong></div>
          <div><span>Outstanding</span><strong>${money.format(monthTotals.cardOutstanding)}</strong></div>
        </div>
        <form id="petrolPaymentForm" class="form-grid compact-form">
          ${field("Payment Date", "date", "date", selectedDate)}
          ${field("Pay Amount", "amount", "number", "")}
          <div class="field full"><label>Note</label><input name="note" placeholder="Credit card payment"></div>
          <button class="primary-action full" type="submit">Pay Petrol Card</button>
        </form>
        <div class="compact-history">
          ${history.length ? history.map(item => `<div class="history-item"><div class="history-line"><span>${item.date} - Payment</span><strong>${money.format(num(item.amount))}</strong></div><div class="muted">${escapeHtml(item.note || "")}</div></div>`).join("") : `<div class="empty-note">No petrol card payment yet.</div>`}
        </div>
      </div>
    </details>
  </section>`;

}

function pendingItem(item) {
  if (item.type === "cash_collected_to_petty") {
    const balances = cashBalances();
    const availablePettyCash = balances.pettyCash + num(item.amount);
    return `<article class="pending-item split-pending-item">
      <div><strong>Set today's cash position</strong><span>${money.format(availablePettyCash)}</span></div>
      <small>Petty Cash ${money.format(balances.pettyCash)} + Cash Collected ${money.format(num(item.amount))}</small>
      <div class="pending-baseline">
        <strong>Cash before today</strong>
        <small>Update this first if the current cash total is old.</small>
        <div class="pending-split">
          <label>Current Petty Cash <input data-pending-current-petty="${item.id}" type="number" step="0.01" value="${balances.pettyCash.toFixed(2)}"></label>
          <label>Current Cash At Home <input data-pending-current-home="${item.id}" type="number" step="0.01" value="${balances.cashAtHome.toFixed(2)}"></label>
        </div>
      </div>
      <div class="pending-split">
        <label>Final Petty Cash <input data-pending-petty="${item.id}" type="number" step="0.01" value="${availablePettyCash.toFixed(2)}"></label>
        <label>Put At Home <input data-pending-home="${item.id}" type="number" step="0.01" placeholder="0.00"></label>
      </div>
      <button class="primary-action" type="button" data-confirm-pending="${item.id}">Confirm</button>
    </article>`;
  }
  return `<article class="pending-item">
    <div><strong>${escapeHtml(item.label)}</strong><span>${money.format(item.amount)}</span></div>
    <button class="primary-action" type="button" data-confirm-pending="${item.id}">Confirm</button>
  </article>`;
}

function summaryPendingMarkup(record) {
  const pending = state.pendingCashActions.filter(item => item.sourceId === record.id);
  return pending.length ? `<section class="summary-confirmations">
    <h3>Cash Confirmation</h3>
    <div class="pending-list">${pending.map(pendingItem).join("")}</div>
  </section>` : "";
}

function cashToolsMarkup() {
  const settings = state.grabSettings || defaultGrabSettings();
  const balances = cashBalances();
  const categories = settings.cashCategories.map(item => `<option value="${escapeHtml(item)}"${item === "pocket money" ? " selected" : ""}>${escapeHtml(item)}</option>`).join("");
  const cashActions = ["Move Petty Cash to Home", "Bank In From Cash At Home", "Bank In From Petty Cash", "Use Cash At Home", "Use Petty Cash"];
  return `<details class="record-details cash-tools">
    <summary>Cash Tools</summary>
    <form id="cashPositionForm" class="form-grid">
      <div class="form-section full">Set Current Cash Position</div>
      ${field("Current Petty Cash", "pettyCashCurrent", "number", balances.pettyCash)}
      ${field("Current Cash At Home", "cashAtHomeCurrent", "number", balances.cashAtHome)}
      <div class="action-row full"><button class="primary-action" type="submit">Update Cash Position</button></div>
    </form>
    <form id="cashSettingsForm" class="form-grid">
      <div class="form-section full">Starting Balance Settings</div>
      ${field("Starting Petty Cash", "pettyCashOpening", "number", settings.pettyCashOpening)}
      ${field("Starting Cash At Home", "cashAtHomeOpening", "number", settings.cashAtHomeOpening)}
      ${field("Car Rental Target", "carRentalTarget", "number", settings.carRentalTarget)}
      ${field("Housing Loan Target", "housingLoanTarget", "number", settings.housingLoanTarget)}
      ${field("Grab Wallet Base", "grabWalletBase", "number", settings.grabWalletBase)}
      <div class="action-row full"><button class="secondary-action" type="submit">Save Settings</button></div>
    </form>
    <form id="cashMoveForm" class="form-grid">
      <div class="form-section full">Move / Withdraw Cash</div>
      ${field("Amount", "amount", "number", "")}
      ${field("Action", "action", "select", "Use Cash At Home", cashActions)}
      <div class="field"><label>Category</label><select name="categoryPreset">${categories}</select></div>
      <div class="field"><label>New Category</label><input name="category" type="text" placeholder="Type new category"></div>
      <div class="field"><label>Remark</label><input name="remark" type="text"></div>
      <div class="action-row full"><button class="primary-action" type="submit">Record Cash Action</button></div>
    </form>
  </details>`;
}

function selectedMonthKey() {
  return selectedDate.slice(0, 7);
}

function selectedMonthLabel() {
  return monthFmt.format(parseDate(`${selectedMonthKey()}-01`));
}

function bankTransferPanel(bankTotals) {
  const month = selectedMonthKey();
  const monthItems = state.bankTransfers.filter(item => String(item.date || "").startsWith(month));
  const monthTotal = monthItems.reduce((sum, item) => sum + num(item.amount), 0);
  return `<section class="history-card">
    <details>
      <summary>
        <span><small>Bank Transfer</small><strong>${selectedMonthLabel()}</strong></span>
        <b>${money.format(monthTotal)}</b>
      </summary>
      <div class="history-card-body">
        <div class="driver-summary two">
          <span>This week ${money.format(bankTotals.week)}</span>
          <span>This month ${money.format(bankTotals.month)}</span>
        </div>
        ${bankTransferHistory(month)}
      </div>
    </details>
  </section>`;
}

function cashHistoryPanel() {
  const month = selectedMonthKey();
  const usage = cashUsageTotals(month);
  const balances = cashBalances();
  const currentTotal = balances.pettyCash + balances.cashAtHome;
  return `<section class="history-card">
    <details>
      <summary>
        <span><small>Cash Usage</small><strong>${selectedMonthLabel()}</strong></span>
        <b>${money.format(usage.pocketMoney)}</b>
      </summary>
      <div class="history-card-body">
        <div class="driver-summary two">
          <span>Pocket money ${money.format(usage.pocketMoney)}</span>
          <span>Current cash ${money.format(currentTotal)}</span>
        </div>
        ${cashUsageBreakdown(usage)}
        ${cashHistory(month)}
      </div>
    </details>
  </section>`;
}

function cashUsageBreakdown(usage) {
  const entries = Object.entries(usage.byCategory).sort((a, b) => b[1] - a[1]);
  return entries.length ? `<div class="driver-summary two cash-usage-breakdown">
    ${entries.map(([category, amount]) => `<span>${escapeHtml(category)} ${money.format(amount)}</span>`).join("")}
  </div>` : `<div class="empty-note">No cash usage recorded this month.</div>`;
}

function bankTransferHistory(monthKey = selectedMonthKey()) {
  const items = [...state.bankTransfers]
    .filter(item => String(item.date || "").startsWith(monthKey))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  return items.length ? items.map(item => `<div class="history-item">
    <div class="history-line"><span>${item.date} - ${item.source === "grab_wallet" ? "Grab Wallet" : "Cash Bank In"}</span><span>${money.format(item.amount)}</span></div>
  </div>`).join("") : `<div class="empty-note">No bank transfer confirmed yet.</div>`;
}

function cashHistory(monthKey = selectedMonthKey()) {
  const items = [...state.cashLedger]
    .filter(item => String(item.date || "").startsWith(monthKey))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  return items.length ? items.map(item => `<div class="history-item">
    <div class="history-line"><span>${item.date} - ${escapeHtml(item.category || item.type)}</span><span>${money.format(cashLedgerEffect(item))}</span></div>
    <div class="muted">${escapeHtml(item.account || `${item.fromAccount || ""} -> ${item.toAccount || ""}`)}</div>
  </div>`).join("") : `<div class="empty-note">No cash ledger entries yet.</div>`;
}

function driverHistoryItem(item) {
  const metrics = driverMetrics(item);
  const iph = metrics.hours ? metrics.income / metrics.hours : 0;
  return `<div class="history-item">
    <div class="history-line"><span>${item.platform} - ${item.status}</span><span>${money.format(metrics.net)}</span></div>
    <div class="muted">${item.startTime || "--:--"} - ${item.endTime || "--:--"} - ${metrics.hours.toFixed(1)}h - ${item.totalTrips || 0} trips</div>
    <div class="muted">Income ${money.format(metrics.income)} - Cost ${money.format(metrics.cost)} - ${money.format(iph)}/hr</div>
    <div class="muted">${escapeHtml(item.remark || "")}</div>
    <div class="action-row">
      <button class="secondary-action" data-edit-driver="${item.id}" type="button">Edit</button>
      <button class="danger-action" data-delete-driver="${item.id}" type="button">Delete</button>
    </div>
  </div>`;
}

function solarSidebar() {
  const editing = state.solarEvents.find(item => item.id === editingSolarId) || {};
  const events = [...state.solarEvents].sort((a, b) => `${b.appointmentDate} ${b.appointmentTime}`.localeCompare(`${a.appointmentDate} ${a.appointmentTime}`));
  return `<form id="solarForm" class="form-grid">
    ${field("Customer Name", "customerName", "text", editing.customerName || "")}
    ${field("Phone", "phone", "tel", editing.phone || "")}
    <div class="field full"><label>Address</label><textarea name="address">${escapeHtml(editing.address || "")}</textarea></div>
    ${field("Postcode", "postcode", "text", editing.postcode || "")}
    ${field("Area", "area", "text", editing.area || "")}
    ${field("Appointment Date", "appointmentDate", "date", editing.appointmentDate || selectedDate)}
    ${field("Appointment Time", "appointmentTime", "time", editing.appointmentTime || "")}
    ${field("Phase Type", "phaseType", "select", editing.phaseType || "Single Phase", ["Single Phase", "Three Phase"])}
    ${field("Battery Units", "batteryUnits", "number", editing.batteryUnits || "0")}
    ${field("System Size", "systemSize", "text", editing.systemSize || "")}
    ${field("Financing", "financing", "select", editing.financing || "Cash", ["Cash", "Loan", "PPA", "TBD"])}
    ${field("Status", "status", "select", editing.status || "New", ["New", "Appointed", "Closed", "Lost"])}
    <div class="field full"><label>Remark</label><textarea name="remark">${escapeHtml(editing.remark || "")}</textarea></div>
    <div class="action-row full">
      <button class="primary-action" type="submit">${editingSolarId ? "Update Solar Lead" : "Save Solar Lead"}</button>
      <button class="secondary-action" type="button" id="clearSolar">Clear</button>
    </div>
  </form>
  <div class="history">
    <h3>Solar History</h3>
    ${events.length ? events.map(solarHistoryItem).join("") : `<div class="empty-note">No solar appointments saved yet.</div>`}
  </div>`;
}

function solarHistoryItem(item) {
  return `<div class="history-item">
    <div class="history-line"><span>${escapeHtml(item.customerName || "Unnamed")}</span><span class="status-dot ${statusClass(item.status)}">${item.status}</span></div>
    <div class="muted">${item.appointmentDate} ${item.appointmentTime || ""} - ${escapeHtml(item.phone || "")}</div>
    <div class="muted">${escapeHtml(item.remark || "")}</div>
    <div class="action-row">
      <button class="secondary-action" data-edit-solar="${item.id}" type="button">Edit</button>
      <button class="danger-action" data-delete-solar="${item.id}" type="button">Delete</button>
    </div>
  </div>`;
}

function field(label, name, type, value, options) {
  if (type === "select") {
    return `<div class="field"><label>${label}</label><select name="${name}">${options.map(option =>
      `<option ${option === value ? "selected" : ""}>${option}</option>`
    ).join("")}</select></div>`;
  }
  if (type === "time") {
    return `<div class="field time-field"><label>${label}</label><div class="time-input-wrap"><input name="${name}" type="time" value="${escapeHtml(value)}"><span class="time-display" data-time-display="${name}">${formatTimeDisplay(value)}</span></div></div>`;
  }
  if (type === "date") {
    return `<div class="field date-field"><label>${label}</label><div class="date-input-frame"><input name="${name}" type="date" value="${escapeHtml(value)}"></div></div>`;
  }
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${type === "number" ? 'step="0.01"' : ""}></div>`;
}

function formatTimeDisplay(value) {
  const clean = String(value || "").trim();
  return clean ? clean : "--:--";
}

function bindTimeDisplays(scope = document) {
  scope.querySelectorAll(".time-input-wrap input[type='time']").forEach(input => {
    const display = input.parentElement?.querySelector(".time-display");
    if (!display) return;
    const sync = () => {
      display.textContent = formatTimeDisplay(input.value);
      input.classList.toggle("has-time-value", Boolean(input.value));
    };
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    input.addEventListener("blur", sync);
    sync();
  });
}

function formatChangeValue(value, format) {
  if (value === "") return "Empty";
  if (format === "money") return money.format(num(value));
  if (format === "hours") return `${num(value).toFixed(1)}h`;
  return String(value);
}

function confirmRecordUpdate(changes, date) {
  const dialog = $("#recordConfirmDialog");
  $("#recordConfirmTitle").textContent = `Update ${dateFmt.format(parseDate(date))}?`;
  $("#recordChangeList").innerHTML = changes.length
    ? changes.map(change => `<div class="change-row"><span>${escapeHtml(change.label)}</span><strong>${escapeHtml(formatChangeValue(change.before, change.format))} -> ${escapeHtml(formatChangeValue(change.after, change.format))}</strong></div>`).join("")
    : `<div class="empty-note">The save status will be updated.</div>`;
  dialog.showModal();
  return new Promise(resolve => {
    const finish = decision => {
      dialog.close();
      $("#recordConfirmUpdate").onclick = null;
      $("#recordConfirmCancel").onclick = null;
      $("#recordConfirmClose").onclick = null;
      resolve(decision);
    };
    $("#recordConfirmUpdate").onclick = () => finish(true);
    $("#recordConfirmCancel").onclick = () => finish(false);
    $("#recordConfirmClose").onclick = () => finish(false);
  });
}

function summaryForRecord(record, cashBeforeValue = null) {
  const metrics = record.driverIncomeModel === "grab_v13" ? grabDailyMetrics(record) : driverMetrics(record);
  const balances = cashBalances();
  const totalCash = balances.pettyCash + balances.cashAtHome;
  return buildDailySummary({
    record,
    metrics: {
      ...metrics,
      cashIncome: hasValue(metrics.cash) ? metrics.cash : num(record.cashCollected || record.cashReceived),
      tngIncome: hasValue(metrics.tngIncome) ? metrics.tngIncome : Math.max(0, num(record.tngCollected)),
      grabWalletIncome: hasValue(metrics.grabWalletIncome) ? metrics.grabWalletIncome : Math.max(0, num(record.walletIncreaseIncome)),
      toll: hasValue(metrics.toll) ? metrics.toll : num(record.smartTagReduction),
      petrol: hasValue(metrics.petrol) ? metrics.petrol : num(record.petrolCost),
      grabWalletTopUp: hasValue(metrics.grabWalletTopUp) ? metrics.grabWalletTopUp : num(record.grabCreditWalletTopUp)
    },
    cashBefore: cashBeforeValue === null ? totalCash : cashBeforeValue,
    confirmedCash: metrics.cash,
    pettyCash: balances.pettyCash,
    cashAtHome: balances.cashAtHome
  });
}

function showDailySummary(record, cashBeforeValue = null) {
  summaryRecordId = record.id;
  const summary = summaryForRecord(record, cashBeforeValue);
  const cashPending = state.pendingCashActions.find(item => item.sourceId === record.id && item.type === "cash_collected_to_petty");
  const displayCashAtHome = summary.cashAtHome;
  const displayPettyCash = cashPending ? summary.availablePettyCash : summary.pettyCash;
  const displayTotalCash = displayCashAtHome + displayPettyCash;
  const pendingCashNote = cashPending
    ? `<small>Available on hand after today: Petty Cash ${money.format(summary.pettyCash)} + Cash Collected ${money.format(summary.confirmedCash)} = ${money.format(summary.availablePettyCash)}</small>`
    : "";
  $("#dailySummaryTitle").textContent = dateFmt.format(parseDate(summary.date));
  $("#dailySummaryBody").innerHTML = `<section class="summary-hero">
    <div><span>Net Profit</span><strong>${money.format(summary.net)}</strong></div>
    <div><span>Total Income</span><strong>${money.format(summary.income)}</strong></div>
  </section>
  <section class="summary-execution">
    <div><span>Trips</span><strong>${summary.trips}</strong></div>
    <div><span>Driving Hours</span><strong>${summary.hours.toFixed(1)}h</strong></div>
    <div><span>Income / Hour</span><strong>${money.format(summary.incomePerHour)}</strong></div>
    <div><span>Total Cost</span><strong>${money.format(summary.cost)}</strong></div>
  </section>
  <div class="summary-columns">
    <section>
      <h3>Income</h3>
      <div class="summary-line"><span>Cash Collected</span><strong>${money.format(summary.incomeSources.cash)}</strong></div>
      <div class="summary-line"><span>TNG eWallet</span><strong>${money.format(summary.incomeSources.tng)}</strong></div>
      <div class="summary-line"><span>Grab Cash Wallet</span><strong>${money.format(summary.incomeSources.grabWallet)}</strong></div>
    </section>
    <section>
      <h3>Cost</h3>
      <div class="summary-line"><span>Petrol</span><strong>${money.format(summary.costSources.petrol)}</strong></div>
      <div class="summary-line"><span>Toll / SmartTAG</span><strong>${money.format(summary.costSources.toll)}</strong></div>
    </section>
  </div>
  <section class="cash-flow-summary">
    <p>Cash Position</p>
    <div><span>Cash At Home<strong>${money.format(displayCashAtHome)}</strong></span><b>+</b><span>Petty Cash<strong>${money.format(displayPettyCash)}</strong></span><b>=</b><span>Total Cash<strong>${money.format(displayTotalCash)}</strong></span></div>
    ${pendingCashNote}
  </section>
  ${summaryPendingMarkup(record)}`;
  const editButton = $("#dailySummaryEdit");
  if (editButton) editButton.dataset.editSummary = record.id;
  bindPendingConfirmControls($("#dailySummaryDialog"));
  const dialog = $("#dailySummaryDialog");
  if (!dialog.open) dialog.showModal();
}

function bindPendingConfirmControls(root = document) {
  root.querySelectorAll("[data-confirm-pending]").forEach(button => {
    if (button.dataset.pendingBound) return;
    button.dataset.pendingBound = "true";
    button.addEventListener("click", async () => {
      const id = button.dataset.confirmPending;
      const safeId = window.CSS?.escape ? CSS.escape(id) : id;
      const pendingCard = button.closest(".pending-item") || root;
      const pettyInput = pendingCard.querySelector(`[data-pending-petty="${safeId}"]`);
      const homeInput = pendingCard.querySelector(`[data-pending-home="${safeId}"]`);
      const currentPettyInput = pendingCard.querySelector(`[data-pending-current-petty="${safeId}"]`);
      const currentHomeInput = pendingCard.querySelector(`[data-pending-current-home="${safeId}"]`);
      confirmPending(id, pettyInput || homeInput || currentPettyInput || currentHomeInput ? {
        currentPettyCash: currentPettyInput?.value,
        currentCashAtHome: currentHomeInput?.value,
        pettyCash: pettyInput?.value || 0,
        cashAtHome: homeInput?.value || 0
      } : null);
      await persistState();
      const record = summaryRecordId ? state.driverSessions.find(item => item.id === summaryRecordId) : null;
      if (record && $("#dailySummaryDialog")?.open) showDailySummary(record);
    });
  });
}

function bindSidebar() {
  const driverForm = $("#driverForm");
  if (driverForm) {
    bindTimeDisplays(driverForm);
    driverForm.elements.date.addEventListener("change", () => {
      driverFormDirty = false;
      selectedDate = driverForm.elements.date.value;
      editingDriverId = null;
      render();
    });
    driverForm.addEventListener("input", () => {
      driverFormDirty = true;
    });
    driverForm.addEventListener("change", event => {
      if (event.target !== driverForm.elements.date) driverFormDirty = true;
    });
    driverForm.addEventListener("submit", async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(driverForm).entries());
      const existing = recordsForDate(data.date).find(item => item.driverIncomeModel === "grab_v13")
        || recordsForDate(data.date).find(item => item.platform === "Grab")
        || null;
      const requestedStatus = event.submitter.name === "finishToday" ? "Finished" : "In Progress";
      const status = resolvedStatus(existing?.status, requestedStatus);
      const session = buildGrabV13Record(data, existing, status);
      const changes = existing ? recordChanges(existing, session) : [];
      if (existing) {
        const beforeMetrics = existing.driverIncomeModel === "grab_v13" ? grabDailyMetrics(existing) : driverMetrics(existing);
        const afterMetrics = grabDailyMetrics(session);
        if (Math.abs(beforeMetrics.net - afterMetrics.net) > 0.004) {
          changes.push({ label: "Net Profit", before: beforeMetrics.net, after: afterMetrics.net, format: "money" });
        }
      }
      if (existing && !(await confirmRecordUpdate(changes, data.date))) return;
      const balancesBefore = cashBalances();
      const cashBefore = balancesBefore.pettyCash + balancesBefore.cashAtHome;
      if (existing) {
        state.activityLogs.push({
          id: uid("activity"),
          date: new Date().toISOString(),
          action: "driver_record_updated",
          sourceId: existing.id,
          businessId: "business_driver",
          before: existing,
          after: session
        });
      }
      state.driverSessions = existing
        ? state.driverSessions.map(item => item.id === existing.id ? session : item)
        : [...state.driverSessions, session];
      if (status === "Finished") createFinishPendingActions(session);
      selectedDate = data.date;
      editingDriverId = null;
      driverFormDirty = false;
      const saved = await persistState();
      if (status === "Finished" && saved) {
        showDailySummary(session, cashBefore);
      }
    });
    document.querySelectorAll("[data-edit-driver]").forEach(button => {
      button.addEventListener("click", () => {
        editingDriverId = button.dataset.editDriver;
        render();
      });
    });
    document.querySelectorAll("[data-delete-driver]").forEach(button => {
      button.addEventListener("click", () => {
        state.driverSessions = state.driverSessions.filter(item => item.id !== button.dataset.deleteDriver);
        persistState();
      });
    });
  }

  bindPendingConfirmControls(document);

  document.querySelectorAll("[data-view-summary]").forEach(button => {
    button.addEventListener("click", () => {
      const record = state.driverSessions.find(item => item.id === button.dataset.viewSummary);
      if (record) showDailySummary(record);
    });
  });

  const petrolPaymentForm = $("#petrolPaymentForm");
  if (petrolPaymentForm) {
    petrolPaymentForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(petrolPaymentForm).entries());
      const amount = num(data.amount);
      if (!amount) return;
      state.petrolCardPayments.push({
        id: uid("petrol_payment"),
        date: data.date || selectedDate,
        amount,
        note: data.note || ""
      });
      persistState();
    });
  }

  document.querySelectorAll("[data-pay-petrol-week]").forEach(button => {
    button.addEventListener("click", () => {
      const weekKey = button.dataset.payPetrolWeek;
      const week = petrolMonthWeekBuckets().find(item => item.weekKey === weekKey);
      if (!week || week.amount <= 0) return;
      const existing = (state.petrolCardPayments || []).find(item => item.source === "petrol_week" && item.weekKey === weekKey);
      if (existing) {
        state.petrolCardPayments = state.petrolCardPayments.filter(item => item.id !== existing.id);
      } else {
        state.petrolCardPayments.push({
          id: uid("petrol_week_payment"),
          date: selectedDate,
          amount: week.amount,
          source: "petrol_week",
          weekKey,
          note: `${week.label} petrol paid`
        });
      }
      persistState();
    });
  });

  const cashSettingsForm = $("#cashSettingsForm");
  if (cashSettingsForm) {
    cashSettingsForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(cashSettingsForm).entries());
      state.grabSettings = { ...state.grabSettings, ...data };
      persistState();
    });
  }

  const cashPositionForm = $("#cashPositionForm");
  if (cashPositionForm) {
    cashPositionForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(cashPositionForm).entries());
      setCashPosition(data);
      persistState();
    });
  }

  const cashMoveForm = $("#cashMoveForm");
  if (cashMoveForm) {
    cashMoveForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(cashMoveForm).entries());
      data.category = String(data.category || "").trim() || data.categoryPreset;
      recordCashAction(data);
      persistState();
    });
  }

  const solarForm = $("#solarForm");
  if (solarForm) {
    bindTimeDisplays(solarForm);
    const postcode = solarForm.elements.postcode;
    postcode.addEventListener("input", () => {
      if (postcode.value.trim() === "52100" && !solarForm.elements.area.value.trim()) {
        solarForm.elements.area.value = "Kuala Lumpur";
      }
    });
    solarForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(solarForm).entries());
      const item = { ...data, id: editingSolarId || uid("solar") };
      state.solarEvents = editingSolarId
        ? state.solarEvents.map(eventItem => eventItem.id === editingSolarId ? item : eventItem)
        : [...state.solarEvents, item];
      selectedDate = data.appointmentDate;
      editingSolarId = null;
      persistState();
    });
    $("#clearSolar").addEventListener("click", () => {
      editingSolarId = null;
      render();
    });
    document.querySelectorAll("[data-edit-solar]").forEach(button => {
      button.addEventListener("click", () => {
        editingSolarId = button.dataset.editSolar;
        render();
      });
    });
    document.querySelectorAll("[data-delete-solar]").forEach(button => {
      button.addEventListener("click", () => {
        state.solarEvents = state.solarEvents.filter(item => item.id !== button.dataset.deleteSolar);
        persistState();
      });
    });
  }
}

function buildGrabV13Record(data, existing, status) {
  const drivingSessions = [1, 2, 3].map(index => ({
    startTime: data[`sessionStart${index}`] || "",
    endTime: data[`sessionEnd${index}`] || ""
  })).filter(item => item.startTime || item.endTime);
  const defaults = {
    station: state.grabSettings?.defaultPetrolStation || "Petron",
    paymentMethod: state.grabSettings?.defaultPetrolPaymentMethod || "Credit Card"
  };
  const petrolEntries = [1, 2, 3].map(index => normalizePetrolEntry({
    amount: data[`petrolAmount${index}`],
    station: data[`petrolStation${index}`],
    paymentMethod: data[`petrolPayment${index}`]
  }, defaults)).filter(entry => entry.amount > 0);
  const firstSession = drivingSessions[0] || {};
  const lastSession = drivingSessions[drivingSessions.length - 1] || {};
  const calculatedHours = sessionHours(drivingSessions);
  return {
    ...(existing || {}),
    id: existing?.id || uid("drive"),
    platform: "Grab",
    driverIncomeModel: "grab_v13",
    date: data.date || selectedDate,
    status,
    drivingSessions,
    startTime: firstSession.startTime || "",
    endTime: lastSession.endTime || "",
    totalDrivingHours: resolvedDrivingHours(calculatedHours, existing?.totalDrivingHours),
    tngOpening: data.tngOpening || "",
    tngClosing: data.tngClosing || "",
    smartTagOpening: data.smartTagOpening || "",
    smartTagClosing: data.smartTagClosing || "",
    grabCashWalletOpening: data.grabCashWalletOpening || "",
    grabCashWalletEnding: data.grabCashWalletEnding || "",
    grabWalletBase: data.grabWalletBase || state.grabSettings?.grabWalletBase || 500,
    cashCollected: data.cashCollected || "",
    cashReceived: data.cashCollected || "",
    petrolEntries,
    petrolCost: petrolTotal(petrolEntries),
    totalTrips: data.totalTrips || "",
    remark: data.remark || ""
  };
}

function recordCashAction(data) {
  const amount = num(data.amount);
  if (!amount) return;
  const action = String(data.action || "").trim();
  const isBankIn = action.startsWith("Bank In");
  const typedCategory = String(data.category || "").trim();
  const category = typedCategory || (isBankIn ? "bank in" : "pocket money");
  const settings = state.grabSettings || defaultGrabSettings();
  if (category && !settings.cashCategories.includes(category)) {
    const shouldSaveCategory = window.confirm(`Add "${category}" as a saved cash category?`);
    if (shouldSaveCategory) {
      state.grabSettings = {
        ...settings,
        cashCategories: [...settings.cashCategories, category]
      };
    }
  }
  const base = {
    id: uid("cash"),
    date: selectedDate,
    amount,
    category,
    remark: data.remark || ""
  };
  if (action === "Move Petty Cash to Home") {
    state.cashLedger.push({ ...base, type: "cash_move", fromAccount: "petty_cash", toAccount: "cash_at_home" });
    return;
  }
  const fromAccount = action.includes("Petty Cash") ? "petty_cash" : "cash_at_home";
  state.cashLedger.push({ ...base, type: "cash_withdrawal", fromAccount });
  if (isBankIn || category.toLowerCase() === "bank in") {
    state.bankTransfers.push({
      id: uid("bank"),
      date: selectedDate,
      source: fromAccount === "cash_at_home" ? "cash_at_home_bank_in" : "petty_cash_bank_in",
      amount,
      category,
      sourceId: base.id
    });
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function statusClass(status) {
  return String(status || "").trim().replace(/\s+/g, "-");
}

function render() {
  applyAccountCapabilities();
  todayOS = buildDerivedTodayData(selectedDate);
  document.body.dataset.nextAction = todayOS.nextAction ? todayOS.nextAction.kind : "none";
  document.body.classList.toggle("theme-light", theme === "light");
  document.body.classList.toggle("mode-driver", mode === "driver");
  $("#themeButton").textContent = theme === "dark" ? "Light" : "Dark";
  document.querySelectorAll(".mode-button").forEach(button => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  renderWeeklyAchievements();
  renderDriverDashboard();
  renderForecastPlanner();
  renderPeopleToMoveToday();
  renderCalendar();
  renderSidebar();
  renderGrabStats();
  bindBottomNavigation();
  animateCounters();
  updateLiveCountdowns();
  localizeUI();
}

function bindBottomNavigation() {
  document.querySelectorAll("[data-nav-target]").forEach(button => {
    if (button.dataset.navBound) return;
    button.dataset.navBound = "true";
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.navTarget);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelectorAll("[data-nav-target]").forEach(item => {
        item.classList.toggle("active", item === button);
      });
      if (button.classList.contains("bottom-nav-add")) {
        const firstInput = document.querySelector("#driverForm input, #driverForm select, #driverForm textarea");
        setTimeout(() => firstInput?.focus({ preventScroll: true }), 260);
      }
    });
  });
}

document.querySelectorAll(".mode-button").forEach(button => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    editingDriverId = null;
    editingSolarId = null;
    render();
  });
});

$("#prevMonth").addEventListener("click", () => {
  visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() - 1, 1);
  render();
});

$("#nextMonth").addEventListener("click", () => {
  visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1);
  render();
});

$("#todayButton").addEventListener("click", () => {
  visibleDate = new Date();
  selectedDate = toISODate(new Date());
  render();
});

$("#themeButton").addEventListener("click", () => {
  theme = "light";
  localStorage.setItem("topOneGroupTheme", theme);
  render();
});

window.addEventListener("top1-language-change", event => {
  updateLanguage(event.detail?.language);
  if (appStarted) render();
});

document.addEventListener("pointermove", event => {
  document.documentElement.style.setProperty("--mouse-x", `${event.clientX}px`);
  document.documentElement.style.setProperty("--mouse-y", `${event.clientY}px`);
});

function startSpaceParticles() {
  const canvas = $("#spaceParticles");
  if (!canvas) return;
  const disableParticles = true;
  const touchDevice = navigator.maxTouchPoints > 0;
  const compactViewport = window.matchMedia("(max-width: 980px)").matches;
  if (disableParticles || touchDevice || compactViewport) {
    canvas.hidden = true;
    return;
  }
  const ctx = canvas.getContext("2d");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let particles = [];
  let pointerX = 0.5;
  let pointerY = 0.2;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(90, Math.max(42, Math.floor((width * height) / 32000)));
    particles = Array.from({ length: count }, () => makeParticle());
  }

  function makeParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      z: 0.35 + Math.random() * 1.6,
      size: 0.35 + Math.random() * 1.15,
      drift: 0.015 + Math.random() * 0.045,
      twinkle: Math.random() * Math.PI * 2,
      alpha: 0.08 + Math.random() * 0.28
    };
  }

  function draw(now) {
    ctx.clearRect(0, 0, width, height);
    const parallaxX = (pointerX - 0.5) * 14;
    const parallaxY = (pointerY - 0.5) * 10;

    particles.forEach(particle => {
      if (!motion) {
        particle.y -= particle.drift * particle.z;
        particle.x += Math.sin(now / 9000 + particle.twinkle) * 0.018 * particle.z;
        if (particle.y < -12) {
          particle.y = height + 12;
          particle.x = Math.random() * width;
        }
      }

      const pulse = 0.58 + Math.sin(now / 2400 + particle.twinkle) * 0.24;
      const alpha = particle.alpha * Math.max(0.16, pulse);
      const x = particle.x + parallaxX * particle.z;
      const y = particle.y + parallaxY * particle.z;
      const radius = particle.size * particle.z;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      gradient.addColorStop(0, `rgba(245, 230, 179, ${alpha})`);
      gradient.addColorStop(0.52, `rgba(212, 175, 55, ${alpha * 0.28})`);
      gradient.addColorStop(1, "rgba(212, 175, 55, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("pointermove", event => {
    pointerX = event.clientX / Math.max(1, width);
    pointerY = event.clientY / Math.max(1, height);
  });
  resize();
  requestAnimationFrame(draw);
}

async function startAuthenticatedApp() {
  if (appStarted) return;
  appStarted = true;
  updateLanguage(authManager.language());
  applyAccountCapabilities();
  document.querySelector("#logoutButton")?.addEventListener("click", () => authManager.signOut());
  document.querySelector("#dailySummaryClose")?.addEventListener("click", () => $("#dailySummaryDialog").close());
  document.querySelector("#dailySummaryEdit")?.addEventListener("click", event => {
    const id = event.currentTarget.dataset.editSummary || summaryRecordId;
    if (!id) return;
    const record = state.driverSessions.find(item => item.id === id);
    if (!record) return;
    $("#dailySummaryDialog").close();
    mode = "driver";
    selectedDate = record.date;
    editingDriverId = id;
    render();
  });
  startSpaceParticles();
  await loadState();
}

authManager = new Top1Auth.AuthManager(startAuthenticatedApp);
authManager.init();
