import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY id')
      .all(userId);
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
    const { label, lender, balance, monthly_payment, interest_rate } =
      await req.json();
    const result = db
      .prepare(
        'INSERT INTO debts (user_id, label, lender, balance, monthly_payment, interest_rate) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        userId,
        label,
        lender ?? '',
        balance ?? 0,
        monthly_payment ?? 0,
        interest_rate ?? 0,
      );
    return NextResponse.json({
      id: result.lastInsertRowid,
      label,
      lender: lender ?? '',
      balance: balance ?? 0,
      monthly_payment: monthly_payment ?? 0,
      interest_rate: interest_rate ?? 0,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { id, label, lender, balance, monthly_payment, interest_rate } =
      await req.json();
    db.prepare(
      'UPDATE debts SET label = COALESCE(?, label), lender = COALESCE(?, lender), balance = COALESCE(?, balance), monthly_payment = COALESCE(?, monthly_payment), interest_rate = COALESCE(?, interest_rate) WHERE id = ? AND user_id = ?',
    ).run(
      label ?? null,
      lender ?? null,
      balance ?? null,
      monthly_payment ?? null,
      interest_rate ?? null,
      id,
      userId,
    );
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
    const { id } = await req.json();
    db.prepare('DELETE FROM debts WHERE id = ? AND user_id = ?').run(
      id,
      userId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
