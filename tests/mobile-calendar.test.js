const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("mobile calendar uses one horizontal viewport for weekdays and dates", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(html, /class="calendar-scroll"/);
  assert.match(css, /\.calendar-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /min-width:\s*868px/);
});

test("mobile calendar does not auto-scroll to selected day after render", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.doesNotMatch(js, /revealSelectedCalendarDay\(\)/);
  assert.doesNotMatch(js, /scrollTo\(\{\s*left:\s*Math\.max\(0,\s*centered\)/s);
});

test("calendar includes a weekly summary column that scrolls with weekdays", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(css, /grid-template-columns:\s*var\(--week-summary-width\)\s+repeat\(7,/);
  assert.match(js, /class="week-summary-card/);
  assert.match(js, /weeklyTarget/);
  assert.doesNotMatch(css, /\.week-summary-card\s*\{[^}]*position:\s*sticky/s);
  assert.doesNotMatch(css, /\.week-summary-card\s*\{[^}]*left:\s*0/s);
});

test("calendar day header keeps date and lunar marker pinned to the top", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /\.day-number\s*\{[^}]*align-items:\s*flex-start/s);
  assert.match(css, /\.day-number\s*\{[^}]*min-height:\s*28px/s);
  assert.match(css, /\.lunar-note\.active\s*\{[^}]*border:/s);
  assert.doesNotMatch(css, /\.lunar-note\s+b\s*\{/);
});

test("light theme covers daily summary and breakdown panels", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /body\.theme-light \.grab-day-summary/);
  assert.match(css, /body\.theme-light \.breakdown-card/);
});

test("light summary cash confirmation uses high-contrast commercial surfaces", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /Commercial light refinement/);
  assert.match(css, /body\.theme-light \.summary-dialog/);
  assert.match(css, /body\.theme-light \.cash-flow-summary/);
  assert.match(css, /body\.theme-light \.pending-item/);
  assert.match(css, /body\.theme-light \.pending-item span[\s\S]*color:\s*var\(--brand-gold-strong\)/);
  assert.match(css, /body\.theme-light \.pending-item strong[\s\S]*color:\s*var\(--ink-strong\)/);
  assert.match(css, /body\.theme-light \.primary-action[\s\S]*color:\s*#171407/);
});

test("mobile time fields render a visible synced display over native picker", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /class="field time-field"/);
  assert.match(js, /data-time-display="\$\{name\}"/);
  assert.match(js, /function bindTimeDisplays/);
  assert.match(js, /input\.addEventListener\("input", sync\)/);
  assert.match(js, /input\.addEventListener\("change", sync\)/);
  assert.match(css, /\.time-display\s*\{/);
  assert.match(css, /\.time-input-wrap input\[type="time"\]/);
});

test("background sync does not redraw over unsaved driver form edits", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /let driverFormDirty = false/);
  assert.match(js, /function hasUnsavedDriverFormEdits/);
  assert.match(js, /if \(hasUnsavedDriverFormEdits\(\)\) return/);
  assert.match(js, /driverForm\.addEventListener\("input"/);
  assert.match(js, /driverFormDirty = true/);
  assert.match(js, /driverFormDirty = false/);
});

test("driver form is not interrupted by fixed background state refresh", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.doesNotMatch(js, /setInterval\(loadState,\s*15000\)/);
});

test("driver form is not interrupted by fixed countdown refresh", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.doesNotMatch(js, /setInterval\(updateLiveCountdowns,\s*1000\)/);
});

test("calendar day click opens daily summary before editing", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(html, /id="dailySummaryEdit"/);
  assert.match(html, /data-edit-summary/);
  assert.match(js, /summaryRecordId/);
  assert.match(js, /showDailySummary\(summaryRecord\)/);
  assert.match(js, /dataset\.editSummary/);
});

test("driver UI is Grab-only and hides legacy Solar switching", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.doesNotMatch(html, /data-mode="solar"/);
  assert.doesNotMatch(html, />Solar</);
  assert.doesNotMatch(js, /body\.classList\.toggle\("mode-solar"/);
});

