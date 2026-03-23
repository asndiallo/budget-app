// Admin-only: list and manage all users.

import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    requireAdmin(user);

    const db = getDb();
    const users = db
      .prepare(
        `SELECT id, email, name, role, branch, pay_grade, duty_station, component, createdAt
         FROM users ORDER BY createdAt`,
      )
      .all();

    return NextResponse.json(users);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await requireAuth(req);
    requireAdmin(me);

    const { id, role } = (await req.json()) as { id: string; role: string };
    if (!['admin', 'user', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await requireAuth(req);
    requireAdmin(me);

    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('id') ?? '';

    if (targetId === me.userId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    const db = getDb();
    db.transaction(() => {
      db.prepare(
        `DELETE FROM goal_contributions WHERE goal_id IN
         (SELECT id FROM goals WHERE user_id = ?)`,
      ).run(targetId);
      for (const table of [
        'income_config', 'transactions', 'goals', 'fixed_expenses',
        'payment_sources', 'debts', 'income_entries', 'receivables',
        'category_budgets', 'assets',
      ]) {
        db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(targetId);
      }
      // Better Auth tables
      db.prepare('DELETE FROM sessions WHERE userId = ?').run(targetId);
      db.prepare('DELETE FROM accounts WHERE userId = ?').run(targetId);
      db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    })();

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
