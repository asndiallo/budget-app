import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         import_id,
         source,
         COUNT(*) as count,
         MIN(month) as min_month,
         MAX(month) as max_month,
         MAX(created_at) as imported_at
       FROM transactions
       WHERE import_id IS NOT NULL
       GROUP BY import_id
       ORDER BY imported_at DESC
       LIMIT 15`,
    )
    .all();
  return NextResponse.json(rows);
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { importId } = await req.json();
  const result = db
    .prepare('DELETE FROM transactions WHERE import_id = ?')
    .run(importId);
  return NextResponse.json({ ok: true, deleted: result.changes });
}
