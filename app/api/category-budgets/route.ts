import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT category, budget FROM category_budgets WHERE user_id = ?',
      )
      .all(userId) as { category: string; budget: number }[];
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { category, budget } = await req.json();
    db.prepare(
      'INSERT INTO category_budgets (user_id, category, budget) VALUES (?, ?, ?) ON CONFLICT(user_id, category) DO UPDATE SET budget = excluded.budget',
    ).run(userId, category, budget);
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
    const { category } = await req.json();
    db.prepare(
      'DELETE FROM category_budgets WHERE user_id = ? AND category = ?',
    ).run(userId, category);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
