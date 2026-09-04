import type Database from 'better-sqlite3';

import { INVESTMENT_CATEGORY } from './config';
import { computeSavingsRate } from './financials';
import { computeMonthlyFinancials } from './income';
import {
  getActiveDebtPaymentsTotal,
  getInvestmentExpenses,
  getJoinedAt,
  getLiquidAssets,
  getMonthCategoryTotal,
  getMonthSpending,
} from './queries';
import type { HealthScoreComponent } from './types';
import { investmentForMonth, isBeforeMonth, lastCompleteMonths } from './utils';

type Db = Database.Database;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function computeHealthScore(
  db: Db,
  userId: string,
): { total: number; components: HealthScoreComponent[] } {
  const joinedAt = getJoinedAt(db, userId);
  const debtPayments = getActiveDebtPaymentsTotal(db, userId);
  const lastMonth = lastCompleteMonths(1)[0];
  const investmentExpenses = getInvestmentExpenses(db, userId);

  // ── Savings Rate ──────────────────────────────────────────────────────────
  let savingsScore = 0;
  let savingsDetail = 'No income data yet';
  {
    const months = lastCompleteMonths(3);
    const rates: number[] = [];
    for (const month of months) {
      if (joinedAt && isBeforeMonth(month, joinedAt)) continue;
      const { totalIncome: income, tsp } = computeMonthlyFinancials(db, month, userId);
      if (income === 0) continue;

      const investmentTxs = getMonthCategoryTotal(db, userId, month, INVESTMENT_CATEGORY);
      const spending = getMonthSpending(db, userId, month, INVESTMENT_CATEGORY);
      const invested = tsp + investmentForMonth(investmentExpenses, month) + investmentTxs;

      rates.push(computeSavingsRate(income, invested, spending));
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
    const liquid = getLiquidAssets(db, userId);
    if (liquid > 0) {
      const months = lastCompleteMonths(6);
      const spends: number[] = [];
      for (const month of months) {
        if (joinedAt && isBeforeMonth(month, joinedAt)) continue;
        const s = getMonthSpending(db, userId, month, INVESTMENT_CATEGORY);
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

  return { total: components.reduce((s, c) => s + c.score, 0), components };
}
