import type Database from 'better-sqlite3';

import { detectSpendingAnomalies } from './anomalies';
import {
  DEDUCTION_FIELDS,
  DUE_SOON_WINDOW,
  INCOME_FIELDS,
  INVESTMENT_CATEGORY,
  SPECIAL_PAY_FIELDS,
  TSP_CONFIG,
} from './config';
import { computeMilitaryNetPay, computeSavingsRate, computeTakeHomePay } from './financials';
import { computeHealthScore } from './health-score';
import { computeMonthlyFinancials, incomeForMonth } from './income';
import {
  getActiveAllotmentsTotal,
  getActiveIncomeStreamsTotal,
  getIncomeEntriesTotal,
  getInvestmentExpenses,
  getMonthCategoryTotal,
  getMonthSpending,
} from './queries';
import type { FixedExpense } from './types';
import { currentMonth, formatCurrency, investmentForMonth, lastCompleteMonths } from './utils';

type Db = Database.Database;

/** Percentage-point drop in savings rate month-over-month that's worth flagging. */
const SAVINGS_RATE_DROP_THRESHOLD = 0.1;
/** Point drop in the 0-100 health score (vs. the last time the digest ran) worth flagging. */
const HEALTH_SCORE_DROP_THRESHOLD = 10;
/** How many top spending categories to show in the "at a glance" bar chart. */
const TOP_CATEGORY_COUNT = 5;

export type DigestTone = 'amber' | 'red';

export interface DigestSection {
  title: string;
  tone: DigestTone;
  lines: string[];
}

export interface DigestSnapshot {
  month: string;
  takeHome: number;
  spending: number;
  savingsRatePct: number;
  topCategories: { category: string; amount: number }[];
}

export interface Digest {
  snapshot: DigestSnapshot;
  sections: DigestSection[];
  hasContent: boolean;
}

function getBillsDueSoon(db: Db, userId: string): DigestSection | null {
  const today = new Date();
  const month = currentMonth();
  const todayDay = today.getDate();

  const bills = db
    .prepare(
      `SELECT id, label, amount, day_of_month FROM fixed_expenses
       WHERE user_id = ? AND active = 1 AND day_of_month IS NOT NULL
         AND (recurrence IS NULL OR recurrence = 'monthly')`,
    )
    .all(userId) as Pick<FixedExpense, 'id' | 'label' | 'amount' | 'day_of_month'>[];
  if (!bills.length) return null;

  const paidIds = new Set(
    (
      db
        .prepare('SELECT fixed_expense_id FROM bill_payments WHERE user_id = ? AND month = ?')
        .all(userId, month) as { fixed_expense_id: number }[]
    ).map((r) => r.fixed_expense_id),
  );

  const dueSoon = bills.filter(
    (b) =>
      !paidIds.has(b.id) &&
      b.day_of_month! >= todayDay &&
      b.day_of_month! <= todayDay + DUE_SOON_WINDOW,
  );
  if (!dueSoon.length) return null;

  return {
    title: 'Bills due soon',
    tone: 'amber',
    lines: dueSoon
      .sort((a, b) => a.day_of_month! - b.day_of_month!)
      .map((b) => `${b.label} — ${formatCurrency(b.amount)}, due the ${b.day_of_month}`),
  };
}

function getSpendingPaceSection(db: Db, userId: string): DigestSection | null {
  const { alerts } = detectSpendingAnomalies(db, userId, currentMonth());
  if (!alerts.length) return null;
  return {
    title: 'Spending pace',
    tone: 'red',
    lines: alerts.map(
      (a) =>
        `${a.category} — projected ${formatCurrency(a.projectedMonthSpend)}, ${a.pctOverAvg}% over its ${formatCurrency(a.trailingAvg)} average`,
    ),
  };
}

function savingsRateForMonth(db: Db, userId: string, month: string): number {
  const { totalIncome: income, tsp } = computeMonthlyFinancials(db, month, userId);
  if (income === 0) return 0;
  const investmentExpenses = getInvestmentExpenses(db, userId);
  const investmentTxs = getMonthCategoryTotal(db, userId, month, INVESTMENT_CATEGORY);
  const spending = getMonthSpending(db, userId, month, INVESTMENT_CATEGORY);
  const invested = tsp + investmentForMonth(investmentExpenses, month) + investmentTxs;
  return computeSavingsRate(income, invested, spending);
}

