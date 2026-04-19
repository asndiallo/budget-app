import { NextResponse } from 'next/server';

import { INCOME_FIELDS, SPECIAL_PAY_FIELDS } from '@/lib/config';
import { withAuth } from '@/lib/route-helpers';
import type { TaxYearSummary } from '@/lib/types';

export const GET = withAuth(async (req, { userId, db }) => {
  const year =
    parseInt(new URL(req.url).searchParams.get('year') ?? '') || new Date().getFullYear();

  const today = new Date();
  const currentYear = today.getFullYear();
  const monthsElapsed = year < currentYear ? 12 : today.getMonth() + 1;

  // Fetch all income_config rows for the year, ordered by month
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

  // Carry-forward within the year only
  function fieldsFor(targetMonth: string): Record<string, number> {
    const applicable = configMonths.filter((m) => m <= targetMonth);
    if (applicable.length === 0) return {};
    return configByMonth[applicable[applicable.length - 1]];
  }

  // Income field keys
  const incomeKeys = INCOME_FIELDS.map((f) => f.key);
  const specialPayKeys = SPECIAL_PAY_FIELDS.map((f) => f.key);
  const allowanceKeys = ['bas', 'bah'];
  const basePayKey = 'base_pay';

  let grossMilitaryPay = 0;
  let allowances = 0;
  let specialPays = 0;
  let rothTspContributions = 0;
  let sgli = 0;
  let afrh = 0;
  let mealDeductions = 0;
  let federalTaxWithheld = 0;
  let ficaSocialSecurity = 0;
  let ficaMedicare = 0;
  let rothIraContributions = 0;
  let combatZoneMonths = 0;
  let combatZoneExclusion = 0;
  let monthsWithData = 0;

  for (let m = 1; m <= monthsElapsed; m++) {
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;
    const fields = fieldsFor(monthStr);
    if (Object.keys(fields).length === 0) continue;
    monthsWithData++;

    const base = fields[basePayKey] ?? 0;
    const tspRate = fields['tsp_rate'] ?? 0;
    const combatZone = !!(fields['combat_zone'] ?? 0);

    // Income
    grossMilitaryPay += base;
    allowances += allowanceKeys.reduce((s, k) => s + (fields[k] ?? 0), 0);
    specialPays += specialPayKeys.reduce((s, k) => s + (fields[k] ?? 0), 0);

    // Roth TSP — post-tax, does NOT reduce taxable income
    rothTspContributions += base * tspRate;

    // Pre-tax deductions (SGLI, AFRH, meal deduction only — not TSP since it's Roth)
    sgli += fields['sgli'] ?? 0;
    afrh += fields['afrh'] ?? 0;
    mealDeductions += fields['meal_deduction'] ?? 0;

    // Combat zone: base pay excluded from taxable income (enlisted rule)
    if (combatZone) {
      combatZoneMonths++;
      combatZoneExclusion += base;
    }

    // Taxes withheld (federal exempt in combat zone months per CZTE)
    federalTaxWithheld += combatZone ? 0 : (fields['taxes'] ?? 0);
    ficaSocialSecurity += fields['fica_soc_security'] ?? 0;
    ficaMedicare += fields['fica_medicare'] ?? 0;

    // Roth IRA from income_config (fallback if not tracked as fixed expense)
    rothIraContributions += fields['roth_ira'] ?? 0;
  }

  // Roth IRA from investment fixed expenses — same logic as contribution-limits route
  const PERIOD_MS = 14 * 86_400 * 1_000;
  const iraExpenses = db
    .prepare(
      `SELECT amount, recurrence, recurrence_anchor, end_date
       FROM fixed_expenses
       WHERE user_id = ? AND active = 1 AND is_investment = 1
         AND (LOWER(label) LIKE '%roth%' OR LOWER(label) LIKE '%ira%')
         AND LOWER(label) NOT LIKE '%tsp%'`,
    )
    .all(userId) as {
    amount: number;
    recurrence: string | null;
    recurrence_anchor: string | null;
    end_date: string | null;
  }[];

  let iraFromExpenses = 0;
  const cutoff = year < currentYear ? new Date(`${year}-12-31`) : today;
  for (const exp of iraExpenses) {
    if (exp.recurrence === 'biweekly' && exp.recurrence_anchor) {
      const anchorMs = new Date(exp.recurrence_anchor + 'T12:00:00').getTime();
      const yearStartMs = new Date(`${year}-01-01T12:00:00`).getTime();
      const cutoffMs = Math.min(
        cutoff.getTime(),
        exp.end_date ? new Date(exp.end_date + 'T23:59:59').getTime() : Infinity,
      );
      const diff = yearStartMs - anchorMs;
      const skip = Math.ceil(diff / PERIOD_MS);
      let cur = anchorMs + skip * PERIOD_MS;
      let count = 0;
      while (cur <= cutoffMs) {
        count++;
        cur += PERIOD_MS;
      }
      iraFromExpenses += exp.amount * count;
    } else {
      iraFromExpenses += exp.amount * monthsElapsed;
    }
  }
  // Use the higher of income_config vs fixed expenses to avoid double-counting
  rothIraContributions = Math.max(rothIraContributions, iraFromExpenses);

  // Pre-tax deductions: SGLI + AFRH + meal only (Roth TSP is post-tax, not included)
  const totalPreTaxDeductions = sgli + afrh + mealDeductions;

  // Taxable income: base pay + special pays − pre-tax deductions − combat zone exclusion
  // Roth TSP is NOT subtracted (it's post-tax). BAH/BAS excluded by law (§134).
  const estimatedTaxableIncome = Math.max(
    0,
    grossMilitaryPay + specialPays - totalPreTaxDeductions - combatZoneExclusion,
  );

  const effectiveFederalRate =
    estimatedTaxableIncome > 0
      ? Math.round((federalTaxWithheld / estimatedTaxableIncome) * 1000) / 1000
      : 0;

  const totalTaxesWithheld = federalTaxWithheld + ficaSocialSecurity + ficaMedicare;
  const grossTotal = grossMilitaryPay + allowances + specialPays;
  const totalPostTaxSavings = Math.round(rothTspContributions + rothIraContributions);

  return NextResponse.json<TaxYearSummary>({
    year,
    monthsWithData,
    grossMilitaryPay: Math.round(grossMilitaryPay),
    allowances: Math.round(allowances),
    specialPays: Math.round(specialPays),
    grossTotal: Math.round(grossTotal),
    rothTspContributions: Math.round(rothTspContributions),
    sgli: Math.round(sgli),
    afrh: Math.round(afrh),
    mealDeductions: Math.round(mealDeductions),
    totalPreTaxDeductions: Math.round(totalPreTaxDeductions),
    combatZoneMonths,
    combatZoneExclusion: Math.round(combatZoneExclusion),
    federalTaxWithheld: Math.round(federalTaxWithheld),
    ficaSocialSecurity: Math.round(ficaSocialSecurity),
    ficaMedicare: Math.round(ficaMedicare),
    totalTaxesWithheld: Math.round(totalTaxesWithheld),
    estimatedTaxableIncome: Math.round(estimatedTaxableIncome),
    effectiveFederalRate,
    rothIraContributions: Math.round(rothIraContributions),
    totalPostTaxSavings,
  });
});
