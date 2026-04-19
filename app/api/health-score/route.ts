import { NextResponse } from 'next/server';

import { INVESTMENT_CATEGORY } from '@/lib/config';
import { computeMonthlyFinancials } from '@/lib/income';
import { withAuth } from '@/lib/route-helpers';
import type { HealthScoreComponent } from '@/lib/types';
import { investmentForMonth, isBeforeMonth } from '@/lib/utils';

function lastCompleteMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  for (let i = 0; i < n; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export const GET = withAuth(async (_req, { userId, db }) => {
  const profile = db.prepare('SELECT joined_at FROM users WHERE id = ?').get(userId) as
    | { joined_at: string | null }
    | undefined;
  const joinedAt = profile?.joined_at ?? null;

  const debtPayments = (
    db.prepare('SELECT monthly_payment FROM debts WHERE user_id=? AND balance > 0').all(userId) as {
      monthly_payment: number;
    }[]
  ).reduce((s, d) => s + d.monthly_payment, 0);

  const lastMonth = lastCompleteMonths(1)[0];

  // Investment fixed expenses — needed for the same invested calculation used by overview/ytd
  const investmentExpenses = db
    .prepare(
      `SELECT amount, period, recurrence, recurrence_anchor, end_date
       FROM fixed_expenses WHERE user_id = ? AND active = 1 AND is_investment = 1`,
    )
    .all(userId) as {
    amount: number;
    period: string;
    recurrence: string | null;
    recurrence_anchor: string | null;
    end_date: string | null;
  }[];

  // ── Savings Rate ──────────────────────────────────────────────────────────
  // Uses the same formula as overview/ytd:
  //   invested = tsp + investmentFixedExpenses + investmentTxs
  //   net      = income − invested − spending  (spending excludes Investment category)
  //   rate     = (invested + max(0, net)) / income
  let savingsScore = 0;
  let savingsDetail = 'No income data yet';
  {
    const months = lastCompleteMonths(3);
    const rates: number[] = [];
    for (const month of months) {
      if (joinedAt && isBeforeMonth(month, joinedAt)) continue;
      const { totalIncome: income, tsp } = computeMonthlyFinancials(db, month, userId);
      if (income === 0) continue;

      const investmentTxs = (
        db
          .prepare(
            'SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE user_id=? AND month=? AND category=?',
          )
          .get(userId, month, INVESTMENT_CATEGORY) as { s: number }
      ).s;

      const spending = (
        db
          .prepare(
            'SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE user_id=? AND month=? AND category!=?',
          )
          .get(userId, month, INVESTMENT_CATEGORY) as { s: number }
      ).s;

      const invested = tsp + investmentForMonth(investmentExpenses, month) + investmentTxs;
      const net = income - invested - spending;
      rates.push((invested + Math.max(0, net)) / income);
    }
    if (rates.length > 0) {
      const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length;
      savingsScore = clamp(Math.round((avgRate / 0.2) * 25), 0, 25);
      savingsDetail = `${Math.round(avgRate * 100)}% avg savings rate`;
    }
  }

  // ── Emergency Fund ────────────────────────────────────────────────────────
  let efScore = 0;
  let efDetail = 'No liquid assets recorded';
  {
    const liquidAssets = (
      db
        .prepare(
          "SELECT COALESCE(SUM(balance),0) AS s FROM assets WHERE user_id=? AND category IN ('Checking','Savings')",
        )
        .get(userId) as { s: number }
    ).s;
    const liquidGoals = (
      db
        .prepare('SELECT COALESCE(SUM(saved),0) AS s FROM goals WHERE user_id=? AND active = 1')
        .get(userId) as { s: number }
    ).s;
    const liquid = liquidAssets + liquidGoals;
    if (liquid > 0) {
      const months = lastCompleteMonths(6);
      const spends: number[] = [];
      for (const month of months) {
        if (joinedAt && isBeforeMonth(month, joinedAt)) continue;
        // Exclude Investment transactions — they aren't living expenses
        const s = (
          db
            .prepare(
              'SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE user_id=? AND month=? AND category!=?',
            )
            .get(userId, month, INVESTMENT_CATEGORY) as { s: number }
        ).s;
        if (s > 0) spends.push(s);
      }
      const avgExpenses =
        spends.length > 0 ? spends.reduce((a, b) => a + b, 0) / spends.length : null;
      if (avgExpenses && avgExpenses > 0) {
        efScore = clamp(Math.round((liquid / avgExpenses / 6) * 25), 0, 25);
        efDetail = `${(liquid / avgExpenses).toFixed(1)} months covered`;
      } else {
        efScore = 12;
        efDetail = `$${Math.round(liquid).toLocaleString()} in liquid assets`;
      }
    }
  }

  // ── Debt-to-Income ────────────────────────────────────────────────────────
  let dtiScore = 25;
  let dtiDetail = 'No active debts';
  {
    const { totalIncome } = computeMonthlyFinancials(db, lastMonth, userId);
    if (totalIncome > 0 && debtPayments > 0) {
      const dti = debtPayments / totalIncome;
      dtiScore = clamp(Math.round((1 - dti / 0.43) * 25), 0, 25);
      dtiDetail = `${Math.round(dti * 100)}% DTI`;
    } else if (totalIncome === 0) {
      dtiScore = 0;
      dtiDetail = 'No income data';
    }
  }

  // ── Budget Adherence ──────────────────────────────────────────────────────
  let budgetScore = 12;
  let budgetDetail = 'Set category budgets to score this';
  {
    const budgets = db
      .prepare('SELECT category, budget FROM category_budgets WHERE user_id=?')
      .all(userId) as { category: string; budget: number }[];
    if (budgets.length > 0) {
      const spending = db
        .prepare(
          'SELECT category, SUM(amount) AS total FROM transactions WHERE user_id=? AND month=? GROUP BY category',
        )
        .all(userId, lastMonth) as { category: string; total: number }[];
      const spendMap = Object.fromEntries(spending.map((r) => [r.category, r.total]));
      const totalBudget = budgets.reduce((s, b) => s + b.budget, 0);
      const totalSpent = budgets.reduce((s, b) => s + (spendMap[b.category] ?? 0), 0);
      if (totalBudget > 0) {
        const ratio = totalSpent / totalBudget;
        budgetScore =
          ratio < 0.8
            ? 25
            : ratio < 1.0
              ? Math.round((1 - (ratio - 0.8) / 0.2) * 10 + 15)
              : ratio < 1.15
                ? Math.round((1 - (ratio - 1.0) / 0.15) * 8)
                : 0;
        budgetScore = clamp(budgetScore, 0, 25);
        budgetDetail = `${Math.round(ratio * 100)}% of budget used`;
      }
    }
  }

  const components: HealthScoreComponent[] = [
    { name: 'Savings rate', score: savingsScore, max: 25, detail: savingsDetail },
    { name: 'Emergency fund', score: efScore, max: 25, detail: efDetail },
    { name: 'Debt-to-income', score: dtiScore, max: 25, detail: dtiDetail },
    { name: 'Budget adherence', score: budgetScore, max: 25, detail: budgetDetail },
  ];

  return NextResponse.json({
    total: components.reduce((s, c) => s + c.score, 0),
    components,
  });
});
