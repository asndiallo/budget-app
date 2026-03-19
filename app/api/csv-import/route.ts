import { CSV_CATEGORY_MAP, DEFAULT_CATEGORY } from '@/lib/config';

import type { CsvRow } from '@/lib/types';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Apple Card CSV format:
// Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD)
// or simpler: Date,Description,Amount,Category

function mapCategory(raw: string): string {
  const lower = (raw || '').toLowerCase();
  for (const [key, val] of Object.entries(CSV_CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return DEFAULT_CATEGORY;
}

export async function POST(req: Request) {
  const db = getDb();
  const { rows, month, source } = (await req.json()) as {
    rows: CsvRow[];
    month: string;
    source: string;
  };

  const insert = db.prepare(
    'INSERT INTO transactions (description, amount, category, month, source) VALUES (?, ?, ?, ?, ?)',
  );

  const count = db.transaction(() => {
    let n = 0;
    for (const row of rows) {
      if (!row.description || !row.amount) continue;
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

  return NextResponse.json({ ok: true, imported: count });
}