test("driver dashboard shows a clean weekly operations overview", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const dashboardStart = js.indexOf("function renderDriverDashboard()");
  const statsStart = js.indexOf("function renderGrabStats()");
  const dashboardBlock = js.slice(dashboardStart, statsStart);

  assert.match(html, /id="driverDashboard"/);
  assert.match(js, /function renderDriverDashboard/);
  assert.match(js, /renderDriverDashboard\(\)/);
  assert.match(dashboardBlock, /Week Net/);
  assert.match(js, /function dueCarRentalPayments\(monthKey = selectedMonthKey\(\), throughDate = selectedDate\)/);
  assert.match(js, /function duePetrolCost\(monthKey = selectedMonthKey\(\), throughDate = selectedDate\)/);
  assert.match(dashboardBlock, /After Car Rental/);
  assert.match(dashboardBlock, /All-Time Net Profit/);
  assert.match(dashboardBlock, /dueCarRentalPayments\(\) \* num\(settings\.carRentalTarget\)/);
  assert.match(dashboardBlock, /const duePetrol = duePetrolCost\(\);/);
  assert.match(dashboardBlock, /After Rental \+ Petrol/);
  assert.match(dashboardBlock, /const netAfterRental = month\.net - dueRental;/);
  assert.match(dashboardBlock, /const netAfterRentalAndPetrol = month\.net - dueRental - duePetrol;/);
  assert.doesNotMatch(dashboardBlock, /bank\.month - dueRental/);
  assert.doesNotMatch(dashboardBlock, /Average Daily Net/);
  assert.doesNotMatch(dashboardBlock, /bankTransferTotals\(\)\.week/);
  assert.doesNotMatch(dashboardBlock, /Income \/ Hour/);
  assert.doesNotMatch(dashboardBlock, /Online Hours/);
  assert.doesNotMatch(dashboardBlock, /Total Cost/);
  assert.doesNotMatch(dashboardBlock, /Cost Ratio/);
});

