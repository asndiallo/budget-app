import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    if (!month)
      return NextResponse.json({ error: 'month required' }, { status: 400 });
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT id, fixed_expense_id, month, paid_at FROM bill_payments WHERE user_id = ? AND month = ?',
      )
      .all(userId, month) as {
      id: number;
      fixed_expense_id: number;
      month: string;
      paid_at: string;
    }[];
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { fixed_expense_id, month } = await req.json();
    db.prepare(
      'INSERT OR IGNORE INTO bill_payments (user_id, fixed_expense_id, month) VALUES (?, ?, ?)',
    ).run(userId, fixed_expense_id, month);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { fixed_expense_id, month } = await req.json();
    db.prepare(
      'DELETE FROM bill_payments WHERE user_id = ? AND fixed_expense_id = ? AND month = ?',
    ).run(userId, fixed_expense_id, month);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
