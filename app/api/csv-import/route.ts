import { CSV_CATEGORY_MAP, DEFAULT_CATEGORY } from '@/lib/config';

import type { CsvRow } from '@/lib/types';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

function parseDate(dateStr: string): { month: string; date: string } | null {
  if (!dateStr) return null;
  const slash = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return { month: `${y}-${m.padStart(2, '0')}`, date };
  }
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso)
    return {
      month: `${iso[1]}-${iso[2]}`,
      date: `${iso[1]}-${iso[2]}-${iso[3]}`,
    };
  return null;
}

function mapCategory(raw: string): string {
  const lower = (raw || '').toLowerCase();
  for (const [key, val] of Object.entries(CSV_CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return DEFAULT_CATEGORY;
}

export async function POST(req: Request) {
  try {
    const { userId } = getRequestUser(req);
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
          mapCategory(row.category),
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
