import { describe, expect, it } from 'vitest';

import type { getDb } from '../db';
import {
  getAccountsForDetection,
  getActiveDebtPaymentsTotal,
  getCategoryTotalByMonth,
  getInvestmentExpenses,
  getJoinedAt,
  getLiquidAssets,
  getMonthCategoryTotal,
  getMonthSpending,
  getSpendingByMonth,
  getUserCategorizationRules,
} from '../queries';

// ── Minimal DB mock helpers ───────────────────────────────────────────────────

type Row = Record<string, unknown>;

/**
 * Builds a fake DB that supports both .get() and .all() on a single prepare() call.
 * `responses` maps SQL fragments (substrings) to their return values.
 */
function makeDb(responses: { match: string; get?: Row; all?: Row[] }[]): ReturnType<typeof getDb> {
  return {
    prepare: (sql: string) => {
      const entry = responses.find((r) => sql.includes(r.match));
      return {
        get: (..._args: unknown[]) => entry?.get ?? null,
        all: (..._args: unknown[]) => entry?.all ?? [],
      };
    },
  } as unknown as ReturnType<typeof getDb>;
}

// ── getJoinedAt ───────────────────────────────────────────────────────────────

describe('getJoinedAt', () => {
  it('returns the joined_at value when present', () => {
    const db = makeDb([{ match: 'joined_at', get: { joined_at: '2024-01' } }]);
    expect(getJoinedAt(db, 'u1')).toBe('2024-01');
  });

  it('returns null when joined_at is null', () => {
    const db = makeDb([{ match: 'joined_at', get: { joined_at: null } }]);
    expect(getJoinedAt(db, 'u1')).toBeNull();
  });

  it('returns null when user row is missing', () => {
    const db = makeDb([{ match: 'joined_at', get: undefined }]);
    expect(getJoinedAt(db, 'u1')).toBeNull();
  });
});

// ── getActiveDebtPaymentsTotal ────────────────────────────────────────────────

describe('getActiveDebtPaymentsTotal', () => {
  it('returns the summed total from the DB', () => {
    const db = makeDb([{ match: 'monthly_payment', get: { total: 850 } }]);
    expect(getActiveDebtPaymentsTotal(db, 'u1')).toBe(850);
  });

  it('returns 0 when there are no active debts', () => {
    const db = makeDb([{ match: 'monthly_payment', get: { total: 0 } }]);
    expect(getActiveDebtPaymentsTotal(db, 'u1')).toBe(0);
  });
});

// ── getMonthSpending ──────────────────────────────────────────────────────────

describe('getMonthSpending', () => {
  it('returns total spending for a month', () => {
    const db = makeDb([{ match: 'SUM(amount)', get: { s: 1234 } }]);
    expect(getMonthSpending(db, 'u1', '2026-03')).toBe(1234);
  });

  it('returns spending with excludeCategory applied', () => {
    const db = makeDb([{ match: 'SUM(amount)', get: { s: 900 } }]);
    expect(getMonthSpending(db, 'u1', '2026-03', 'Investment')).toBe(900);
  });

  it('returns 0 when no transactions exist', () => {
    const db = makeDb([{ match: 'SUM(amount)', get: { s: 0 } }]);
    expect(getMonthSpending(db, 'u1', '2026-03')).toBe(0);
  });
});

// ── getMonthCategoryTotal ─────────────────────────────────────────────────────

describe('getMonthCategoryTotal', () => {
  it('returns the category total for the given month', () => {
    const db = makeDb([{ match: 'SUM(amount)', get: { s: 500 } }]);
    expect(getMonthCategoryTotal(db, 'u1', '2026-03', 'Investment')).toBe(500);
  });

  it('returns 0 when the category has no transactions', () => {
    const db = makeDb([{ match: 'SUM(amount)', get: { s: 0 } }]);
    expect(getMonthCategoryTotal(db, 'u1', '2026-03', 'Investment')).toBe(0);
  });
});

// ── getSpendingByMonth ────────────────────────────────────────────────────────

