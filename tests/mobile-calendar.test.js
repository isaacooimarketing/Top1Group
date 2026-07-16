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

test("driver dashboard shows a clean monthly operations overview", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(html, /id="driverDashboard"/);
  assert.match(js, /function renderDriverDashboard/);
  assert.match(js, /renderDriverDashboard\(\)/);
  assert.match(js, /Month Net/);
  assert.match(js, /Online Hours/);
  assert.match(js, /Cost Ratio/);
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
  assert.match(css, /body\.theme-light \.app-shell\s*\{[^}]*width:\s*min\(100%,\s*760px\)/s);
  assert.match(css, /body\.theme-light \.theme-button\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /body\.theme-light \.dashboard-net-card\s*\{[^}]*background:\s*#11844f;/s);
});

test("light calendar and form controls stay readable on mobile", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /body\.theme-light \.week-summary-card,[\s\S]*?background:\s*linear-gradient\(180deg,\s*#eef8f1,\s*#ffffff\)/);
  assert.match(css, /body\.theme-light \.driver-mini\.finished\.net-gold \.net-profit\s*\{[^}]*color:\s*#8f6900;/s);
  assert.match(css, /body\.theme-light input,[\s\S]*?body\.theme-light \.time-input-wrap\s*\{[^}]*max-width:\s*100%;/s);
  assert.match(css, /body\.theme-light \.stats-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /body\.theme-light \.bottom-nav\s*\{[^}]*bottom:\s*max\(0px,\s*env\(safe-area-inset-bottom\)\)/s);
  assert.match(css, /body\.theme-light \.topbar \.language-switch\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /body\.theme-light \.achievement-strip\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /body\.theme-light \.achievement-card\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /body\.theme-light \.lunar-note\s*\{[^}]*color:\s*#5f6f68;/s);
  assert.match(css, /body\.theme-light \.workspace-panel,[\s\S]*?body\.theme-light textarea\s*\{[^}]*box-sizing:\s*border-box;[\s\S]*?max-width:\s*100%;/s);
});

test("finished grab records do not keep the driver form in edit mode", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /function selectedGrabRecord/);
  assert.match(js, /editingDriverId/);
  assert.match(js, /record\.status === "In Progress"/);
});

test("finish today rerenders sidebar so completed inputs clear immediately", () => {
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(js, /if \(status === "Finished" && saved\) \{\s*showDailySummary\(session, cashBefore\);\s*render\(\);\s*\}/);
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
