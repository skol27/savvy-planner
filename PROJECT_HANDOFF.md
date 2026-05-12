# Savvy Planner Project Handoff

Last updated: 2026-05-12

## Purpose

This repo is the new frontend implementation of the user's Excel budget workbook. The goal is to preserve the existing frontend design while making the app behave like the uploaded spreadsheet and start with the spreadsheet's data already loaded.

## Current Repo Location

- Active repo: `/Users/lukasgulbinat/Documents/Budget_Planner/savvy-planner`
- Original earlier workspace path was `/Users/lukasgulbinat/Documents/New project/savvy-planner`, but the repo is now under `Documents/Budget_Planner`.
- Source workbook: `/Users/lukasgulbinat/Documents/--FINANCE STUFF/Ultimate Personal Finance Suite.xlsx`
- GitHub source requested by user: `https://github.com/skol27/savvy-planner.git`

## User Requirements From This Thread

- Analyze the Excel workbook and implement all workbook functions in the new frontend.
- Do not redesign or change the frontend visual structure beyond requested behavior changes.
- Fill in spreadsheet values so the user can start working immediately.
- Add later UI/behavior changes:
  - Color-code table values: Income green, Expenses red, Savings blue, Debt orange.
  - Improve transaction add dialog.
  - Improve budget dashboard focus/month/completion logic.
  - Add budget planner monthly totals and income-expense differences.
  - Fix net worth tracker typing while editing.
- Make the app usable independently of Codex and preserve user changes.
- Create this handoff and install a skill for future AI sessions.
- Add CSV upload on Transactions for bank/card statements:
  - Detect duplicates.
  - Review new entries one by one before adding.
  - Detect date, amount, income/expense type, and merchant/details.
  - Uploaded amounts should round to whole numbers.
  - CSV expenses should be stored with a negative amount even when the source CSV omits or inconsistently uses minus signs.

## Major Implemented Files

### Workbook-backed finance layer

- `src/lib/finance/workbookData.ts`
  - Generated extracted workbook data.
  - Includes workbook settings, categories, budget positions, net worth positions, transactions, projection assumptions, extra cash flows, and goals.
- `src/lib/finance/store.tsx`
  - Replaced mock store with workbook-seeded state.
  - Hydrates state from local file API first, browser `localStorage` second, workbook seed data third.
  - Keeps browser fallback persistence with key `savvy-planner-finance-state-v1`.
  - Exposes backup export/import and persistence status to routes.
- `src/lib/finance/persistence.ts`
  - Defines the typed persisted finance state, backup envelope, schema version, validation helpers, and backup filename helper.
- `src/lib/finance/calc.ts`
  - Added budget month/year helpers for 10-year arrays.
  - Improved latest tracked month handling.
  - Improved projection logic.
  - `fmt` rounds displayed whole-number values and applies thousands separators.
- `src/lib/finance/types.ts`
  - Adjusted comments/types around 10-year budget monthly values.

### Route/UI behavior files

- `src/routes/index.tsx`
  - Overview now uses selected/latest month budget values instead of first array value.
- `src/routes/budget.tsx`
  - Budget planner uses 10-year monthly arrays.
  - Monthly, Annual, and 10-Year views calculate correctly by selected year.
  - Added section color coding.
  - Added monthly total row per section.
  - Added Income vs Expenses table with monthly and annual differences.
- `src/routes/budget-dashboard.tsx`
  - Year/month/period logic uses workbook-backed data.
  - Month defaults to current month.
  - Focus card displays selected month for Month period.
  - Period Completion displays percent of days left in selected month.
  - Dashboard toggles and account filters work against actual data.
  - Breakdown table section values are color-coded.
  - Allocation chart segments and breakdown item names drill into Transactions with matching type/category or position and selected period date filters.
  - Breakdown table includes sync buttons for each budget section and each row. Sync asks for confirmation, then updates Budget Planner monthly values to match tracked values for the selected dashboard period.
- `src/routes/networth.tsx`
  - Added workbook-style month status logic.
  - Fixed edit fields by storing balance drafts as strings and committing on blur or Done.
- `src/routes/networth-dashboard.tsx`
  - Detail toggle supports Positions vs Categories grouping.
  - Sorting applies to grouped rows.
