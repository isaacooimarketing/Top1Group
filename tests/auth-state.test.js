const test = require("node:test");
const assert = require("node:assert/strict");

const {
  bearerToken,
  stateQueryForUser,
  accountEmail
} = require("../api/auth-utils");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("bearerToken rejects missing and malformed authorization", () => {
  assert.equal(bearerToken(undefined), "");
  assert.equal(bearerToken("Basic abc"), "");
  assert.equal(bearerToken("Bearer"), "");
  assert.equal(bearerToken("Bearer signed-token"), "signed-token");
});

test("stateQueryForUser scopes state to the authenticated user", () => {
  assert.equal(
    stateQueryForUser("31a9b55e-45fd-4a0a-b673-e399bd990f20"),
    "user_id=eq.31a9b55e-45fd-4a0a-b673-e399bd990f20&select=state,account_type"
  );
});

test("account aliases map only owner and demo to internal emails", () => {
  assert.equal(accountEmail("isaac"), "isaac@top1group.com");
  assert.equal(accountEmail("DEMO"), "demo@top1group.com");
  assert.equal(accountEmail("driver@example.com"), "driver@example.com");
  assert.equal(accountEmail("unknown-driver"), "");
});

test("browser auth refreshes expired sessions instead of clearing login on reload", () => {
  const authJs = fs.readFileSync(path.join(root, "public", "auth.js"), "utf8");
  const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(authJs, /async handleUnauthorized\(\)/);
  assert.match(authJs, /if \(await this\.refreshSession\(\)\) return true;/);
  assert.match(authJs, /if \(response\.status === 401\) return this\.refreshSession\(\);/);
  assert.match(authJs, /catch\s*\{\s*return true;\s*\}/);
  assert.match(appJs, /const recovered = await authManager\?\.handleUnauthorized\?\.\(\);/);
  assert.match(appJs, /response = await fetch\("\/api\/state"/);
});
