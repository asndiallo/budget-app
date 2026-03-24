import type { CsvRow } from '@/lib/types';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { mapCategory, parseDate } from '@/lib/csv-utils';
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const {
      rows,
      month: fallbackMonth,
      source,
    } = (await req.json()) as {
      rows: CsvRow[];
      month: string;
      source: string;
    };

    // Load user's custom categorization rules
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

    return NextResponse.json({
      ok: true,
      imported: count,
      months: [...months],
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
