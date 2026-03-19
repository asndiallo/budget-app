import { NextResponse } from 'next/server';
import { currentMonth } from '@/lib/utils';
import { getDb } from '@/lib/db';

// Returns the most recent snapshot for each key at or before `month`.
// Falls back to the '0000-00' baseline if no later snapshot exists.
function getIncomeForMonth(db: ReturnType<typeof getDb>, month: string) {
  const rows = db
    .prepare(
      `SELECT key, value FROM income_config i1
       WHERE month <= ?
         AND month = (
           SELECT MAX(month) FROM income_config i2
           WHERE i2.key = i1.key AND i2.month <= ?
         )`,
    )
    .all(month, month) as { key: string; value: number }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();
  return NextResponse.json(getIncomeForMonth(db, month));
}

export async function POST(req: Request) {
  const db = getDb();
  const { month: reqMonth, ...updates } = (await req.json()) as Record<
    string,
    number | string
  >;
  const month = (reqMonth as string) || currentMonth();

  // If this month has no snapshot yet, copy the nearest prior snapshot first
  // so edits only diverge from that point forward.
  const hasSnapshot = (
    db
      .prepare('SELECT COUNT(*) as n FROM income_config WHERE month = ?')
      .get(month) as { n: number }
  ).n;

  if (hasSnapshot === 0) {
    db.prepare(
      `INSERT OR IGNORE INTO income_config (month, key, value)
       SELECT ?, key, value FROM income_config i1
       WHERE month = (
         SELECT MAX(month) FROM income_config i2
         WHERE i2.key = i1.key AND i2.month < ?
       )`,
    ).run(month, month);
  }

  const upsert = db.prepare(
    'INSERT INTO income_config (month, key, value) VALUES (?, ?, ?) ON CONFLICT(month, key) DO UPDATE SET value = excluded.value',
  );
  db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'number') upsert.run(month, key, value);
    }
  })();

  return NextResponse.json({ ok: true });
}
