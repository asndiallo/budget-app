// Admin-only: list and manage all users.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { user, db }) => {
  requireAdmin(user);
  const users = db
    .prepare(
      `SELECT id, email, name, role, branch, pay_grade, duty_station, component, createdAt
       FROM users ORDER BY createdAt`,
    )
    .all();
  return NextResponse.json(users);
});

export const PATCH = withAuth(async (req, { user, db }) => {
  requireAdmin(user);
  const { id, role } = (await req.json()) as { id: string; role: string };
  if (!['admin', 'user', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { user, db }) => {
  requireAdmin(user);
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get('id') ?? '';

  if (targetId === user.userId) {
    return NextResponse.json(
      { error: 'Cannot delete yourself' },
      { status: 400 },
    );
  }

  db.transaction(() => {
    db.prepare(
      `DELETE FROM goal_contributions WHERE goal_id IN
       (SELECT id FROM goals WHERE user_id = ?)`,
    ).run(targetId);
    for (const table of [
      'income_config',
      'transactions',
      'goals',
      'fixed_expenses',
      'payment_sources',
      'debts',
      'income_entries',
      'receivables',
      'category_budgets',
      'assets',
    ]) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(targetId);
    }
    db.prepare('DELETE FROM sessions WHERE userId = ?').run(targetId);
    db.prepare('DELETE FROM accounts WHERE userId = ?').run(targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  })();

  return NextResponse.json({ ok: true });
});
