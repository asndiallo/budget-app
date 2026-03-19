import { INCOME_FIELDS, TSP_CONFIG } from '@/lib/config';

import { NextResponse } from 'next/server';
import { currentMonth } from '@/lib/utils';
import { getDb } from '@/lib/db';

// Generate `count` consecutive month strings ending at `to` (inclusive), oldest first.
function prevMonths(to: string, count: number): string[] {
  const [y, m] = to.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

function shortLabel(month: string): string {
  const [y, m] = month.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

// Nearest-prior snapshot query for income
function incomeForMonth(
  db: ReturnType<typeof getDb>,
  month: string,
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT key, value FROM income_config i1
       WHERE month <= ?
         AND month = (
           SELECT MAX(month) FROM income_config i2
           WHERE i2.key = i1.key AND i2.month <= ?
         )`,
    )
    .all(month, month) as { key: string; value: number }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();
  const count = Math.min(parseInt(searchParams.get('count') ?? '6'), 12);

  const months = prevMonths(month, count);

  // Spending per month + category breakdown in one query
  const spendingRows = db
    .prepare(
      `SELECT month, category, SUM(amount) as total
       FROM transactions
       WHERE month IN (${months.map(() => '?').join(',')})
       GROUP BY month, category`,
    )
    .all(...months) as { month: string; category: string; total: number }[];

  // Build a map: month → { category → amount }
  const spendingMap = new Map<string, Record<string, number>>();
  for (const row of spendingRows) {
    if (!spendingMap.has(row.month)) spendingMap.set(row.month, {});
    spendingMap.get(row.month)![row.category] = row.total;
  }

  // Income + deductions per month
  const result = months.map((m) => {
    const income = incomeForMonth(db, m);
    const tspRate = income.tsp_rate ?? TSP_CONFIG.rate;
    const totalIncome = INCOME_FIELDS.reduce((s, f) => s + (income[f.key] ?? 0), 0);
    const tsp = Math.round((income.base_pay ?? 0) * tspRate);
    const roth = income.roth_ira ?? 0;
    const categories = spendingMap.get(m) ?? {};
    const spending = Object.values(categories).reduce((s, v) => s + v, 0);

    return {
      month: m,
      label: shortLabel(m),
      totalIncome,
      tsp,
      roth,
      spending,
      net: totalIncome - tsp - roth - spending,
      categories,
    };
  });

  return NextResponse.json(result);
}
