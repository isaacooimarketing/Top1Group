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
