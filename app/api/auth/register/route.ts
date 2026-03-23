import type { Branch, Component } from '@/lib/types';
import { hashPassword, signToken, tokenCookie } from '@/lib/auth';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const db = getDb();
    const {
      username,
      password,
      display_name,
      branch,
      pay_grade,
      mos,
      duty_station,
      bah_zip,
      component,
      dependents,
      years_of_service,
    } = (await req.json()) as {
      username: string;
      password: string;
      display_name?: string;
      branch?: Branch;
      pay_grade?: string;
      mos?: string;
      duty_station?: string;
      bah_zip?: string;
      component?: Component;
      dependents?: number;
      years_of_service?: number;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 },
      );
    }

    // Determine role: first real user becomes admin
    const userCount = (
      db
        .prepare('SELECT count(*) as n FROM users WHERE password_hash != ?')
        .get('') as {
        n: number;
      }
    ).n;
    const role = userCount === 0 ? 'admin' : 'user';

    const existing = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(username);
    if (existing) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 },
      );
    }

    const password_hash = await hashPassword(password);

    const result = db
      .prepare(
        `INSERT INTO users
          (username, password_hash, role, display_name, branch, pay_grade, mos,
           duty_station, bah_zip, component, dependents, years_of_service)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        username,
        password_hash,
        role,
        display_name || username,
        branch || 'Army',
        pay_grade || 'E-3',
        mos || '',
        duty_station || '',
        bah_zip || '',
        component || 'Active',
        dependents ?? 0,
        years_of_service ?? 0,
      );

    const userId = result.lastInsertRowid as number;

    // Seed income config from pay tables based on profile
    _seedIncomeForUser(
      db,
      userId,
      pay_grade || 'E-3',
      duty_station || '',
      dependents ?? 0,
      years_of_service ?? 0,
    );

    const token = await signToken({
      sub: String(userId),
      username,
      role: role as 'admin' | 'user',
      displayName: display_name || username,
    });

    const response = NextResponse.json({ ok: true, role });
    response.headers.set('Set-Cookie', tokenCookie(token));
    return response;
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}

function _seedIncomeForUser(
  db: ReturnType<typeof getDb>,
  userId: number,
  payGrade: string,
  dutyStation: string,
  dependents: number,
  yos: number,
) {
  const { getBasePay, getBAS, getBAH, isOfficer } =
    require('@/lib/pay-tables') as typeof import('@/lib/pay-tables');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grade = payGrade as any;
  const basePay = getBasePay(grade, yos);
  const bas = getBAS(grade);
  const bah = getBAH(dutyStation, grade, dependents > 0);

  const INCOME_SEED: Record<string, number> = {
    base_pay: basePay,
    bas,
    bah,
    other: 0,
    tsp_rate: 0.05, // BRS automatic contribution
    taxes: Math.round(basePay * 0.06 * 100) / 100,
    fica_soc_security: Math.round(basePay * 0.062 * 100) / 100,
    fica_medicare: Math.round(basePay * 0.0145 * 100) / 100,
    sgli: isOfficer(grade) ? 26.0 : 26.0,
    afrh: 0.5,
    meal_deduction: 0,
    roth_ira: 0,
  };

  const ins = db.prepare(
    'INSERT OR IGNORE INTO income_config (user_id, month, key, value) VALUES (?, ?, ?, ?)',
  );
  db.transaction(() => {
    for (const [key, value] of Object.entries(INCOME_SEED))
      ins.run(userId, '0000-00', key, value);
  })();
}
