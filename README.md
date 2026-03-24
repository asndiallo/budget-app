# Military Budget Tracker

A self-hosted personal finance app built for U.S. military service members. It understands your LES — base pay, BAH, BAS, TSP, SGLI — and puts everything in one place, on your own machine, with no subscription and no cloud.

---

## What it does

- Tracks your full military paycheck: base pay, BAH, BAS, deductions (taxes, FICA, SGLI, AFRH, TSP)
- Imports your LES directly to auto-fill income fields
- Shows what you'll earn if you get promoted to the next rank (or any rank)
- Imports credit card CSVs (Apple Card, Capital One, Navy Federal, Chase) with a review step before saving
- Tracks fixed bills, savings goals, debts with amortization, and assets
- Gives you a financial health score and month-over-month trends
- Runs entirely on your laptop — your data never leaves your machine

---

## Quick start

### Requirements

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- macOS, Linux, or Windows (WSL)

### Install and run

```bash
git clone <repo-url>
cd budget-app
bun install
bun run dev
```

Open **<http://localhost:3000>** in your browser.

> If you don't have Bun: `curl -fsSL https://bun.sh/install | bash`, then restart your terminal.

---

## First-time setup

The database and all tables are created automatically on first run — no migration command needed.

When you open the app for the first time:

1. **Log in** with the default admin account created on startup:
   - Email: `admin@example.com`
   - Password: `admin123`

   To override these, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` env vars before first run.

2. **Update your profile** — click your name in the top-right corner → Edit Profile:
   - Pay grade, branch, component (Active / Reserve / Guard)
   - Duty station — needed for accurate BAH lookup
   - Years of service and dependents

   Or skip this and use the app with default E-3 values for exploration.

3. **Go to the Income tab** and update your pay fields, or click **Import LES** to paste your LES text directly and auto-fill everything.

4. **Add your fixed expenses** — rent/mortgage (if off-base), subscriptions, car payment, etc.

5. **Import a CSV** from your credit card to load your spending history.

> **Creating your own account:** go to `/register` to sign up with your personal details. The first account is auto-promoted to admin; subsequent accounts are regular users.

That's it. The summary bar at the top will now show your income, what's committed, what you've spent, and what's left.

---

## Importing your Leave & Earnings Statement (LES)

The fastest way to fill in your income data:

1. Go to **myPay** → download or open your LES PDF
2. Press `Cmd+A` then `Cmd+C` to select and copy all the text (or save the `.txt` version)
3. In the app: **Income tab** → **Import LES** → paste the text
4. Review the extracted fields (base pay, BAH, BAS, TSP rate, deductions)
5. Confirm the month and click **Apply**

The parser handles the standard DFAS two-column myPay format and most single-column variants. If a field isn't detected, a warning tells you which one to fill in manually.

---

## Importing credit card transactions

1. Export a CSV from your card's app or website
2. **Spending tab** → **Upload CSV** → select your card as the source
3. A review grid appears — check that categories look right; uncategorized rows are highlighted
4. Fix any categories using the dropdowns, then click **Import**

Supported formats: Apple Card, Capital One, Navy Federal, Chase. Duplicate transactions are automatically skipped on re-import.

**Apple Card export:**

1. Wallet app on iPhone → tap Apple Card
2. Scroll down → Export Transactions
3. AirDrop or save to Mac → import in the app

---

## Promotion projection

Curious what your pay looks like at the next rank?

- **Income tab** → scroll to **Promotion projection**
- It defaults to your next grade in the same category (E → E, O → O)
- Change the target grade to model any scenario (e.g. commissioning from E to O)
- Adjust years of service at promotion to see how time-in affects base pay
- Shows the delta for base pay, BAS, BAH, and gross — plus TSP impact

---

## Key features by tab

### Income

- Military pay fields (base pay, BAS, BAH) — inline editable, auto-save
- LES import — paste LES text or upload `.txt` file to auto-fill
- TSP deduction — configurable rate, shown as dollar amount and percentage
- Other deductions — federal tax, FICA, SGLI, AFRH, meal deduction
- Additional income — log extra pays, side income, per diem, etc.
- Fixed expenses — recurring bills with due dates, monthly/annual toggle, investment flag
- Bill payment tracker — mark fixed bills as paid each month
- Promotion projection — side-by-side pay comparison for any rank change
- Receivables — track money others owe you

### Spending

- CSV import with category review grid
- Manual transaction entry (description, amount, category, source, notes)
- Auto-categorization rules — set keywords that automatically categorize matching transactions
- Filter by category, search across all months
- Select mode — bulk recategorize or delete multiple transactions
- Import history — view and undo past import batches
- CSV export — export filtered transactions for Excel/Sheets

### Goals

- Savings goals with target amounts and color-coded progress bars
- Log contributions with notes and timestamps
- Goal balances count toward your Net Worth automatically

### Analytics

- Spending donut by category (click to drill into Spending tab)
- 6-month income vs. spending trend
- Savings rate over time with 20% reference line
- Spending insights — 3-month and 6-month averages per category, trend direction
- Budget suggestions — set fixed or percentage-of-income budget per category

### Net Worth

- Track assets: checking, savings, brokerage, TSP/retirement, property, vehicles
- Debt tracking with amortization schedules — shows months to payoff, interest saved with extra payments
- Financial health score (0–100) across emergency fund, savings rate, debt-to-income, and investment consistency
- Year-to-date summary

### Calendar

- Monthly calendar showing pay days (1st and 15th), bill due dates, and daily spending totals
- Click any day to see transactions and bills for that day

### Keyboard shortcuts

| Key       | Action                          |
| --------- | ------------------------------- |
| `←` / `→` | Previous / next month           |
| `1` – `7` | Switch tabs (Income → Overview) |
| `/`       | Focus transaction search        |
| `?`       | Show shortcuts help             |

---

## Your data

All data is stored in `budget.db` in the project root. It never leaves your machine.

| Task             | How                                                             |
| ---------------- | --------------------------------------------------------------- |
| Backup           | Copy `budget.db`                                                |
| Restore a backup | Use **Export/Import** button in the app header (JSON format)    |
| Start fresh      | Delete `budget.db` and restart — app re-seeds with defaults     |
| Multiple users   | Supported — each user has isolated data; admin manages accounts |

---

## TSP quick reference

- Default contribution shown in the app: **5% of base pay** (the DoD match threshold)
- To change: Income tab → TSP row → edit the percentage
- Or import your LES — the rate is detected automatically from your LES deduction line
- 2026 contribution limit: **$23,500** ($31,000 if age 50+)

Common allocation (L Fund equivalent):

- C Fund 50% · S Fund 30% · I Fund 20%

## Roth IRA

Add your Roth IRA contribution as a Fixed Expense and toggle the **invest** flag. It counts toward your Invested metric and savings rate instead of regular spending.

- 2026 contribution limit: **$7,500** ($625/month)

---

## Running on a shared (home) server

If you want the app always running on a home server or NAS so any device on your network can reach it:

```bash
# Run on a specific port and bind to all interfaces
PORT=3000 bun run dev -- -H 0.0.0.0
```

Then access it from any device at `http://<server-ip>:3000`. For permanent hosting, run it as a `systemd` service or use `pm2`.

