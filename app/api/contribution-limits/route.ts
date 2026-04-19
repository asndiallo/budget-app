import { NextResponse } from 'next/server';

import { dodMatchRate } from '@/lib/brs-calc';
import { CONTRIBUTION_LIMITS, INVESTMENT_CATEGORY } from '@/lib/config';
import { buildYearlyConfigLookup } from '@/lib/income';
import { getIraContributionsByTaxYear, getJoinedAt } from '@/lib/queries';
import { withAuth } from '@/lib/route-helpers';
import { countBiweeklyPeriods } from '@/lib/utils';

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

  return NextResponse.json({
    year,
    limitsYear,
    tspYtd: Math.round(tspYtd),
    tspLimit: limits.tsp,
    tspCatchupLimit: limits.tspCatchup,
    agencyYtd: Math.round(agencyYtd),
    iraYtd: Math.round(iraYtd),
    iraLimit: limits.ira,
    iraCatchupLimit: limits.iraCatchup,
    monthsWithData: hasData ? monthsElapsed : 0,
  });
});
