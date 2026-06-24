# Mobile Calendar Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the seven-column Grab calendar readable on portrait phones through horizontal scrolling without changing the desktop layout.

**Architecture:** Wrap the weekday header and calendar grid in one horizontal scroll container so they stay aligned. At phone widths, keep each day column wide enough to display the operational figures and automatically reveal the selected date.

**Tech Stack:** HTML, CSS media queries, vanilla JavaScript, Node test runner, in-app browser verification.

---

### Task 1: Add the mobile calendar viewport

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`
- Test: `tests/mobile-calendar.test.js`

- [ ] Add a failing structure test for a shared `calendar-scroll` container and mobile overflow rules.
- [ ] Wrap `.weekday-row` and `#calendarGrid` in `.calendar-scroll`.
- [ ] At widths up to 620px, enable horizontal scrolling and set both calendar rows to a shared 756px minimum width.
- [ ] Add touch momentum, scroll snapping, and a subtle edge hint.
- [ ] After rendering, scroll the selected date into the visible portion of the calendar without moving the page.
- [ ] Run automated tests and syntax checks.
- [ ] Verify portrait and desktop layouts in the browser.
- [ ] Commit, push, and deploy to production.
