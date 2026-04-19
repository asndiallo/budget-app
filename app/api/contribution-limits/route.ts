import { NextResponse } from 'next/server';

import { dodMatchRate } from '@/lib/brs-calc';
import { CONTRIBUTION_LIMITS, INVESTMENT_CATEGORY } from '@/lib/config';
import { withAuth } from '@/lib/route-helpers';

const PERIOD_MS = 14 * 86_400 * 1_000;

function countBiweeklyPeriods(
  year: number,
  anchor: string,
  endDate: string | null,
  cutoff: Date,
): number {
  const anchorMs = new Date(anchor + 'T12:00:00').getTime();
  const yearStartMs = new Date(`${year}-01-01T12:00:00`).getTime();
  const cutoffMs = Math.min(
    cutoff.getTime(),
    endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity,
  );
  const diff = yearStartMs - anchorMs;
  const skip = Math.ceil(diff / PERIOD_MS);
  let cur = anchorMs + skip * PERIOD_MS;
  let count = 0;
  while (cur <= cutoffMs) {
    count++;
    cur += PERIOD_MS;
  }
  return count;
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

  // Fetch joined_at for agency match vesting calculation
  const profile = db.prepare('SELECT joined_at FROM users WHERE id = ?').get(userId) as
    | { joined_at: string | null }
    | undefined;
  const joinedAt = profile?.joined_at ?? null;

  // ── Income config: carry-forward within the year only ──────────────────────
  // Cross-year carry-forward is intentionally excluded: a missing month at the
  // start of the year means $0 contributed that month (e.g. started TSP in Feb).
  const configRows = db
    .prepare(
      `SELECT month, key, value
       FROM income_config
       WHERE user_id = ? AND month LIKE ?
       ORDER BY month`,
    )
    .all(userId, `${year}-%`) as { month: string; key: string; value: number }[];

  const configByMonth: Record<string, Record<string, number>> = {};
  for (const { month, key, value } of configRows) {
    (configByMonth[month] ??= {})[key] = value;
  }
  const configMonths = Object.keys(configByMonth).sort();

  // Returns the income config for the most recent month ≤ target, within the year.
  function fieldsFor(targetMonth: string): Record<string, number> {
    const applicable = configMonths.filter((m) => m <= targetMonth);
    if (applicable.length === 0) return {}; // No data yet this year → treat as $0
    return configByMonth[applicable[applicable.length - 1]];
  }

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
  // This is the most precise source: actual money sent to the account.
  // Preferred over config/expense estimates when present.
  const { iraFromTxs: _iraFromTxs } = db
    .prepare(
      `SELECT COALESCE(SUM(t.amount), 0) AS iraFromTxs
       FROM transactions t
       JOIN financial_accounts fa ON fa.id = t.account_id AND fa.user_id = t.user_id
       WHERE t.user_id = ? AND t.category = ? AND t.month LIKE ?
         AND fa.type IN ('roth_ira', 'trad_ira')`,
    )
    .get(userId, INVESTMENT_CATEGORY, `${year}-%`) as { iraFromTxs: number };

  // Prefer actual transaction data; fall back to configured estimates
  const iraYtd = _iraFromTxs > 0 ? _iraFromTxs : Math.max(iraFromConfig, iraFromExpenses);
  const hasData = hasConfigData || iraExpenses.length > 0 || _iraFromTxs > 0;

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
