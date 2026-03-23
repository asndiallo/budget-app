// Admin-only: list and manage all users.

import { getRequestUser, requireAdmin } from '@/lib/auth';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const user = getRequestUser(req);
    requireAdmin(user);

    const db = getDb();
    const users = db
      .prepare(
        `SELECT id, username, role, display_name, branch, pay_grade,
                duty_station, component, created_at
         FROM users ORDER BY id`,
      )
      .all();

    return NextResponse.json(users);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Admin: update another user's role
export async function PATCH(req: Request) {
  try {
    const reqUser = getRequestUser(req);
    requireAdmin(reqUser);

    const { id, role } = (await req.json()) as { id: number; role: string };
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

// Admin: delete a user (cannot delete self)
export async function DELETE(req: Request) {
  try {
    const reqUser = getRequestUser(req);
    requireAdmin(reqUser);

    const { searchParams } = new URL(req.url);
    const targetId = parseInt(searchParams.get('id') ?? '0', 10);

    if (targetId === reqUser.userId) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 },
      );
    }

    const db = getDb();
    // Cascade delete all user data
    db.transaction(() => {
      for (const table of [
        'income_config',
        'transactions',
        'goals',
        'goal_contributions',
        'fixed_expenses',
        'payment_sources',
        'debts',
        'income_entries',
        'receivables',
        'category_budgets',
        'assets',
      ]) {
        if (table === 'goal_contributions') {
          // goal_contributions references goal_id, not user_id
          db.prepare(
            `DELETE FROM goal_contributions WHERE goal_id IN
             (SELECT id FROM goals WHERE user_id = ?)`,
          ).run(targetId);
        } else {
          db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(targetId);
        }
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    })();

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
