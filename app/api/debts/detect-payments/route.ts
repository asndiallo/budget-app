import { NextResponse } from 'next/server';

import { detectDebtPayments } from '@/lib/debt-match';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const suggestions = detectDebtPayments(db, userId);
  return NextResponse.json(suggestions);
});
