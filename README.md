# Budget Tracker — Personal Military Finance App

A self-hosted personal finance app built specifically for U.S. military service members. Tracks pay, deductions, fixed expenses, spending, savings goals, debts, assets, and investments — all in one place, with no cloud dependency.

---

## Stack

- **Next.js 16** (App Router) — frontend + API routes in one process
- **SQLite** (`better-sqlite3`) — local persistent database, zero config
- **Tailwind CSS 4** — styling with CSS custom property theming
- **Recharts** — charts and analytics
- **TypeScript 5** — fully typed throughout
- **Bun** — package manager and runtime

---

## Setup

### Requirements

- Node.js 18+ or Bun runtime
- If using mise: `mise use node@20`

### Install & run

```bash
bun install
bun run dev
```

Open → <http://localhost:3000>

On first run the app seeds default military pay data (E-3) and creates an `admin` account. Log in and update your profile to match your pay grade, branch, and duty station.

### Your data

All data lives in `budget.db` in the project root.

- **Backup**: copy `budget.db`
- **Reset**: delete `budget.db` and restart — re-seeds defaults automatically
- **Full export/restore**: use the JSON backup button in the app header

---

## Features

### Income tab

- **Military pay fields** — Base pay, BAS, BAH, and Other; all inline-editable, auto-save on blur
- **TSP** — auto-calculated at 20% of base pay (configurable); fund allocation displayed (C/S/I)
- **Payroll deductions** — Federal taxes, FICA (Social Security + Medicare), SGLI, AFRH, meal deduction
- **Monthly income entries** — log additional income sources (e.g. extra BAH, special pays) per month
- **Fixed expenses** — recurring bills with monthly or annual periods; each expense shows the monthly equivalent for annual ones; due-day badge (e.g. "due 15th") for calendar integration; inline notes; toggle individual expenses as **investments** (Roth IRA, brokerage contributions, etc.) so they count toward the Invested metric and savings rate rather than regular committed expenses
- **Recurring detection** — automatically scans 6 months of transaction history and surfaces charges that appear consistently (Netflix, gym, etc.) as candidates to promote to Fixed Expenses
- **Receivables** — track money owed to you; record partial payments; marks as fully paid automatically

### Spending tab

- **CSV import** — import transactions from any card CSV; Apple Card categories are auto-mapped to budget categories; duplicate detection prevents re-importing the same transactions
- **Import history** — view past imports with date ranges; delete an entire import batch to undo it
- **Manual transactions** — add transactions with description, amount, category, date, source, and optional notes; 6-second undo toast after adding
- **Filter & search** — filter by category or search by description across all months
- **CSV export** — export the currently filtered transaction list as a CSV for Excel/Sheets analysis
- **Payment sources** — manage your card/source list; used as labels on transactions

### Goals tab

- **Savings goals** — name, target amount, color-coded progress bar
- **Contribution history** — log each time you add funds with an optional note; full history per goal with timestamps; delete individual contributions (automatically reverses the amount)
- **Net Worth integration** — goal savings are included in the Net Worth calculation automatically; no duplicate entry needed

### Analytics tab

- **Spending donut** — current month's spending breakdown by category; click a slice to filter the Spending tab
- **Income · Spending · Net area chart** — 6-month trend
- **Spending by category bar chart** — stacked 6-month breakdown; click a bar segment to drill into that category
- **Savings rate line chart** — monthly savings rate over time with a 20% reference line
- **Spending insights** — category-level averages (3-month and 6-month), trend direction (↑↓ stable), and a suggested monthly budget per category

### Net Worth / Assets tab

- **Assets** — track checking, savings, brokerage, retirement, property, vehicle, and other assets; inline balance editing
- **Debts** — loans with balance, monthly payment, and interest rate; paid-off debts (balance = 0) are excluded from the Committed total automatically
- **Financial health score** — composite 0–100 score across emergency fund coverage, savings rate, debt-to-income, net worth trend, and investment consistency
- **YTD summary** — year-to-date totals for income, invested, spending, and net saved

### Calendar tab

- **Monthly cash flow calendar** — grid view of the current month showing:
  - Green chips on military pay days (1st and 15th)
  - Blue chips for bill due dates (from fixed expenses with a due day set)
  - Red daily spending totals from transactions
- Click any day to see a breakdown of that day's transactions and bills

### Global

- **Summary bar** — 5 metric cards always visible: Total Income · Invested (TSP + investment fixed expenses) · Committed (fixed expenses + active debt payments) · Spending · Net remaining; each card shows a delta vs. the prior month
- **Budget allocation bar** — visual breakdown of income: Invested / Committed / Spending / Net
- **Month selector** — navigate any month/year; all data is month-scoped
- **Theme** — follows the OS/browser preference by default; toggle manually; preference is saved
- **Multi-user** — each user has their own isolated data; admin can manage users; role-based access (admin / user / viewer)
- **Backup & restore** — full JSON export/import from the header

