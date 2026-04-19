import { describe, expect, it } from 'vitest';

import { TSP_CONFIG } from '../config';
import { computeMonthlyFinancials, incomeForMonth } from '../income';

// ── Mock DB helper ────────────────────────────────────────────────────────────
// Builds a minimal fake DB object whose .prepare().all() returns the provided rows.

function makeDb(rows: { key: string; value: number }[]) {
  return {
    prepare: () => ({
      all: () => rows,
    }),
  } as unknown as ReturnType<typeof import('../db').getDb>;
}

// ── incomeForMonth ────────────────────────────────────────────────────────────

describe('incomeForMonth', () => {
  it('returns an empty object when there are no rows', () => {
    const db = makeDb([]);
    expect(incomeForMonth(db, '2026-03', 'u1')).toEqual({});
  });

  it('maps DB rows into key → value record', () => {
    const db = makeDb([
      { key: 'base_pay', value: 2836.8 },
      { key: 'bas', value: 460 },
    ]);
    expect(incomeForMonth(db, '2026-03', 'u1')).toEqual({
      base_pay: 2836.8,
      bas: 460,
    });
  });
});

// ── computeMonthlyFinancials ──────────────────────────────────────────────────

describe('computeMonthlyFinancials', () => {
  describe('TSP calculation', () => {
    it('uses tsp_rate from config when present', () => {
      const db = makeDb([
        { key: 'base_pay', value: 3000 },
        { key: 'tsp_rate', value: 0.05 },
      ]);
      const { tsp } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(tsp).toBe(150); // 3000 * 0.05
    });

    it('falls back to TSP_CONFIG.rate when tsp_rate is absent', () => {
      const db = makeDb([{ key: 'base_pay', value: 3000 }]);
      const { tsp } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(tsp).toBe(Math.round(3000 * TSP_CONFIG.rate));
    });

    it('rounds TSP to the nearest dollar', () => {
      // 2836.8 * 0.2 = 567.36 → rounds to 567
      const db = makeDb([
        { key: 'base_pay', value: 2836.8 },
        { key: 'tsp_rate', value: 0.2 },
      ]);
      const { tsp } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(tsp).toBe(567);
    });

    it('returns 0 TSP when base_pay is absent', () => {
      const db = makeDb([
        { key: 'bas', value: 460 },
        { key: 'tsp_rate', value: 0.1 },
      ]);
      const { tsp } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(tsp).toBe(0);
    });

    it('handles 20% TSP rate correctly (common high-savings scenario)', () => {
      // E-5 base pay ~3,136.80
      const db = makeDb([
        { key: 'base_pay', value: 3136.8 },
        { key: 'tsp_rate', value: 0.2 },
      ]);
      const { tsp } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(tsp).toBe(Math.round(3136.8 * 0.2)); // 627
    });

    it('handles 5% TSP rate (minimum for full DoD match)', () => {
      const db = makeDb([
        { key: 'base_pay', value: 2836.8 },
        { key: 'tsp_rate', value: 0.05 },
      ]);
      const { tsp } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(tsp).toBe(Math.round(2836.8 * 0.05)); // 142
    });
  });

  describe('totalIncome calculation', () => {
    it('sums base_pay + bas + bah + other', () => {
      const db = makeDb([
        { key: 'base_pay', value: 2836.8 },
        { key: 'bas', value: 460 },
        { key: 'bah', value: 1839 },
        { key: 'other', value: 100 },
      ]);
      const { totalIncome } = computeMonthlyFinancials(db, '2026-03', 'u1');
      // 2836.8 + 460 + 1839 + 100 = 5235.8
      expect(totalIncome).toBeCloseTo(5235.8, 1);
    });

    it('treats missing income fields as zero', () => {
      const db = makeDb([{ key: 'base_pay', value: 2836.8 }]);
      const { totalIncome } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(totalIncome).toBeCloseTo(2836.8, 1);
    });

    it('returns 0 when no income rows exist', () => {
      const db = makeDb([]);
      const { totalIncome } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(totalIncome).toBe(0);
    });

    it('tsp_rate row does not contribute to totalIncome', () => {
      // tsp_rate is stored in income_config but is NOT an INCOME_FIELD key
      const db = makeDb([
        { key: 'base_pay', value: 3000 },
        { key: 'tsp_rate', value: 0.2 },
      ]);
      const { totalIncome } = computeMonthlyFinancials(db, '2026-03', 'u1');
      // only base_pay counts — tsp_rate must not be added
      expect(totalIncome).toBe(3000);
    });
  });

  describe('combined scenarios', () => {
    it('E-3 typical paycheck — correct income and TSP', () => {
      const db = makeDb([
        { key: 'base_pay', value: 2836.8 },
        { key: 'bas', value: 460 },
        { key: 'bah', value: 1839 },
        { key: 'other', value: 0 },
        { key: 'tsp_rate', value: 0.05 },
      ]);
      const { totalIncome, tsp } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(totalIncome).toBeCloseTo(5135.8, 1);
      expect(tsp).toBe(Math.round(2836.8 * 0.05)); // 142
    });

    it('both totalIncome and tsp are non-negative', () => {
      const db = makeDb([
        { key: 'base_pay', value: 0 },
        { key: 'tsp_rate', value: 0 },
      ]);
      const { totalIncome, tsp } = computeMonthlyFinancials(db, '2026-03', 'u1');
      expect(totalIncome).toBeGreaterThanOrEqual(0);
      expect(tsp).toBeGreaterThanOrEqual(0);
    });
  });
});
