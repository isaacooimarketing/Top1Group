# Account, Language, And Theme Fix Implementation Plan

**Goal:** Give each account the correct product scope, independent demo data, complete English/Simplified Chinese switching, and a fully coherent light theme.

**Architecture:** A shared UI-preferences utility owns account capabilities and translations. Rendering reads the signed-in account type, then applies language and theme consistently to static and generated UI.

**Tech Stack:** Vanilla JavaScript, CSS variables, Supabase user metadata/RLS, Node test runner.

## Tasks

1. Add tested account capability and translation utilities.
2. Hide Solar for demo and driver accounts while retaining it for owner.
3. Add English/简体中文 controls to login and application headers.
4. Translate all system-owned labels, actions, statuses, summaries, dates, and errors.
5. Replace demo state with fictional presentation records.
6. Replace hard-coded dark surfaces with complete light-theme overrides.
7. Verify owner, demo, desktop, mobile, both languages, and both themes.
