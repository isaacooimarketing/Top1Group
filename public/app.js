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
let theme = localStorage.getItem("topOneGroupTheme") || "dark";
let todayOS = null;
let authManager = null;
let appStarted = false;
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
  const canUseSolar = Top1UI.canAccessSolar(authManager?.accountType());
  const solarButton = document.querySelector('.mode-button[data-mode="solar"]');
  if (solarButton) solarButton.hidden = !canUseSolar;
  if (!canUseSolar && mode === "solar") mode = "driver";
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
    pendingCashActions: Array.isArray(input.pendingCashActions) ? input.pendingCashActions : [],
    bankTransfers: Array.isArray(input.bankTransfers) ? input.bankTransfers : [],
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
    return `Current net ${money.format(analytics.totals.net)} · Average ${money.format(analytics.averageIncomePerHour)}/hour · ${analytics.totals.trips} trips imported`;
  }
  const item = action.item;
  const time = action.kind === "task" ? item.dueTime : item.startTime;
  return `${displayTime(time)} · ${businessName(item.businessId)} · ${item.priority || "normal"} priority`;
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
  try {
    const response = await fetch("/api/state", {
      cache: "no-store",
      headers: authManager?.authHeaders() || {}
    });
    if (response.status === 401) {
      await authManager?.signOut();
      return;
    }
    if (!response.ok) throw new Error("Unable to load state");
    state = normalizeOSState(await response.json());
  } catch {
    state = normalizeOSState(JSON.parse(localStorage.getItem("topOneGroupState") || JSON.stringify(state)));
  }
  syncUniversalObjects();
  render();
}

async function persistState() {
  syncUniversalObjects();
  state.updatedAt = new Date().toISOString();
  localStorage.setItem("topOneGroupState", JSON.stringify(state));
  if (saving) return;
  saving = true;
  let cloudSaved = false;
  try {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authManager?.authHeaders() || {})
      },
      body: JSON.stringify(state)
    });
    if (response.status === 401) {
      await authManager?.signOut();
      return false;
    }
    if (!response.ok) throw new Error("Unable to save state");
    state = normalizeOSState(await response.json());
    syncUniversalObjects();
    cloudSaved = true;
  } catch {
    // Local storage keeps the app usable if the data server is offline.
  } finally {
    saving = false;
    render();
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
      kpi("Total Earning", money.format(monthTotals.income), `Grab ${money.format(monthTotals.grab)} · Bolt ${money.format(monthTotals.bolt)}`),
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
  return recordsForDate(selectedDate).find(item => item.driverIncomeModel === "grab_v13")
    || recordsForDate(selectedDate).find(item => item.platform === "Grab")
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
  const grabWalletTopUp = Math.max(0, -walletMove);
  const income = cash + tngIncome + grabWalletIncome;
  const toll = smartTagCost + tngCost;
  const cost = petrol + toll + grabWalletTopUp;
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
    grabWalletTopUp,
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
    acc.grabTopUp += item.driverIncomeModel === "grab_v13" ? metrics.grabWalletTopUp : 0;
    return acc;
  }, { income: 0, cost: 0, net: 0, hours: 0, trips: 0, petrol: 0, toll: 0, grabTopUp: 0 });
}

function weekRecords(dateIso = selectedDate) {
  return recordsThroughSelectedDate(state.driverSessions, dateIso);
}

function monthRecords() {
  const y = visibleDate.getFullYear();
  const m = visibleDate.getMonth();
  return state.driverSessions.filter(item => {
    const date = parseDate(item.date);
    return date.getFullYear() === y && date.getMonth() === m;
  });
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
  const exists = state.pendingCashActions.some(item => item.id === action.id);
  if (!exists && num(action.amount) > 0) state.pendingCashActions.push(action);
}

function createFinishPendingActions(record) {
  const metrics = grabDailyMetrics(record);
  upsertPending({
    id: `pending_cash_${record.id}`,
    date: record.date,
    type: "cash_collected_to_petty",
    amount: metrics.cash,
    label: "Add cash collected to Petty Cash",
    sourceId: record.id
  });
  upsertPending({
    id: `pending_grab_bank_${record.id}`,
    date: record.date,
    type: "grab_wallet_transfer_to_bank",
    amount: metrics.transferToBank,
    label: "Confirm Grab wallet transfer to bank",
    sourceId: record.id
  });
}

