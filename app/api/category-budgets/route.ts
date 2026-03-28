import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare(
      'SELECT category, budget, percentage FROM category_budgets WHERE user_id = ?',
    )
    .all(userId) as {
    category: string;
    budget: number;
    percentage: number | null;
  }[];
  return NextResponse.json(rows);
});

export const PUT = withAuth(async (req, { userId, db }) => {
  const { category, budget, percentage } = await req.json();
  db.prepare(
    'INSERT INTO category_budgets (user_id, category, budget, percentage) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, category) DO UPDATE SET budget = excluded.budget, percentage = excluded.percentage',
  ).run(userId, category, budget ?? 0, percentage ?? null);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { category } = await req.json();
  db.prepare(
    'DELETE FROM category_budgets WHERE user_id = ? AND category = ?',
  ).run(userId, category);
  return NextResponse.json({ ok: true });
});
