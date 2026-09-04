import { NextResponse } from 'next/server';

import { detectSpendingAnomalies } from '@/lib/anomalies';
import { withAuth } from '@/lib/route-helpers';
import type { AnomalyResult } from '@/lib/types';
import { currentMonth } from '@/lib/utils';

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? currentMonth();
  return NextResponse.json<AnomalyResult>(detectSpendingAnomalies(db, userId, month));
});