function confirmPending(id) {
  const action = state.pendingCashActions.find(item => item.id === id);
  if (!action) return;
  if (action.type === "cash_collected_to_petty") {
    state.cashLedger.push({
      id: uid("cash"),
      date: action.date,
      type: "cash_collected",
      account: "petty_cash",
      amount: num(action.amount),
      category: "cash collected",
      sourceId: action.sourceId
    });
  }
  if (action.type === "grab_wallet_transfer_to_bank") {
    state.bankTransfers.push({
      id: uid("bank"),
      date: action.date,
      source: "grab_wallet",
      amount: num(action.amount),
      sourceId: action.sourceId
    });
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
    `<article class="achievement-card"><span>Weekly Net</span><strong>${money.format(totals.net)}</strong><small>${totals.hours.toFixed(1)}h · ${totals.trips} trips</small></article>`
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
  const first = new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  const todayIso = toISODate(new Date());
  const cards = [];

  for (let week = 0; week < 6; week += 1) {
    const weekStartDate = new Date(start);
    weekStartDate.setDate(start.getDate() + (week * 7));
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
  }
  grid.innerHTML = cards.join("");
  grid.querySelectorAll(".day-card").forEach(card => {
    card.addEventListener("click", () => {
      selectedDate = card.dataset.date;
      editingDriverId = null;
      editingSolarId = null;
      render();
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
    <div class="day-status">${status}${platforms ? ` · ${platforms}` : ""}</div>
    <div class="net-profit">${moneyCompact.format(totals.net)}</div>
    <div>${moneyCompact.format(iph)}/h income</div>
    <div>${totals.hours.toFixed(1)}h · ${totals.trips || 0} trips</div>
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
          <span>${businessName(event.businessId)} · ${escapeHtml(event.status || "scheduled")}</span>
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
          <span>${displayTime(task.dueTime)} · ${businessName(task.businessId)}</span>
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

function renderGrabStats() {
  const target = $("#grabStats");
  if (!target) return;
  const week = totalsForRecords(weekRecords());
  const month = totalsForRecords(monthRecords());
  const bank = bankTransferTotals();
  const incomeBreakdown = weeklyBreakdown("income");
  const costBreakdown = weeklyBreakdown("cost");
  target.innerHTML = `<div class="section-heading">
    <p class="eyebrow">Weekly Statistics</p>
    <h2>Grab Intelligence</h2>
  </div>
  <div class="stats-grid">
    ${statCard("Week Net", money.format(week.net), `${week.hours.toFixed(1)}h · ${week.trips} trips`)}
    ${statCard("Month Net", money.format(month.net), `${money.format(month.income)} income`)}
    ${statCard("Income/hour", money.format(week.hours ? week.income / week.hours : 0), "Based on total income")}
    ${statCard("Bank Transfer", `${money.format(bank.week)} / ${money.format(bank.month)}`, "This week / this month")}
  </div>
  <div class="breakdown-grid">
    ${breakdownBars("Income Breakdown", incomeBreakdown)}
    ${breakdownBars("Cost Breakdown", costBreakdown)}
  </div>`;
}

function statCard(label, value, detail) {
  return `<article class="stat-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
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
      acc["Grab Wallet Top-Up"] += metrics.grabWalletTopUp;
    }
    if (!metrics && type === "income") acc["Imported Summary"] += driverMetrics(item).income;
    if (!metrics && type === "cost") acc["Imported Summary"] += driverMetrics(item).cost;
    return acc;
  }, type === "income"
    ? { "Cash": 0, "TNG QR": 0, "Grab Wallet": 0, "Imported Summary": 0 }
    : { "Petrol": 0, "Toll": 0, "Grab Wallet Top-Up": 0, "Imported Summary": 0 });
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
        <h3>${consoleData.sourceDate === date ? "Selected day" : "Latest record"} · ${escapeHtml(consoleData.platform)}</h3>
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
  const metrics = editing.id ? (editing.driverIncomeModel === "grab_v13" ? grabDailyMetrics(editing) : driverMetrics(editing)) : grabDailyMetrics({});
  const balances = cashBalances();
  const pending = state.pendingCashActions.filter(item => item.date === selectedDate);
  const bankTotals = bankTransferTotals();
  const settings = state.grabSettings || defaultGrabSettings();
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
    ${sessionFields(editing)}
    <div class="form-section full">Touch & Go eWallet</div>
    ${field("Starting", "tngOpening", "number", editing.tngOpening || "")}
    ${field("Ending", "tngClosing", "number", editing.tngClosing || "")}
    <div class="form-section full">SmartTAG / TNG Card</div>
    ${field("Starting", "smartTagOpening", "number", editing.smartTagOpening || "")}
    ${field("Ending", "smartTagClosing", "number", editing.smartTagClosing || "")}
    <div class="form-section full">Grab Cash Wallet Balance</div>
    ${field("Starting", "grabCashWalletOpening", "number", hasValue(editing.grabCashWalletOpening) ? editing.grabCashWalletOpening : editing.id ? "" : settings.grabWalletBase)}
    ${field("Ending Before Withdrawal", "grabCashWalletEnding", "number", editing.grabCashWalletEnding || "")}
    ${field("Wallet Base", "grabWalletBase", "number", editing.grabWalletBase || settings.grabWalletBase)}
    <div class="field"><label>Auto Transfer To Bank</label><input disabled value="${moneySafe(metrics.transferToBank)}"></div>
    <div class="form-section full">Cash / Petrol / Trips</div>
    ${field("Cash Collected Today", "cashCollected", "number", editing.cashCollected || editing.cashReceived || "")}
    ${petrolFields(editing)}
    ${field("Total Trips", "totalTrips", "number", editing.totalTrips || "")}
    <div class="field"><label>Grab Wallet Top-Up Cost</label><input disabled value="${moneySafe(metrics.grabWalletTopUp)}"></div>
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

  <section class="history compact-history">
    <h3>Bank Transfer</h3>
    <div class="driver-summary two">
      <span>This week ${money.format(bankTotals.week)}</span>
      <span>This month ${money.format(bankTotals.month)}</span>
    </div>
    ${bankTransferHistory()}
  </section>

  <section class="history compact-history">
    <h3>Cash History</h3>
    ${cashHistory()}
  </section>

  ${petrolLiabilityMarkup()}`;
}

function sessionFields(editing) {
  const sessions = Array.isArray(editing.drivingSessions) && editing.drivingSessions.length
    ? editing.drivingSessions
    : [{ startTime: editing.startTime || "", endTime: editing.endTime || "" }, { startTime: "", endTime: "" }];
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

function petrolLiabilityMarkup() {
  const entries = explicitPetrolEntries();
  const payments = state.petrolCardPayments || [];
  const totals = petrolTotals(entries, payments);
  const [weekStart, weekEnd] = weekRange(selectedDate);
  const month = selectedDate.slice(0, 7);
  const petrolCostForRecord = record => record.driverIncomeModel === "grab_v13"
    ? grabDailyMetrics(record).petrol
    : num(record.petrolCost || record.metadata?.petrolCost);
  const weekCost = state.driverSessions
    .filter(record => record.date >= weekStart && record.date <= weekEnd)
    .reduce((sum, record) => sum + petrolCostForRecord(record), 0);
  const monthCost = state.driverSessions
    .filter(record => record.date.startsWith(month))
    .reduce((sum, record) => sum + petrolCostForRecord(record), 0);
  const history = [...payments].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
  return `<section class="history petrol-liability">
    <div class="section-title-row"><h3>Petrol Credit Card</h3><span>${money.format(totals.cardOutstanding)} outstanding</span></div>
    <div class="petrol-ledger-grid">
      <div><span>Week Cost</span><strong>${money.format(weekCost)}</strong></div>
      <div><span>Month Cost</span><strong>${money.format(monthCost)}</strong></div>
      <div><span>Card Charged</span><strong>${money.format(totals.cardCharged)}</strong></div>
      <div><span>Paid</span><strong>${money.format(totals.cardPaid)}</strong></div>
    </div>
    <form id="petrolPaymentForm" class="form-grid compact-form">
      ${field("Payment Date", "date", "date", selectedDate)}
      ${field("Pay Amount", "amount", "number", "")}
      <div class="field full"><label>Note</label><input name="note" placeholder="Credit card payment"></div>
      <button class="primary-action full" type="submit">Pay Petrol Card</button>
    </form>
    <div class="compact-history">
      ${history.length ? history.map(item => `<div class="history-item"><div class="history-line"><span>${item.date} · Payment</span><strong>${money.format(num(item.amount))}</strong></div><div class="muted">${escapeHtml(item.note || "")}</div></div>`).join("") : `<div class="empty-note">No petrol card payment yet.</div>`}
    </div>
  </section>`;
}

function pendingItem(item) {
  return `<article class="pending-item">
    <div><strong>${escapeHtml(item.label)}</strong><span>${money.format(item.amount)}</span></div>
    <button class="primary-action" type="button" data-confirm-pending="${item.id}">Confirm</button>
  </article>`;
}

function cashToolsMarkup() {
  const settings = state.grabSettings || defaultGrabSettings();
  const categories = settings.cashCategories.map(item => `<option value="${escapeHtml(item)}"></option>`).join("");
  return `<details class="record-details cash-tools">
    <summary>Cash Tools</summary>
    <form id="cashSettingsForm" class="form-grid">
      ${field("Petty Cash Opening", "pettyCashOpening", "number", settings.pettyCashOpening)}
      ${field("Cash At Home Opening", "cashAtHomeOpening", "number", settings.cashAtHomeOpening)}
      ${field("Car Rental Target", "carRentalTarget", "number", settings.carRentalTarget)}
      ${field("Housing Loan Target", "housingLoanTarget", "number", settings.housingLoanTarget)}
      ${field("Grab Wallet Base", "grabWalletBase", "number", settings.grabWalletBase)}
      <div class="action-row full"><button class="secondary-action" type="submit">Save Settings</button></div>
    </form>
    <form id="cashMoveForm" class="form-grid">
      <div class="form-section full">Move / Withdraw Cash</div>
      ${field("Amount", "amount", "number", "")}
      ${field("Action", "action", "select", "Move Petty Cash to Home", ["Move Petty Cash to Home", "Withdraw From Petty Cash", "Withdraw From Cash At Home"])}
      <div class="field"><label>Category</label><input name="category" list="cashCategoryList" value="bank in"></div>
      <datalist id="cashCategoryList">${categories}</datalist>
      <div class="field"><label>Remark</label><input name="remark" type="text"></div>
      <div class="action-row full"><button class="primary-action" type="submit">Record Cash Action</button></div>
    </form>
  </details>`;
}

function bankTransferHistory() {
  const items = [...state.bankTransfers].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return items.length ? items.map(item => `<div class="history-item">
    <div class="history-line"><span>${item.date} · ${item.source === "grab_wallet" ? "Grab Wallet" : "Cash Bank In"}</span><span>${money.format(item.amount)}</span></div>
  </div>`).join("") : `<div class="empty-note">No bank transfer confirmed yet.</div>`;
}

function cashHistory() {
  const items = [...state.cashLedger].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return items.length ? items.map(item => `<div class="history-item">
    <div class="history-line"><span>${item.date} · ${escapeHtml(item.category || item.type)}</span><span>${money.format(item.amount)}</span></div>
    <div class="muted">${escapeHtml(item.account || `${item.fromAccount || ""} -> ${item.toAccount || ""}`)}</div>
  </div>`).join("") : `<div class="empty-note">No cash ledger entries yet.</div>`;
}

function driverHistoryItem(item) {
  const metrics = driverMetrics(item);
  const iph = metrics.hours ? metrics.income / metrics.hours : 0;
  return `<div class="history-item">
    <div class="history-line"><span>${item.platform} · ${item.status}</span><span>${money.format(metrics.net)}</span></div>
    <div class="muted">${item.startTime || "--:--"} - ${item.endTime || "--:--"} · ${metrics.hours.toFixed(1)}h · ${item.totalTrips || 0} trips</div>
    <div class="muted">Income ${money.format(metrics.income)} · Cost ${money.format(metrics.cost)} · ${money.format(iph)}/hr</div>
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
    <div class="muted">${item.appointmentDate} ${item.appointmentTime || ""} · ${escapeHtml(item.phone || "")}</div>
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
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${type === "number" ? 'step="0.01"' : ""}></div>`;
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
    ? changes.map(change => `<div class="change-row"><span>${escapeHtml(change.label)}</span><strong>${escapeHtml(formatChangeValue(change.before, change.format))} → ${escapeHtml(formatChangeValue(change.after, change.format))}</strong></div>`).join("")
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
  const summary = summaryForRecord(record, cashBeforeValue);
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
      <div class="summary-line"><span>Grab Wallet Top-Up</span><strong>${money.format(summary.costSources.grabWalletTopUp)}</strong></div>
    </section>
  </div>
  <section class="cash-flow-summary">
    <p>Cash Movement</p>
    <div><span>Previous Total Cash<strong>${money.format(summary.cashBefore)}</strong></span><b>+</b><span>Today's Cash<strong>${money.format(summary.confirmedCash)}</strong></span><b>=</b><span>New Total Cash<strong>${money.format(summary.cashAfter)}</strong></span></div>
    <small>Petty Cash ${money.format(summary.pettyCash)} + Cash At Home ${money.format(summary.cashAtHome)} = ${money.format(summary.totalCash)}</small>
  </section>`;
  $("#dailySummaryDialog").showModal();
}

function bindSidebar() {
  const driverForm = $("#driverForm");
  if (driverForm) {
    driverForm.elements.date.addEventListener("change", () => {
      selectedDate = driverForm.elements.date.value;
      editingDriverId = null;
      render();
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
      const saved = await persistState();
      if (status === "Finished" && saved) showDailySummary(session, cashBefore);
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

  document.querySelectorAll("[data-confirm-pending]").forEach(button => {
    button.addEventListener("click", () => {
      confirmPending(button.dataset.confirmPending);
      persistState();
    });
  });

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

  const cashSettingsForm = $("#cashSettingsForm");
  if (cashSettingsForm) {
    cashSettingsForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(cashSettingsForm).entries());
      state.grabSettings = { ...state.grabSettings, ...data };
      persistState();
    });
  }

  const cashMoveForm = $("#cashMoveForm");
  if (cashMoveForm) {
    cashMoveForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(cashMoveForm).entries());
      recordCashAction(data);
      persistState();
    });
  }

  const solarForm = $("#solarForm");
  if (solarForm) {
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
  const category = String(data.category || "cash action").trim();
  const settings = state.grabSettings || defaultGrabSettings();
  if (category && !settings.cashCategories.includes(category)) {
    state.grabSettings = {
      ...settings,
      cashCategories: [...settings.cashCategories, category]
    };
  }
  const base = {
    id: uid("cash"),
    date: selectedDate,
    amount,
    category,
    remark: data.remark || ""
  };
  if (data.action === "Move Petty Cash to Home") {
    state.cashLedger.push({ ...base, type: "cash_move", fromAccount: "petty_cash", toAccount: "cash_at_home" });
    return;
  }
  const fromAccount = data.action === "Withdraw From Petty Cash" ? "petty_cash" : "cash_at_home";
  state.cashLedger.push({ ...base, type: "cash_withdrawal", fromAccount });
  if (category.toLowerCase() === "bank in") {
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
  document.body.classList.toggle("mode-solar", mode === "solar");
  $("#themeButton").textContent = theme === "dark" ? "Light" : "Dark";
  document.querySelectorAll(".mode-button").forEach(button => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  renderWeeklyAchievements();
  renderPeopleToMoveToday();
  renderCalendar();
  renderSidebar();
  renderGrabStats();
  animateCounters();
  updateLiveCountdowns();
  localizeUI();
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
  theme = theme === "dark" ? "light" : "dark";
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
  setInterval(updateLiveCountdowns, 1000);
  setInterval(loadState, 15000);
  startSpaceParticles();
  await loadState();
}

authManager = new Top1Auth.AuthManager(startAuthenticatedApp);
authManager.init();