---

## Configuration

All app constants live in **`lib/config.ts`**. Edit this file to customize behavior without touching components.

| Export                | Controls                                                         |
| --------------------- | ---------------------------------------------------------------- |
| `APP_CONFIG`          | App title, subtitle, tab label                                   |
| `INCOME_FIELDS`       | Income rows — add a field here and it shows up in the Income tab |
| `TSP_CONFIG`          | Default TSP rate and fund allocation note                        |
| `DEDUCTION_FIELDS`    | Deduction rows (taxes, FICA, SGLI, etc.)                         |
| `CATEGORIES`          | Transaction categories                                           |
| `CSV_CATEGORY_MAP`    | Map source CSV categories to internal categories                 |
| `SEED_INCOME`         | Default income values on first run                               |
| `SEED_FIXED_EXPENSES` | Default fixed expenses on first run                              |

---

## Testing

```bash
bun run test             # run all tests once
bun run test:watch       # watch mode (re-runs on file change)
bun run test:coverage    # run with coverage report
```

Tests live in `lib/__tests__/` and cover all critical financial logic:

| File                 | What it tests                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pay-tables.test.ts` | `getBasePay`, `getBAS`, `getBAH`, `isOfficer`, `getRankTitle`, data integrity of all 13 installations and 24 pay grades |
| `les-parser.test.ts` | LES field extraction, date parsing, TSP rate derivation, warnings, CRLF handling                                        |
| `utils.test.ts`      | Month navigation, date comparisons, currency formatting, CSV line parsing                                               |
| `csv-utils.test.ts`  | `parseDate` (MM/DD/YYYY, ISO, edge cases), `mapCategory` (all mappings, case insensitivity, integrity check)            |
| `income.test.ts`     | `computeMonthlyFinancials` TSP math (rates, rounding, fallback), `totalIncome` field aggregation                        |
| `config.test.ts`     | Config integrity: no duplicate field keys, all color maps complete, CSV map values valid, hex color format              |

**238 tests, ~99% statement coverage** across all core libraries. Pay table assertions are pinned to exact 2026 DoD values — if rates are updated in `lib/pay-tables.ts`, the corresponding tests will fail immediately to flag the discrepancy.

---

## Tech stack

- **Next.js 16** (App Router) — frontend + API routes in one process
- **SQLite** (`better-sqlite3`) — local database, zero config
- **Tailwind CSS 4** — CSS custom property theming
- **Recharts** — charts
- **Better Auth** — session-based auth
- **TypeScript 5** — fully typed
- **Bun** — package manager and runtime
- **Vitest** — unit tests
