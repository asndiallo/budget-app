import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT id, keyword, category FROM categorization_rules WHERE user_id = ? ORDER BY keyword',
      )
      .all(userId) as { id: number; keyword: string; category: string }[];
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
    const { keyword, category } = await req.json();
    if (!keyword?.trim() || !category) {
      return NextResponse.json(
        { error: 'keyword and category required' },
        { status: 400 },
      );
    }
    const row = db
      .prepare(
        'INSERT INTO categorization_rules (user_id, keyword, category) VALUES (?, ?, ?) ON CONFLICT(user_id, keyword) DO UPDATE SET category = excluded.category RETURNING id, keyword, category',
      )
      .get(userId, keyword.trim().toLowerCase(), category) as {
      id: number;
      keyword: string;
      category: string;
    };
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { id } = await req.json();
    db.prepare(
      'DELETE FROM categorization_rules WHERE user_id = ? AND id = ?',
    ).run(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
