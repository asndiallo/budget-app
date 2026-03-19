import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Apple Card CSV format:
// Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD)
// or simpler: Date,Description,Amount,Category

const CATEGORY_MAP: Record<string, string> = {
  'food and drink': 'Food',
  restaurants: 'Food',
  groceries: 'Food',
  transportation: 'Transport',
  gas: 'Transport',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  health: 'Personal care',
  subscriptions: 'Subscriptions',
  services: 'Other',
};

function mapCategory(raw: string): string {
  const lower = (raw || '').toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'Other';
}

export async function POST(req: Request) {
  const db = getDb();
  const { rows, month } = (await req.json()) as {
    rows: {
      description: string;
      amount: number;
      category: string;
      date: string;
    }[];
    month: string;
  };

  const insert = db.prepare(
    'INSERT INTO transactions (description, amount, category, month, source) VALUES (?, ?, ?, ?, ?)',
  );

  const insertAll = db.transaction(() => {
    let count = 0;
    for (const row of rows) {
      if (!row.description || !row.amount) continue;
      const cat = mapCategory(row.category);
      insert.run(
        row.description,
        Math.abs(row.amount),
        cat,
        month,
        'apple_card',
      );
      count++;
    }
    return count;
  });

  const count = insertAll();
  return NextResponse.json({ ok: true, imported: count });
}
