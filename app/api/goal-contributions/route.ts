import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const goalId = parseInt(searchParams.get('goal_id') ?? '0');
    if (!goalId) return NextResponse.json([]);

    // Verify the goal belongs to this user
    const goal = db
      .prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?')
      .get(goalId, userId);
    if (!goal) return NextResponse.json([]);

    const rows = db
      .prepare(
        'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY created_at DESC',
      )
      .all(goalId);
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { goal_id, amount, note } = await req.json();
    if (!goal_id || !amount)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Verify the goal belongs to this user
    const goal = db
      .prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?')
      .get(goal_id, userId);
    if (!goal)
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    const result = db
      .prepare(
        'INSERT INTO goal_contributions (goal_id, amount, note) VALUES (?, ?, ?)',
      )
      .run(goal_id, amount, note ?? null);

    db.prepare(
      'UPDATE goals SET saved = MIN(target, saved + ?) WHERE id = ? AND user_id = ?',
    ).run(amount, goal_id, userId);

    return NextResponse.json({
      id: result.lastInsertRowid,
      goal_id,
      amount,
      note: note ?? null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { id, goal_id, amount } = await req.json();

    // Verify the goal belongs to this user
    const goal = db
      .prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?')
      .get(goal_id, userId);
    if (!goal)
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    db.prepare('DELETE FROM goal_contributions WHERE id = ?').run(id);
    db.prepare(
      'UPDATE goals SET saved = MAX(0, saved - ?) WHERE id = ? AND user_id = ?',
    ).run(amount, goal_id, userId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
