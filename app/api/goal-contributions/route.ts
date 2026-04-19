import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const goalId = parseInt(searchParams.get('goal_id') ?? '0');
  if (!goalId) return NextResponse.json([]);

  const goal = db.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').get(goalId, userId);
  if (!goal) return NextResponse.json([]);

  const rows = db
    .prepare('SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY created_at DESC')
    .all(goalId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { goal_id, amount, note } = await req.json();
  if (!goal_id || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const goal = db.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').get(goal_id, userId);
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

  const result = db
    .prepare('INSERT INTO goal_contributions (goal_id, amount, note) VALUES (?, ?, ?)')
    .run(goal_id, amount, note ?? null);

  db.prepare('UPDATE goals SET saved = MIN(target, saved + ?) WHERE id = ? AND user_id = ?').run(
    amount,
    goal_id,
    userId,
  );

  return NextResponse.json({
    id: result.lastInsertRowid,
    goal_id,
    amount,
    note: note ?? null,
  });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id, goal_id, amount } = await req.json();

  const goal = db.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').get(goal_id, userId);
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

  db.prepare('DELETE FROM goal_contributions WHERE id = ?').run(id);
  db.prepare('UPDATE goals SET saved = MAX(0, saved - ?) WHERE id = ? AND user_id = ?').run(
    amount,
    goal_id,
    userId,
  );

  return NextResponse.json({ ok: true });
});
