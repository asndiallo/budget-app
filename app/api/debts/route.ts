import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM debts ORDER BY id').all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const { label, lender, balance, monthly_payment, interest_rate } =
    await req.json();
  const result = db
    .prepare(
      'INSERT INTO debts (label, lender, balance, monthly_payment, interest_rate) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
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
}

export async function PATCH(req: Request) {
  const db = getDb();
  const { id, label, lender, balance, monthly_payment, interest_rate } =
    await req.json();
  db.prepare(
    'UPDATE debts SET label = COALESCE(?, label), lender = COALESCE(?, lender), balance = COALESCE(?, balance), monthly_payment = COALESCE(?, monthly_payment), interest_rate = COALESCE(?, interest_rate) WHERE id = ?',
  ).run(
    label ?? null,
    lender ?? null,
    balance ?? null,
    monthly_payment ?? null,
    interest_rate ?? null,
    id,
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { id } = await req.json();
  db.prepare('DELETE FROM debts WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
