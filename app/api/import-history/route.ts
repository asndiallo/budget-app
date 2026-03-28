import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
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
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { importId } = await req.json();
  const result = db
    .prepare('DELETE FROM transactions WHERE user_id = ? AND import_id = ?')
    .run(userId, importId);
  return NextResponse.json({ ok: true, deleted: result.changes });
});
