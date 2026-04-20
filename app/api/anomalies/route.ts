import { NextResponse } from 'next/server';

import { INVESTMENT_CATEGORY } from '@/lib/config';
import { withAuth } from '@/lib/route-helpers';
import type { AnomalyResult } from '@/lib/types';
import { currentMonth } from '@/lib/utils';

function prevMonthStr(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? currentMonth();

  const today = new Date();
  const [y, m] = month.split('-').map(Number);
  const totalDays = new Date(y, m, 0).getDate();
  const isCurrentMonth = month === currentMonth();
  const dayOfMonth = isCurrentMonth ? today.getDate() : totalDays;

  // Build trailing 3 complete months before `month`
  const trailing: string[] = [];
  let cur = prevMonthStr(month);
  for (let i = 0; i < 3; i++) {
    trailing.unshift(cur);
    cur = prevMonthStr(cur);
  }

  const allMonths = [...trailing, month];

  const rows = db
    .prepare(
      `SELECT month, category, SUM(amount) AS total
       FROM transactions
       WHERE user_id = ? AND month IN (${allMonths.map(() => '?').join(',')})
         AND category != ?
       GROUP BY month, category`,
    )
    .all(userId, ...allMonths, INVESTMENT_CATEGORY) as {
    month: string;
    category: string;
    total: number;
  }[];

  const byMonth = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (!byMonth.has(row.month)) byMonth.set(row.month, {});
    byMonth.get(row.month)![row.category] = row.total;
  }

  const trailingWithData = trailing.filter((mn) => byMonth.has(mn));
  const currentCats = byMonth.get(month) ?? {};

  const empty: AnomalyResult = { month, dayOfMonth, totalDays, alerts: [] };

  // Need at least 2 trailing months of data and at least 3 days into the current month
  if (trailingWithData.length < 2 || dayOfMonth < 3) {
    return NextResponse.json<AnomalyResult>(empty);
  }

  const allCats = new Set<string>();
  for (const mn of trailingWithData) {
    for (const cat of Object.keys(byMonth.get(mn)!)) allCats.add(cat);
  }

  const alerts: AnomalyResult['alerts'] = [];

  for (const category of allCats) {
    const trailingVals = trailingWithData.map((mn) => byMonth.get(mn)?.[category] ?? 0);
    const monthsWithData = trailingVals.filter((v) => v > 0).length;
    if (monthsWithData === 0) continue;

    const trailingAvg = trailingVals.reduce((s, v) => s + v, 0) / monthsWithData;
    if (trailingAvg < 20) continue;

    const currentMonthSpend = currentCats[category] ?? 0;
    if (currentMonthSpend === 0) continue;

    const projectedMonthSpend = isCurrentMonth
      ? Math.round((currentMonthSpend / dayOfMonth) * totalDays)
      : currentMonthSpend;

    const pctOverAvg = Math.round(((projectedMonthSpend - trailingAvg) / trailingAvg) * 100);
    if (pctOverAvg < 20) continue;

    alerts.push({
      category,
      currentMonthSpend: Math.round(currentMonthSpend),
      projectedMonthSpend,
      trailingAvg: Math.round(trailingAvg),
      pctOverAvg,
      severity: pctOverAvg >= 50 ? 'alert' : 'warning',
    });
  }

  alerts.sort((a, b) => b.pctOverAvg - a.pctOverAvg);

  return NextResponse.json<AnomalyResult>({ month, dayOfMonth, totalDays, alerts });
});
