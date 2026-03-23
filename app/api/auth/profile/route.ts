// Update the current user's military profile.
// Also re-seeds income_config for the baseline month if pay-relevant fields change.

import type { Branch, Component } from '@/lib/types';
import { getBAH, getBAS, getBasePay, isOfficer } from '@/lib/pay-tables';

import { NextResponse } from 'next/server';
import type { PayGrade } from '@/lib/pay-tables';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

export async function PATCH(req: Request) {
  try {
    const user = getRequestUser(req);
    const db = getDb();

    const body = (await req.json()) as {
      display_name?: string;
      branch?: Branch;
      pay_grade?: string;
      mos?: string;
      duty_station?: string;
      bah_zip?: string;
      component?: Component;
      dependents?: number;
      years_of_service?: number;
      reseed_income?: boolean;
    };

    // Build dynamic UPDATE
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowed = [
      'display_name',
      'branch',
      'pay_grade',
      'mos',
      'duty_station',
      'bah_zip',
      'component',
      'dependents',
      'years_of_service',
    ] as const;

    for (const key of allowed) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(user.userId);
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(
        ...values,
      );
    }

    // Optionally reseed the income baseline from pay tables
    if (body.reseed_income) {
      const updated = db
        .prepare(
          'SELECT pay_grade, duty_station, dependents, years_of_service FROM users WHERE id = ?',
        )
        .get(user.userId) as {
        pay_grade: string;
        duty_station: string;
        dependents: number;
        years_of_service: number;
      };

      const grade = updated.pay_grade as PayGrade;
      const basePay = getBasePay(grade, updated.years_of_service);
      const bas = getBAS(grade);
      const bah = getBAH(updated.duty_station, grade, updated.dependents > 0);

      const payFields: Record<string, number> = {
        base_pay: basePay,
        bas,
        bah,
        fica_soc_security: Math.round(basePay * 0.062 * 100) / 100,
        fica_medicare: Math.round(basePay * 0.0145 * 100) / 100,
        taxes:
          Math.round(basePay * (isOfficer(grade) ? 0.12 : 0.06) * 100) / 100,
      };

      const upsert = db.prepare(
        `INSERT INTO income_config (user_id, month, key, value) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, month, key) DO UPDATE SET value = excluded.value`,
      );
      db.transaction(() => {
        for (const [key, value] of Object.entries(payFields))
          upsert.run(user.userId, '0000-00', key, value);
      })();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
