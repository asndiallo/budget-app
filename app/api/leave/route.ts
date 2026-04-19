import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';
import type { LeaveEvent } from '@/lib/types';

export const GET = withAuth(async (_req, { userId, db }) => {
  const events = db
    .prepare(
      'SELECT id, taken_at, days, note, created_at FROM leave_events WHERE user_id = ? ORDER BY taken_at ASC',
    )
    .all(userId) as LeaveEvent[];

  const { joined_at } = (db.prepare('SELECT joined_at FROM users WHERE id = ?').get(userId) as {
    joined_at: string | null;
  }) ?? { joined_at: null };

  const anchor = db
    .prepare('SELECT balance_days, les_period, updated_at FROM leave_tracker WHERE user_id = ?')
    .get(userId) as {
    balance_days: number;
    les_period: string | null;
    updated_at: string;
  } | null;

  return NextResponse.json({
    events,
    joined_at: joined_at ?? '',
    anchor: anchor?.les_period
      ? {
          balance_days: anchor.balance_days,
          les_period: anchor.les_period, // YYYY-MM-DD
          imported_at: anchor.updated_at,
        }
      : null,
  });
});

/** Record leave taken */
export const POST = withAuth(async (req, { userId, db }) => {
  const { taken_at, days, note } = (await req.json()) as {
    taken_at: string;
    days: number;
    note?: string | null;
  };
  if (!taken_at || typeof days !== 'number' || days <= 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const result = db
    .prepare('INSERT INTO leave_events (user_id, taken_at, days, note) VALUES (?, ?, ?, ?)')
    .run(userId, taken_at, days, note ?? null);
  return NextResponse.json({
    id: result.lastInsertRowid,
    taken_at,
    days,
    note: note ?? null,
    created_at: new Date().toISOString(),
  });
});

/** Set / update LES anchor */
export const PATCH = withAuth(async (req, { userId, db }) => {
  const { balance_days, les_period } = (await req.json()) as {
    balance_days: number;
    les_period: string; // YYYY-MM-DD (end of LES period)
  };
  if (
    typeof balance_days !== 'number' ||
    balance_days < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(les_period)
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  db.prepare(
    `INSERT INTO leave_tracker (user_id, balance_days, les_period, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       balance_days = excluded.balance_days,
       les_period   = excluded.les_period,
       updated_at   = excluded.updated_at`,
  ).run(userId, balance_days, les_period);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = (await req.json()) as { id: number };
  db.prepare('DELETE FROM leave_events WHERE id = ? AND user_id = ?').run(id, userId);
  return NextResponse.json({ ok: true });
});
