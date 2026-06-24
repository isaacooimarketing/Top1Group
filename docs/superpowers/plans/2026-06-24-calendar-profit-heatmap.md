# Calendar Profit Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make daily net-profit performance immediately scannable through user-approved blue, cyan, and gold calendar tiers.

**Architecture:** Put threshold classification in a small browser/Node utility so boundary behavior is directly testable. Calendar markup receives one tier class, while CSS owns the visual treatment across desktop and mobile.

**Tech Stack:** Vanilla JavaScript, CSS, Node test runner.

---

### Task 1: Add tested profit classification

**Files:**
- Create: `public/calendar-utils.js`
- Create: `tests/calendar-profit-tier.test.js`
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] Test every threshold boundary from loss through RM300.
- [ ] Implement `profitTier(net)` and expose it to the browser.
- [ ] Apply the resulting class to finished driver calendar records.

### Task 2: Apply tier visuals and verify

**Files:**
- Modify: `public/styles.css`

- [ ] Add restrained neutral, blue, cyan, gold, and red treatments.
- [ ] Verify readable contrast on desktop and portrait mobile.
- [ ] Run all tests and syntax checks.
- [ ] Commit, push, and deploy production.
