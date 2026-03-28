import { getBAH, getBAS, getBasePay } from '@/lib/pay-tables';

import { NextResponse } from 'next/server';
import type { PayGrade } from '@/lib/pay-tables';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const profile = db
    .prepare(
      'SELECT pay_grade, duty_station, dependents, years_of_service FROM users WHERE id = ?',
    )
    .get(userId) as
    | {
        pay_grade: string;
        duty_station: string;
        dependents: number;
        years_of_service: number;
      }
    | undefined;

  if (!profile)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const grade = (profile.pay_grade ?? 'E-3') as PayGrade;
  const base_pay = getBasePay(grade, profile.years_of_service ?? 0);
  const bas = getBAS(grade);
  const bah = getBAH(
    profile.duty_station ?? '',
    grade,
    (profile.dependents ?? 0) > 0,
  );

  return NextResponse.json({ base_pay, bas, bah });
});
