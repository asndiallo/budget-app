// Client-side API layer — components depend on this abstraction, not raw fetch().
// Only call these functions from 'use client' components.

import type {
  CategoryBudget,
  CsvRow,
  Debt,
  FixedExpense,
  Goal,
  IncomeConfig,
  IncomeEntry,
  PaymentSource,
  Receivable,
  SpendingInsights,
  Transaction,
} from './types';

const H = { 'Content-Type': 'application/json' };

const asJson = <T>(res: Response): Promise<T> => res.json();

const send = (method: string, url: string, body: unknown) =>
  fetch(url, { method, headers: H, body: JSON.stringify(body) });

export const api = {
  income: {
    get: (month: string) =>
      fetch(`/api/income?month=${month}`).then(asJson<IncomeConfig>),
    update: (month: string, data: Partial<IncomeConfig>) =>
      send('POST', '/api/income', { month, ...data }).then(
        asJson<{ ok: boolean }>,
      ),
  },

  fixedExpenses: {
    list: () => fetch('/api/fixed-expenses').then(asJson<FixedExpense[]>),
    add: (
      label: string,
      amount: number,
      period: 'monthly' | 'annual' = 'monthly',
    ) =>
      send('POST', '/api/fixed-expenses', { label, amount, period }).then(
        asJson<FixedExpense>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/fixed-expenses', { id }).then(
        asJson<{ ok: boolean }>,
      ),
    update: (
      id: number,
      label: string,
      amount: number,
      period: 'monthly' | 'annual',
    ) =>
      send('PATCH', '/api/fixed-expenses', { id, label, amount, period }).then(
        asJson<{ ok: boolean }>,
      ),
  },

  transactions: {
    list: (month: string) =>
      fetch(`/api/transactions?month=${month}`).then(asJson<Transaction[]>),
    add: (data: Omit<Transaction, 'id' | 'created_at'> & { source?: string }) =>
      send('POST', '/api/transactions', data).then(asJson<Transaction>),
    update: (
      id: number,
      data: Partial<Pick<Transaction, 'description' | 'amount' | 'category'>>,
    ) =>
      send('PATCH', '/api/transactions', { id, ...data }).then(
        asJson<{ ok: boolean }>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/transactions', { id }).then(asJson<{ ok: boolean }>),
    importCsv: (rows: CsvRow[], month: string, source: string) =>
      send('POST', '/api/csv-import', { rows, month, source }).then(
        asJson<{ ok: boolean; imported: number; months: string[] }>,
      ),
  },

  goals: {
    list: () => fetch('/api/goals').then(asJson<Goal[]>),
    add: (name: string, target: number, color: string) =>
      send('POST', '/api/goals', { name, target, color }).then(asJson<Goal>),
    update: (id: number, fields: Partial<Pick<Goal, 'name' | 'target' | 'saved' | 'color'>>) =>
      send('PATCH', '/api/goals', { id, ...fields }).then(asJson<{ ok: boolean }>),
    remove: (id: number) =>
      send('DELETE', '/api/goals', { id }).then(asJson<{ ok: boolean }>),
  },

  insights: {
    get: () => fetch('/api/insights').then(asJson<SpendingInsights>),
  },

  categoryBudgets: {
    list: () => fetch('/api/category-budgets').then(asJson<CategoryBudget[]>),
    set: (category: string, budget: number) =>
      send('PUT', '/api/category-budgets', { category, budget }).then(
        asJson<{ ok: boolean }>,
      ),
    remove: (category: string) =>
      send('DELETE', '/api/category-budgets', { category }).then(
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
    add: (description: string, amount: number, month: string, source: string) =>
      send('POST', '/api/income-entries', {
        description,
        amount,
        month,
        source,
      }).then(asJson<IncomeEntry>),
    remove: (id: number) =>
      send('DELETE', '/api/income-entries', { id }).then(
        asJson<{ ok: boolean }>,
      ),
  },

  receivables: {
    list: () => fetch('/api/receivables').then(asJson<Receivable[]>),
    add: (
      name: string,
      description: string,
      amount: number,
      month_created: string,
    ) =>
      send('POST', '/api/receivables', {
        name,
        description,
        amount,
        month_created,
      }).then(asJson<Receivable>),
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
