import { NextResponse } from 'next/server';

import { autoMatchBills } from '@/lib/bill-match';
import { categorizeTransaction, detectAccountId } from '@/lib/categorization';
import { parseDate } from '@/lib/csv-utils';
import { getAccountsForDetection, getUserCategorizationRules } from '@/lib/queries';
import { withAuth } from '@/lib/route-helpers';
import type { CsvRow } from '@/lib/types';

export const POST = withAuth(async (req, { userId, db }) => {
  const {
    rows,
    month: fallbackMonth,
    source,
  } = (await req.json()) as {
    rows: CsvRow[];
    month: string;
    source: string;
  };

  const userRules = getUserCategorizationRules(db, userId);
  const userAccounts = getAccountsForDetection(db, userId);

  const importId = crypto.randomUUID();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO transactions (user_id, description, amount, category, month, source, date, import_id, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );

  const months = new Set<string>();
  const count = db.transaction(() => {
    let n = 0;
    for (const row of rows) {
      if (!row.description || !row.amount) continue;
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
  return NextResponse.json({ ok: true, imported: count, months: [...months], billsMatched });
});
