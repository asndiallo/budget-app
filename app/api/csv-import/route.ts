import { CSV_CATEGORY_MAP, DEFAULT_CATEGORY } from '@/lib/config';

import type { CsvRow } from '@/lib/types';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Parses MM/DD/YYYY (Apple Card) or YYYY-MM-DD into YYYY-MM.
// Returns null if the date string is unrecognizable.
function parseMonth(dateStr: string): string | null {
  if (!dateStr) return null;
  // MM/DD/YYYY
  const slash = dateStr.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
  if (slash) return `${slash[2]}-${slash[1].padStart(2, '0')}`;
  // YYYY-MM-DD
  const iso = dateStr.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
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

  const insert = db.prepare(
    'INSERT INTO transactions (description, amount, category, month, source) VALUES (?, ?, ?, ?, ?)',
  );

  const months = new Set<string>();
  const count = db.transaction(() => {
    let n = 0;
    for (const row of rows) {
      if (!row.description || !row.amount) continue;
      const month = parseMonth(row.date) ?? fallbackMonth;
      months.add(month);
      insert.run(
        row.description,
        Math.abs(row.amount),
        mapCategory(row.category),
        month,
        source || 'Unknown',
      );
      n++;
    }
    return n;
  })();

  return NextResponse.json({ ok: true, imported: count, months: [...months] });
}
