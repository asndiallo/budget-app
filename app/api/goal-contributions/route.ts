import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const goalId = parseInt(searchParams.get('goal_id') ?? '0');
  if (!goalId) return NextResponse.json([]);
  const rows = db
    .prepare(
      'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY created_at DESC',
    )
    .all(goalId);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const { goal_id, amount, note } = await req.json();
  if (!goal_id || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const result = db
    .prepare('INSERT INTO goal_contributions (goal_id, amount, note) VALUES (?, ?, ?)')
    .run(goal_id, amount, note ?? null);

  // Increment goal.saved, capped at target
  db.prepare('UPDATE goals SET saved = MIN(target, saved + ?) WHERE id = ?').run(
    amount,
    goal_id,
  );

  return NextResponse.json({
    id: result.lastInsertRowid,
    goal_id,
    amount,
    note: note ?? null,
  });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { id, goal_id, amount } = await req.json();

  db.prepare('DELETE FROM goal_contributions WHERE id = ?').run(id);
  // Reverse the contribution (floor at 0)
  db.prepare('UPDATE goals SET saved = MAX(0, saved - ?) WHERE id = ?').run(
    amount,
    goal_id,
  );

  return NextResponse.json({ ok: true });
}
