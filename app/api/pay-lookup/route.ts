// Returns computed pay figures for a given grade / YOS / duty station.
// Used by the profile wizard to preview auto-filled income values.

import { NextResponse } from 'next/server';

import type { PayGrade } from '@/lib/pay-tables';
import { getBAH, getBAS, getBasePay, getRankTitle, INSTALLATIONS } from '@/lib/pay-tables';
import type { Branch } from '@/lib/types';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const grade = (searchParams.get('grade') ?? 'E-3') as PayGrade;
  const yos = parseFloat(searchParams.get('yos') ?? '0');
  const station = searchParams.get('station') ?? '';
  const withDep = searchParams.get('dependents') === '1';
  const branch = (searchParams.get('branch') ?? 'Army') as Branch;

  const basePay = getBasePay(grade, yos);
  const bas = getBAS(grade);
  const bah = getBAH(station, grade, withDep);
  const rankTitle = getRankTitle(branch, grade);

  return NextResponse.json({
    basePay,
    bas,
    bah,
    grossMonthly: basePay + bas + bah,
    rankTitle,
    installations: INSTALLATIONS.map((i) => ({ name: i.name, state: i.state })),
  });
}
