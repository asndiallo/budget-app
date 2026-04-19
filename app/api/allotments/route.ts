import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';
import type { Allotment } from '@/lib/types';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare(
      `SELECT id, label, amount, type, start_date, end_date, notes, created_at
       FROM allotments WHERE user_id = ? ORDER BY start_date DESC`,
    )
    .all(userId) as Allotment[];
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { label, amount, type, start_date, end_date, notes } = await req.json();
  const result = db
    .prepare(
      `INSERT INTO allotments (user_id, label, amount, type, start_date, end_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, label, amount, type ?? 'other', start_date, end_date ?? null, notes ?? null);
  return NextResponse.json({ id: result.lastInsertRowid });
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const { id, label, amount, type, start_date, end_date, notes } = await req.json();
  db.prepare(
    `UPDATE allotments SET label=?, amount=?, type=?, start_date=?, end_date=?, notes=?
     WHERE id=? AND user_id=?`,
  ).run(label, amount, type ?? 'other', start_date, end_date ?? null, notes ?? null, id, userId);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('DELETE FROM allotments WHERE id=? AND user_id=?').run(id, userId);
  return NextResponse.json({ ok: true });
});