test("bottom navigation classifies the driver workspace", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(html, /class="bottom-nav"/);
  assert.match(html, /data-nav-target="calendarSection"/);
  assert.match(html, /data-nav-target="entrySection"/);
  assert.match(html, /class="bottom-nav-add"/);
  assert.match(js, /function bindBottomNavigation/);
  assert.match(js, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("clean light visual system is fixed and mobile centered", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(html, /<body class="theme-light auth-locked">/);
  assert.match(js, /let theme = "light"/);
  assert.match(css, /body\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /body\.theme-light \.app-shell\s*\{[^}]*width:\s*min\(96vw,\s*1760px\)/s);
  assert.match(css, /@media \(max-width:\s*620px\)\s*\{[\s\S]*?body\.theme-light \.app-shell\s*\{[^}]*width:\s*100%;/s);
  assert.match(css, /body\.theme-light \.theme-button\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /body\.theme-light \.dashboard-net-card\s*\{[^}]*background:\s*#11844f;/s);
});

test("desktop light layout keeps calendar wide with a right workspace", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /@media \(min-width:\s*981px\)\s*\{[\s\S]*?body\.theme-light \.grab-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*7fr\)\s+minmax\(360px,\s*3fr\)/s);
  assert.match(css, /@media \(min-width:\s*981px\)\s*\{[\s\S]*?body\.theme-light \.achievement-strip\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /@media \(min-width:\s*981px\)\s*\{[\s\S]*?body\.theme-light \.grab-entry-panel\s*\{[^}]*position:\s*sticky;[\s\S]*?overflow-y:\s*auto;/s);
});

test("light calendar and form controls stay readable on mobile", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /body\.theme-light \.week-summary-card,[\s\S]*?background:\s*linear-gradient\(180deg,\s*#eef8f1,\s*#ffffff\)/);
  assert.match(css, /body\.theme-light \.driver-mini\.finished\.net-gold \.net-profit\s*\{[^}]*color:\s*#8f6900;/s);
  assert.match(css, /body\.theme-light input,[\s\S]*?body\.theme-light \.time-input-wrap\s*\{[^}]*max-width:\s*100%;/s);
  assert.match(css, /body\.theme-light \.stats-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /body\.theme-light \.bottom-nav\s*\{[^}]*bottom:\s*calc\(max\(12px,\s*env\(safe-area-inset-bottom\)\)\s*\+\s*76px\)/s);
  assert.match(css, /body\.theme-light \.topbar \.language-switch\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /body\.theme-light \.achievement-strip\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /body\.theme-light \.achievement-card\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /body\.theme-light \.lunar-note\s*\{[^}]*color:\s*#5f6f68;/s);
  assert.match(css, /body\.theme-light \.workspace-panel,[\s\S]*?body\.theme-light textarea\s*\{[^}]*box-sizing:\s*border-box;[\s\S]*?max-width:\s*100%;/s);
  assert.match(css, /body\.theme-light \.today-button\s*\{[^}]*display:\s*none !important;/s);
  assert.match(css, /body\.theme-light \.achievement-card\.complete::after\s*\{[^}]*content:\s*none;/s);
});

test("mobile light layout keeps entry panel below calendar instead of overlapping", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /@media \(max-width:\s*980px\)\s*\{[\s\S]*?body\.theme-light \.grab-layout\s*\{[^}]*grid-template-columns:\s*1fr !important;/s);
  assert.match(css, /@media \(max-width:\s*980px\)\s*\{[\s\S]*?body\.theme-light \.grab-entry-panel\s*\{[^}]*position:\s*relative;[\s\S]*?max-height:\s*none;/s);
});

test("light login screen uses readable product surfaces", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /body\.theme-light\.auth-locked/);
  assert.match(css, /body\.theme-light \.auth-panel\s*\{[^}]*border-radius:\s*24px;/s);
  assert.match(css, /body\.theme-light \.auth-product h1\s*\{[^}]*color:\s*var\(--ink-strong\)/s);
  assert.match(css, /body\.theme-light \.auth-form input\s*\{[^}]*color:\s*var\(--ink-strong\)/s);
});

test("commercial mobile correction locks nav and time fields inside the viewport", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /Commercial mobile correction/);
  assert.match(css, /body\.theme-light \.bottom-nav\s*\{[^}]*position:\s*fixed !important;[\s\S]*?bottom:\s*max\(10px,\s*env\(safe-area-inset-bottom\)\) !important;/s);
  assert.match(css, /body\.theme-light \.time-input-wrap input\[type="time"\]\s*\{[^}]*-webkit-appearance:\s*none;[\s\S]*?max-inline-size:\s*100%;/s);
  assert.match(css, /body\.theme-light \.app-shell\s*\{[^}]*max-width:\s*100vw;[\s\S]*?overflow-x:\s*clip;/s);
  assert.match(css, /body\.theme-light \.auth-gate\s*\{[^}]*min-height:\s*100dvh;[\s\S]*?overflow-x:\s*hidden;/s);
});

test("commercial dashboard polish calms KPI typography and aligns date inputs", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /Friendly commercial polish/);
  assert.match(css, /--money-teal:\s*#0f7c76;/);
  assert.match(css, /body\.theme-light \.dashboard-mini-card:nth-child\(5\),[\s\S]*?background:\s*linear-gradient\(180deg,\s*#ffffff 0%,\s*var\(--soft-blue\) 100%\)/);
  assert.match(css, /body\.theme-light \.dashboard-mini-card strong,\s*body\.theme-light \.achievement-card strong\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(css, /body\.theme-light input\[type="date"\],[\s\S]*?inline-size:\s*100%;[\s\S]*?max-inline-size:\s*100%;/s);
  assert.match(css, /@media \(max-width:\s*620px\)\s*\{[\s\S]*?body\.theme-light \.dashboard-net-card strong\s*\{[^}]*font-size:\s*clamp\(38px,\s*10\.4vw,\s*48px\)/s);
  assert.match(css, /@media \(max-width:\s*620px\)\s*\{[\s\S]*?body\.theme-light \.achievement-card strong\s*\{[^}]*font-size:\s*clamp\(20px,\s*5vw,\s*24px\)/s);
});

test("mobile form detail polish keeps date borders and history readable", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /Field and history readability pass/);
  assert.match(css, /body\.theme-light \.workspace-panel \.date-input-frame,[\s\S]*?width:\s*100%;[\s\S]*?box-sizing:\s*border-box;/s);
  assert.match(css, /body\.theme-light \.petrol-entry > strong\s*\{[^}]*color:\s*#7f5f00;[\s\S]*?font-weight:\s*860;/s);
  assert.match(css, /body\.theme-light \.history-item\s*\{[^}]*padding:\s*15px 16px;[\s\S]*?border-radius:\s*14px;/s);
  assert.match(css, /body\.theme-light \.history-line\s*\{[^}]*gap:\s*16px;/s);
  assert.match(css, /body\.theme-light \.history-line span:first-child\s*\{[^}]*line-height:\s*1\.35;/s);
});

test("calendar rows, date borders, and record gutters stay stable on mobile", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /Calendar row and record gutter stabilizer/);
  assert.match(css, /--calendar-week-row-height:\s*184px;/);
  assert.match(css, /body\.theme-light \.calendar-grid\s*\{[^}]*grid-auto-rows:\s*var\(--calendar-week-row-height\);/s);
  assert.match(css, /body\.theme-light \.calendar-grid > \.week-summary-card,[\s\S]*?height:\s*var\(--calendar-week-row-height\);[\s\S]*?min-height:\s*var\(--calendar-week-row-height\);/s);
  assert.match(css, /body\.theme-light \.workspace-panel \.field,[\s\S]*?body\.theme-light \.grab-entry-panel \.field\.full\s*\{[^}]*overflow:\s*visible;/s);
  assert.match(css, /body\.theme-light \.workspace-panel \.date-input-frame,[\s\S]*?outline-offset:\s*-1px;/s);
  assert.match(css, /@media \(max-width:\s*620px\)\s*\{[\s\S]*?body\.theme-light \.workspace-panel \.date-input-frame,[\s\S]*?inline-size:\s*calc\(100% - 2px\);[\s\S]*?overflow:\s*hidden;/s);
  assert.match(css, /@media \(max-width:\s*620px\)\s*\{[\s\S]*?body\.theme-light \.workspace-panel \.date-input-frame input\[type="date"\],[\s\S]*?width:\s*100%;[\s\S]*?contain:\s*layout paint;/s);
  assert.match(css, /body\.theme-light \.workspace-panel > h3,[\s\S]*?body\.theme-light \.workspace-panel > \.history-item,[\s\S]*?margin-left:\s*var\(--record-gutter\);[\s\S]*?margin-right:\s*var\(--record-gutter\);/s);
});

test("ledger sections use bordered monthly drilldown cards", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(js, /bankTransferPanel\(bankTotals\)/);
  assert.match(js, /cashHistoryPanel\(\)/);
  assert.match(js, /class="history-card petrol-liability"/);
  assert.match(js, /function bankTransferHistory\(monthKey = selectedMonthKey\(\)\)/);
  assert.match(js, /function cashHistory\(monthKey = selectedMonthKey\(\)\)/);
  assert.match(css, /body\.theme-light \.history-card\s*\{[^}]*border:\s*1px solid rgba\(31,\s*64,\s*53,\s*0\.12\);[\s\S]*?border-radius:\s*20px;/s);
  assert.match(css, /body\.theme-light \.history-card summary\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto;/s);
  assert.match(css, /body\.theme-light \.workspace-panel \.date-input-frame,[\s\S]*?width:\s*100%;[\s\S]*?outline-offset:\s*-1px;/s);
});

test("monthly record totals use selected month instead of visible calendar month", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /function monthRecords\(monthKey = selectedMonthKey\(\)\)/);
  assert.match(js, /String\(item\.date \|\| ""\)\.startsWith\(monthKey\)/);
  assert.doesNotMatch(js, /function monthRecords\(\)\s*\{[\s\S]*visibleDate\.getFullYear/);
});

test("cash history summarizes monthly cash usage by category", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cashPanelStart = js.indexOf("function cashHistoryPanel()");
  const cashPanelBlock = js.slice(cashPanelStart, js.indexOf("function bankTransferHistory", cashPanelStart));

  assert.match(js, /function cashLedgerEffect\(item = \{\}\)/);
  assert.match(js, /function cashUsageTotals\(monthKey = selectedMonthKey\(\)\)/);
  assert.match(js, /item\.type === "cash_withdrawal"/);
  assert.match(cashPanelBlock, /const usage = cashUsageTotals\(month\);/);
  assert.match(cashPanelBlock, /Cash Usage/);
  assert.match(cashPanelBlock, /Pocket money/);
  assert.match(js, /function cashUsageBreakdown\(usage\)/);
  assert.match(js, /money\.format\(cashLedgerEffect\(item\)\)/);
  assert.match(js, /Bank In From Cash At Home/);
  assert.match(js, /Use Cash At Home/);
  assert.match(js, /const isBankIn = action\.startsWith\("Bank In"\);/);
});

test("petrol credit card card shows monthly outstanding while retaining month cost detail", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /const monthEntries = entries\.filter\(entry => String\(entry\.date \|\| ""\)\.startsWith\(month\)\);/);
  assert.match(js, /const monthPayments = payments\.filter\(item => String\(item\.date \|\| ""\)\.startsWith\(month\)\);/);
  assert.match(js, /const monthTotals = petrolTotals\(monthEntries, monthPayments\);/);
  assert.match(js, /<b>\$\{money\.format\(monthTotals\.cardOutstanding\)\}<\/b>/);
  assert.match(js, /Month Cost<\/span><strong>\$\{money\.format\(monthCost\)\}/);
  assert.match(js, /Card Charged<\/span><strong>\$\{money\.format\(monthTotals\.cardCharged\)\}/);
});

