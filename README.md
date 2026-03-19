# Budget Tracker — Personal Military Finance App

Built for E-3 · 4N0 · JBSA Fort Sam Houston.
Pre-loaded with your military pay structure, TSP/Roth allocations, and savings goals.

---

## Stack

- **Next.js 16** (App Router) — frontend + API routes in one process
- **SQLite** (better-sqlite3) — local persistent database, no server needed
- **Tailwind CSS 4** — styling
- **TypeScript 5** — fully typed
- **Bun** — package manager

---

## Setup

### Requirements

- Node.js 18+ (check with `node -v`)
- If using mise: `mise use node@20`

### Install & run

```bash
bun install
bun run dev
```

Open → <http://localhost:3000>

### Your data

All data is stored in `budget.db` in the project root.

- Back it up: just copy `budget.db`
- Reset: delete `budget.db` and restart (re-seeds defaults)

---

## Project structure

```txt
app/
  page.tsx                      # Root layout — tabs, summary cards, month selector
  components/
    IncomePanel.tsx              # Military pay + deductions
    FixedExpensesPanel.tsx       # Recurring monthly expenses
    TransactionsPanel.tsx        # CSV import + manual transactions, card management
    GoalsPanel.tsx               # Savings goals with progress tracking
    DebtsPanel.tsx               # Loans / debts with inline editing
  api/
    income/route.ts
    fixed-expenses/route.ts
    transactions/route.ts
    goals/route.ts
    csv-import/route.ts
    payment-sources/route.ts    # Card/source management
    debts/route.ts              # Loan tracking

lib/
  config.ts   # All app constants — edit here to change categories, colors, rates, seed data
  types.ts    # Shared TypeScript interfaces
  utils.ts    # Pure utilities: currentMonth, formatCurrency, parseCSVLine, etc.
  api.ts      # Typed client-side API layer
  db.ts       # SQLite singleton + schema init
```

---

## Configuration

Everything hardcoded is in **`lib/config.ts`**. Edit that file to customize the app without touching components.

| Export                                | What to change                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `APP_CONFIG`                          | App title, subtitle, transactions tab label                                  |
| `INCOME_FIELDS`                       | Income rows (key, label, note) — add a row here and it appears automatically |
| `TSP_CONFIG`                          | TSP rate (default 20%), display label, fund allocation note                  |
| `DEDUCTION_FIELDS`                    | Deduction rows — same pattern as income fields                               |
| `CATEGORIES`                          | Transaction category list                                                    |
| `CAT_COLORS`                          | Tailwind badge classes per category                                          |
| `CSV_CATEGORY_MAP`                    | Apple Card category → internal category mapping                              |
| `GOAL_COLORS`                         | Available goal color names                                                   |
| `GOAL_BAR_COLORS` / `GOAL_DOT_COLORS` | Tailwind classes per goal color                                              |
| `SEED_INCOME`                         | Default income values on first run                                           |
| `SEED_FIXED_EXPENSES`                 | Default fixed expenses on first run                                          |
| `SEED_GOALS`                          | Default goals on first run                                                   |
| `SEED_PAYMENT_SOURCES`                | Default card/source list on first run                                        |
| `SEED_DEBTS`                          | Default debt entries on first run (includes Westlake Financial car loan)     |

---

## Features

- **Income tab** — Edit base pay, BAS, BAH, other income; TSP auto-calculated at 20% of base; Roth IRA / taxes / SGLI deductions; fixed monthly expenses; debts & loans
- **Spending tab** — Import CSV from any card, select the source card before uploading; add transactions manually with card selector; manage card list; filter by category; monthly view
- **Goals tab** — Savings goals with progress bars; add funds incrementally; tracks total saved vs. target
- **Summary bar** — 5 cards: Total income · Invested · Committed (fixed + active debt payments) · Spending · Net remaining; updates on every change
- **Debt tracking** — Inline-editable balance, monthly payment, interest rate; paid-off debts (balance = 0) are excluded from the Committed total automatically
- **Month selector** — Dynamically generated for the current year; defaults to current month

---

## Apple Card CSV import

1. Open **Wallet** app on iPhone
2. Tap your Apple Card
3. Scroll to the bottom → **Export Transactions**
4. AirDrop or save the CSV to your Mac
5. In the app: Apple Card tab → **Upload CSV**

Apple Card categories are automatically mapped to your budget categories via `CSV_CATEGORY_MAP` in `lib/config.ts`.

---

## Inline editing

All income and deduction fields save automatically on blur (click away). Transactions and goals are added via the form at the bottom of each section.

---

## TSP breakdown (reference)

- C Fund: 70%
- S Fund: 20%
- I Fund: 10%
- Contribution: 20% of base pay (auto-calculated, configurable via `TSP_CONFIG.rate`)

## Roth IRA (reference)

- Max annual: $7,000 → $583/month
- Fidelity: 80% FZROX / 20% FZILX
