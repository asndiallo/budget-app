import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM assets WHERE user_id = ? ORDER BY category, label',
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
    const { label, category, balance } = await req.json();
    const row = db
      .prepare(
        'INSERT INTO assets (user_id, label, category, balance) VALUES (?, ?, ?, ?) RETURNING *',
      )
      .get(userId, label, category ?? 'Other', balance ?? 0);
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { id, label, category, balance } = await req.json();
    db.prepare(
      `UPDATE assets SET
         label      = COALESCE(?, label),
         category   = COALESCE(?, category),
         balance    = COALESCE(?, balance),
         updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    ).run(label ?? null, category ?? null, balance ?? null, id, userId);
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
    db.prepare('DELETE FROM assets WHERE id = ? AND user_id = ?').run(
      id,
      userId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