- `src/routes/transactions.tsx`
  - Added account/type/budget-position filters.
  - Added category filter and URL search params so dashboard drilldowns can pre-filter transactions.
  - Transaction date entry uses `dd.mm.yyyy` display/input, while stored dates remain ISO `yyyy-mm-dd`.
  - Add dialog defaults type to Expenses.
  - Amount field starts blank instead of `0`.
  - Expenses are saved negative automatically.
  - Manual and imported amounts round to whole numbers before saving.
  - Added `Add & New` to save and continue on same date.
  - Added `Upload CSV` flow for bank statements.
  - CSV parser supports comma-separated Swisscard exports with `Transaction date`, `Merchant`, `Debit/Credit`, and semicolon-separated account statements with `Amount`, `Description`, `Category`.
  - Swisscard CSV type detection uses `Debit/Credit`: `Credit` imports as income; all other rows import as expenses.
  - Account-statement CSV type detection uses `Category`: `income` imports as income; all other rows import as expenses. Raw positive `Amount` values do not imply income.
  - Imported expenses are saved as negative rounded whole numbers; imported income is saved as positive rounded whole numbers.
  - Import detects duplicates against existing transactions and within the uploaded file, skips duplicate rows, then reviews each new entry one by one before adding.
  - Import detects date, amount/type, merchant/details, and gives an initial budget-position guess where possible.
- `src/routes/settings.tsx`
  - Adds Data Backup controls.
  - Exports the full current finance state to a versioned JSON backup.
  - Imports a versioned JSON backup after previewing metadata and confirming overwrite.
  - Shows whether file persistence is saved, saving, or using browser fallback.

### Independent access

- `scripts/serve-built.mjs`
  - Custom local server for the built TanStack Start/Worker app.
  - Serves `/assets/*` from `dist/client` and sends app routes to `dist/server/index.js`.
  - Adds `GET /api/state` and `PUT /api/state` for local JSON file persistence.
  - Saves the default state file at `data/finance-state.json`, overrideable with `SAVVY_PLANNER_STATE_FILE`.
  - Needed because serving `dist/client` directly shows a directory listing and Vite/Wrangler hit local environment issues.
- `Start Savvy Planner.command`
  - Double-click macOS launcher.
  - Opens `http://127.0.0.1:4300/` and starts `scripts/serve-built.mjs`.
- `package.json`
  - Added scripts:
    - `serve:built`: `node scripts/serve-built.mjs`
    - `start:local`: `node scripts/serve-built.mjs`

## Workbook Data Extracted

From `Ultimate Personal Finance Suite.xlsx`:

- Settings:
  - startingYear: 2026
  - startingMonth: 2
  - shiftLateIncome: false
  - lateIncomeDay: 6
  - latestTrackedMode: Lazy
  - irrEcr: true
- Budget categories:
  - Income, Expenses, Savings, Debt categories from workbook.
- Asset categories:
  - 7 asset categories with ST/LT, cash, and available flags.
- Liability categories:
  - 5 liability categories.
- Budget positions:
  - 29 visible/non-empty budget rows.
  - Each has 120 monthly values for 10 years, arranged Jan-Dec per year.
  - No debt budget positions were extracted because workbook debt table rows were blank.
- Net worth positions:
  - 5 asset positions: Neon Konto, Spar Konto, IBKR Free Cash, VWCE, AMD.
  - No liabilities extracted because workbook liability table was blank.
  - Balances contain nonzero months from workbook, including 2026-01, 2026-02, 2026-03, 2026-05.
- Transactions:
  - 178 ledger rows from workbook Transactions sheet.
  - Transfer transactions have no budget position.
- Projection assumptions:
  - endYear 2090
  - outputMode InflAdj
  - extraCFMode PV
  - retirementMode PV
  - initialIncome 26000
  - expenses 24000
  - incomeGrowth 4
  - inflation 2
  - desiredExpenses 42000
  - surplusToLiab 0
  - irr 5
  - ecr 0
  - minPrincipal 0
  - birthday 2001-10-26
  - retirementYear 2066
  - retirementIncome 36000
  - retirementGrowth 2
  - taxOnLiquidation false
  - taxableFraction 0
  - taxRate 15
  - taxFreeAllowance 0
- Extra cash flows:
  - None extracted; workbook only had placeholder text.
- Goals:
  - First 100k
  - First 250k
  - First 1M
  - FIRE default

## Persistence Model

Current persistence has two layers:

1. Local file persistence through the built-app runner:
   - `GET /api/state` reads the saved backup envelope.
   - `PUT /api/state` writes the saved backup envelope atomically.
   - Default file: `data/finance-state.json`.
   - Override path: `SAVVY_PLANNER_STATE_FILE=/path/to/file.json`.
   - The file is ignored by Git.
2. Browser fallback persistence:
   - Key: `savvy-planner-finance-state-v1`.
   - Still used if the local API is unavailable.

Hydration order:

1. Local file state.
2. Browser `localStorage`.
3. Workbook seed data.

Backup/restore:

- Settings includes Export Backup and Import Backup.
- Backups use app id `savvy-planner` and schema version `1`.
- Import previews export date, transaction count, budget position count, and net worth position count before replacing current state.

Limitations:

- File persistence only works through `scripts/serve-built.mjs`; static serving or unsupported dev runners will fall back to browser storage.
- There is not yet a historical backup rotation system for automatic saves.
- There is no SQLite/database layer yet.

