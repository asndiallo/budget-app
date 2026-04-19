import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare('SELECT * FROM payment_sources WHERE user_id = ? ORDER BY id')
    .all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { label } = await req.json();
  const result = db
    .prepare('INSERT OR IGNORE INTO payment_sources (user_id, label) VALUES (?, ?)')
    .run(userId, label);
  return NextResponse.json({ id: result.lastInsertRowid, label });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('DELETE FROM payment_sources WHERE id = ? AND user_id = ?').run(id, userId);
  return NextResponse.json({ ok: true });
});