describe('getSpendingByMonth', () => {
  it('returns an empty object when months array is empty', () => {
    const db = makeDb([]);
    expect(getSpendingByMonth(db, 'u1', [])).toEqual({});
  });

  it('maps month → total for returned rows', () => {
    const db = makeDb([
      {
        match: 'SUM(amount)',
        all: [
          { month: '2026-01', total: 1000 },
          { month: '2026-02', total: 1500 },
        ],
      },
    ]);
    expect(getSpendingByMonth(db, 'u1', ['2026-01', '2026-02'])).toEqual({
      '2026-01': 1000,
      '2026-02': 1500,
    });
  });

  it('returns empty record when no transactions match', () => {
    const db = makeDb([{ match: 'SUM(amount)', all: [] }]);
    expect(getSpendingByMonth(db, 'u1', ['2026-01'])).toEqual({});
  });
});

// ── getCategoryTotalByMonth ───────────────────────────────────────────────────

describe('getCategoryTotalByMonth', () => {
  it('returns an empty object for an empty months array', () => {
    const db = makeDb([]);
    expect(getCategoryTotalByMonth(db, 'u1', [], 'Investment')).toEqual({});
  });

  it('maps month → category total', () => {
    const db = makeDb([
      {
        match: 'SUM(amount)',
        all: [{ month: '2026-01', total: 200 }],
      },
    ]);
    expect(getCategoryTotalByMonth(db, 'u1', ['2026-01'], 'Investment')).toEqual({
      '2026-01': 200,
    });
  });
});

// ── getLiquidAssets ───────────────────────────────────────────────────────────

describe('getLiquidAssets', () => {
  it('sums Checking/Savings balance plus active goal balances', () => {
    const db = {
      prepare: (sql: string) => ({
        get: () => {
          if (sql.includes('assets')) return { assets: 5000 };
          if (sql.includes('goals')) return { goals: 1500 };
          return null;
        },
      }),
    } as unknown as ReturnType<typeof getDb>;
    expect(getLiquidAssets(db, 'u1')).toBe(6500);
  });

  it('returns 0 when both assets and goals are empty', () => {
    const db = {
      prepare: (sql: string) => ({
        get: () => {
          if (sql.includes('assets')) return { assets: 0 };
          if (sql.includes('goals')) return { goals: 0 };
          return null;
        },
      }),
    } as unknown as ReturnType<typeof getDb>;
    expect(getLiquidAssets(db, 'u1')).toBe(0);
  });
});

// ── getInvestmentExpenses ─────────────────────────────────────────────────────

describe('getInvestmentExpenses', () => {
  it('returns all active investment fixed expenses', () => {
    const rows = [
      { amount: 500, period: 'monthly', recurrence: null, recurrence_anchor: null, end_date: null },
      {
        amount: 200,
        period: 'monthly',
        recurrence: 'biweekly',
        recurrence_anchor: '2026-01-01',
        end_date: null,
      },
    ];
    const db = makeDb([{ match: 'is_investment', all: rows }]);
    expect(getInvestmentExpenses(db, 'u1')).toEqual(rows);
  });

  it('returns an empty array when there are no investment expenses', () => {
    const db = makeDb([{ match: 'is_investment', all: [] }]);
    expect(getInvestmentExpenses(db, 'u1')).toEqual([]);
  });
});

// ── getAccountsForDetection ───────────────────────────────────────────────────

describe('getAccountsForDetection', () => {
  it('returns accounts with non-empty institutions', () => {
    const rows = [
      { id: 1, institution: 'fidelity' },
      { id: 2, institution: 'usaa' },
    ];
    const db = makeDb([{ match: 'financial_accounts', all: rows }]);
    expect(getAccountsForDetection(db, 'u1')).toEqual(rows);
  });

  it('returns an empty array when there are no active accounts', () => {
    const db = makeDb([{ match: 'financial_accounts', all: [] }]);
    expect(getAccountsForDetection(db, 'u1')).toEqual([]);
  });
});

// ── getUserCategorizationRules ────────────────────────────────────────────────

describe('getUserCategorizationRules', () => {
  it('returns all categorization rules for the user', () => {
    const rows = [
      { keyword: 'netflix', category: 'Entertainment' },
      { keyword: 'spotify', category: 'Entertainment' },
    ];
    const db = makeDb([{ match: 'categorization_rules', all: rows }]);
    expect(getUserCategorizationRules(db, 'u1')).toEqual(rows);
  });

  it('returns an empty array when no rules are defined', () => {
    const db = makeDb([{ match: 'categorization_rules', all: [] }]);
    expect(getUserCategorizationRules(db, 'u1')).toEqual([]);
  });
});
