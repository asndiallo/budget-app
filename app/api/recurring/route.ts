import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';

function normalize(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/\*[a-z0-9]+/gi, '')
    .replace(/\s+[a-z0-9]{6,}$/i, '')
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '')
    .replace(/\d{4,}/g, '')
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function monthsBack(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const GET = withAuth(async (_req, { userId, db }) => {
  const since = monthsBack(6);

  const rows = db
    .prepare(
      `SELECT description, amount, month, category
       FROM transactions
       WHERE user_id = ? AND month >= ?
       ORDER BY description, month`,
    )
    .all(userId, since) as {
    description: string;
    amount: number;
    month: string;
    category: string;
  }[];

  const groups = new Map<
    string,
    {
      description: string;
      months: Set<string>;
      amounts: number[];
      category: string;
    }
  >();
  for (const row of rows) {
    const key = normalize(row.description);
    if (!key || key.length < 3) continue;
    if (!groups.has(key))
      groups.set(key, {
        description: row.description,
        months: new Set(),
        amounts: [],
        category: row.category,
      });
    const g = groups.get(key)!;
    g.months.add(row.month);
    g.amounts.push(row.amount);
  }

  const existing = db
    .prepare('SELECT label FROM fixed_expenses WHERE user_id=? AND active = 1')
    .all(userId) as { label: string }[];
  const existingKeys = new Set(existing.map((f) => normalize(f.label)));

  const candidates = [];
  for (const [key, g] of groups) {
    if (g.months.size < 3) continue;
    const avg = g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;
    const consistent = g.amounts.every((a) => Math.abs(a - avg) / avg <= 0.15);
    if (!consistent) continue;
    if (existingKeys.has(key)) continue;
    if ([...existingKeys].some((ek) => ek.includes(key) || key.includes(ek))) continue;

    candidates.push({
      description: g.description,
      normalized_key: key,
      avg_amount: Math.round(avg * 100) / 100,
      months_seen: g.months.size,
      months: Array.from(g.months).sort(),
      category: g.category,
    });
  }

  candidates.sort((a, b) => b.months_seen - a.months_seen || b.avg_amount - a.avg_amount);
  return NextResponse.json(candidates);
});
