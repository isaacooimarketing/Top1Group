const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canAccessSolar,
  createTranslator,
  localeForLanguage,
  translateText
} = require("../public/ui-preferences");

test("only the owner account can access Solar", () => {
  assert.equal(canAccessSolar("owner"), true);
  assert.equal(canAccessSolar("demo"), false);
  assert.equal(canAccessSolar("driver"), false);
  assert.equal(canAccessSolar(undefined), false);
});

test("English and Simplified Chinese translations are reversible", () => {
  const english = createTranslator("en");
  const chinese = createTranslator("zh-CN");

  assert.equal(chinese("Finish Today"), "完成今天");
  assert.equal(chinese("Total Income"), "总收入");
  assert.equal(english("完成今天"), "Finish Today");
  assert.equal(english("总收入"), "Total Income");
});

test("Simplified Chinese covers calendar, settings, and cash operation labels", () => {
  assert.equal(translateText("Mon", "zh-CN"), "周一");
  assert.equal(translateText("Petty Cash Opening", "zh-CN"), "随身现金期初");
  assert.equal(translateText("Move Petty Cash to Home", "zh-CN"), "将随身现金转到家中");
  assert.equal(translateText("Note", "zh-CN"), "备注");
  assert.equal(translateText("This week / this month", "zh-CN"), "本周 / 本月");
  assert.equal(
    translateText("Private workspace · Secure cloud sync · Your data only", "zh-CN"),
    "私人工作空间 · 安全云端同步 · 仅限你的资料"
  );
  assert.equal(translateText("2026-06-21 · Payment", "zh-CN"), "2026-06-21 · 还款");
});

test("language selects the matching date locale", () => {
  assert.equal(localeForLanguage("en"), "en-MY");
  assert.equal(localeForLanguage("zh-CN"), "zh-CN");
});
