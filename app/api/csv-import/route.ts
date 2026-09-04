import { NextResponse } from 'next/server';

import { importTransactions } from '@/lib/csv-import';
import { withAuth } from '@/lib/route-helpers';
import type { CsvRow, DetectedIncomeRow } from '@/lib/types';

export const POST = withAuth(async (req, { userId, db }) => {
  const {
    rows,
    incomeEntries,
    month: fallbackMonth,
    source,
  } = (await req.json()) as {
    rows: CsvRow[];
    incomeEntries?: DetectedIncomeRow[];
    month: string;
    source: string;
  };

  return NextResponse.json(
    importTransactions(db, userId, { rows, incomeEntries, month: fallbackMonth, source }),
  );
});
