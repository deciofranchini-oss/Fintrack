# Fintrack (GitHub Pages + Supabase) — DOCUMENTATION.md

> **Goal of this document:** give enough technical + functional context so Claude/other AIs (and humans) can safely modify the app without regressions.
>
> **Stack:** Vanilla JS SPA + Supabase Postgres (browser client) + optional PWA (Service Worker) + optional EmailJS/Chart.js/Export libs.

---

## Table of Contents

- [1. What this app is](#1-what-this-app-is)
- [2. Architecture overview](#2-architecture-overview)
- [3. Runtime boot flow](#3-runtime-boot-flow)
- [4. Project structure and responsibilities](#4-project-structure-and-responsibilities)
- [5. Global contracts and invariants (don’t break)](#5-global-contracts-and-invariants-dont-break)
- [6. Logo: ALL references and how it loads](#6-logo-all-references-and-how-it-loads)
- [7. UX / Functional documentation](#7-ux--functional-documentation)
- [8. Supabase connection and security notes](#8-supabase-connection-and-security-notes)
- [9. Database model (SQL + ERD) explained](#9-database-model-sql--erd-explained)
- [10. Config keys (app_settings + localStorage)](#10-config-keys-app_settings--localstorage)
- [11. Import / Export / Attachments](#11-import--export--attachments)
- [12. Scheduling (recurring transactions)](#12-scheduling-recurring-transactions)
- [13. Release / Deploy (GitHub Pages)](#13-release--deploy-github-pages)
- [14. Regression checklist](#14-regression-checklist)

---

## 1. What this app is

A personal/family finance PWA-like web app designed to run on **GitHub Pages** and store data in **Supabase (Postgres)**.

Core capabilities:
- Accounts + Groups (with currency support)
- Categories (hierarchy + types)
- Payees (beneficiary/source)
- Transactions (expense/income/transfer/card payment; pending/confirmed)
- Reports + exports (PDF/XLSX/CSV)
- Budgets
- Scheduled transactions + auto-register engine
- Import pipeline with staging tables
- App-wide settings + per-screen user preferences

---

## 2. Architecture overview

- **Front-end:** Vanilla JS SPA (single `index.html` containing sections for all screens)
- **Navigation:** `navigate(page)` toggles visible sections (`.page.active`, etc.)
- **State:** global `state` object in `js/app.js` used across modules
- **Backend:** Supabase Postgres accessed via `@supabase/supabase-js@2` directly in browser
- **Auth model used by front:** custom tables `app_users` + `app_sessions`
- **Optional auth present in schema but not used by front currently:** Supabase Auth (`auth.users`) + `user_profiles`
- **PWA:** `sw.js` registered from `js/app.js`

External libs (CDN):
- Supabase JS v2
- Chart.js
- html2canvas, jsPDF, jsPDF autotable
- SheetJS (xlsx)
- EmailJS

---

## 3. Runtime boot flow

Typical runtime sequence:

1) **Load HTML + scripts** (`index.html`)
2) `tryAutoConnect()` (in `js/app.js`)
   - reads `sb_url` + `sb_key` from `localStorage`
   - if present, creates Supabase client and validates it
3) If multi-user/auth is enabled:
   - tries to restore session (`ft_session_token`, `ft_user_id`)
   - if invalid -> show auth/login screen
4) If missing Supabase credentials -> show Setup screen
5) On success -> `bootApp()`:
   - `registerServiceWorkerSafe()`
   - `loadAppSettings()` and apply runtime config
   - apply logo (`setAppLogo()`)
   - load base data + render default route (usually dashboard)

---

## 4. Project structure and responsibilities

### Root
- `index.html`
  - App shell: all screens, sidebar/topbar, modals
  - Contains logo `<img>` placeholders with known IDs (see logo section)
- `sw.js`
  - PWA Service Worker cache/offline
- `logo.png`
  - local asset (but default runtime uses a URL; see logo section)

### `css/`
- `css/style.css`
  - main styling

### `js/` (loaded by `index.html`)
> **Important:** scripts are loaded as classic `<script>` (globals). Order matters.

- `js/app.js` (CORE)
  - Supabase init, boot, navigation, global `state`
  - **Logo pipeline** (`DEFAULT_LOGO_URL`, `APP_LOGO_URL`, `setAppLogo()`)
  - Service Worker registration
- `js/auth.js`
  - Custom auth using `app_users`/`app_sessions`
  - Permission flags (`can_*`)
  - Helpers: `currentUser`, `famQ()`, `famId()`
- `js/accounts.js`
  - Accounts + groups (`accounts`, `account_groups`) CRUD + rendering
- `js/categories.js`
  - Category tree CRUD + selection logic
- `js/payees.js` / `js/payee_autocomplete.js`
  - Payees CRUD + autocomplete + default category behavior
- `js/transactions.js`
  - Transaction list + filters + creation/editing
  - Transfers + card payments + status (pending/confirmed)
  - Supports grouped-by-account view and flat list view
- `js/budgets.js`
  - Budget CRUD + month/category views
- `js/dashboard.js`
  - Aggregations + charts (Chart.js)
- `js/reports.js`
  - Reporting, exports (PDF/XLSX/CSV), aggregations
- `js/scheduled.js` / `js/auto_register.js`
  - Scheduled transactions engine + occurrence generation + logs
- `js/attachments.js`
  - Storage uploads + binding into transactions
- `js/iof.js`
  - IOF logic (per-account `iof_rate` and/or defaults)
- `js/forecast.js`
  - Forecast projection (transactions + scheduled)
- `js/email.js`
  - EmailJS integration for sending reports
- `js/settings.js`
  - Loads/saves `app_settings`, handles admin-only settings UI
  - Applies `app_logo_url` to runtime (via `setAppLogo`)
- `js/import.js`
  - Import sessions + staging tables + commit workflow
- `js/backup.js`
  - backup/restore utilities + “clear data”
- `js/audit.js`
  - audit logging layer (depends on what is enabled in DB)

### Present in repo but NOT loaded by index.html (likely legacy / unused)
- `js/admin.js`
- `js/autocheck.js`
- `js/config.js`
- `js/icons.js`
- `js/utils.js`
- `js/supabase-config.js`

> Recommendation: keep them clearly marked as legacy or remove to reduce confusion and AI hallucination risk.

---

## 5. Global contracts and invariants (don’t break)

### 5.1 Global variables used across modules
- `sb` — Supabase client created by `initSupabase(url, key)`
- `state` — global UI/data state contract used by multiple modules
- `currentUser` — current logged user (from `auth.js`)
- `famQ(queryBuilder)` — applies family filter to a query
- `famId()` — returns current `family_id` for inserts

If you change names/signatures, expect cascading failures.

### 5.2 `state` contract (high regression risk)
Defined in `js/app.js`. Keys commonly used:
- `txFilter`: `{ search, month, account, type, status }`
- view modes (e.g., flat list vs grouped-by-account)
- pagination: `txPage`, `txPageSize`, `txTotal`
- sorting: `txSortField`, `txSortAsc`
- UX toggles: privacy mode, compact view, etc.

**Rule:** if you add keys, keep backward compatibility. If you rename keys, update all modules and preferences storage.

---

## 6. Logo: ALL references and how it loads

This section is intentionally explicit so no one breaks branding consistency.

### 6.1 Source of truth (runtime)
In `js/app.js`:
- `DEFAULT_LOGO_URL = 'https://deciofranchini-oss.github.io/fintrack/logo.png'`
- `APP_LOGO_URL` starts as default
- `setAppLogo(url)` updates the `src` for all logo images by ID:
  - `sidebarLogoImg`
  - `settingsLogoImg`
  - `topbarLogoImg`
  - `loginLogoImg`
  - `authLogoImg`

### 6.2 Where logo images exist (HTML IDs)
In `index.html` there are `<img>` placeholders (some with hardcoded default `src`):
- `img#authLogoImg` (auth/login screen)
- `img#loginLogoImg` (login area)
- `img#sidebarLogoImg` (sidebar)
- `img#topbarLogoImg` (top bar; may be hidden by CSS/logic)
- `img#settingsLogoImg` (settings page)

### 6.3 Logo override via DB setting
`js/settings.js` loads `app_settings`.
If key exists:
- `app_settings.key = 'app_logo_url'`
- then `setAppLogo(app_logo_url)` overrides everywhere

### 6.4 Admin UX to change logo
In `index.html`:
- `#logoSettingsSection` (admin-only)
- URL input: `#appLogoUrl`
- file input: `#appLogoFile`
- preview: `#appLogoPreview`
- actions: `saveAppLogo()` + `resetAppLogo()`

In `js/settings.js`:
- `saveAppLogo()` saves `app_logo_url` into `app_settings` and applies immediately.
- `resetAppLogo()` clears `app_logo_url` (falls back to DEFAULT_LOGO_URL).

### 6.5 Important “don’t break” rules
- Do not rename logo `<img>` IDs.
- Ensure `setAppLogo()` runs on boot and when entering auth screens.
- If you change default logo behavior, keep a fallback that works even when the app fails early.

---

## 7. UX / Functional documentation

### 7.1 Setup screen (first run)
- User inputs:
  - Supabase URL
  - Supabase anon public key
- Stored in `localStorage`:
  - `sb_url`
  - `sb_key`
- App validates connection by querying a lightweight table read.
- On success: `bootApp()`.

### 7.2 Auth (custom multi-user model)
Tables:
- `app_users` (users + roles + permissions)
- `app_sessions` (token + expiry)

Login flow:
- user enters email + password
- client computes SHA-256 hash and compares with `password_hash`
- if `approved=false` -> block with message
- if `must_change_pwd=true` -> force password update
- on success:
  - creates session record in `app_sessions`
  - stores token and user id in `localStorage`:
    - `ft_session_token`
    - `ft_user_id`

Permissions:
- enforced in UI using flags like `can_admin`, `can_edit`, etc.
- note: real security still requires DB RLS policies (see security section).

### 7.3 Navigation model
- SPA sections in `index.html`
- `navigate(pageId)` toggles visible page
- page entry may trigger data reload/render (dashboard/reports/transactions)

### 7.4 Accounts + Groups
- Accounts belong to:
  - group (`accounts.group_id`) optional
  - family (`accounts.family_id`)
- Currency handling:
  - `accounts.currency`
  - groups have `account_groups.currency`
- Balances:
  - `initial_balance` + transactions
  - may also use stored `accounts.balance` depending on module logic

### 7.5 Transactions (critical UX)
Transactions support:
- Expense / income
- Transfer (debit origin + credit destination)
- Card payment (transfer-like + categorized as card payment)
- Status:
  - `status = confirmed | pending`
  - pending should be visually separated/highlighted

Views:
- Flat list
- Grouped-by-account list (separate renderer)

Filters:
- month
- account
- search
- type
- status

Attachments:
- optional `attachment_url`, `attachment_name`

### 7.6 Categories
- Tree structure: `parent_id` self FK
- Type:
  - `despesa`, `receita`, `transferencia`
- UI must preserve tree selection + path display.

### 7.7 Payees
- Unique by name
- Type:
  - beneficiary, payer, both
- Optional default category.

### 7.8 Reports + Exports
Reports:
- group by category/payee/account/month, etc.
Exports:
- PDF: html2canvas + jsPDF (+ autotable)
- XLSX: SheetJS
- CSV: simple export

### 7.9 Preferences
Per-screen preferences can be saved:
- localStorage (primary in many flows)
- optionally `user_preferences` if enabled

---

## 8. Supabase connection and security notes

### 8.1 How it connects
- Client-side Supabase JS with anon key.
- This is normal for Supabase, but security depends on **RLS + policies**.

### 8.2 Security reality check
If RLS is not strict:
- anyone with URL + anon key can query from the browser console.

Client-side “family filters” (`famQ()`) are not security controls.
They are convenience filters only.

**Recommended approach:**
- Use Supabase Auth + RLS (strongest)
- Or enforce strict policies on `family_id` with authenticated claims

---

## 9. Database model (SQL + ERD) explained

### 9.1 Core entities
- `families`
  - tenant root; everything ties to family
- `account_groups`
  - group of accounts, includes `currency`
- `accounts`
  - holds `initial_balance`, `balance`, `currency`, `iof_rate`, `group_id`, `family_id`
- `categories`
  - hierarchical (`parent_id`) + `type`
- `payees`
  - unique names + optional default category
- `transactions`
  - main ledger; supports transfers + card payments + status + attachments

### 9.2 Budgets
- `budgets(category_id, month, amount, family_id)`

### 9.3 Scheduling
- `scheduled_transactions`
  - recurrence rules + transfer/card payment support + notifications
- `scheduled_occurrences`
  - generated occurrences; link to `transactions` when registered
- `scheduled_run_logs`
  - audit trail of runs

### 9.4 Import staging
- `import_sessions`
- `import_staging_accounts`
- `import_staging_categories`
- `import_staging_payees`
- `import_staging_transactions`

### 9.5 Users (custom auth)
- `app_users`
  - user identity + permission flags + family
- `app_sessions`
  - persistent sessions

### 9.6 Settings + preferences
- `app_settings` (key/value jsonb)
- `user_preferences` (screen/preferences jsonb)

### 9.7 Supabase Auth (parallel, not used by current front)
- `user_profiles` references `auth.users`

---

## 10. Config keys (app_settings + localStorage)

### 10.1 localStorage keys (known)
- `sb_url` — Supabase project URL
- `sb_key` — Supabase anon public key
- `ft_session_token` — custom session token
- `ft_user_id` — logged user id
- EmailJS fallback keys (if not present in DB):
  - `ej_service`
  - `ej_template`
  - `ej_key`
- UX preferences (varies by screen; check modules):
  - transaction view mode, grouping, etc.

### 10.2 app_settings keys (known / used)
- `app_logo_url` — overrides logo globally
- EmailJS:
  - `ej_service`
  - `ej_template`
  - `ej_key`
- Security / access:
  - `masterPin` (if used)
- Other feature toggles:
  - auto-register toggles
  - menu visibility options

> Note: the app typically loads up to ~200 settings keys and caches them.

---

## 11. Import / Export / Attachments

### Import
- uses `import_sessions` + staging tables
- workflow:
  1) create session
  2) parse input -> staging tables
  3) user reviews conflicts
  4) commit -> inserts into real tables

### Export
- reports can export PDF (canvas -> PDF) and XLSX (SheetJS)

### Attachments
- uploads to Supabase Storage (implementation in `js/attachments.js`)
- links stored in `transactions.attachment_url` + `attachment_name`

---

## 12. Scheduling (recurring transactions)

Tables:
- `scheduled_transactions`
- `scheduled_occurrences`
- `scheduled_run_logs`

Flow:
- define schedule rule
- engine computes next occurrences
- if auto-register enabled:
  - creates actual `transactions`
  - logs run in `scheduled_run_logs`
- optional notification by EmailJS (if configured)

---

## 13. Release / Deploy (GitHub Pages)

- App is static.
- Ensure paths use relative references (`./`) where possible.
- Service Worker is registered with `./sw.js` and scope `./` for GH Pages compatibility.

Typical deployment:
1) commit to main
2) GitHub Pages serves from repo root (or `/docs` depending configuration)
3) validate:
   - load on desktop + mobile Safari
   - first-run setup
   - service worker registers
   - supabase connection works

---

## 14. Regression checklist

Before shipping changes, validate:

### Boot / Setup / Auth
- Setup screen saves `sb_url`/`sb_key` and boots
- Auto-connect works after reload
- Multi-user login works:
  - approved vs not approved behavior
  - must-change-password behavior
  - session restoration works after refresh

### Logo consistency
- Logo shows correctly on:
  - auth screen
  - login screen
  - sidebar
  - settings page
  - topbar (if enabled)
- `app_logo_url` override applies everywhere
- reset returns to default

### Transactions (highest priority)
- Create/edit:
  - expense, income
  - transfer (debit origin + credit destination)
  - card payment (transfer-like + categorized properly)
- Status:
  - pending vs confirmed separation and visuals
- Views:
  - flat list
  - grouped-by-account view matches layout rules
- Filters + pagination + sorting work

### Accounts / Currency
- Account balances reflect initial balance + transactions
- Grouping by currency is consistent

### Reports / Export
- report filters work
- PDF export works on desktop + mobile
- XLSX export works

### Scheduling
- creating schedules works
- auto-register does not duplicate entries
- logs recorded as expected

### Import
- staging load + commit works
- conflicts handled gracefully

### PWA
- service worker registers without errors
- caching doesn’t break updates (force refresh scenario tested)

---

## Notes for AI-assisted changes

When modifying:
- keep the global contracts (`sb`, `state`, IDs, `setAppLogo`) stable
- prefer small, surgical edits
- document changes in a CHANGELOG section in your PR/commit message
- if you add settings, register them in this doc under [Config keys](#10-config-keys-app_settings--localstorage)

END.
