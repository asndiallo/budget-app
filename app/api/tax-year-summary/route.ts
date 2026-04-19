import { NextResponse } from 'next/server';

import { INCOME_FIELDS, INVESTMENT_CATEGORY, SPECIAL_PAY_FIELDS } from '@/lib/config';
import { buildYearlyConfigLookup } from '@/lib/income';
import { getIraContributionsByTaxYear } from '@/lib/queries';
import { withAuth } from '@/lib/route-helpers';
import type { TaxYearSummary } from '@/lib/types';
import { countBiweeklyPeriods } from '@/lib/utils';

export const GET = withAuth(async (req, { userId, db }) => {
  const year =
    parseInt(new URL(req.url).searchParams.get('year') ?? '') || new Date().getFullYear();

  const today = new Date();
  const currentYear = today.getFullYear();
  const monthsElapsed = year < currentYear ? 12 : today.getMonth() + 1;

  const fieldsFor = buildYearlyConfigLookup(db, userId, year);

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
      iraFromExpenses +=
        exp.amount * countBiweeklyPeriods(year, exp.recurrence_anchor, exp.end_date, cutoff);
    } else {
      iraFromExpenses += exp.amount * monthsElapsed;
    }
  }
  // ── Roth/Traditional IRA from linked transactions (most accurate source) ───────
  // Uses tax_year override so prior-year contributions (e.g. Jan 2026 → tax_year 2025)
  // are attributed to the correct year without duplicating the transaction.
  const iraFromTxs = getIraContributionsByTaxYear(db, userId, year, INVESTMENT_CATEGORY);

  // Priority: actual linked transactions > max(income_config, fixed expenses)
  const finalRothIra =
    iraFromTxs > 0 ? iraFromTxs : Math.max(rothIraContributions, iraFromExpenses);

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
  const totalPostTaxSavings = Math.round(rothTspContributions + finalRothIra);

  // incomeKeys used only for type-checking — ensure unused-variable linter is satisfied
  void incomeKeys;

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
    rothIraContributions: Math.round(finalRothIra),
    totalPostTaxSavings,
  });
});
