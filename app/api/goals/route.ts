import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM goals WHERE user_id = ? AND active = 1 ORDER BY id',
      )
      .all(userId);
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
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
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
    db.prepare('UPDATE goals SET active = 0 WHERE id = ? AND user_id = ?').run(
      id,
      userId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
