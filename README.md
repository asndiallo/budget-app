# Military Budget Tracker

A self-hosted personal finance app built for U.S. military service members. It understands your LES — base pay, BAH, BAS, TSP, SGLI, allotments — and puts everything in one place, on your own machine, with no subscription and no cloud.

---

## Contents

- [Military Budget Tracker](#military-budget-tracker)
  - [Contents](#contents)
  - [Quick start](#quick-start)
  - [First-time setup](#first-time-setup)
    - [1. Log in](#1-log-in)
    - [2. Set your military profile](#2-set-your-military-profile)
    - [3. Enter your pay](#3-enter-your-pay)
    - [4. Add fixed expenses](#4-add-fixed-expenses)
    - [5. Import transactions](#5-import-transactions)
  - [Feature guide](#feature-guide)
    - [Dashboard](#dashboard)
    - [Pay tab](#pay-tab)
      - [Pay \& deductions](#pay--deductions)
      - [Tax summary](#tax-summary)
      - [Leave \& receivables](#leave--receivables)
    - [Spending tab](#spending-tab)
      - [Transactions](#transactions)
      - [Fixed bills](#fixed-bills)
      - [Budget](#budget)
      - [Calendar](#calendar)
    - [Wealth tab](#wealth-tab)
      - [Net worth](#net-worth)
      - [Goals](#goals)
      - [Analytics](#analytics)
    - [Plan tab](#plan-tab)
      - [Annual overview](#annual-overview)
      - [Projections](#projections)
      - [PCS](#pcs)
  - [Importing your LES](#importing-your-les)
  - [Importing credit card transactions](#importing-credit-card-transactions)
  - [Deployment \& income profiles](#deployment--income-profiles)
  - [Allotments](#allotments)
  - [Tax year summary](#tax-year-summary)
    - [Contribution limits (IRS 2026)](#contribution-limits-irs-2026)
  - [Keyboard shortcuts](#keyboard-shortcuts)
  - [Your data \& backups](#your-data--backups)
  - [Running on a home server](#running-on-a-home-server)
  - [Configuration](#configuration)
    - [Adding a new income field](#adding-a-new-income-field)
    - [Updating contribution limits](#updating-contribution-limits)
  - [Development](#development)
    - [Tests](#tests)
    - [Linting rules of note](#linting-rules-of-note)
    - [Project structure](#project-structure)
  - [Tech stack](#tech-stack)

---

## Quick start

**Requirements:** [Bun](https://bun.sh) (recommended) or Node.js 18+

```bash
git clone <repo-url>
cd budget-app
bun install
bun run dev
```

Open **<http://localhost:3000>** — the app is ready.

> Don't have Bun? `curl -fsSL https://bun.sh/install | bash`, then restart your terminal.

The SQLite database (`budget.db`) and all tables are created automatically on first run. No migration command needed.

---

## First-time setup

### 1. Log in

A default admin account is seeded on first startup:

| Field    | Default             |
| -------- | ------------------- |
| Email    | `admin@example.com` |
| Password | `admin123`          |

Override these before first run with environment variables:

```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=yourpassword bun run dev
```

To create your own account instead, go to `/register`.

### 2. Set your military profile

Click your name in the top-right → the profile dropdown opens. Fill in:

- **Pay grade** (E-1 through O-10, warrant officers supported)
- **Branch** and **component** (Active / Reserve / Guard)
- **Duty station** — drives BAH lookup
- **Service start date** — used for years-of-service and pre-service income zeroing
- **Dependents** — with or without, for BAH

Check **"Recalculate income from pay tables"** to auto-populate your base pay, BAS, and BAH based on 2026 DoD tables.

### 3. Enter your pay

Go to **Pay → Pay & deductions**. Either:

- Fill in the fields manually (base pay, allowances, deductions), or
- Click **Import LES** and paste your LES text to auto-fill everything in one step

### 4. Add fixed expenses

**Spending → Fixed bills**: rent/mortgage (if off-base), subscriptions, car payment, insurance, etc. Mark investment-type expenses (Roth IRA contributions) with the invest flag so they count toward savings rate rather than spending.

### 5. Import transactions

**Spending → Transactions → Upload CSV**: drag in a CSV export from your credit card. Review the category assignments before saving.

The summary dashboard is now live.

---

## Feature guide

### Dashboard

The default landing view. Shows everything at a glance for the selected month:

- **6 metric cards** — total income, invested, committed (fixed + debt payments), spending, net remaining, savings rate — each with a month-over-month delta
- **Budget allocation bar** — visual breakdown of where your income goes
- **Net worth card** — assets minus liabilities (updates live as you add/edit)
- **Financial health score** — 0–100 composite across emergency fund coverage, savings rate, debt-to-income, and investment consistency
- **Spending streak** — consecutive months at or under budget
- **Budget vs actual** — per-category spend against your configured budgets for the month

The month picker in the dashboard header controls which month all the metrics reflect.

---

### Pay tab

Everything about money coming in.

#### Pay & deductions

- **Military pay fields**: base pay, BAS, BAH, other income — inline editable, auto-saved
- **Special & incentive pays**: flight pay (ACIP), hazardous duty pay (HDZP), jump pay, hostile fire/IDP, SDAP, SRB/bonus — shown only when non-zero
- **Deductions**: Roth TSP (configurable % of base pay), federal taxes, FICA social security, FICA Medicare, SGLI, AFRH, meal deduction — all from your LES
- **Allotments**: fixed gross-pay deductions (savings allotments, loan allotments, etc.) with active date ranges — see [Allotments](#allotments)
- **Deployment / income profiles**: one-click field overrides for combat zone, TDY, or school — see [Deployment & income profiles](#deployment--income-profiles)
- **Combat zone flag**: when set, federal income tax withholding is zeroed (CZTE), and the base pay exclusion is applied to the tax year summary
- **Additional income entries**: log extra pays, per diem, side income
- **Contribution limits**: YTD progress bars for Roth TSP (elective deferral) and Roth IRA against IRS annual limits, with catch-up amounts and DoD match displayed separately

#### Tax summary

Annual tax picture for the selected year (see [Tax year summary](#tax-year-summary)).

#### Leave & receivables

- **Leave tracker**: log leave taken with dates and note; shows accrued vs used vs projected leave value in dollars
- **Receivables**: track money others owe you (split bills, reimbursements) and mark when received

---

### Spending tab

Everything about money going out.

#### Transactions

- Manual entry (description, amount, category, date, source account, notes)
- CSV import with review grid — see [Importing credit card transactions](#importing-credit-card-transactions)
- **Search** (`/` shortcut) and filter by category
- Select mode — bulk recategorize, bulk delete, or bulk link to a financial account
- Import history — view and undo past CSV import batches
- CSV export of filtered transactions for Excel / Sheets
- **Auto-match**: after import, transactions are automatically matched to fixed bills when description and amount line up — bill marked paid without manual click
- **Transaction detail drawer**: click `⋯` on any transaction to view and edit category, financial account link, and notes
- **Financial accounts**: track which specific account a transaction belongs to (Fidelity Roth IRA, USAA checking, etc.). Accounts are defined under Manage Accounts with a type and institution keyword. Transactions are auto-linked on import when the description contains the institution keyword; ambiguous matches are left unlinked. Use **Backfill** to retroactively link existing transactions.

#### Fixed bills

- Recurring expenses with due dates, monthly or annual period toggle
- Biweekly recurrence with start date anchor (e.g. every-other-Friday rent)
- Investment flag — marks an expense as savings (Roth IRA, brokerage) rather than spending
- Bill payment tracker — check off bills as paid each month; auto-matched from imports
- **Recurring detection**: scans your transaction history for repeating charges and offers to promote them to fixed bills
- **Auto-categorization rules**: define keyword → category mappings applied automatically on import

#### Budget

Per-category budget vs actual for the selected month. Set fixed-dollar or percentage-of-income budgets per category. Shows remaining / over amounts with color coding.

#### Calendar

Monthly calendar view:

- Pay days (1st and 15th) highlighted
- Bill due dates shown on their day
- Daily spending totals from transactions
- Click any day for a detail view of transactions and bills

---

### Wealth tab

Long-term financial picture.

#### Net worth

- **Trend chart**: sparkline of net worth over the last 90 days — snapshots are auto-saved whenever an asset or debt balance changes
- **Assets**: checking, savings, brokerage, TSP/retirement, property, vehicles — click a category badge to change it inline
- **Debts**: balance, interest rate, monthly payment, optional due day — shows months to payoff and projected interest paid; adjust payment to see how much interest extra payments save
- Goal balances are included in the net worth total automatically

#### Goals

- Savings goals with name, target amount, and color
- Progress bar with amount saved and amount remaining
- Log contributions with optional note and timestamp
- **Emergency fund goal**: shows a "months covered" callout (saved ÷ monthly burn rate) with color-coded status (red < 1 month, amber 1–3 months, green ≥ 3 months); smart target is 3× your combined spending + committed expenses

#### Analytics

- **YTD summary**: total income, invested, spending, and net saved for the year; month grid showing each month at a glance
- **Spending donut**: breakdown by category for the selected month — click a slice to drill into transactions for that category
- **6-month trend**: income vs spending bar chart with savings rate line and 20% reference
- **Spending insights**: 3-month and 6-month category averages, trend direction (up/down/stable), and suggested budget amounts

---

### Plan tab

Forward-looking tools.

#### Annual overview

Year-level view: quarterly summaries, month-by-month grid, category totals. Navigate between years with the year selector. Future months show projected income (based on current month's income config) and $0 spending.

#### Projections

- **Promotion projection**: side-by-side pay comparison for any rank change. Shows delta for base pay, BAS, BAH, and gross total — and what happens to TSP. Defaults to your next grade; change to model commissioning (E→O) or any scenario.
- **BRS calculator**: Blended Retirement System projection — models your TSP balance at retirement accounting for DoD matching (1% automatic + up to 4% match) and projected growth, plus the reduced pension vs legacy High-3.
- **SDP calculator**: Savings Deposit Program — models returns on deposits made while deployed to a combat zone (10% APR guaranteed).
- **GI Bill estimator**: shows monthly housing allowance (MHA) at your duty station BAH rate and tuition entitlement based on years of service.

#### PCS

PCS cost estimator and move planner:

- Select origin and destination installations
- Shows BAH difference at new duty station (immediate pay impact)
- DITY/PPM weight allowance by grade and dependency status
- Estimated DITY reimbursement vs government move cost

---

## Importing your LES

The fastest way to populate your income data.

1. Go to **myPay** → open or download your LES
2. Select all text (`Cmd+A`) and copy (`Cmd+C`), or save the `.txt` version
3. In the app: **Pay → Pay & deductions → Import LES** → paste the text
4. Review the extracted fields — the parser shows a warning for any field it couldn't detect
5. Confirm the month and click **Apply**

The parser handles the standard DFAS two-column myPay format and most single-column variants. Detected fields include: base pay, BAS, BAH, TSP rate and dollar amount, federal taxes, FICA social security, FICA Medicare, SGLI, AFRH, meal deduction, and leave balance.

---

## Importing credit card transactions

1. Export a CSV from your card's website or app
2. **Spending → Transactions → Upload CSV** → select your card format
3. A review grid appears — rows with unrecognized categories are highlighted
4. Adjust categories using the dropdowns in the grid
5. Click **Import** — duplicates are automatically skipped

**Supported formats**: Apple Card, Capital One, Navy Federal, Chase

**Apple Card export on iPhone**: Wallet → tap Apple Card → scroll down → Export Transactions → AirDrop to Mac

After import, the app automatically matches transactions against your fixed bills using keyword and amount matching. Bills with confident matches are marked paid without any manual step.

---

## Deployment & income profiles

Income profiles let you define a named set of field overrides (e.g. combat zone pays, TDY per diem) with a date range and apply them to any month in one click.

**Creating a profile:**

1. **Pay → Pay & deductions → ⇄ Profiles** → **New profile**
2. Choose a type — preset types auto-populate default fields:
   - **Combat Zone** — pre-fills hostile fire/IDP ($225/mo) and sets the combat zone flag
   - **TDY** — prompts you to add per diem as other income
   - **School / Training** — use for BAH overrides if in government quarters
   - **Custom** — any combination of fields
3. Set a date range (start month, optional end month)
4. Adjust field overrides — add or remove any of the 18 income config fields

**Applying a profile:**
Active profiles (those whose date range includes the current month) appear as banners above the pay fields. Click **Apply** to merge the profile's field overrides into that month's income config.

---

## Allotments

Allotments are fixed amounts automatically deducted from your gross pay before it hits your bank account — like TSP but for savings allotments, loan repayments, or family support.

**Adding an allotment**: **Pay → Pay & deductions → Allotments** → **New allotment**. Set the label, amount, type (savings / loan / family / insurance / charity / other), and a start month. Add an end month when it stops; leave blank for ongoing.

Active allotments appear as read-only rows in the deductions section of your pay panel and are subtracted from net income in all summary calculations.

---

## Tax year summary

**Pay → Tax summary** shows an estimated annual picture for federal tax purposes.

| Section                  | What's included                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Gross income             | Base military pay + special/incentive pays + allowances (BAH/BAS shown separately as non-taxable per 26 U.S.C. §134)  |
| Pre-tax deductions       | SGLI + AFRH + meal deduction only — Roth TSP is post-tax and does not reduce taxable income                           |
| Combat zone exclusion    | Base pay months in a designated combat zone (CZTE) — enlisted base pay excluded from federal income                   |
| Taxes withheld           | Federal income tax (zeroed for combat zone months), FICA social security, FICA Medicare                               |
| Estimated taxable income | Base + special pays − pre-tax deductions − combat exclusion                                                           |
| Post-tax Roth savings    | Roth TSP contributions (computed from your TSP rate × base pay) + Roth IRA (from fixed expenses tagged as investment) |

The **effective federal rate** and **total tax burden** cards show your withholding efficiency at a glance.

> This is an estimate based on your income entries and is not tax advice. Use your official W-2 and LES for filing. Consult a tax professional for complex situations.

### Contribution limits (IRS 2026)

| Account                      | Base limit | Catch-up (age 50+)           |
| ---------------------------- | ---------- | ---------------------------- |
| Roth TSP (elective deferral) | $24,500    | $32,500 total ($8,000 extra) |
| Roth IRA                     | $7,500     | $8,600 total ($1,100 extra)  |

> **SECURE 2.0 note**: ages 60–63 qualify for a higher TSP super catch-up: $35,750 total in 2026.

DoD automatic contributions (1%) and matching (up to 4%) are shown separately and do not count against the elective deferral limit.

**IRA tracking priority** (highest wins):
1. Actual transactions linked to a `roth_ira` or `trad_ira` financial account — most accurate
2. Fixed expenses labeled with "roth" or "ira" keywords — fallback when accounts aren't linked
3. `roth_ira` field in income config — last resort estimate

---

## Keyboard shortcuts

| Key       | Action                                                   |
| --------- | -------------------------------------------------------- |
| `←` / `→` | Previous / next month                                    |
| `1`       | Dashboard                                                |
| `2`       | Pay                                                      |
| `3`       | Spending                                                 |
| `4`       | Wealth                                                   |
| `5`       | Plan                                                     |
| `/`       | Focus transaction search (opens Spending → Transactions) |
| `?`       | Show / hide shortcuts overlay                            |
| `Esc`     | Close overlay                                            |

---

## Your data & backups

All data is stored in `budget.db` (SQLite) in the project root. It never leaves your machine.

| Task              | How                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------- |
| Manual backup     | Copy `budget.db` to a safe location                                                   |
| In-app backup     | UserNav (top-right) → **Export backup** — downloads a JSON snapshot                   |
| Restore from JSON | UserNav → **Restore** → select the `.json` file                                       |
| Start fresh       | Delete `budget.db` and restart — tables and seed data are recreated                   |
| Multiple users    | Supported — each user has fully isolated data; admins can manage accounts at `/admin` |

**Recommended backup schedule**: export a JSON backup after each pay period so you have a recoverable point if something goes wrong.

---

## Running on a home server

To access the app from any device on your home network (phone, tablet, other laptop):

```bash
# Allow connections from any IP on port 3000
bun run dev -- -H 0.0.0.0
```

Then open `http://<your-computer-ip>:3000` on any local device. Find your IP with `ipconfig getifaddr en0` (macOS) or `ip route get 1 | awk '{print $7}'` (Linux).

**To add your local IP to the allowed origins** (required for hot-reload in dev):

```js
// next.config.js
const nextConfig = {
  allowedDevOrigins: ['192.168.1.x'], // replace with your machine's LAN IP
};
```

**Permanent hosting** (always-on, starts on boot):

```bash
# Using PM2
bun add -g pm2
pm2 start "bun run start" --name budget-app
pm2 save && pm2 startup
```

Or as a `systemd` service — create `/etc/systemd/system/budget-app.service`:

```ini
[Unit]
Description=Military Budget Tracker
After=network.target

[Service]
WorkingDirectory=/path/to/budget-app
ExecStart=/home/<user>/.bun/bin/bun run start
Restart=always
User=<user>

[Install]
WantedBy=multi-user.target
```

Then: `sudo systemctl enable --now budget-app`.

---

## Configuration

All constants live in **`lib/config.ts`** — edit this file to customize the app without touching components.

| Export                         | Controls                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `APP_CONFIG`                   | App title, subtitle shown in header                                              |
| `INCOME_FIELDS`                | Income rows shown in the Pay panel — add a key here and it appears automatically |
| `SPECIAL_PAY_FIELDS`           | Special pay rows (flight, IDP, SDAP, etc.)                                       |
| `TSP_CONFIG`                   | Default TSP contribution rate and display note                                   |
| `DEDUCTION_FIELDS`             | Deduction rows (taxes, FICA, SGLI, AFRH, meal)                                   |
| `CONTRIBUTION_LIMITS`          | IRS/TSP annual limits by year — update each January                              |
| `INCOME_PROFILE_TYPES`         | Preset profile types with default field overrides                                |
| `INCOME_PROFILE_FIELD_OPTIONS` | Available fields in the profile override editor                                  |
| `CATEGORIES`                   | Transaction categories shown in dropdowns                                        |
| `CSV_CATEGORY_MAP`             | Maps source CSV category strings to internal categories                          |
| `ASSET_CATEGORIES`             | Asset types shown in the Net Worth panel                                         |
| `GOAL_COLORS`                  | Available colors for savings goals                                               |
| `SEED_INCOME`                  | Default income values loaded on first run                                        |
| `SEED_FIXED_EXPENSES`          | Default fixed expenses loaded on first run                                       |

### Adding a new income field

1. Add an entry to `INCOME_FIELDS` or `SPECIAL_PAY_FIELDS` in `lib/config.ts`
2. Add the key to `income_config` usage in `app/api/income/route.ts` if you want it persisted differently
3. The field appears automatically in Pay → Pay & deductions

### Updating contribution limits

Edit `CONTRIBUTION_LIMITS` in `lib/config.ts` when the IRS announces new limits (usually November):

```ts
export const CONTRIBUTION_LIMITS = {
  2026: { tsp: 24_500, tspCatchup: 32_500, ira: 7_500, iraCatchup: 8_600 },
  2027: { tsp: ...,   tspCatchup: ...,     ira: ...,   iraCatchup: ...    },
};
```

---

## Development

```bash
bun run dev          # start dev server with hot reload
bun run build        # production build
bun run start        # run production build

bun run lint         # ESLint — check for errors
bun run lint:fix     # ESLint — auto-fix import order and type imports
bun run format       # Prettier — format all files
bun run format:check # Prettier — check formatting without writing

bun run test         # run all tests once
bun run test:watch   # watch mode
bun run test:coverage # coverage report (lcov + text)
```

### Tests

410 tests across 12 test files in `lib/__tests__/`:

| File                      | What it covers                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pay-tables.test.ts`      | `getBasePay`, `getBAS`, `getBAH`, `getRankTitle` — pinned to exact 2026 DoD values for all grades and installations                                                                                                   |
| `les-parser.test.ts`      | Field extraction, date parsing, TSP rate derivation, partial LES, CRLF handling, warning generation                                                                                                                   |
| `utils.test.ts`           | Month navigation, date comparisons, currency formatting, projected spend                                                                                                                                              |
| `csv-utils.test.ts`       | `parseDate` (all formats + edge cases), `mapCategory` (all mappings, case-insensitive matching)                                                                                                                       |
| `income.test.ts`          | TSP math (rates, rounding, fallback), total income aggregation, edge cases                                                                                                                                            |
| `brs-calc.test.ts`        | BRS pension and TSP projections, DoD match ladder, High-3 vs BRS comparison                                                                                                                                           |
| `config.test.ts`          | Structural integrity — no duplicate keys, all color maps complete, contribution limits year-over-year, profile presets, field option groups                                                                           |
| `bill-match.test.ts`      | Keyword extraction, description matching, amount tolerance ($2 absolute / 10% relative), `autoMatchBills` with in-memory SQLite — match/no-match, biweekly skip, idempotency, multi-month, multi-bill, user isolation |
| `financials.test.ts`      | Canonical savings rate formula — all input combinations including zero income, overspend, TSP-only, and typical military paycheck scenarios                                                                            |
| `categorization.test.ts`  | `categorizeTransaction` priority chain (rules → explicit → investment keywords → CSV map → default); `detectAccountId` unambiguous-match and conflict behavior                                                        |
| `queries.test.ts`         | All shared DB query helpers — return shapes, zero-result handling, and correct SQL branching via lightweight DB mocks                                                                                                  |
| `debt-match.test.ts`      | Debt payment detection and balance application                                                                                                                                                                        |

Pay table assertions are pinned to exact 2026 DoD values — if rates change in `lib/pay-tables.ts`, the tests fail immediately.

### Linting rules of note

| Rule                      | Level | Reason                                                                                     |
| ------------------------- | ----- | ------------------------------------------------------------------------------------------ |
| `no-floating-promises`    | error | Unhandled promise rejections are real bugs; use `void` for intentional fire-and-forget     |
| `no-unsafe-assignment`    | warn  | `better-sqlite3` returns `any` from `.all()/.get()` — library limitation, not a code smell |
| `require-await`           | off   | Sync SQLite ops inside async Next.js route handlers is the normal pattern                  |
| `consistent-type-imports` | error | Enforces `import type { Foo }` — auto-fixable with `lint:fix`                              |
| `no-autofocus`            | warn  | `autofocus` is good UX for modal forms                                                     |

### Project structure

```txt
app/
  api/               # Next.js route handlers (one folder per resource)
  components/        # React components
  page.tsx           # Main app shell — tab routing and top-level state
  layout.tsx         # Root layout with theme and auth middleware
lib/
  config.ts          # All hardcoded values — single source of truth
  db.ts              # SQLite setup, schema init, migrations
  types.ts           # Shared TypeScript interfaces
  api.ts             # Typed client-side API wrappers (server-agnostic)
  queries.ts         # Shared DB query helpers — one function per query pattern
  financials.ts      # Canonical savings rate formula (computeSavingsRate)
  categorization.ts  # Transaction categorization + account detection
  income.ts          # Monthly income computation, yearly config lookup
  utils.ts           # Date/month helpers, biweekly period math, formatting
  pay-tables.ts      # 2026 DoD pay table data
  les-parser.ts      # LES text parser
  bill-match.ts      # Transaction → fixed bill auto-matching
  csv-utils.ts       # CSV date parsing and category mapping
  brs-calc.ts        # BRS / legacy retirement calculator
  __tests__/         # Vitest test files (mirrors lib/ structure)
```

---

## Tech stack

| Layer      | Choice                                      | Why                                                       |
| ---------- | ------------------------------------------- | --------------------------------------------------------- |
| Framework  | Next.js 16 (App Router)                     | API routes + frontend in one process; no separate backend |
| Database   | SQLite via `better-sqlite3`                 | Zero config, single file, runs on any machine             |
| Auth       | Better Auth                                 | Session-based, no external service                        |
| Styling    | Tailwind CSS 4                              | CSS custom property theming (light/dark/system)           |
| Charts     | Recharts                                    |                                                           |
| Date math  | date-fns                                    |                                                           |
| Runtime    | Bun                                         | Fast installs and startup                                 |
| Testing    | Vitest                                      | Native TypeScript, fast                                   |
| Linting    | ESLint 10 (flat config) + typescript-eslint | Type-aware rules                                          |
| Formatting | Prettier + prettier-plugin-tailwindcss      | Auto-sorts Tailwind classes                               |
