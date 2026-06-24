const test = require("node:test");
const assert = require("node:assert/strict");

const {
  bearerToken,
  stateQueryForUser,
  accountEmail
} = require("../api/auth-utils");

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
