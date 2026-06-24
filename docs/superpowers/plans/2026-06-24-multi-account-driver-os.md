# Multi-Account Driver OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure the app with multi-account authentication, isolated workspaces, a presentation demo, guarded historical edits, Finish Today summaries, and petrol liabilities.

**Architecture:** Supabase Auth owns identity and sessions. A user-owned `app_state` row preserves the existing JSON architecture while RLS provides immediate tenant isolation; focused ledger fields inside each user's state support the new daily workflows without splitting the full application into many tables yet.

**Tech Stack:** Vanilla JavaScript, Node/Vercel Functions, Supabase Auth/Postgres/RLS, CSS, Node test runner.

---

### Task 1: Secure account and state foundation

**Files:**
- Create: `api/config.js`
- Create: `public/auth.js`
- Create: `tests/auth-state.test.js`
- Modify: `api/state.js`
- Modify: `server.js`
- Modify: `vercel.json`

- [ ] Add failing tests proving unauthenticated state calls are rejected and user IDs scope state.
- [ ] Add browser-safe Supabase URL and publishable-key configuration.
- [ ] Implement password session handling and bearer forwarding.
- [ ] Reject missing/invalid sessions in production state reads and writes.

### Task 2: Apply user-owned database schema

**Files:**
- Create: `supabase/migrations/20260624_multi_account_driver_os.sql`

- [ ] Add `user_id`, `account_type`, and timestamps to `app_state`.
- [ ] Add profiles with unique normalized usernames.
- [ ] Enable RLS and owner predicates.
- [ ] Add new-user workspace initialization.
- [ ] Run Supabase security and performance advisors.

### Task 3: Build the login and account UI

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`

- [ ] Build a premium responsive login screen.
- [ ] Add sign-in, driver registration, demo access, session restoration, and logout.
- [ ] Hide the OS shell until authentication succeeds.
- [ ] Seed demo data separately from owner data.

### Task 4: Protect historical record replacement

**Files:**
- Create: `public/record-utils.js`
- Create: `tests/record-replacement.test.js`
- Modify: `public/app.js`

- [ ] Detect whether the selected date has an existing record.
- [ ] Display existing-record state.
- [ ] Show before/after differences before update.
- [ ] Require confirmation and append an activity log before replacing.

### Task 5: Add Finish Today summary

**Files:**
- Create: `public/summary-utils.js`
- Create: `tests/daily-summary.test.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`

- [ ] Calculate the complete daily summary from saved data.
- [ ] Show the modal only after Finish Today succeeds.
- [ ] Include old cash, confirmed cash, new cash, petty cash, and cash at home.
- [ ] Add `View Daily Summary` for completed dates.

### Task 6: Add petrol payment and liability tracking

**Files:**
- Create: `public/petrol-utils.js`
- Create: `tests/petrol-ledger.test.js`
- Modify: `public/app.js`
- Modify: `public/styles.css`

- [ ] Store station brand and payment method per petrol entry.
- [ ] Default each driver to Petron and Credit Card while allowing alternatives.
- [ ] Calculate credit-card petrol charged, paid, and outstanding.
- [ ] Record partial payments without duplicating operating cost.
- [ ] Show weekly/monthly petrol statistics and payment history.

### Task 7: Verify and release

**Files:**
- Modify: `data/app-data.json` only if a normalized default is required.

- [ ] Run all automated tests and syntax checks.
- [ ] Verify owner, driver, and demo isolation.
- [ ] Verify desktop and mobile login, calendar, summary, and petrol flows.
- [ ] Reconcile Isaac's existing state after migration.
- [ ] Push GitHub and deploy production.
