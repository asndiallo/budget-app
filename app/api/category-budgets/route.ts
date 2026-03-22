import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare('SELECT category, budget FROM category_budgets')
    .all() as { category: string; budget: number }[];
  return NextResponse.json(rows);
}

export async function PUT(req: Request) {
  const db = getDb();
  const { category, budget } = await req.json();
  db.prepare(
    'INSERT INTO category_budgets (category, budget) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET budget = excluded.budget',
  ).run(category, budget);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { category } = await req.json();
  db.prepare('DELETE FROM category_budgets WHERE category = ?').run(category);
  return NextResponse.json({ ok: true });
}