test("petrol credit card includes weekly paid tiles", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(js, /function petrolMonthWeekBuckets\(monthKey = selectedMonthKey\(\)\)/);
  assert.match(js, /const ranges = \[\s*\[\s*1,\s*7\s*\],[\s\S]*\[\s*22,\s*monthEnd\s*\]/);
  assert.match(js, /function petrolWeekSummaryMarkup\(monthKey = selectedMonthKey\(\)\)/);
  assert.match(js, /class="petrol-month-card"/);
  assert.match(js, /data-pay-petrol-week="\$\{week\.weekKey\}"/);
  assert.match(js, /source:\s*"petrol_week"/);
  assert.match(js, /state\.petrolCardPayments = state\.petrolCardPayments\.filter\(item => item\.id !== existing\.id\);/);
  assert.match(css, /\.petrol-week-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /@media \(max-width:\s*620px\)\s*\{[\s\S]*?\.petrol-week-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(css, /body\.theme-light \.petrol-week-tile\.is-paid\s*\{[^}]*background:\s*linear-gradient\(145deg,\s*#d9fff3/s);
});

test("saving keeps the current viewport instead of jumping after button actions", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /function renderPreservingViewport\(\)/);
  assert.match(js, /const x = window\.scrollX;/);
  assert.match(js, /const y = window\.scrollY;/);
  assert.match(js, /window\.scrollTo\(x, y\);/);
  assert.match(js, /focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(js, /finally\s*\{[\s\S]*?saving = false;[\s\S]*?renderPreservingViewport\(\);[\s\S]*?\}/);
  assert.doesNotMatch(js, /await persistState\(\);\s*render\(\);/);
  assert.doesNotMatch(js, /showDailySummary\(session, cashBefore\);\s*render\(\);/);
});

test("driver form asks for total trips before session times", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  const formStart = js.indexOf('<div class="form-section full">Driving Sessions</div>');
  const tripsField = js.indexOf('${field("Total Trips", "totalTrips", "number", editing.totalTrips || "")}', formStart);
  const sessionFields = js.indexOf('${sessionFields(editing)}', formStart);
  const sessionStart = js.indexOf("function sessionFields");
  const sessionBlock = js.slice(sessionStart, js.indexOf("function petrolFields", sessionStart));

  assert.notEqual(formStart, -1);
  assert.notEqual(tripsField, -1);
  assert.notEqual(sessionFields, -1);
  assert.ok(tripsField < sessionFields);
  assert.match(sessionBlock, /startTime:\s*editing\.startTime \|\| "05:00"/);
});

test("new grab records default opening balances from previous finished endings", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const sidebarStart = js.indexOf("function driverSidebar()");
  const sidebarBlock = js.slice(sidebarStart, js.indexOf("function sessionFields", sidebarStart));

  assert.match(js, /function latestGrabEndingBefore\(dateIso = selectedDate, fieldName\)/);
  assert.match(js, /item\.date < dateIso && item\.status === "Finished" && hasValue\(item\[fieldName\]\)/);
  assert.match(sidebarBlock, /const defaultTngOpening = latestGrabEndingBefore\(selectedDate, "tngClosing"\);/);
  assert.match(sidebarBlock, /const defaultSmartTagOpening = latestGrabEndingBefore\(selectedDate, "smartTagClosing"\);/);
  assert.match(sidebarBlock, /hasValue\(editing\.tngOpening\) \? editing\.tngOpening : defaultTngOpening/);
  assert.match(sidebarBlock, /hasValue\(editing\.smartTagOpening\) \? editing\.smartTagOpening : defaultSmartTagOpening/);
});

test("dashboard hero uses weekly metrics and moves monthly metrics lower", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  const dashboardStart = js.indexOf("function renderDriverDashboard()");
  const statsStart = js.indexOf("function renderGrabStats()");
  const dashboardBlock = js.slice(dashboardStart, statsStart);
  const statsBlock = js.slice(statsStart, js.indexOf("function statCard", statsStart));

  assert.match(dashboardBlock, /<span>Week Net<\/span>/);
  assert.match(dashboardBlock, /<span>All-Time Net Profit<\/span>/);
  assert.match(dashboardBlock, /<span>After Car Rental<\/span>/);
  assert.match(dashboardBlock, /<span>After Rental \+ Petrol<\/span>/);
  assert.match(dashboardBlock, /netAfterRentalAndPetrol/);
  assert.doesNotMatch(dashboardBlock, /bank\.month - dueRental/);
  assert.doesNotMatch(dashboardBlock, /<span>Month Net<\/span>/);
  assert.doesNotMatch(dashboardBlock, /<small>This month<\/small>/);
  assert.match(statsBlock, /Monthly Overview/);
  assert.match(statsBlock, /<h2>This Month<\/h2>/);
  assert.match(statsBlock, /Month Net/);
  assert.match(statsBlock, /bank\.month/);
});

