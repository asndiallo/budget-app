import { auth, requireAdmin, requireAuth } from '@/lib/auth';
import { getBAH, getBAS, getBasePay, isOfficer } from '@/lib/pay-tables';

import { NextResponse } from 'next/server';
import type { PayGrade } from '@/lib/pay-tables';
import { getDb } from '@/lib/db';

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    const {
      name,
      branch,
      pay_grade,
      mos,
      duty_station,
      bah_zip,
      component,
      dependents,
      years_of_service,
      joined_at,
      reseed_income,
    } = body;

    // Update user via Better Auth
    await auth.api.updateUser({
      headers: req.headers,
      body: {
        name: name,
        branch: branch,
        pay_grade: pay_grade,
        mos: mos,
        duty_station: duty_station,
        bah_zip: bah_zip,
        component: component,
        dependents: dependents,
        years_of_service: years_of_service,
        joined_at: joined_at,
      },
    });

    if (reseed_income) {
      const db = getDb();

      // Fetch the latest profile values (use body values, fall back to DB)
      const currentProfile = db
        .prepare(
          'SELECT pay_grade, duty_station, dependents, years_of_service FROM users WHERE id = ?',
        )
        .get(user.userId) as
        | {
            pay_grade: string;
            duty_station: string;
            dependents: number;
            years_of_service: number;
          }
        | undefined;

      const grade = (pay_grade ??
        currentProfile?.pay_grade ??
        'E-3') as PayGrade;
      const yos = years_of_service ?? currentProfile?.years_of_service ?? 0;
      const ds = duty_station ?? currentProfile?.duty_station ?? '';
      const deps = dependents ?? currentProfile?.dependents ?? 0;

      const basePay = getBasePay(grade, yos);
      const bas = getBAS(grade);
      const bah = getBAH(ds, grade, deps > 0);

      const updates: Record<string, number> = {
        base_pay: basePay,
        bas,
        bah,
        taxes:
          Math.round(basePay * (isOfficer(grade) ? 0.12 : 0.06) * 100) / 100,
        fica_soc_security: Math.round(basePay * 0.062 * 100) / 100,
        fica_medicare: Math.round(basePay * 0.0145 * 100) / 100,
      };

      const ins = db.prepare(
        'INSERT OR REPLACE INTO income_config (user_id, month, key, value) VALUES (?, ?, ?, ?)',
      );
      db.transaction(() => {
        for (const [key, value] of Object.entries(updates))
          ins.run(user.userId, '0000-00', key, value);
      })();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Admin: update another user's role
export async function PUT(req: Request) {
  try {
    const me = await requireAuth(req);
    requireAdmin(me);
    const db = getDb();
    const { id, role } = await req.json();
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
