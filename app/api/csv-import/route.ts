import { mapCategory, parseDate } from '@/lib/csv-utils';
import { autoMatchBills } from '@/lib/bill-match';

import type { CsvRow } from '@/lib/types';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

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

  const userRules = db
    .prepare(
      'SELECT keyword, category FROM categorization_rules WHERE user_id = ?',
    )
    .all(userId) as { keyword: string; category: string }[];

  function applyCategory(description: string, csvCategory: string): string {
    const lower = description.toLowerCase();
    for (const rule of userRules) {
      if (lower.includes(rule.keyword)) return rule.category;
    }
    return mapCategory(csvCategory);
  }

  const importId = crypto.randomUUID();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO transactions (user_id, description, amount, category, month, source, date, import_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
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
        applyCategory(row.description, row.category),
        month,
        source || 'Unknown',
        date,
        importId,
      );
      if (result.changes > 0) n++;
    }
    return n;
  })();

  const billsMatched = autoMatchBills(db, userId, [...months]);
  return NextResponse.json({ ok: true, imported: count, months: [...months], billsMatched });
});
