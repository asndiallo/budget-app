import { DEFAULT_CATEGORY } from '@/lib/config';
import { NextResponse } from 'next/server';
import { currentMonth } from '@/lib/utils';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      const rows = db
        .prepare(
          `SELECT * FROM transactions
           WHERE user_id = ? AND (description LIKE ? OR category LIKE ?)
           ORDER BY month DESC, created_at DESC
           LIMIT 200`,
        )
        .all(userId, like, like);
      return NextResponse.json(rows);
    }

    const month = searchParams.get('month') || currentMonth();
    const rows = db
      .prepare(
        'SELECT * FROM transactions WHERE user_id = ? AND month = ? ORDER BY created_at DESC',
      )
      .all(userId, month);
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { description, amount, category, month, source } = await req.json();
    const m = month || currentMonth();
    const result = db
      .prepare(
        'INSERT INTO transactions (user_id, description, amount, category, month, source) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        userId,
        description,
        amount,
        category || DEFAULT_CATEGORY,
        m,
        source || 'manual',
      );
    return NextResponse.json({
      id: result.lastInsertRowid,
      description,
      amount,
      category,
      month: m,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { id, description, amount, category, notes } = await req.json();
    db.prepare(
      'UPDATE transactions SET description = COALESCE(?, description), amount = COALESCE(?, amount), category = COALESCE(?, category), notes = COALESCE(?, notes) WHERE id = ? AND user_id = ?',
    ).run(
      description ?? null,
      amount ?? null,
      category ?? null,
      notes ?? null,
      id,
      userId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { id } = await req.json();
    db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(
      id,
      userId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
