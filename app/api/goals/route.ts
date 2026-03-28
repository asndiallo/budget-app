import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare('SELECT * FROM goals WHERE user_id = ? AND active = 1 ORDER BY id')
    .all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { name, target, saved, color } = await req.json();
  const result = db
    .prepare(
      'INSERT INTO goals (user_id, name, target, saved, color) VALUES (?, ?, ?, ?, ?)',
    )
    .run(userId, name, target, saved || 0, color || 'blue');
  return NextResponse.json({
    id: result.lastInsertRowid,
    name,
    target,
    saved: saved || 0,
    color: color || 'blue',
  });
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const body = await req.json();
  const { id } = body;
  const editable = ['saved', 'target', 'name', 'color'] as const;
  const updates = editable.filter((f) => f in body);
  if (updates.length > 0) {
    const clause = updates.map((f) => `${f} = ?`).join(', ');
    const values = updates.map((f) => body[f]);
    db.prepare(`UPDATE goals SET ${clause} WHERE id = ? AND user_id = ?`).run(
      ...values,
      id,
      userId,
    );
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('UPDATE goals SET active = 0 WHERE id = ? AND user_id = ?').run(
    id,
    userId,
  );
  return NextResponse.json({ ok: true });
});
