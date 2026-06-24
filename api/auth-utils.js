function bearerToken(header) {
  const match = /^Bearer\s+(.+)$/i.exec(String(header || "").trim());
  return match ? match[1].trim() : "";
}

function stateQueryForUser(userId) {
  return `user_id=eq.${encodeURIComponent(userId)}&select=state,account_type`;
}

function accountEmail(accountId) {
  const normalized = String(accountId || "").trim().toLowerCase();
  if (normalized === "isaac") return "isaac@top1group.com";
  if (normalized === "demo") return "demo@top1group.com";
  return normalized.includes("@") ? normalized : "";
}

module.exports = {
  bearerToken,
  stateQueryForUser,
  accountEmail
};
