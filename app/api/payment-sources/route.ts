import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const rows = db.prepare('SELECT * FROM payment_sources WHERE user_id = ? ORDER BY id').all(userId);
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
    const { label } = await req.json();
    const result = db
      .prepare('INSERT OR IGNORE INTO payment_sources (user_id, label) VALUES (?, ?)')
      .run(userId, label);
    return NextResponse.json({ id: result.lastInsertRowid, label });
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
    db.prepare('DELETE FROM payment_sources WHERE id = ? AND user_id = ?').run(id, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
