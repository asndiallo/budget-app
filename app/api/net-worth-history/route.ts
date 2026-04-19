import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare(
      `SELECT recorded_at, assets, liabilities, net_worth
       FROM net_worth_snapshots
       WHERE user_id = ?
       ORDER BY recorded_at ASC`,
    )
    .all(userId);
  return NextResponse.json(rows);
});
