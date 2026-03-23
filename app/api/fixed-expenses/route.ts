import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM fixed_expenses WHERE user_id = ? AND active = 1 ORDER BY id',
      )
      .all(userId);
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { label, amount, period, day_of_month, notes, is_investment } =
      await req.json();
    const p = period === 'annual' ? 'annual' : 'monthly';
    const dom = day_of_month ? Number(day_of_month) : null;
    const inv = is_investment ? 1 : 0;
    const result = db
      .prepare(
        'INSERT INTO fixed_expenses (user_id, label, amount, period, day_of_month, notes, is_investment) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(userId, label, amount, p, dom, notes ?? null, inv);
    return NextResponse.json({
      id: result.lastInsertRowid,
      label,
      amount,
      period: p,
      day_of_month: dom,
      notes: notes ?? null,
      is_investment: inv,
      active: 1,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { id } = await req.json();
    db.prepare(
      'UPDATE fixed_expenses SET active = 0 WHERE id = ? AND user_id = ?',
    ).run(id, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { id, label, amount, period, day_of_month, notes, is_investment } =
      await req.json();
    const dom = day_of_month ? Number(day_of_month) : null;
    db.prepare(
      'UPDATE fixed_expenses SET label = ?, amount = ?, period = ?, day_of_month = ?, notes = ?, is_investment = ? WHERE id = ? AND user_id = ?',
    ).run(
      label,
      amount,
      period ?? 'monthly',
      dom,
      notes ?? null,
      is_investment ? 1 : 0,
      id,
      userId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
