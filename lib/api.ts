// Client-side API layer — components depend on this abstraction, not raw fetch().
// Only call these functions from 'use client' components.

import type {
  Asset,
  AssetCategory,
  BillPayment,
  CategoryBudget,
  CategorizationRule,
  CsvRow,
  Debt,
  FixedExpense,
  Goal,
  GoalContribution,
  HealthScore,
  IncomeConfig,
  IncomeEntry,
  PaymentSource,
  Receivable,
  SpendingInsights,
  Transaction,
  UserProfile,
  YearOverview,
  YtdSummary,
} from './types';

const H = { 'Content-Type': 'application/json' };

const asJson = <T>(res: Response): Promise<T> => {
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
};

const send = (method: string, url: string, body: unknown) =>
  fetch(url, { method, headers: H, body: JSON.stringify(body) });

export const api = {
  auth: {
    me: () => fetch('/api/auth/me').then(asJson<UserProfile>),
    logout: () =>
      send('POST', '/api/auth/logout', {}).then(asJson<{ ok: boolean }>),
    updateProfile: (data: Partial<UserProfile> & { reseed_income?: boolean }) =>
      send('PATCH', '/api/auth/profile', data).then(asJson<{ ok: boolean }>),
  },

  income: {
    get: (month: string) =>
      fetch(`/api/income?month=${month}`).then(asJson<IncomeConfig>),
    update: (month: string, data: Partial<IncomeConfig>) =>
      send('POST', '/api/income', { month, ...data }).then(
        asJson<{ ok: boolean }>,
      ),
    suggest: () =>
      fetch('/api/income/suggest').then(
        asJson<{ base_pay: number; bas: number; bah: number }>,
      ),
  },

  fixedExpenses: {
    list: () => fetch('/api/fixed-expenses').then(asJson<FixedExpense[]>),
    add: (data: {
      label: string;
      amount: number;
      period?: 'monthly' | 'annual';
      day_of_month?: number | null;
      notes?: string | null;
      is_investment?: boolean;
      goal_id?: number | null;
      recurrence?: 'monthly' | 'biweekly';
      recurrence_anchor?: string | null;
      end_date?: string | null;
    }) =>
      send('POST', '/api/fixed-expenses', {
        period: 'monthly',
        recurrence: 'monthly',
        ...data,
      }).then(asJson<FixedExpense>),
    remove: (id: number) =>
      send('DELETE', '/api/fixed-expenses', { id }).then(
        asJson<{ ok: boolean }>,
      ),
    update: (data: {
      id: number;
      label: string;
      amount: number;
      period: 'monthly' | 'annual';
      day_of_month?: number | null;
      notes?: string | null;
      is_investment?: boolean;
      goal_id?: number | null;
      recurrence?: 'monthly' | 'biweekly';
      recurrence_anchor?: string | null;
      end_date?: string | null;
    }) =>
      send('PATCH', '/api/fixed-expenses', data).then(asJson<{ ok: boolean }>),
  },

  transactions: {
    list: (month: string) =>
      fetch(`/api/transactions?month=${month}`).then(asJson<Transaction[]>),
    search: (q: string) =>
      fetch(`/api/transactions?q=${encodeURIComponent(q)}`).then(
        asJson<Transaction[]>,
      ),
    add: (data: Omit<Transaction, 'id' | 'created_at'> & { source?: string }) =>
      send('POST', '/api/transactions', data).then(asJson<Transaction>),
    update: (
      id: number,
      data: Partial<
        Pick<Transaction, 'description' | 'amount' | 'category' | 'notes'>
      >,
    ) =>
      send('PATCH', '/api/transactions', { id, ...data }).then(
        asJson<{ ok: boolean }>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/transactions', { id }).then(asJson<{ ok: boolean }>),
    bulkDelete: (ids: number[]) =>
      send('DELETE', '/api/transactions', { ids }).then(
        asJson<{ ok: boolean }>,
      ),
    bulkRecategorize: (ids: number[], category: string) =>
      send('PATCH', '/api/transactions', { ids, category }).then(
        asJson<{ ok: boolean }>,
      ),
    importCsv: (rows: CsvRow[], month: string, source: string) =>
      send('POST', '/api/csv-import', { rows, month, source }).then(
        asJson<{ ok: boolean; imported: number; months: string[] }>,
      ),
  },

  goals: {
    list: () => fetch('/api/goals').then(asJson<Goal[]>),
    add: (name: string, target: number, color: string) =>
      send('POST', '/api/goals', { name, target, color }).then(asJson<Goal>),
    update: (
      id: number,
      fields: Partial<Pick<Goal, 'name' | 'target' | 'saved' | 'color'>>,
    ) =>
      send('PATCH', '/api/goals', { id, ...fields }).then(
        asJson<{ ok: boolean }>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/goals', { id }).then(asJson<{ ok: boolean }>),
  },

  goalContributions: {
    list: (goalId: number) =>
      fetch(`/api/goal-contributions?goal_id=${goalId}`).then(
        asJson<GoalContribution[]>,
      ),
    add: (goalId: number, amount: number, note?: string | null) =>
      send('POST', '/api/goal-contributions', {
        goal_id: goalId,
        amount,
        note,
      }).then(asJson<GoalContribution>),
    remove: (id: number, goalId: number, amount: number) =>
      send('DELETE', '/api/goal-contributions', {
        id,
        goal_id: goalId,
        amount,
      }).then(asJson<{ ok: boolean }>),
  },

  insights: {
    get: () => fetch('/api/insights').then(asJson<SpendingInsights>),
  },

  recurring: {
    list: () =>
      fetch('/api/recurring').then(
        asJson<
          {
            description: string;
            normalized_key: string;
            avg_amount: number;
            months_seen: number;
            months: string[];
            category: string;
          }[]
        >,
      ),
  },

  streak: {
    get: () => fetch('/api/streak').then(asJson<{ streak: number }>),
  },

  assets: {
    list: () => fetch('/api/assets').then(asJson<Asset[]>),
    add: (label: string, category: AssetCategory, balance: number) =>
      send('POST', '/api/assets', { label, category, balance }).then(
        asJson<Asset>,
      ),
    update: (
      id: number,
      data: Partial<Pick<Asset, 'label' | 'category' | 'balance'>>,
    ) =>
      send('PATCH', '/api/assets', { id, ...data }).then(
        asJson<{ ok: boolean }>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/assets', { id }).then(asJson<{ ok: boolean }>),
  },

  healthScore: {
    get: () => fetch('/api/health-score').then(asJson<HealthScore>),
  },

  ytd: {
    get: (month: string) =>
      fetch(`/api/ytd?month=${month}`).then(asJson<YtdSummary>),
  },

  overview: {
    get: (year: number) =>
      fetch(`/api/overview?year=${year}`).then(asJson<YearOverview>),
  },

  categoryBudgets: {
    list: () => fetch('/api/category-budgets').then(asJson<CategoryBudget[]>),
    set: (category: string, budget: number, percentage?: number | null) =>
      send('PUT', '/api/category-budgets', {
        category,
        budget,
        percentage,
      }).then(asJson<{ ok: boolean }>),
    remove: (category: string) =>
      send('DELETE', '/api/category-budgets', { category }).then(
        asJson<{ ok: boolean }>,
      ),
  },

  billPayments: {
    list: (month: string) =>
      fetch(`/api/bill-payments?month=${month}`).then(asJson<BillPayment[]>),
    markPaid: (fixed_expense_id: number, month: string) =>
      send('POST', '/api/bill-payments', { fixed_expense_id, month }).then(
        asJson<{ ok: boolean }>,
      ),
    unmark: (fixed_expense_id: number, month: string) =>
      send('DELETE', '/api/bill-payments', { fixed_expense_id, month }).then(
        asJson<{ ok: boolean }>,
      ),
  },

  categorizationRules: {
    list: () =>
      fetch('/api/categorization-rules').then(asJson<CategorizationRule[]>),
    add: (keyword: string, category: string) =>
      send('POST', '/api/categorization-rules', { keyword, category }).then(
        asJson<CategorizationRule>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/categorization-rules', { id }).then(
        asJson<{ ok: boolean }>,
      ),
  },

  paymentSources: {
    list: () => fetch('/api/payment-sources').then(asJson<PaymentSource[]>),
    add: (label: string) =>
      send('POST', '/api/payment-sources', { label }).then(
        asJson<PaymentSource>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/payment-sources', { id }).then(
        asJson<{ ok: boolean }>,
      ),
  },

  debts: {
    list: () => fetch('/api/debts').then(asJson<Debt[]>),
    add: (data: Omit<Debt, 'id'>) =>
      send('POST', '/api/debts', data).then(asJson<Debt>),
    update: (id: number, data: Partial<Omit<Debt, 'id'>>) =>
      send('PATCH', '/api/debts', { id, ...data }).then(
        asJson<{ ok: boolean }>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/debts', { id }).then(asJson<{ ok: boolean }>),
  },

  incomeEntries: {
    list: (month: string) =>
      fetch(`/api/income-entries?month=${month}`).then(asJson<IncomeEntry[]>),
    add: (data: {
      description: string;
      amount: number;
      month: string;
      source: string;
    }) =>
      send('POST', '/api/income-entries', data).then(asJson<IncomeEntry>),
    remove: (id: number) =>
      send('DELETE', '/api/income-entries', { id }).then(
        asJson<{ ok: boolean }>,
      ),
  },

  importHistory: {
    list: () =>
      fetch('/api/import-history').then(
        asJson<
          {
            import_id: string;
            source: string;
            count: number;
            min_month: string;
            max_month: string;
            imported_at: string;
          }[]
        >,
      ),
    remove: (importId: string) =>
      send('DELETE', '/api/import-history', { importId }).then(
        asJson<{ ok: boolean; deleted: number }>,
      ),
  },

  leave: {
    get: () =>
      fetch('/api/leave').then(
        (r) =>
          r.json() as Promise<{
            events: import('./types').LeaveEvent[];
            joined_at: string;
            anchor: {
              balance_days: number;
              les_period: string;
              imported_at: string;
            } | null;
          }>,
      ),
    addEvent: (taken_at: string, days: number, note?: string | null) =>
      send('POST', '/api/leave', { taken_at, days, note }).then(
        (r) => r.json() as Promise<import('./types').LeaveEvent>,
      ),
    removeEvent: (id: number) =>
      send('DELETE', '/api/leave', { id }).then(
        (r) => r.json() as Promise<{ ok: boolean }>,
      ),
    /** Set the LES anchor (balance as of the end of the LES period) */
    setLesAnchor: (balance_days: number, les_period: string) =>
      send('PATCH', '/api/leave', { balance_days, les_period }).then(
        (r) => r.json() as Promise<{ ok: boolean }>,
      ),
  },

  backup: {
    exportUrl: '/api/backup',
    restore: (data: unknown) =>
      send('POST', '/api/backup', data).then(
        asJson<{ ok: boolean; restored?: number; error?: string }>,
      ),
  },

  receivables: {
    list: () => fetch('/api/receivables').then(asJson<Receivable[]>),
    add: (data: {
      name: string;
      description: string;
      amount: number;
      month_created: string;
    }) =>
      send('POST', '/api/receivables', data).then(asJson<Receivable>),
    update: (
      id: number,
      data: Partial<Pick<Receivable, 'name' | 'description' | 'amount'>>,
    ) =>
      send('PATCH', '/api/receivables', { id, ...data }).then(
        asJson<{ ok: boolean }>,
      ),
    recordPayment: (id: number, payment: number, month: string) =>
      send('PATCH', '/api/receivables', { id, payment, month }).then(
        asJson<{ ok: boolean; fullyPaid: boolean }>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/receivables', { id }).then(asJson<{ ok: boolean }>),
  },
};
