# CLAUDE.md — codebase guide for AI coding sessions

This file provides the context an AI assistant needs to work correctly in this codebase. Read it before making any backend changes.

---

## Project in one sentence

A self-hosted military personal finance app (Next.js + SQLite) built for a single user — an Air Force E-3 4N0 at JBSA Fort Sam Houston using the Blended Retirement System.

---

## Non-negotiable rules

- **Never commit** unless the user explicitly asks.
- **Never mock the database in API route tests.** Bill-match tests use an in-memory SQLite instance. Other DB-dependent logic is tested through pure function extraction.
- **Run `npx tsc --noEmit && npm test` before calling any work done.** Both must be clean.
- **No new dependencies** unless the user approves — this app is intentionally lean.
- **Do not add comments or docstrings to code you didn't change.**
- **Do not speculate about future features** — implement exactly what was asked.

---

## Architecture

```txt
app/api/<resource>/route.ts   — Next.js route handlers, one folder per resource
app/components/               — React client components
lib/                          — Shared server + client logic (see module guide below)
```

Auth is handled by [Better Auth](https://better-auth.com). Every API route must be wrapped with `withAuth` from `lib/route-helpers.ts`:

```ts
export const GET = withAuth(async (req, { userId, db }) => { ... });
```

`userId` and `db` (a `better-sqlite3` connection) are injected — never open a separate connection inside a route.

---

## Key lib modules — what lives where

| Module                  | Responsibility                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `lib/config.ts`         | Every hardcoded constant. To add a category, field, or limit — edit only this file                                         |
| `lib/db.ts`             | Schema init + migrations. All `CREATE TABLE` and `ALTER TABLE` live here                                                   |
| `lib/types.ts`          | All shared TypeScript interfaces                                                                                           |
| `lib/api.ts`            | Client-side typed wrappers around `fetch`. No server logic here                                                            |
| `lib/queries.ts`        | Shared DB query helpers — all commonly repeated SQL patterns extracted here                                                |
| `lib/financials.ts`     | Canonical savings rate formula — `computeSavingsRate` and `computeSavingsRatePct`                                          |
| `lib/categorization.ts` | `categorizeTransaction` and `detectAccountId` — shared by all ingestion paths                                              |
| `lib/income.ts`         | `computeMonthlyFinancials`, `incomeForMonth`, `buildYearlyConfigLookup`                                                    |
| `lib/utils.ts`          | Pure date/month/formatting helpers. Also: `prevMonths`, `lastCompleteMonths`, `countBiweeklyPeriods`, `investmentForMonth` |
| `lib/pay-tables.ts`     | 2026 DoD pay table data — do not hand-edit; update from official DoD tables                                                |
| `lib/les-parser.ts`     | LES text → income config field extraction                                                                                  |
| `lib/bill-match.ts`     | Auto-matches imported transactions to fixed bills                                                                          |
| `lib/csv-utils.ts`      | CSV date parsing and bank category → internal category mapping                                                             |
| `lib/brs-calc.ts`       | BRS retirement projection math                                                                                             |

---

## The canonical savings rate formula

**This is the single source of truth. Do not deviate from it.**

```ts
// lib/financials.ts
rate = (invested + max(0, net)) / income
// where:
net     = income - invested - spending
invested = TSP + investmentForMonth(investmentExpenses, month) + investmentCategoryTxs
spending = all transactions EXCLUDING the Investment category
```

- Used in: `overview`, `ytd`, `health-score`, `analytics`, `streak`
- Always call `computeSavingsRate` / `computeSavingsRatePct` from `lib/financials.ts`
- Never reimplement this inline in a route

The `INVESTMENT_CATEGORY` constant (`'Investment'`) must always be excluded from `spending` and added to `invested`.

---

## Pre-service data (`joined_at`)

Users may have transaction history from before their military service. `joined_at` (stored as `YYYY-MM` in the `users` table) marks the start of service.

**Any calculation over multiple months must filter pre-service months:**

```ts
import { getJoinedAt } from '@/lib/queries';
import { isBeforeMonth } from '@/lib/utils';

const joinedAt = getJoinedAt(db, userId);
for (const month of months) {
  if (joinedAt && isBeforeMonth(month, joinedAt)) continue; // skip pre-service
  // ...
}
```

Routes that do this correctly: `overview`, `ytd`, `health-score`, `insights`, `streak`, `contribution-limits`.

---

## Financial accounts

The `financial_accounts` table stores user-defined accounts (Fidelity Roth IRA, USAA checking, etc.) with:

- `type`: `'roth_ira' | 'trad_ira' | 'hsa' | '529' | 'brokerage' | 'checking' | 'savings' | 'money_market' | 'other'`
- `institution`: keyword string matched case-insensitively against transaction descriptions

Transactions have an `account_id FK → financial_accounts`. Auto-detection (one unambiguous match only) runs on:

- Manual transaction entry (`api/transactions POST`)
- CSV import (`api/csv-import POST`)
- Backfill action (`api/financial-accounts POST { action: 'backfill' }`)

Always use `detectAccountId` from `lib/categorization.ts` — never reimplement the matching logic.

---

## Transaction categorization

Always use `categorizeTransaction` from `lib/categorization.ts`. Priority (highest wins):

1. User keyword rules (`lib/queries.ts → getUserCategorizationRules`) — CSV import path
2. Explicit non-default category — manual entry path
3. Investment keyword detection (INVESTMENT_KEYWORDS from config)
4. CSV category string via `mapCategory`
5. `DEFAULT_CATEGORY` fallback

**For manual entry** (transactions POST): `categorizeTransaction(description, { explicitCategory: category })`
**For CSV import** (csv-import POST): `categorizeTransaction(description, { csvCategory: row.category, rules: userRules })`

---

## Shared DB query helpers (`lib/queries.ts`)

Do not write inline SQL for these patterns — use the shared helpers:

```ts
getJoinedAt(db, userId)
getInvestmentExpenses(db, userId)
getActiveDebtPaymentsTotal(db, userId)
getMonthSpending(db, userId, month, excludeCategory?)
getMonthCategoryTotal(db, userId, month, category)
getSpendingByMonth(db, userId, months, excludeCategory?)
getCategoryTotalByMonth(db, userId, months, category)
getLiquidAssets(db, userId)
getAccountsForDetection(db, userId)
getUserCategorizationRules(db, userId)
```

---

## Biweekly recurrence

Fixed expenses and IRA contributions can recur biweekly (every 2 weeks). The amount is per-occurrence, not monthly — some months get 2 occurrences, some get 3.

**Always use the shared helpers — never multiply by 2 or use a flat monthly average:**

- `investmentForMonth(expenses, month)` — counts biweekly hits in a calendar month
- `countBiweeklyPeriods(year, anchor, endDate, cutoff)` — counts hits in a year up to a cutoff date

Both are in `lib/utils.ts`.

---

## Yearly income config carry-forward

Income config is stored as snapshots (`income_config` table, keyed by `user_id + month + key`). A month with no row inherits the most recent prior config — **within the same year only** (cross-year carry-forward is intentionally excluded).

Use `buildYearlyConfigLookup(db, userId, year)` from `lib/income.ts`. It returns a `fieldsFor(month)` function. Do not reimplement this in routes.

---

## Month helpers (`lib/utils.ts`)

```ts
prevMonths(to, count); // count months ending AT `to`, chronological order
lastCompleteMonths(n); // n months ending last month, reverse-chronological (newest first)
formatMonthShort(month); // "Jan '26" — for chart labels
formatMonthLabel(month); // "Jan 2026" — for display text
isBeforeMonth(month, boundary);
currentMonth();
prevMonth(month);
nextMonth(month);
```

---

## Database migrations

All schema changes go in `lib/db.ts` inside `initSchema()`. Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` style guards so they're idempotent. Never create a separate migration file.

---

## Testing conventions

**Test runner:** Vitest. Files live in `lib/__tests__/`.

**DB mocking pattern** (lightweight, used in `queries.test.ts` and `income.test.ts`):

```ts
function makeDb(rows) {
  return {
    prepare: () => ({ get: () => rows[0], all: () => rows }),
  } as unknown as ReturnType<typeof import('../db').getDb>;
}
```

For tests that need real SQL (joins, transactions, etc.), use `better-sqlite3` with `:memory:` and call `initSchema()` — see `bill-match.test.ts` as the reference.

**Tests must:**

- Cover zero/empty inputs
- Cover the happy path with realistic values
- Assert exact types and shapes, not just truthiness
- Never depend on the current date (freeze or parameterize time)

---

## Type conventions

- All API route response bodies must match a type exported from `lib/types.ts`
- Use `import type { ... }` for type-only imports (enforced by ESLint)
- `better-sqlite3` returns `unknown` from `.all()/.get()` — always cast: `.get(...) as { field: type }`
- Prefer `Record<string, number>` over `{ [key: string]: number }` — they're identical but the former is more readable

---

## ESLint / formatting

```bash
npm run lint         # check
npm run lint:fix     # auto-fix imports
npm run format       # Prettier
```

Import order is enforced (Next → React → third-party → @/ aliases → relative). Run `lint:fix` after adding imports.

---

## What NOT to do

- Do not add `try/catch` inside API routes — `withAuth` and Next.js handle unhandled exceptions
- Do not use `Math.round` on the savings rate before it reaches the final response — keep full precision for intermediate calculations
- Do not use `async/await` in SQLite calls — `better-sqlite3` is synchronous by design
- Do not call `incomeForMonth` directly in a route that already calls `computeMonthlyFinancials` — the latter already calls the former
- Do not add a `DEDUCTION_FIELDS.reduce(...)` block to compute a savings rate — that approach was removed as broken (it subtracted tax deductions from income before computing savings, which is wrong)