test("finished grab records do not keep the driver form in edit mode", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /function selectedGrabRecord/);
  assert.match(js, /editingDriverId/);
  assert.match(js, /record\.status === "In Progress"/);
});

test("finish today opens summary without a second full render jump", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /if \(status === "Finished" && saved\) \{\s*showDailySummary\(session, cashBefore\);\s*\}/);
  assert.doesNotMatch(js, /if \(status === "Finished" && saved\) \{\s*showDailySummary\(session, cashBefore\);\s*render\(\);\s*\}/);
});

test("cash confirmation can be split between petty cash and cash at home", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /data-pending-petty/);
  assert.match(js, /data-pending-home/);
  assert.match(js, /cashPositionForm/);
  assert.match(js, /type: "cash_adjustment"/);
});

test("daily summary includes pending cash confirmations", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /function summaryPendingMarkup/);
  assert.match(js, /summaryPendingMarkup\(record\)/);
  assert.match(js, /bindPendingConfirmControls\(\$\(("#|')dailySummaryDialog/);
});

test("daily summary shows cash at home plus petty cash equation", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.doesNotMatch(js, /Previous Total Cash/);
  assert.doesNotMatch(js, /Today's Cash/);
  assert.doesNotMatch(js, /New Total Cash/);
  assert.match(js, /Cash At Home/);
  assert.match(js, /Petty Cash/);
  assert.match(js, /summary\.availablePettyCash/);
});

test("daily summary projects today's cash before cash confirmation", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /const cashPending = state\.pendingCashActions\.find/);
  assert.match(js, /const displayPettyCash = cashPending \? summary\.availablePettyCash : summary\.pettyCash/);
  assert.match(js, /const displayCashAtHome = summary\.cashAtHome/);
  assert.match(js, /const displayTotalCash = displayCashAtHome \+ displayPettyCash/);
  assert.match(js, /money\.format\(displayCashAtHome\)/);
  assert.match(js, /money\.format\(displayPettyCash\)/);
  assert.match(js, /money\.format\(displayTotalCash\)/);
});

