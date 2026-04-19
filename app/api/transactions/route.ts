import { NextResponse } from 'next/server';

import { autoMatchBills } from '@/lib/bill-match';
import { categorizeTransaction, detectAccountId } from '@/lib/categorization';
import { getAccountsForDetection } from '@/lib/queries';
import { withAuth } from '@/lib/route-helpers';
import { currentMonth } from '@/lib/utils';

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    const rows = db
      .prepare(
        `SELECT * FROM transactions
         WHERE user_id = ? AND (description LIKE ? OR category LIKE ?)
         ORDER BY month DESC, created_at DESC
         LIMIT 200`,
      )
      .all(userId, like, like);
    return NextResponse.json(rows);
  }

  const month = searchParams.get('month') || currentMonth();
  const rows = db
    .prepare('SELECT * FROM transactions WHERE user_id = ? AND month = ? ORDER BY created_at DESC')
    .all(userId, month);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { description, amount, category, month, source } = await req.json();
  const m = month || currentMonth();
  const resolvedCategory = categorizeTransaction(description, { explicitCategory: category });
  const accountId = detectAccountId(description, getAccountsForDetection(db, userId));
  const result = db
    .prepare(
      'INSERT INTO transactions (user_id, description, amount, category, month, source, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(userId, description, amount, resolvedCategory, m, source || 'manual', accountId);
  autoMatchBills(db, userId, [m]);
  return NextResponse.json({
    id: result.lastInsertRowid,
    description,
    amount,
    category: resolvedCategory,
    month: m,
    account_id: accountId,
  });
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const body = await req.json();

  // Bulk recategorize
  if (Array.isArray(body.ids) && body.category) {
    const placeholders = body.ids.map(() => '?').join(',');
    db.prepare(
      `UPDATE transactions SET category = ? WHERE id IN (${placeholders}) AND user_id = ?`,
    ).run(body.category, ...body.ids, userId);
    return NextResponse.json({ ok: true });
  }

  // Bulk link / unlink account
  if (Array.isArray(body.ids) && 'account_id' in body) {
    const placeholders = body.ids.map(() => '?').join(',');
    db.prepare(
      `UPDATE transactions SET account_id = ? WHERE id IN (${placeholders}) AND user_id = ?`,
    ).run(body.account_id ?? null, ...body.ids, userId);
    return NextResponse.json({ ok: true });
  }

  const { id, description, amount, category, notes } = body;
  const sets: string[] = [
    'description = COALESCE(?, description)',
    'amount = COALESCE(?, amount)',
    'category = COALESCE(?, category)',
    'notes = COALESCE(?, notes)',
  ];
  const vals: (string | number | null)[] = [
    description ?? null,
    amount ?? null,
    category ?? null,
    notes ?? null,
  ];

  // account_id: allow explicit null to clear the link
  if ('account_id' in body) {
    sets.push('account_id = ?');
    vals.push(body.account_id ?? null);
  }

  db.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(
    ...vals,
    id,
    userId,
  );
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const body = await req.json();

  // Bulk delete
  if (Array.isArray(body.ids)) {
    const placeholders = body.ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders}) AND user_id = ?`).run(
      ...body.ids,
      userId,
    );
    return NextResponse.json({ ok: true });
  }

  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(body.id, userId);
  return NextResponse.json({ ok: true });
});