---

## CSV import

Any card CSV is supported. Apple Card format is natively mapped. For other cards, map their category names in `CSV_CATEGORY_MAP` in `lib/config.ts`.

**Apple Card export steps:**

1. Open **Wallet** on iPhone → tap Apple Card
2. Scroll to bottom → **Export Transactions**
3. AirDrop or save the CSV to your Mac
4. In the app: Spending tab → **Upload CSV** → select source card

---

## Configuration

All hardcoded values live in **`lib/config.ts`**. Edit that file to customize without touching components.

| Export                 | What it controls                                                              |
| ---------------------- | ----------------------------------------------------------------------------- |
| `APP_CONFIG`           | App title, subtitle, transactions tab label                                   |
| `INCOME_FIELDS`        | Income rows — add a field here and it appears in the Income tab automatically |
| `TSP_CONFIG`           | TSP contribution rate and fund allocation note                                |
| `DEDUCTION_FIELDS`     | Payroll deduction rows (taxes, FICA, SGLI, etc.)                              |
| `CATEGORIES`           | Transaction category list                                                     |
| `CAT_COLORS`           | Tailwind badge classes per category                                           |
| `CHART_CAT_COLORS`     | Hex colors for Recharts charts per category                                   |
| `CSV_CATEGORY_MAP`     | Source CSV category → internal category mapping                               |
| `GOAL_COLORS`          | Available goal color palette                                                  |
| `SEED_INCOME`          | Default income values seeded on first run                                     |
| `SEED_FIXED_EXPENSES`  | Default fixed expenses seeded on first run                                    |
| `SEED_GOALS`           | Default savings goals seeded on first run                                     |
| `SEED_PAYMENT_SOURCES` | Default card/source list seeded on first run                                  |
| `SEED_DEBTS`           | Default debt entries seeded on first run                                      |

---

## Project structure

```txt
app/
  page.tsx                        # Root shell — tabs, summary bar, month selector
  login/                          # Login page
  components/
    IncomePanel.tsx                # Pay, deductions, income entries
    FixedExpensesPanel.tsx         # Fixed expenses with due day, notes, investment toggle
    RecurringDetectionPanel.tsx    # Recurring charge detection from transaction history
    TransactionsPanel.tsx          # CSV import, manual entry, search/filter, export
    GoalsPanel.tsx                 # Savings goals with contribution history
    DebtsPanel.tsx                 # Loans and debt tracking
    AssetsPanel.tsx                # Asset tracking by category
    AnalyticsPanel.tsx             # Charts: donut, area, bar, savings rate, insights
    CashFlowCalendar.tsx           # Monthly calendar with pay days, bills, spending
    ReceivablesPanel.tsx           # Money owed tracking
    YtdPanel.tsx                   # Year-to-date summary
    BudgetSuggestionsPanel.tsx     # AI-style budget suggestions from spending data
    MonthlyBudgetStatus.tsx        # Budget vs. actual per category
    UserNav.tsx                    # Profile dropdown, logout
  api/
    auth/                          # login, logout, me, profile, register
    income/                        # Monthly income config
    income-entries/                # Extra income entries per month
    fixed-expenses/                # Recurring expenses
    transactions/                  # Spending transactions
    csv-import/                    # CSV batch import with dedup
    import-history/                # Import batch management
    goals/                         # Savings goals
    goal-contributions/            # Goal contribution log
    assets/                        # Asset tracking
    debts/                         # Debt/loan tracking
    receivables/                   # Receivables tracking
    payment-sources/               # Card/source management
    category-budgets/              # Per-category budget limits
    analytics/                     # Multi-month chart data
    insights/                      # Spending insights + category analysis
    health-score/                  # Financial health score
    ytd/                           # Year-to-date summary
    recurring/                     # Recurring charge detection
    streak/                        # Logging streak
    pay-lookup/                    # Military pay table lookup
    backup/                        # JSON export/import
    users/                         # User management (admin)

lib/
  config.ts     # All app constants — single source of truth
  types.ts      # Shared TypeScript interfaces
  db.ts         # SQLite schema + seed data
  income.ts     # Server-side income calculation helpers
  api.ts        # Typed client-side API layer
  auth.ts       # Auth helpers (JWT / session)
  utils.ts      # Pure utilities
```

---

## TSP reference

- Default contribution: 20% of base pay (configurable via `TSP_CONFIG.rate`)
- Default allocation: C Fund 70% · S Fund 20% · I Fund 10%

## Roth IRA

Roth IRA is treated as a **fixed investment expense** — add it in the Fixed Expenses panel and toggle the **invest** flag. It will count toward the Invested metric and savings rate rather than regular committed spending.

- Max annual contribution (2025): $7,000 → ~$583/month
- Suggested allocation: Fidelity FZROX 80% / FZILX 20%
