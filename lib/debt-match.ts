// Server-only: detect transaction → debt payment matches.
// Same keyword+amount strategy as bill-match, but for debts.
// Returns suggestions for transactions that look like debt payments
// and haven't already been applied via debt_payments.
//
// Matching rules (both must hold):
//   1. Keyword: at least one ≥3-char word from debt.lender or debt.label
//      appears in the transaction description (case-insensitive).
//   2. Amount: |tx.amount − debt.monthly_payment| ≤ max($10 absolute, 15% relative).
//      Slightly looser than bill-match because loan servicers sometimes vary amounts
//      (escrow adjustments, partial payments, etc.).

import type Database from 'better-sqlite3';

interface DebtRow {
  id: number;
  label: string;
  lender: string;
  balance: number;
  monthly_payment: number;
}

interface TxRow {
  id: number;
  description: string;
  amount: number;
  month: string;
  date: string | null;
}

export interface DebtPaymentSuggestion {
  debtId: number;
  debtLabel: string;
  debtLender: string;
  debtBalance: number;
  transactionId: number;
  txDescription: string;
  txAmount: number;
  txMonth: string;
  txDate: string | null;
  suggestedBalance: number;
}

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_.,/&()+]+/)
    .filter((w) => w.length >= 3);
}

function descriptionMatches(description: string, debt: DebtRow): boolean {
  const desc = description.toLowerCase();
  const kws = [...keywords(debt.lender), ...keywords(debt.label)];
  return kws.some((kw) => desc.includes(kw));
}

function amountMatches(txAmount: number, monthlyPayment: number): boolean {
  if (monthlyPayment <= 0) return false;
  const diff = Math.abs(txAmount - monthlyPayment);
  return diff <= 10 || diff / monthlyPayment <= 0.15;
}

/**
 * Returns suggestions for transactions that look like debt payments
 * but haven't been applied yet.
 *
 * Scans the most recent 3 months of transactions.
 */
export function detectDebtPayments(db: Database.Database, userId: string): DebtPaymentSuggestion[] {
  // Only active debts with a known payment amount
  const debts = db
    .prepare(
      `SELECT id, label, lender, balance, monthly_payment
       FROM debts
       WHERE user_id = ? AND balance > 0 AND monthly_payment > 0`,
    )
    .all(userId) as DebtRow[];

  if (debts.length === 0) return [];

  // Recent transactions not already applied to a debt
  const txs = db
    .prepare(
      `SELECT t.id, t.description, t.amount, t.month, t.date
       FROM transactions t
       WHERE t.user_id = ?
         AND t.month >= date('now', '-3 months', 'start of month')
         AND NOT EXISTS (
           SELECT 1 FROM debt_payments dp
           WHERE dp.user_id = t.user_id AND dp.transaction_id = t.id
         )
       ORDER BY t.month DESC, t.created_at DESC`,
    )
    .all(userId) as TxRow[];

  if (txs.length === 0) return [];

  const suggestions: DebtPaymentSuggestion[] = [];
  const usedTxIds = new Set<number>(); // prevent same tx matching multiple debts

  for (const debt of debts) {
    for (const tx of txs) {
      if (usedTxIds.has(tx.id)) continue;
      if (
        descriptionMatches(tx.description, debt) &&
        amountMatches(tx.amount, debt.monthly_payment)
      ) {
        suggestions.push({
          debtId: debt.id,
          debtLabel: debt.label,
          debtLender: debt.lender,
          debtBalance: debt.balance,
          transactionId: tx.id,
          txDescription: tx.description,
          txAmount: tx.amount,
          txMonth: tx.month,
          txDate: tx.date,
          suggestedBalance: Math.max(0, debt.balance - tx.amount),
        });
        usedTxIds.add(tx.id);
        break; // one suggestion per debt
      }
    }
  }

  return suggestions;
}
