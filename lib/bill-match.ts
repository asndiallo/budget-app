// Server-only: auto-match imported/manual transactions against active fixed expenses.
// For each (bill, month) pair that doesn't already have a payment record, look for a
// transaction whose description contains a keyword from the bill label AND whose amount
// is within tolerance. On a match, insert a bill_payment row tagged with matched_tx_id.
//
// Matching rules (both must hold):
//   1. Keyword: at least one ≥3-char word from the bill label appears in the transaction
//      description (case-insensitive).
//   2. Amount: |tx.amount − bill.amount| ≤ max($2 absolute, 10% relative).
//
// Biweekly bills are skipped — per-occurrence matching is ambiguous.
// Annual bills are matched against their full amount (lump-sum payment).

import type Database from 'better-sqlite3';

interface BillRow {
  id: number;
  label: string;
  amount: number;
  period: string;
  recurrence: string | null;
}

interface TxRow {
  id: number;
  description: string;
  amount: number;
  month: string;
}

/** Extract meaningful keywords from a bill label (words with ≥3 chars). */
function keywords(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[\s\-_.,/&()+]+/)
    .filter((w) => w.length >= 3);
}

/** Returns true if the transaction description contains at least one bill keyword. */
function descriptionMatches(description: string, bill: BillRow): boolean {
  const desc = description.toLowerCase();
  return keywords(bill.label).some((kw) => desc.includes(kw));
}

/** Returns true if the amounts are within $2 absolute or 10% relative. */
function amountMatches(txAmount: number, billAmount: number): boolean {
  const diff = Math.abs(txAmount - billAmount);
  return diff <= 2 || diff / billAmount <= 0.1;
}

/**
 * Auto-matches transactions in the given months against active fixed expenses.
 * Inserts bill_payment rows for confident matches (sets matched_tx_id).
 *
 * @returns the number of new auto-match records created
 */
export function autoMatchBills(
  db: Database.Database,
  userId: string,
  months: string[],
): number {
  if (months.length === 0) return 0;

  // Only monthly (non-biweekly) bills — biweekly per-occurrence matching is unreliable
  const bills = db
    .prepare(
      `SELECT id, label, amount, period, recurrence
       FROM fixed_expenses
       WHERE user_id = ? AND active = 1
         AND (recurrence IS NULL OR recurrence = 'monthly')`,
    )
    .all(userId) as BillRow[];

  if (bills.length === 0) return 0;

  const placeholders = months.map(() => '?').join(', ');
  const txs = db
    .prepare(
      `SELECT id, description, amount, month
       FROM transactions
       WHERE user_id = ? AND month IN (${placeholders})`,
    )
    .all(userId, ...months) as TxRow[];

  if (txs.length === 0) return 0;

  // Index existing bill_payments so we don't double-insert
  const existingSet = new Set<string>(
    (
      db
        .prepare(
          `SELECT fixed_expense_id, month
           FROM bill_payments
           WHERE user_id = ? AND month IN (${placeholders})`,
        )
        .all(userId, ...months) as { fixed_expense_id: number; month: string }[]
    ).map((r) => `${r.fixed_expense_id}:${r.month}`),
  );

  const insert = db.prepare(
    `INSERT OR IGNORE INTO bill_payments (user_id, fixed_expense_id, month, matched_tx_id)
     VALUES (?, ?, ?, ?)`,
  );

  // Group transactions by month for fast lookup
  const txsByMonth: Record<string, TxRow[]> = {};
  for (const tx of txs) {
    (txsByMonth[tx.month] ??= []).push(tx);
  }

  let matched = 0;
  db.transaction(() => {
    for (const bill of bills) {
      const matchAmount = bill.period === 'annual' ? bill.amount : bill.amount;
      for (const month of months) {
        const key = `${bill.id}:${month}`;
        if (existingSet.has(key)) continue; // already paid/matched

        const monthTxs = txsByMonth[month] ?? [];
        const hit = monthTxs.find(
          (tx) =>
            descriptionMatches(tx.description, bill) &&
            amountMatches(tx.amount, matchAmount),
        );
        if (hit) {
          insert.run(userId, bill.id, month, hit.id);
          existingSet.add(key); // prevent re-matching same bill in same month
          matched++;
        }
      }
    }
  })();

  return matched;
}
