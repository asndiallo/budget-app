import { NextResponse } from 'next/server';

import { dodMatchRate } from '@/lib/brs-calc';
import { CONTRIBUTION_LIMITS, INVESTMENT_CATEGORY } from '@/lib/config';
import { buildYearlyConfigLookup } from '@/lib/income';
import { getIraContributionsByTaxYear, getJoinedAt } from '@/lib/queries';
import { withAuth } from '@/lib/route-helpers';
import type { PaceStatus } from '@/lib/types';
import { countBiweeklyPeriods } from '@/lib/utils';

function pacingStatus(ytd: number, projected: number, limit: number): PaceStatus {
  if (ytd >= limit) return 'maxed';
  if (projected > limit * 1.02) return 'ahead';
  if (projected >= limit * 0.95) return 'on_track';
  return 'behind';
}

/** Whether the member has crossed the 2-year BRS vesting threshold by a given month. */
function isVested(monthStr: string, joinedAt: string | null): boolean {
  if (!joinedAt) return false;
  const joined = new Date(joinedAt + 'T12:00:00');
  const monthDate = new Date(monthStr + '-15T12:00:00');
  const diffMonths =
    (monthDate.getFullYear() - joined.getFullYear()) * 12 +
    (monthDate.getMonth() - joined.getMonth());
  return diffMonths >= 24;
}

export const GET = withAuth(async (req, { userId, db }) => {
  const year =
    parseInt(new URL(req.url).searchParams.get('year') ?? '') || new Date().getFullYear();

  // Resolve limits, falling back to the most recent known year
  const knownYears = Object.keys(CONTRIBUTION_LIMITS)
    .map(Number)
    .sort((a, b) => b - a);
  const limitsYear = knownYears.find((y) => y <= year) ?? knownYears[0];
  const limits = CONTRIBUTION_LIMITS[limitsYear];

  const today = new Date();
  const currentYear = today.getFullYear();
  const monthsElapsed = year < currentYear ? 12 : today.getMonth() + 1;

  const joinedAt = getJoinedAt(db, userId);
  const fieldsFor = buildYearlyConfigLookup(db, userId, year);

  let tspYtd = 0;
  let agencyYtd = 0;
  let iraFromConfig = 0;
  let hasConfigData = false;

  for (let m = 1; m <= monthsElapsed; m++) {
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;
    const fields = fieldsFor(monthStr);
    if (Object.keys(fields).length === 0) continue;
    hasConfigData = true;

    const base = fields['base_pay'] ?? 0;
    const tspRate = fields['tsp_rate'] ?? 0;
    tspYtd += base * tspRate;
    iraFromConfig += fields['roth_ira'] ?? 0;

    // Agency match: 1% automatic-only before 2-year vesting; full BRS match after.
    agencyYtd += base * (isVested(monthStr, joinedAt) ? dodMatchRate(tspRate) : 0.01);
  }

  // ── Roth IRA from investment fixed expenses ─────────────────────────────────
  const iraExpenses = db
    .prepare(
      `SELECT label, amount, recurrence, recurrence_anchor, end_date
       FROM fixed_expenses
       WHERE user_id = ? AND active = 1 AND is_investment = 1
         AND (LOWER(label) LIKE '%roth%' OR LOWER(label) LIKE '%ira%')
         AND LOWER(label) NOT LIKE '%tsp%'`,
    )
    .all(userId) as {
    label: string;
    amount: number;
    recurrence: string | null;
    recurrence_anchor: string | null;
    end_date: string | null;
  }[];

  let iraFromExpenses = 0;
  for (const exp of iraExpenses) {
    if (exp.recurrence === 'biweekly' && exp.recurrence_anchor) {
      iraFromExpenses +=
        exp.amount *
        countBiweeklyPeriods(
          year,
          exp.recurrence_anchor,
          exp.end_date,
          year < currentYear ? new Date(`${year}-12-31`) : today,
        );
    } else {
      iraFromExpenses += exp.amount * monthsElapsed;
    }
  }

  // ── Roth/Traditional IRA from transactions linked to a roth_ira/trad_ira account ──
  // Preferred over config/expense estimates. Uses tax_year override so prior-year
  // contributions (e.g. Jan 2026 → tax_year 2025) are attributed correctly.
  const iraFromTxs = getIraContributionsByTaxYear(db, userId, year, INVESTMENT_CATEGORY);

  // Prefer actual transaction data; fall back to configured estimates
  const iraYtd = iraFromTxs > 0 ? iraFromTxs : Math.max(iraFromConfig, iraFromExpenses);
  const hasData = hasConfigData || iraExpenses.length > 0 || iraFromTxs > 0;

  const tspRounded = Math.round(tspYtd);
  const iraRounded = Math.round(iraYtd);
  const remainingMonths = Math.max(0, 12 - monthsElapsed);

  const tspMonthlyAvg = monthsElapsed > 0 ? Math.round(tspRounded / monthsElapsed) : 0;
  const tspProjectedYearEnd = Math.round(tspMonthlyAvg * 12);
  const tspMonthlyNeeded =
    remainingMonths > 0 ? Math.max(0, Math.round((limits.tsp - tspRounded) / remainingMonths)) : 0;

  const iraMonthlyAvg = monthsElapsed > 0 ? Math.round(iraRounded / monthsElapsed) : 0;
  const iraProjectedYearEnd = Math.round(iraMonthlyAvg * 12);
  const iraMonthlyNeeded =
    remainingMonths > 0 ? Math.max(0, Math.round((limits.ira - iraRounded) / remainingMonths)) : 0;

  return NextResponse.json({
    year,
    limitsYear,
    tspYtd: tspRounded,
    tspLimit: limits.tsp,
    tspCatchupLimit: limits.tspCatchup,
    agencyYtd: Math.round(agencyYtd),
    iraYtd: iraRounded,
    iraLimit: limits.ira,
    iraCatchupLimit: limits.iraCatchup,
    monthsWithData: hasData ? monthsElapsed : 0,
    tspMonthlyAvg,
    tspProjectedYearEnd,
    tspMonthlyNeeded,
    tspPaceStatus: pacingStatus(tspRounded, tspProjectedYearEnd, limits.tsp),
    iraMonthlyAvg,
    iraProjectedYearEnd,
    iraMonthlyNeeded,
    iraPaceStatus: pacingStatus(iraRounded, iraProjectedYearEnd, limits.ira),
  });
});
