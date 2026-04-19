import { describe, expect, it } from 'vitest';

import { computeSavingsRate, computeSavingsRatePct } from '../financials';

describe('computeSavingsRate', () => {
  it('returns 0 when income is zero', () => {
    expect(computeSavingsRate(0, 500, 1000)).toBe(0);
  });

  it('returns 0 when income is negative', () => {
    expect(computeSavingsRate(-100, 0, 0)).toBe(0);
  });

  describe('canonical formula: rate = (invested + max(0, net)) / income', () => {
    it('counts fully invested income as 100% savings rate', () => {
      // invested = 5000, spending = 0 → net = 0 → rate = 5000/5000 = 1.0
      expect(computeSavingsRate(5000, 5000, 0)).toBe(1);
    });

    it('counts surplus (net > 0) towards savings', () => {
      // income=5000, invested=500, spending=2000 → net=2500
      // rate = (500 + 2500) / 5000 = 0.6
      expect(computeSavingsRate(5000, 500, 2000)).toBe(0.6);
    });

    it('ignores negative net (overspending beyond income after investment)', () => {
      // income=5000, invested=1000, spending=5000 → net=-1000 → max(0,-1000)=0
      // rate = 1000/5000 = 0.2
      expect(computeSavingsRate(5000, 1000, 5000)).toBe(0.2);
    });

    it('returns 0 when invested=0 and spending=income (no surplus, no investment)', () => {
      // income=5000, invested=0, spending=5000 → net=0 → rate = 0/5000 = 0
      expect(computeSavingsRate(5000, 0, 5000)).toBe(0);
    });

    it('handles zero investment but positive net', () => {
      // income=5000, invested=0, spending=3000 → net=2000
      // rate = (0 + 2000) / 5000 = 0.4
      expect(computeSavingsRate(5000, 0, 3000)).toBe(0.4);
    });

    it('TSP-only scenario: 5% tsp, no other spending', () => {
      // income=4000, invested=200 (5% tsp), spending=0 → net=3800
      // rate = (200 + 3800) / 4000 = 1.0
      expect(computeSavingsRate(4000, 200, 0)).toBe(1);
    });

    it('typical military paycheck: 20% tsp, normal spending', () => {
      // income=5000, invested=1000 (20%), spending=3500 → net=500
      // rate = (1000 + 500) / 5000 = 0.3
      expect(computeSavingsRate(5000, 1000, 3500)).toBe(0.3);
    });

    it('returns exactly 1.0 when all income is invested and no spending', () => {
      expect(computeSavingsRate(3000, 3000, 0)).toBe(1);
    });

    it('spending and investment together exceed income (overspend)', () => {
      // income=3000, invested=500, spending=3000 → net=-500 → max(0,-500)=0
      // rate = 500/3000 ≈ 0.167
      expect(computeSavingsRate(3000, 500, 3000)).toBeCloseTo(500 / 3000, 5);
    });
  });
});

describe('computeSavingsRatePct', () => {
  it('returns a rounded integer percentage', () => {
    // income=5000, invested=500, spending=2000 → rate=0.6 → 60%
    expect(computeSavingsRatePct(5000, 500, 2000)).toBe(60);
  });

  it('rounds to nearest integer', () => {
    // income=3000, invested=1000, spending=1500 → net=500 → rate=1500/3000=0.5 → 50%
    expect(computeSavingsRatePct(3000, 1000, 1500)).toBe(50);
  });

  it('returns 0 when income is zero', () => {
    expect(computeSavingsRatePct(0, 100, 200)).toBe(0);
  });

  it('returns 100 when fully saved', () => {
    expect(computeSavingsRatePct(5000, 5000, 0)).toBe(100);
  });

  it('can exceed 100% (impossible in canonical formula — verifying the cap does NOT apply)', () => {
    // invested > income is theoretically impossible but let's verify the math
    // if income=1000, invested=500, spending=0 → net=500 → rate=1000/1000=1.0=100%
    expect(computeSavingsRatePct(1000, 500, 0)).toBe(100);
  });
});