function getSavingsRateDropSection(db: Db, userId: string): DigestSection | null {
  const [prevMonth, lastMonth] = lastCompleteMonths(2).reverse();
  if (!prevMonth || !lastMonth) return null;
  const current = savingsRateForMonth(db, userId, lastMonth);
  const previous = savingsRateForMonth(db, userId, prevMonth);
  const drop = previous - current;
  if (drop < SAVINGS_RATE_DROP_THRESHOLD) return null;
  return {
    title: 'Savings rate drop',
    tone: 'red',
    lines: [
      `${Math.round(current * 100)}% last month, down from ${Math.round(previous * 100)}% the month before`,
    ],
  };
}

// Also persists currentTotal as tomorrow's baseline — app_settings has no history,
// so each run both checks against and overwrites the single stored prior value.
function getHealthScoreDropSection(
  db: Db,
  userId: string,
  currentTotal: number,
): DigestSection | null {
  const key = `health_score_last:${userId}`;
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  db.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, String(currentTotal));
  if (!row) return null;
  const previousTotal = Number(row.value);
  const drop = previousTotal - currentTotal;
  if (drop < HEALTH_SCORE_DROP_THRESHOLD) return null;
  return {
    title: 'Financial health score drop',
    tone: 'red',
    lines: [`${currentTotal}/100, down from ${previousTotal}/100 since the last check`],
  };
}

/** The same "take-home pay" formula the dashboard headline card uses (app/page.tsx). */
function takeHomeForMonth(db: Db, userId: string, month: string): number {
  const income = incomeForMonth(db, month, userId);
  const milNetPay = computeMilitaryNetPay(
    income,
    INCOME_FIELDS,
    SPECIAL_PAY_FIELDS,
    DEDUCTION_FIELDS,
    TSP_CONFIG.rate,
  );
  const allotments = getActiveAllotmentsTotal(db, userId, month);
  const streamsTotal = getActiveIncomeStreamsTotal(db, userId, month);
  const extraIncome = getIncomeEntriesTotal(db, userId, month);
  return computeTakeHomePay(milNetPay, allotments, streamsTotal, extraIncome);
}

function buildSnapshot(db: Db, userId: string, month: string): DigestSnapshot {
  const topCategories = db
    .prepare(
      `SELECT category, SUM(amount) AS total FROM transactions
       WHERE user_id = ? AND month = ? AND category != ?
       GROUP BY category ORDER BY total DESC LIMIT ?`,
    )
    .all(userId, month, INVESTMENT_CATEGORY, TOP_CATEGORY_COUNT) as {
    category: string;
    total: number;
  }[];

  return {
    month,
    takeHome: takeHomeForMonth(db, userId, month),
    spending: getMonthSpending(db, userId, month, INVESTMENT_CATEGORY),
    savingsRatePct: Math.round(savingsRateForMonth(db, userId, month) * 100),
    topCategories: topCategories.map((c) => ({ category: c.category, amount: c.total })),
  };
}

export function buildDailyDigest(db: Db, userId: string): Digest {
  const month = currentMonth();
  const { total: healthScoreTotal } = computeHealthScore(db, userId);

  const sections = [
    getBillsDueSoon(db, userId),
    getSpendingPaceSection(db, userId),
    getSavingsRateDropSection(db, userId),
    getHealthScoreDropSection(db, userId, healthScoreTotal),
  ].filter((s): s is DigestSection => s !== null);

  return {
    snapshot: buildSnapshot(db, userId, month),
    sections,
    hasContent: sections.length > 0,
  };
}

// ── Email rendering ──────────────────────────────────────────────────────────
// Table-based layout + inline styles throughout: the common denominator that
// renders consistently across Gmail, Outlook, and Apple Mail, none of which
// reliably support <style> blocks, flexbox/grid, or external assets. The
// category "chart" below is a table with colored-width cells for the same
// reason — no image generation dependency, no client-side JS.

