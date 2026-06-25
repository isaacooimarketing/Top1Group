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
  assert.match(css, /min-width:\s*756px/);
});

test("light theme covers daily summary and breakdown panels", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(css, /body\.theme-light \.grab-day-summary/);
  assert.match(css, /body\.theme-light \.breakdown-card/);
});
