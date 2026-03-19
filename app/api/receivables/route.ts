import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const rows = getDb()
    .prepare('SELECT * FROM receivables ORDER BY paid ASC, id DESC')
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { name, description, amount, month_created } = await req.json();
  const db = getDb();
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO receivables (name, description, amount, month_created) VALUES (?, ?, ?, ?)',
    )
    .run(name, description || '', amount, month_created);
  const row = db
    .prepare('SELECT * FROM receivables WHERE id = ?')
    .get(lastInsertRowid);
  return NextResponse.json(row);
}

// Records a payment (full or partial). Atomically:
//  1. Adds payment to amount_paid
//  2. Marks paid=1 + sets month_paid if fully settled
//  3. Creates an income_entry for the payment amount
// Also handles field edits when `payment` is absent (name, description, amount).
export async function PATCH(req: Request) {
  const body = await req.json();
  const db = getDb();

  // Field edit (name / description / amount)
  if (!('payment' in body)) {
    const { id, name, description, amount } = body as {
      id: number; name?: string; description?: string; amount?: number;
    };
    db.prepare(`
      UPDATE receivables SET
        name        = COALESCE(?, name),
        description = COALESCE(?, description),
        amount      = COALESCE(?, amount)
      WHERE id = ?
    `).run(name ?? null, description ?? null, amount ?? null, id);
    return NextResponse.json({ ok: true });
  }

  const { id, payment, month } = body as { id: number; payment: number; month: string };

  const row = db.prepare('SELECT * FROM receivables WHERE id = ?').get(id) as {
    name: string; description: string; amount: number; amount_paid: number;
  } | undefined;
  if (!row) return NextResponse.json({ ok: false }, { status: 404 });

  const newPaid = Math.min(row.amount_paid + payment, row.amount);
  const fullyPaid = newPaid >= row.amount;
  const label = `From ${row.name}${row.description ? ` — ${row.description}` : ''}`;

  db.transaction(() => {
    db.prepare(
      'UPDATE receivables SET amount_paid = ?, paid = ?, month_paid = ? WHERE id = ?',
    ).run(newPaid, fullyPaid ? 1 : 0, fullyPaid ? month : null, id);
    db.prepare(
      'INSERT INTO income_entries (description, amount, month, source) VALUES (?, ?, ?, ?)',
    ).run(label, payment, month, 'Receivable');
  })();

  return NextResponse.json({ ok: true, fullyPaid });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  getDb().prepare('DELETE FROM receivables WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
