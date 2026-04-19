import { NextResponse } from 'next/server';

import { takeNetWorthSnapshot } from '@/lib/db';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare('SELECT * FROM assets WHERE user_id = ? ORDER BY category, label')
    .all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { label, category, balance } = await req.json();
  const row = db
    .prepare(
      'INSERT INTO assets (user_id, label, category, balance) VALUES (?, ?, ?, ?) RETURNING *',
    )
    .get(userId, label, category ?? 'Other', balance ?? 0);
  takeNetWorthSnapshot(db, userId);
  return NextResponse.json(row);
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const { id, label, category, balance } = await req.json();
  db.prepare(
    `UPDATE assets SET
       label      = COALESCE(?, label),
       category   = COALESCE(?, category),
       balance    = COALESCE(?, balance),
       updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`,
  ).run(label ?? null, category ?? null, balance ?? null, id, userId);
  takeNetWorthSnapshot(db, userId);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('DELETE FROM assets WHERE id = ? AND user_id = ?').run(id, userId);
  takeNetWorthSnapshot(db, userId);
  return NextResponse.json({ ok: true });
});
