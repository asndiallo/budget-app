import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Strips trailing reference codes, dates, and noise so "SPOTIFY P3Y7G8" and
// "SPOTIFY A1B2C3" collapse to the same key.
function normalize(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/\*[a-z0-9]+/gi, '')        // *REFCODE after merchant name
    .replace(/\s+[a-z0-9]{6,}$/i, '')    // trailing standalone ref codes
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '') // date fragments
    .replace(/\d{4,}/g, '')              // 4+ digit numbers (order IDs etc.)
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

export async function GET() {
  const db = getDb();

  const since = monthsBack(6);

  const rows = db
    .prepare(
      `SELECT description, amount, month, category
       FROM transactions
       WHERE month >= ?
       ORDER BY description, month`,
    )
    .all(since) as {
    description: string;
    amount: number;
    month: string;
    category: string;
  }[];

  // Group by normalized description
  const groups = new Map<
    string,
    { description: string; months: Set<string>; amounts: number[]; category: string }
  >();

  for (const row of rows) {
    const key = normalize(row.description);
    if (!key || key.length < 3) continue;
    if (!groups.has(key)) {
      groups.set(key, {
        description: row.description,
        months: new Set(),
        amounts: [],
        category: row.category,
      });
    }
    const g = groups.get(key)!;
    g.months.add(row.month);
    g.amounts.push(row.amount);
  }

  // Existing fixed expense labels (normalized) to avoid surfacing already-tracked bills
  const existing = db
    .prepare('SELECT label FROM fixed_expenses WHERE active = 1')
    .all() as { label: string }[];
  const existingKeys = new Set(existing.map((f) => normalize(f.label)));

  const candidates = [];
  for (const [key, g] of groups) {
    if (g.months.size < 3) continue;

    // Amount consistency: all values within 15% of the mean
    const avg = g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;
    const consistent = g.amounts.every((a) => Math.abs(a - avg) / avg <= 0.15);
    if (!consistent) continue;

    // Skip if already tracked as a fixed expense
    if (existingKeys.has(key)) continue;
    // Also skip if any existing fixed label is a substring match
    const alreadyTracked = [...existingKeys].some(
      (ek) => ek.includes(key) || key.includes(ek),
    );
    if (alreadyTracked) continue;

    candidates.push({
      description: g.description,
      normalized_key: key,
      avg_amount: Math.round(avg * 100) / 100,
      months_seen: g.months.size,
      months: Array.from(g.months).sort(),
      category: g.category,
    });
  }

  // Sort: most consistent (most months) first, then by amount desc
  candidates.sort(
    (a, b) => b.months_seen - a.months_seen || b.avg_amount - a.avg_amount,
  );

  return NextResponse.json(candidates);
}