test("put at home pending input starts blank for faster mobile entry", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /data-pending-home/);
  assert.doesNotMatch(js, /data-pending-home="\$\{item\.id\}"[^>]*value="0\.00"/);
  assert.match(js, /data-pending-home="\$\{item\.id\}"[^>]*placeholder="0\.00"/);
});

test("cash collected confirmation sets final petty cash instead of adding it twice", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /const availablePettyCash = current\.pettyCash \+ total/);
  assert.match(js, /amount: requestedPetty - current\.pettyCash/);
  assert.match(js, /amount: requestedHome/);
});

test("pending cash confirmation reads inputs from the clicked confirmation card", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /const pendingCard = button\.closest\("\.pending-item"\) \|\| root/);
  assert.match(js, /pendingCard\.querySelector\(`\[data-pending-petty="\$\{safeId\}"\]`\)/);
  assert.match(js, /pendingCard\.querySelector\(`\[data-pending-home="\$\{safeId\}"\]`\)/);
  assert.doesNotMatch(js, /const pettyInput = document\.querySelector\(`\[data-pending-petty="\$\{safeId\}"\]`\)/);
});

test("grab cash wallet shortfall is not auto-counted as top-up cost", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.doesNotMatch(js, /Grab Wallet Top-Up Cost/);
  assert.doesNotMatch(js, /<span>Grab Wallet Top-Up<\/span>/);
  assert.doesNotMatch(js, /Math\.max\(0, -walletMove\)/);
  assert.match(js, /grabWalletTopUp: 0/);
});

