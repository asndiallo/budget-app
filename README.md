# Budget Tracker — Personal Military Finance App

Built for E-3 · 4N0 · JBSA Fort Sam Houston.
Pre-loaded with your military pay structure, TSP/Roth allocations, and savings goals.

---

## Stack
- **Next.js 14** (App Router) — frontend + API routes in one process
- **SQLite** (better-sqlite3) — local persistent database, no server needed
- **Tailwind CSS** — styling

---

## Setup

### Requirements
- Node.js 18+ (check with `node -v`)
- If using mise: `mise use node@20`

### Install & run
```bash
cd budget-app
npm install
npm run dev
```

Open → http://localhost:3000

### Your data
All data is stored in `budget.db` in the project root.
- Back it up: just copy `budget.db`
- Reset: delete `budget.db` and restart (re-seeds defaults)

---

## Apple Card CSV import

1. Open **Wallet** app on iPhone
2. Tap your Apple Card
3. Scroll to the bottom → **Export Transactions**
4. AirDrop or save the CSV file to your Mac
5. In the app: Apple Card tab → **Upload CSV**

The app auto-maps Apple Card categories (Food & Drink, Transportation, etc.)
to your budget categories.

---

## Features

- **Income panel** — Edit base pay, BAS, BAH, other income; TSP auto-calculated at 20% of base
- **Apple Card tab** — CSV import or manual entry; filter by category; monthly view
- **Goals tracker** — Track VA loan, emergency fund, wedding, car fund, etc.
- **Month selector** — Switch between months; data is per-month

---

## Updating your data

All fields are editable inline. Income changes auto-save on blur (when you click away).
Transactions and goals are added via the form at the bottom of each section.

---

## TSP breakdown (reference)
- C Fund: 70%
- S Fund: 20%
- I Fund: 10%
- Contribution: 20% of base pay (auto-calculated)

## Roth IRA (reference)
- Max annual: $7,000 → $583/month
- Fidelity: 80% FZROX / 20% FZILX
