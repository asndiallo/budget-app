import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const month = new URL(req.url).searchParams.get('month');
    if (!month) return NextResponse.json([]);
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM income_entries WHERE user_id = ? AND month = ? ORDER BY id DESC',
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
    const { description, amount, month, source } = await req.json();
    const db = getDb();
    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO income_entries (user_id, description, amount, month, source) VALUES (?, ?, ?, ?, ?)',
      )
      .run(userId, description, amount, month, source || 'Other');
    const row = db
      .prepare('SELECT * FROM income_entries WHERE id = ?')
      .get(lastInsertRowid);
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const { id } = await req.json();
    getDb()
      .prepare('DELETE FROM income_entries WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
