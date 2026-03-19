// Client-side API layer — components depend on this abstraction, not raw fetch().
// Only call these functions from 'use client' components.

import type {
  CsvRow,
  FixedExpense,
  Goal,
  IncomeConfig,
  Transaction,
} from './types';

const H = { 'Content-Type': 'application/json' };

const asJson = <T>(res: Response): Promise<T> => res.json();

const send = (method: string, url: string, body: unknown) =>
  fetch(url, { method, headers: H, body: JSON.stringify(body) });

export const api = {
  income: {
    get: () => fetch('/api/income').then(asJson<IncomeConfig>),
    update: (data: Partial<IncomeConfig>) =>
      send('POST', '/api/income', data).then(asJson<{ ok: boolean }>),
  },

  fixedExpenses: {
    list: () => fetch('/api/fixed-expenses').then(asJson<FixedExpense[]>),
    add: (label: string, amount: number) =>
      send('POST', '/api/fixed-expenses', { label, amount }).then(
        asJson<FixedExpense>,
      ),
    remove: (id: number) =>
      send('DELETE', '/api/fixed-expenses', { id }).then(
        asJson<{ ok: boolean }>,
      ),
    update: (id: number, label: string, amount: number) =>
      send('PATCH', '/api/fixed-expenses', { id, label, amount }).then(
        asJson<{ ok: boolean }>,
      ),
  },

  transactions: {
    list: (month: string) =>
      fetch(`/api/transactions?month=${month}`).then(asJson<Transaction[]>),
    add: (data: Omit<Transaction, 'id' | 'source' | 'created_at'>) =>
      send('POST', '/api/transactions', data).then(asJson<Transaction>),
    remove: (id: number) =>
      send('DELETE', '/api/transactions', { id }).then(asJson<{ ok: boolean }>),
    importCsv: (rows: CsvRow[], month: string) =>
      send('POST', '/api/csv-import', { rows, month }).then(
        asJson<{ ok: boolean; imported: number }>,
      ),
  },

  goals: {
    list: () => fetch('/api/goals').then(asJson<Goal[]>),
    add: (name: string, target: number, color: string) =>
      send('POST', '/api/goals', { name, target, color }).then(asJson<Goal>),
    updateSaved: (id: number, saved: number) =>
      send('PATCH', '/api/goals', { id, saved }).then(asJson<{ ok: boolean }>),
    remove: (id: number) =>
      send('DELETE', '/api/goals', { id }).then(asJson<{ ok: boolean }>),
  },
};
