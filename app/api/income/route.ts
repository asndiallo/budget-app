import { NextResponse } from 'next/server';
import { currentMonth } from '@/lib/utils';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

function getIncomeForMonth(
  db: ReturnType<typeof getDb>,
  month: string,
  userId: number,
) {
  const rows = db
    .prepare(
      `SELECT key, value FROM income_config i1
       WHERE user_id = ? AND month <= ?
         AND month = (
           SELECT MAX(month) FROM income_config i2
           WHERE i2.user_id = i1.user_id AND i2.key = i1.key AND i2.month <= ?
         )`,
    )
    .all(userId, month, month) as { key: string; value: number }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function GET(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || currentMonth();
    return NextResponse.json(getIncomeForMonth(db, month, userId));
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { month: reqMonth, ...updates } = (await req.json()) as Record<
      string,
      number | string
    >;
    const month = (reqMonth as string) || currentMonth();

    const hasSnapshot = (
      db
        .prepare(
          'SELECT COUNT(*) as n FROM income_config WHERE user_id = ? AND month = ?',
        )
        .get(userId, month) as { n: number }
    ).n;

    if (hasSnapshot === 0) {
      db.prepare(
        `INSERT OR IGNORE INTO income_config (user_id, month, key, value)
         SELECT ?, ?, key, value FROM income_config i1
         WHERE user_id = ? AND month = (
           SELECT MAX(month) FROM income_config i2
           WHERE i2.user_id = ? AND i2.key = i1.key AND i2.month < ?
         )`,
      ).run(userId, month, userId, userId, month);
    }

    const upsert = db.prepare(
      `INSERT INTO income_config (user_id, month, key, value) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, month, key) DO UPDATE SET value = excluded.value`,
    );
    db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'number') upsert.run(userId, month, key, value);
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