const TONE_COLORS: Record<DigestTone, { bg: string; border: string; text: string }> = {
  amber: { bg: '#fef6e7', border: '#f0b429', text: '#92600a' },
  red: { bg: '#fdecec', border: '#e0524d', text: '#9c2b27' },
};

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function statCell(label: string, value: string, color: string): string {
  return `
    <td style="padding:14px 10px;text-align:center;border:1px solid #e6e6e6;border-radius:8px;background:#fafafa;">
      <div style="font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:#8a8a8a;font-family:-apple-system,Helvetica,Arial,sans-serif;">${label}</div>
      <div style="font-size:20px;font-weight:600;color:${color};font-family:-apple-system,Helvetica,Arial,sans-serif;margin-top:4px;">${value}</div>
    </td>`;
}

function categoryBarsHtml(topCategories: DigestSnapshot['topCategories']): string {
  if (!topCategories.length) return '';
  const max = Math.max(...topCategories.map((c) => c.amount));
  const rows = topCategories
    .map((c) => {
      const pct = max > 0 ? Math.max(4, Math.round((c.amount / max) * 100)) : 0;
      return `
      <tr>
        <td style="padding:4px 10px 4px 0;font-size:13px;color:#333;font-family:-apple-system,Helvetica,Arial,sans-serif;white-space:nowrap;width:1%;">${escapeHtml(c.category)}</td>
        <td style="padding:4px 0;width:100%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="background:#4a8cff;border-radius:4px;width:${pct}%;height:10px;font-size:1px;line-height:10px;">&nbsp;</td>
              <td style="width:${100 - pct}%;"></td>
            </tr>
          </table>
        </td>
        <td style="padding:4px 0 4px 10px;font-size:13px;font-weight:600;color:#333;font-family:-apple-system,Helvetica,Arial,sans-serif;text-align:right;white-space:nowrap;">${formatCurrency(c.amount)}</td>
      </tr>`;
    })
    .join('');
  return `
    <h2 style="font-size:13px;letter-spacing:0.03em;text-transform:uppercase;color:#8a8a8a;margin:24px 0 10px;font-family:-apple-system,Helvetica,Arial,sans-serif;">Top categories this month</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
}

function sectionHtml(s: DigestSection): string {
  const c = TONE_COLORS[s.tone];
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;">
      <tr>
        <td style="background:${c.bg};border:1px solid ${c.border}33;border-left:4px solid ${c.border};border-radius:6px;padding:12px 14px;">
          <div style="font-size:14px;font-weight:600;color:${c.text};font-family:-apple-system,Helvetica,Arial,sans-serif;">${escapeHtml(s.title)}</div>
          <ul style="margin:6px 0 0;padding-left:18px;font-size:13px;color:#333;line-height:1.6;font-family:-apple-system,Helvetica,Arial,sans-serif;">
            ${s.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}
          </ul>
        </td>
      </tr>
    </table>`;
}

export function digestToHtml(digest: Digest): string {
  const { snapshot } = digest;
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return `
  <div style="background:#f4f4f5;padding:24px 12px;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e6e6e6;">
      <tr>
        <td style="background:#111318;padding:20px 24px;">
          <div style="font-size:17px;font-weight:700;color:#ffffff;">Fieldbook</div>
          <div style="font-size:12px;color:#9a9ea6;margin-top:2px;">${dateLabel}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate;">
            <tr>
              ${statCell('Take-home', formatCurrency(snapshot.takeHome), '#111318')}
              ${statCell('Spent so far', formatCurrency(snapshot.spending), '#e0524d')}
              ${statCell('Savings rate', `${snapshot.savingsRatePct}%`, '#1a9e6b')}
            </tr>
          </table>

          ${categoryBarsHtml(snapshot.topCategories)}

          ${
            digest.sections.length
              ? `<h2 style="font-size:13px;letter-spacing:0.03em;text-transform:uppercase;color:#8a8a8a;margin:24px 0 0;font-family:-apple-system,Helvetica,Arial,sans-serif;">Worth a look</h2>${digest.sections.map(sectionHtml).join('')}`
              : ''
          }

          <p style="font-size:12px;color:#a0a0a0;margin:24px 0 0;">Open Fieldbook for the full picture — this is just what changed.</p>
        </td>
      </tr>
    </table>
  </div>`;
}

export function digestSubject(digest: Digest): string {
  return `Fieldbook: ${digest.sections.map((s) => s.title).join(', ')}`;
}