## How To Run Independently

Preferred double-click method:

1. Open `/Users/lukasgulbinat/Documents/Budget_Planner/savvy-planner` in Finder.
2. Double-click `Start Savvy Planner.command`.
3. Leave that Terminal window open.
4. Open `http://127.0.0.1:4300/`.

Terminal method:

```bash
cd "/Users/lukasgulbinat/Documents/Budget_Planner/savvy-planner"
npm run start:local
```

If dependencies are missing or the build is stale, run the app's build flow before starting. In this environment Bun was available at `/private/tmp/bun/bin/bun`, but on the user's machine a normal Node/Bun setup may differ.

## Validation Already Performed

- Type check passed: `/private/tmp/bun/bin/bunx tsc --noEmit`
- Production build passed: `/private/tmp/bun/bin/bun --bun run build`
- ESLint passed on touched route files after the behavior changes.
- Latest focused validation after CSV importer changes:
  - `/private/tmp/bun/bin/bunx prettier --write src/routes/transactions.tsx`
  - `/private/tmp/bun/bin/bunx tsc --noEmit`
  - `/private/tmp/bun/bin/bunx eslint src/routes/transactions.tsx`
  - `/private/tmp/bun/bin/bun --bun run build`
- Latest focused validation after backup/file persistence changes:
  - `/private/tmp/bun/bin/bunx prettier --write src/lib/finance/persistence.ts src/lib/finance/store.tsx src/routes/settings.tsx scripts/serve-built.mjs`
  - `/private/tmp/bun/bin/bunx tsc --noEmit`
  - `/private/tmp/bun/bin/bunx eslint src/lib/finance/persistence.ts src/lib/finance/store.tsx src/routes/settings.tsx`
  - `/private/tmp/bun/bin/bun --bun run build`
  - `GET /api/state` returned `204` when no state file existed.
  - `PUT /api/state` and readback succeeded against a temporary state file using `SAVVY_PLANNER_STATE_FILE=/private/tmp/savvy-planner-test-state.json`.
- Latest focused validation after `to do.md` changes:
  - `/private/tmp/bun/bin/bunx prettier --write src/lib/finance/calc.ts src/routes/budget-dashboard.tsx src/routes/transactions.tsx`
  - `/private/tmp/bun/bin/bunx tsc --noEmit`
  - `/private/tmp/bun/bin/bunx eslint src/lib/finance/calc.ts src/routes/budget-dashboard.tsx src/routes/transactions.tsx src/routes/index.tsx`
  - `/private/tmp/bun/bin/bun --bun run build`
  - Restarted built app at `http://127.0.0.1:4300/`.
- Full repo lint has many pre-existing formatting errors in untouched files, so do not treat full lint failure as necessarily introduced by this work.
- The built app was verified at `http://127.0.0.1:4300/` using the custom local runner.

## Current Runtime State

- Last known local app URL: `http://127.0.0.1:4300/`
- As of the latest handoff update, the app had been rebuilt and restarted with `node scripts/serve-built.mjs`.
- A server process may still be bound to port `4300`; check with `lsof -ti tcp:4300` before starting another one.
- If a stale server is running after a rebuild, stop it and restart `node scripts/serve-built.mjs` so new asset hashes are served.

## Known Environment Issues

- `vite dev` under normal Node can fail with Rollup native binary code-signature errors on macOS:
  - Rollup optional dependency `@rollup/rollup-darwin-arm64` loads but fails code-signature validation.
- `wrangler dev` can fail in the Codex sandbox due loopback/debug/watch restrictions.
- `vite build` may print a Wrangler log-file `EPERM` warning for `/Users/lukasgulbinat/Library/Preferences/.wrangler`; the build can still complete successfully with exit code 0.
- Serving `dist/client` directly with a static file server is wrong for this app; it produces directory listing (`.assetsignore`, `assets/`) because there is no static `index.html`.
- Use `scripts/serve-built.mjs` for local built app access.

## Current Skill Added

Installed skill:

- `/Users/lukasgulbinat/.codex/skills/savvy-planner-project`

Skill purpose:

- Tell future Codex sessions to read this handoff and understand the current repo state, data model, local runner, validation commands, persistence limitations, and change discipline.

## Change Discipline For Future Agents

- Preserve the frontend design unless the user explicitly asks for visual changes.
- Make surgical patches.
- Do not reset or delete user data.
- Treat localStorage persistence as user data.
- Before changing finance logic, inspect `src/lib/finance/types.ts`, `store.tsx`, `calc.ts`, and the relevant route.
- Keep workbook-derived seed data in `workbookData.ts`; do not manually edit it unless the change is intentional and documented.
- If editing persistence, consider migration from `savvy-planner-finance-state-v1`.
- Validate with type check and a build or touched-file lint where possible.