test("finish pending actions update changed amounts and avoid duplicate bank transfers", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /state\.pendingCashActions\[index\] = \{ \.\.\.state\.pendingCashActions\[index\], \.\.\.action, amount \};/);
  assert.match(js, /function confirmedCashAmountForRecord\(recordId\)/);
  assert.match(js, /function hasConfirmedCashForRecord\(recordId, amount = null\)/);
  assert.match(js, /function removeConfirmedCashForRecord\(recordId\)/);
  assert.match(js, /removeConfirmedCashForRecord\(record\.id\)/);
  assert.match(js, /function hasConfirmedGrabBankTransfer\(recordId, amount = null\)/);
  assert.match(js, /function removeConfirmedGrabBankTransferForRecord\(recordId\)/);
  assert.match(js, /removeConfirmedGrabBankTransferForRecord\(record\.id\)/);
  assert.match(js, /removePending\(`pending_cash_\$\{record\.id\}`\)/);
  assert.match(js, /removePending\(`pending_grab_bank_\$\{record\.id\}`\)/);
  assert.match(js, /if \(!hasConfirmedGrabBankTransfer\(action\.sourceId, action\.amount\)\) \{/);
  assert.match(js, /dedupeByKey\(Array\.isArray\(input\.bankTransfers\)/);
});

test("mobile disables canvas particle animation for smoother input", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /maxTouchPoints/);
  assert.match(js, /max-width:\s*980px/);
  assert.match(js, /canvas\.hidden = true/);
});

test("space particle animation is disabled before it starts for smoother operations", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /const disableParticles = true/);
  assert.match(js, /if \(disableParticles \|\| touchDevice \|\| compactViewport\)/);
});
