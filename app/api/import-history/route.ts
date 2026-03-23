import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT
           import_id, source, COUNT(*) as count,
           MIN(month) as min_month, MAX(month) as max_month,
           MAX(created_at) as imported_at
         FROM transactions
         WHERE user_id = ? AND import_id IS NOT NULL
         GROUP BY import_id
         ORDER BY imported_at DESC
         LIMIT 15`,
      )
      .all(userId);
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { importId } = await req.json();
    const result = db
      .prepare('DELETE FROM transactions WHERE user_id = ? AND import_id = ?')
      .run(userId, importId);
    return NextResponse.json({ ok: true, deleted: result.changes });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
