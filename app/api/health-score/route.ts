import { computeMonthlyFinancials, incomeForMonth } from '@/lib/income';

import { DEDUCTION_FIELDS } from '@/lib/config';
import type { HealthScoreComponent } from '@/lib/types';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function lastCompleteMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  for (let i = 0; i < n; i++) {
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    );
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export async function GET() {
  const db = getDb();

  // ── Shared data ──────────────────────────────────────────────────────────
  const fixedMonthly = (
    db
      .prepare('SELECT amount, period FROM fixed_expenses WHERE active = 1')
      .all() as { amount: number; period: string }[]
  ).reduce((s, f) => s + (f.period === 'annual' ? f.amount / 12 : f.amount), 0);

  const debtPayments = (
    db.prepare('SELECT monthly_payment FROM debts WHERE balance > 0').all() as {
      monthly_payment: number;
    }[]
  ).reduce((s, d) => s + d.monthly_payment, 0);

  const committed = fixedMonthly + debtPayments;

  const [lastMonth] = lastCompleteMonths(1);

  // ── Component 1: Savings Rate (25 pts) ───────────────────────────────────
  // avg(net / totalIncome) over last 3 complete months with data; linearly
  // scaled so that ≥20% savings rate earns the full 25 points.
  let savingsScore = 0;
  let savingsDetail = 'No income data yet';
  {
    const months = lastCompleteMonths(3);
    const rates: number[] = [];
    for (const month of months) {
      const { totalIncome, tsp } = computeMonthlyFinancials(db, month);
      if (totalIncome === 0) continue;
      const config = incomeForMonth(db, month);
      const deductions =
        tsp + DEDUCTION_FIELDS.reduce((s, f) => s + (config[f.key] ?? 0), 0);
      const extraIncome = (
        db
          .prepare(
            'SELECT COALESCE(SUM(amount),0) as s FROM income_entries WHERE month=?',
          )
          .get(month) as { s: number }
      ).s;
      const spending = (
        db
          .prepare(
            'SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE month=?',
          )
          .get(month) as { s: number }
      ).s;
      const net = totalIncome + extraIncome - deductions - committed - spending;
      rates.push(net / totalIncome);
    }
    if (rates.length > 0) {
      const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length;
      const pct = Math.round(avgRate * 100);
      savingsScore = clamp(Math.round((avgRate / 0.2) * 25), 0, 25);
      savingsDetail = `${pct}% avg savings rate`;
    }
  }

  // ── Component 2: Emergency Fund (25 pts) ────────────────────────────────
  // liquid (checking + savings) ÷ avg monthly expenses; linearly scaled so
  // that 6+ months of coverage earns the full 25 points.
  let efScore = 0;
  let efDetail = 'No liquid assets recorded';
  {
    const liquidAssets = (
      db
        .prepare(
          "SELECT COALESCE(SUM(balance),0) as s FROM assets WHERE category IN ('Checking','Savings')",
        )
        .get() as { s: number }
    ).s;
    const liquidGoals = (
      db
        .prepare('SELECT COALESCE(SUM(saved),0) as s FROM goals WHERE active = 1')
        .get() as { s: number }
    ).s;
    const liquid = liquidAssets + liquidGoals;

    if (liquid > 0) {
      const months = lastCompleteMonths(6);
      const spends: number[] = [];
      for (const month of months) {
        const s = (
          db
            .prepare(
              'SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE month=?',
            )
            .get(month) as { s: number }
        ).s;
        if (s > 0) spends.push(s);
      }
      const avgExpenses =
        spends.length > 0
          ? spends.reduce((a, b) => a + b, 0) / spends.length
          : null;

      if (avgExpenses && avgExpenses > 0) {
        const months = liquid / avgExpenses;
        efScore = clamp(Math.round((months / 6) * 25), 0, 25);
        efDetail = `${months.toFixed(1)} months covered`;
      } else {
        efScore = 12; // liquid assets exist but can't compute months
        efDetail = `$${Math.round(liquid).toLocaleString()} in liquid assets`;
      }
    }
  }

  // ── Component 3: Debt-to-Income (25 pts) ────────────────────────────────
  // DTI = monthly debt payments ÷ gross income; scaled so that 0% → 25 pts
  // and 43%+ (conventional lending ceiling) → 0 pts.
  let dtiScore = 25;
  let dtiDetail = 'No active debts';
  {
    const { totalIncome } = computeMonthlyFinancials(db, lastMonth);
    if (totalIncome > 0 && debtPayments > 0) {
      const dti = debtPayments / totalIncome;
      dtiScore = clamp(Math.round((1 - dti / 0.43) * 25), 0, 25);
      dtiDetail = `${Math.round(dti * 100)}% DTI`;
    } else if (totalIncome === 0) {
      dtiScore = 0;
      dtiDetail = 'No income data';
    }
  }

  // ── Component 4: Budget Adherence (25 pts) ───────────────────────────────
  // Ratio of actual spending to budgeted amount across all budgeted
  // categories for the last complete month.  If no budgets are configured,
  // a neutral 12 pts is awarded to encourage users to set them.
  let budgetScore = 12;
  let budgetDetail = 'Set category budgets to score this';
  {
    const budgets = db
      .prepare('SELECT category, budget FROM category_budgets')
      .all() as { category: string; budget: number }[];

    if (budgets.length > 0) {
      const spending = db
        .prepare(
          `SELECT category, SUM(amount) as total
           FROM transactions WHERE month = ?
           GROUP BY category`,
        )
        .all(lastMonth) as { category: string; total: number }[];

      const spendMap = Object.fromEntries(
        spending.map((r) => [r.category, r.total]),
      );

      const totalBudget = budgets.reduce((s, b) => s + b.budget, 0);
      const totalSpent = budgets.reduce(
        (s, b) => s + (spendMap[b.category] ?? 0),
        0,
      );

      if (totalBudget > 0) {
        const ratio = totalSpent / totalBudget;
        budgetScore =
          ratio < 0.8
            ? 25
            : ratio < 1.0
              ? Math.round((1 - (ratio - 0.8) / 0.2) * 10 + 15) // 15–25
              : ratio < 1.15
                ? Math.round((1 - (ratio - 1.0) / 0.15) * 8) // 0–8
                : 0;
        budgetScore = clamp(budgetScore, 0, 25);
        const pct = Math.round(ratio * 100);
        budgetDetail = `${pct}% of budget used`;
      }
    }
  }

  const components: HealthScoreComponent[] = [
    {
      name: 'Savings rate',
      score: savingsScore,
      max: 25,
      detail: savingsDetail,
    },
    { name: 'Emergency fund', score: efScore, max: 25, detail: efDetail },
    { name: 'Debt-to-income', score: dtiScore, max: 25, detail: dtiDetail },
    {
      name: 'Budget adherence',
      score: budgetScore,
      max: 25,
      detail: budgetDetail,
    },
  ];

  return NextResponse.json({
    total: components.reduce((s, c) => s + c.score, 0),
    components,
  });
}
