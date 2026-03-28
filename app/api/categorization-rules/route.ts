import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare(
      'SELECT id, keyword, category FROM categorization_rules WHERE user_id = ? ORDER BY keyword',
    )
    .all(userId) as { id: number; keyword: string; category: string }[];
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { keyword, category } = await req.json();
  if (!keyword?.trim() || !category) {
    return NextResponse.json(
      { error: 'keyword and category required' },
      { status: 400 },
    );
  }
  const row = db
    .prepare(
      'INSERT INTO categorization_rules (user_id, keyword, category) VALUES (?, ?, ?) ON CONFLICT(user_id, keyword) DO UPDATE SET category = excluded.category RETURNING id, keyword, category',
    )
    .get(userId, keyword.trim().toLowerCase(), category) as {
    id: number;
    keyword: string;
    category: string;
  };
  return NextResponse.json(row);
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare(
    'DELETE FROM categorization_rules WHERE user_id = ? AND id = ?',
  ).run(userId, id);
  return NextResponse.json({ ok: true });
});
