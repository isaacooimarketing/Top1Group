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

test("calendar includes a fixed weekly summary column before weekdays", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
  const js = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(css, /grid-template-columns:\s*var\(--week-summary-width\)\s+repeat\(7,/);
  assert.match(js, /class="week-summary-card/);
  assert.match(js, /weeklyTarget/);
});

test("light theme covers daily summary and breakdown panels", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /body\.theme-light \.grab-day-summary/);
  assert.match(css, /body\.theme-light \.breakdown-card/);
});
