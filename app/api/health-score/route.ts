import { NextResponse } from 'next/server';

import { computeHealthScore } from '@/lib/health-score';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  return NextResponse.json(computeHealthScore(db, userId));
});
