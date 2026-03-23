import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const TABLES = [
  'income_config',
  'fixed_expenses',
  'transactions',
  'goals',
  'payment_sources',
  'debts',
  'income_entries',
  'receivables',
  'category_budgets',
] as const;

export async function GET() {
  const db = getDb();
  const dump: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    dump[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  const payload = JSON.stringify(
    { exportedAt: new Date().toISOString(), version: 1, tables: dump },
    null,
    2,
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(payload, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="budget-backup-${date}.json"`,
    },
  });
}

export async function POST(req: Request) {
  const db = getDb();
  const body = await req.json();
  if (body.version !== 1 || typeof body.tables !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Invalid backup format' },
      { status: 400 },
    );
  }

  const tables = body.tables as Record<string, Record<string, unknown>[]>;
  let restored = 0;

  db.transaction(() => {
    for (const table of TABLES) {
      const rows = tables[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      // Build INSERT OR IGNORE from the first row's keys
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => '?').join(', ');
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
      );

      for (const row of rows) {
        stmt.run(...cols.map((c) => row[c]));
        restored++;
      }
    }
  })();

  return NextResponse.json({ ok: true, restored });
}
