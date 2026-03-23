import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestUser, requireAdmin } from '@/lib/auth';

const TABLES = [
  'income_config',
  'fixed_expenses',
  'transactions',
  'goals',
  'payment_sources',
  'debts',
  'income_entries',
  'receivables',
  'category_budgets',
] as const;

// GET: Export current user's data (or all data if admin)
export async function GET(req: Request) {
  try {
    const { userId, role } = getRequestUser(req);
    const db = getDb();
    const dump: Record<string, unknown[]> = {};

    for (const table of TABLES) {
      if (role === 'admin' && new URL(req.url).searchParams.get('all') === '1') {
        dump[table] = db.prepare(`SELECT * FROM ${table}`).all();
      } else {
        dump[table] = db.prepare(`SELECT * FROM ${table} WHERE user_id = ?`).all(userId);
      }
    }

    const payload = JSON.stringify(
      { exportedAt: new Date().toISOString(), version: 2, userId, tables: dump },
      null, 2,
    );
    const date = new Date().toISOString().slice(0, 10);
    return new Response(payload, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="budget-backup-${date}.json"`,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Restore backup — admin only (replaces current user's data)
export async function POST(req: Request) {
  try {
    const reqUser = getRequestUser(req);
    requireAdmin(reqUser);

    const db = getDb();
    const body = await req.json();
    if (!body.tables || typeof body.tables !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid backup format' }, { status: 400 });
    }

    const tables = body.tables as Record<string, Record<string, unknown>[]>;
    let restored = 0;

    db.transaction(() => {
      for (const table of TABLES) {
        const rows = tables[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const cols = Object.keys(rows[0]);
        const placeholders = cols.map(() => '?').join(', ');
        const stmt = db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);
        for (const row of rows) {
          stmt.run(...cols.map((c) => row[c]));
          restored++;
        }
      }
    })();

    return NextResponse.json({ ok: true, restored });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
