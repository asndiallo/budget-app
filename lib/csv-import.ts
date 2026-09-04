import type Database from 'better-sqlite3';

import { autoMatchBills } from './bill-match';
import { categorizeTransaction, detectAccountId, isDebtServicePayment } from './categorization';
import { parseDate } from './csv-utils';
import {
  getAccountsForDetection,
  getDebtsForDetection,
  getUserCategorizationRules,
} from './queries';
import type { CsvRow, DetectedIncomeRow } from './types';

type Db = Database.Database;

export interface CsvImportResult {
  ok: true;
  imported: number;
  months: string[];
  billsMatched: number;
  incomeImported: number;
  debtServiceSkipped: number;
}

export function importTransactions(
  db: Db,
  userId: string,
  {
    rows,
    incomeEntries,
    month: fallbackMonth,
    source,
  }: { rows: CsvRow[]; incomeEntries?: DetectedIncomeRow[]; month: string; source: string },
): CsvImportResult {
  const userRules = getUserCategorizationRules(db, userId);
  const userAccounts = getAccountsForDetection(db, userId);
  const userDebts = getDebtsForDetection(db, userId);

  const importId = crypto.randomUUID();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO transactions (user_id, description, amount, category, month, source, date, import_id, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );

  const months = new Set<string>();
  let debtServiceSkipped = 0;
  const count = db.transaction(() => {
    let n = 0;
    for (const row of rows) {
      if (!row.description || !row.amount) continue;
      if (isDebtServicePayment(row.description, userDebts)) {
        debtServiceSkipped++;
        continue;
      }
      const parsed = parseDate(row.date);
      const month = parsed?.month ?? fallbackMonth;
      const date = parsed?.date ?? null;
      months.add(month);
      const result = insert.run(
        userId,
        row.description,
        Math.abs(row.amount),
        categorizeTransaction(row.description, { csvCategory: row.category, rules: userRules }),
        month,
        source || 'Unknown',
        date,
        importId,
        detectAccountId(row.description, userAccounts),
      );
      if (result.changes > 0) n++;
    }
    return n;
  })();

  const billsMatched = autoMatchBills(db, userId, [...months]);

  // Gig-income deposits detected during parsing — income_entries has no
  // unique constraint (unlike transactions' idx_tx_dedup), so dedupe here to
  // keep a re-import of the same file from double-counting.
  const insertIncome = db.prepare(
    `INSERT INTO income_entries (user_id, description, amount, month, source)
     SELECT ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM income_entries
       WHERE user_id = ? AND description = ? AND amount = ? AND month = ? AND source = ?
     )`,
  );
  const incomeImported = db.transaction(() => {
    let n = 0;
    for (const entry of incomeEntries ?? []) {
      if (!entry.description || !entry.amount) continue;
      const parsed = parseDate(entry.date);
      const month = parsed?.month ?? fallbackMonth;
      const result = insertIncome.run(
        userId,
        entry.description,
        Math.abs(entry.amount),
        month,
        entry.source,
        userId,
        entry.description,
        Math.abs(entry.amount),
        month,
        entry.source,
      );
      if (result.changes > 0) n++;
    }
    return n;
  })();

  return {
    ok: true,
    imported: count,
    months: [...months],
    billsMatched,
    incomeImported,
    debtServiceSkipped,
  };
}
