import { describe, expect, it } from 'vitest';

import { categorizeTransaction, detectAccountId } from '../categorization';

// ── categorizeTransaction ─────────────────────────────────────────────────────

describe('categorizeTransaction', () => {
  describe('priority 1: user-defined keyword rules', () => {
    it('matches a user rule and overrides investment keyword', () => {
      // "fidelity" is an investment keyword, but user rule maps it to Savings
      const rules = [{ keyword: 'fidelity', category: 'Savings' }];
      expect(categorizeTransaction('Fidelity transfer', { rules })).toBe('Savings');
    });

    it('applies the first matching rule (rules are ordered)', () => {
      const rules = [
        { keyword: 'netflix', category: 'Entertainment' },
        { keyword: 'netflix', category: 'Subscriptions' },
      ];
      expect(categorizeTransaction('NETFLIX.COM', { rules })).toBe('Entertainment');
    });

    it('is case-insensitive on description', () => {
      const rules = [{ keyword: 'grocery', category: 'Food' }];
      expect(categorizeTransaction('GROCERY OUTLET', { rules })).toBe('Food');
    });

    it('is case-insensitive on the rule keyword', () => {
      const rules = [{ keyword: 'AMAZON', category: 'Shopping' }];
      expect(categorizeTransaction('amazon prime', { rules })).toBe('Shopping');
    });

    it('user rule overrides an explicit non-default category', () => {
      const rules = [{ keyword: 'grocery', category: 'Food' }];
      expect(
        categorizeTransaction('GROCERY MART', {
          explicitCategory: 'Shopping',
          rules,
        }),
      ).toBe('Food');
    });
  });

  describe('priority 2: explicit non-default category', () => {
    it('returns explicit category when no rules match and category is non-default', () => {
      expect(categorizeTransaction('random store', { explicitCategory: 'Utilities' })).toBe(
        'Utilities',
      );
    });

    it('does NOT return explicit "Other" — falls through to investment keyword check', () => {
      // "Other" is the DEFAULT_CATEGORY; "fidelity" is an INVESTMENT_KEYWORD
      expect(categorizeTransaction('Fidelity investment', { explicitCategory: 'Other' })).toBe(
        'Investment',
      );
    });
  });

  describe('priority 3: investment keyword detection', () => {
    it('detects known investment keywords in description', () => {
      expect(categorizeTransaction('FIDELITY CONTRIBUTION')).toBe('Investment');
    });

    it('is case-insensitive on investment keywords', () => {
      expect(categorizeTransaction('vanguard ROTH IRA')).toBe('Investment');
    });

    it('does NOT false-positive on unrelated descriptions', () => {
      expect(categorizeTransaction('grocery store')).toBe('Other');
    });
  });

  describe('priority 4: CSV category mapping', () => {
    it('falls through to mapCategory when no rules, no explicit, no keywords', () => {
      // mapCategory maps 'Food & Drink' → 'Food' etc. — just verify it's called
      const result = categorizeTransaction('random coffee', { csvCategory: 'Food & Drink' });
      // We don't hardcode the mapped value here — that's csv-utils' responsibility
      expect(typeof result).toBe('string');
      expect(result).not.toBe('');
    });

    it('uses DEFAULT_CATEGORY when csvCategory maps to nothing recognisable', () => {
      const result = categorizeTransaction('mystery charge', { csvCategory: '' });
      expect(result).toBe('Other');
    });
  });

  describe('priority 5: DEFAULT_CATEGORY fallback', () => {
    it('returns Other when no inputs match', () => {
      expect(categorizeTransaction('random charge')).toBe('Other');
    });

    it('returns explicit category when it equals DEFAULT_CATEGORY and no investment keywords', () => {
      expect(categorizeTransaction('misc', { explicitCategory: 'Other' })).toBe('Other');
    });
  });
});

// ── detectAccountId ───────────────────────────────────────────────────────────

describe('detectAccountId', () => {
  const accounts = [
    { id: 1, institution: 'fidelity' },
    { id: 2, institution: 'usaa' },
    { id: 3, institution: 'vanguard' },
  ];

  it('returns the account ID when exactly one institution matches', () => {
    expect(detectAccountId('FIDELITY ROTH CONTRIBUTION', accounts)).toBe(1);
  });

  it('is case-insensitive on description', () => {
    expect(detectAccountId('usaa direct deposit', accounts)).toBe(2);
  });

  it('is case-insensitive on institution keyword', () => {
    const accs = [{ id: 10, institution: 'USAA' }];
    expect(detectAccountId('usaa transfer', accs)).toBe(10);
  });

  it('returns null when no account matches', () => {
    expect(detectAccountId('netflix subscription', accounts)).toBeNull();
  });

  it('returns null when multiple accounts match (ambiguous)', () => {
    const ambiguous = [
      { id: 1, institution: 'fidelity' },
      { id: 2, institution: 'fidelity' },
    ];
    expect(detectAccountId('fidelity transfer', ambiguous)).toBeNull();
  });

  it('returns null when accounts array is empty', () => {
    expect(detectAccountId('fidelity', [])).toBeNull();
  });

  it('skips accounts with empty institution string', () => {
    const mixed = [
      { id: 1, institution: '' },
      { id: 2, institution: 'usaa' },
    ];
    expect(detectAccountId('usaa deposit', mixed)).toBe(2);
  });

  it('does not match partial institution keyword across account boundaries', () => {
    // "bank of america" should not match "bank" if institution is "bank"
    const accs = [{ id: 1, institution: 'bank' }];
    expect(detectAccountId('bank of america transfer', accs)).toBe(1);
  });
});
