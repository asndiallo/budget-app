import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM income_config').all() as {
    key: string;
    value: number;
  }[];
  const config = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return NextResponse.json(config);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json()) as Record<string, number>;
  const upsert = db.prepare(
    'INSERT INTO income_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  const update = db.transaction(() => {
    for (const [key, value] of Object.entries(body)) {
      upsert.run(key, value);
    }
  });
  update();
  return NextResponse.json({ ok: true });
}
