import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { autoMatchBills } from '../bill-match';

// ── Helper: re-exported internal helpers via dynamic import trick ─────────────
// bill-match only exports autoMatchBills; test helpers by testing their effects,
// and also test them directly by duplicating the tiny pure functions here.

function keywords(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[\s\-_.,/&()+]+/)
    .filter((w) => w.length >= 3);
}

function descriptionMatches(description: string, billLabel: string): boolean {
  const desc = description.toLowerCase();
  return keywords(billLabel).some((kw) => desc.includes(kw));
}

function amountMatches(txAmount: number, billAmount: number): boolean {
  const diff = Math.abs(txAmount - billAmount);
  return diff <= 2 || diff / billAmount <= 0.1;
}

// ── keywords() ────────────────────────────────────────────────────────────────

describe('keywords()', () => {
  it('lowercases and splits on spaces', () => {
    expect(keywords('Netflix Streaming')).toEqual(['netflix', 'streaming']);
  });

  it('splits on hyphens, underscores, commas, dots, slashes, ampersands, parens, plus', () => {
    // AT&T → "at" + "t" (both < 3 chars, filtered); remaining words kept
    expect(keywords('AT&T/Phone-bill_monthly.plan')).toEqual(['phone', 'bill', 'monthly', 'plan']);
  });

  it('filters out words shorter than 3 characters', () => {
    // AT&T splits on & → "at" (2) + "t" (1) → both filtered
    expect(keywords('AT&T')).toEqual([]);
    expect(keywords('a bb ccc')).toEqual(['ccc']);
  });

  it('returns empty array for blank or separator-only strings', () => {
    expect(keywords('')).toEqual([]);
    expect(keywords('- & ,')).toEqual([]);
  });

  it('handles a single long word', () => {
    expect(keywords('Comcast')).toEqual(['comcast']);
  });
});

// ── descriptionMatches() ──────────────────────────────────────────────────────

describe('descriptionMatches()', () => {
  it('matches when description contains a bill keyword', () => {
    expect(descriptionMatches('NETFLIX.COM CHARGE', 'Netflix')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(descriptionMatches('spotify subscription', 'Spotify')).toBe(true);
  });

  it('returns false when no keyword appears in description', () => {
    expect(descriptionMatches('AMAZON PRIME', 'Netflix')).toBe(false);
  });

  it('matches on any keyword from a multi-word label', () => {
    // "Geico Auto Insurance" → keywords: geico, auto, insurance
    expect(descriptionMatches('GEICO PAYMENT', 'Geico Auto Insurance')).toBe(true);
  });

  it('returns false when all label words are < 3 chars (no keywords to match)', () => {
    // "AT&T" splits on & → "at" + "t" → no keywords → never matches
    expect(descriptionMatches('att wireless', 'AT&T')).toBe(false);
    expect(descriptionMatches('at&t wireless payment', 'AT&T')).toBe(false);
  });

  it('does substring matching within description', () => {
    // "state" is a substring of "TRISTATE" → should still match
    expect(descriptionMatches('TRISTATE POWER', 'State Electric')).toBe(true);
  });
});

// ── amountMatches() ───────────────────────────────────────────────────────────

describe('amountMatches()', () => {
  it('exact match returns true', () => {
    expect(amountMatches(100, 100)).toBe(true);
  });

  it('within $2 absolute tolerance returns true', () => {
    expect(amountMatches(98.5, 100)).toBe(true);
    expect(amountMatches(101.99, 100)).toBe(true);
  });

  it('exactly $2 difference is within tolerance', () => {
    expect(amountMatches(102, 100)).toBe(true);
    expect(amountMatches(98, 100)).toBe(true);
  });

  it('$2.01 difference on a large bill uses 10% relative', () => {
    // 102.01 vs 100 → diff = 2.01, diff/100 = 0.0201 ≤ 0.10 → true
    expect(amountMatches(102.01, 100)).toBe(true);
  });

  it('within 10% relative tolerance returns true', () => {
    // 108 vs 100 → diff = 8 > 2, but 8/100 = 0.08 ≤ 0.10
    expect(amountMatches(108, 100)).toBe(true);
    expect(amountMatches(92, 100)).toBe(true);
  });

  it('exactly 10% difference is within tolerance', () => {
    expect(amountMatches(110, 100)).toBe(true);
    expect(amountMatches(90, 100)).toBe(true);
  });

  it('more than 10% difference returns false', () => {
    expect(amountMatches(115, 100)).toBe(false);
    expect(amountMatches(85, 100)).toBe(false);
  });

  it('works for small bill amounts with $2 tolerance', () => {
    // $15 bill, tx $13.50 → diff = 1.50 ≤ 2 → true
    expect(amountMatches(13.5, 15)).toBe(true);
    // $15 bill, tx $12 → diff = 3 > 2, 3/15 = 0.20 > 0.10 → false
    expect(amountMatches(12, 15)).toBe(false);
  });
});

// ── autoMatchBills() ──────────────────────────────────────────────────────────

function buildDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE fixed_expenses (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      amount REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      recurrence TEXT,
      recurrence_anchor TEXT,
      end_date TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      is_investment INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      month TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE bill_payments (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL,
      fixed_expense_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      paid_at TEXT NOT NULL DEFAULT (datetime('now')),
      matched_tx_id INTEGER,
      UNIQUE(user_id, fixed_expense_id, month)
    );
  `);
  return db;
}

const USER = 'user-1';

describe('autoMatchBills()', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = buildDb();
  });

  it('returns 0 when months array is empty', () => {
    expect(autoMatchBills(db, USER, [])).toBe(0);
  });

  it('returns 0 when no active bills exist', () => {
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'Netflix charge',
      15,
      '2025-01',
    );
    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(0);
  });

  it('returns 0 when no transactions exist', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Netflix', 15, 'monthly');
    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(0);
  });

  it('matches a transaction to a bill and inserts bill_payment', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Netflix', 15, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'NETFLIX.COM',
      15,
      '2025-01',
    );

    const count = autoMatchBills(db, USER, ['2025-01']);
    expect(count).toBe(1);

    const payment = db.prepare(`SELECT * FROM bill_payments WHERE user_id = ?`).get(USER) as {
      fixed_expense_id: number;
      month: string;
      matched_tx_id: number;
    };
    expect(payment).toBeTruthy();
    expect(payment.month).toBe('2025-01');
    expect(payment.matched_tx_id).toBe(1);
  });

  it('does not match a transaction with wrong amount', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Netflix', 15, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'NETFLIX.COM',
      50,
      '2025-01',
    );

    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(0);
  });

  it('does not match a transaction with wrong description', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Netflix', 15, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'AMAZON PRIME VIDEO',
      15,
      '2025-01',
    );

    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(0);
  });

  it('skips biweekly bills', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,recurrence,active) VALUES (?,?,?,?,?,1)`,
    ).run(USER, 'Roth IRA', 200, 'monthly', 'biweekly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'ROTH IRA TRANSFER',
      200,
      '2025-01',
    );

    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(0);
  });

  it('skips inactive bills', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,0)`,
    ).run(USER, 'Netflix', 15, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'NETFLIX.COM',
      15,
      '2025-01',
    );

    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(0);
  });

  it('does not double-match a bill that already has a payment', () => {
    const { lastInsertRowid: billId } = db
      .prepare(`INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`)
      .run(USER, 'Netflix', 15, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'NETFLIX.COM',
      15,
      '2025-01',
    );
    db.prepare(`INSERT INTO bill_payments (user_id,fixed_expense_id,month) VALUES (?,?,?)`).run(
      USER,
      billId,
      '2025-01',
    );

    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(0);
  });

  it('matches across multiple months', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Spotify', 11, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'SPOTIFY USA',
      11,
      '2025-01',
    );
    db.prepare(`INSERT INTO transactions VALUES (2,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'SPOTIFY USA',
      11,
      '2025-02',
    );

    expect(autoMatchBills(db, USER, ['2025-01', '2025-02'])).toBe(2);
  });

  it('matches only within correct months, not outside requested range', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Gym', 50, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'GYM MEMBERSHIP',
      50,
      '2025-03',
    );
    // Only request 2025-01
    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(0);
  });

  it('isolates by user_id — does not match other users bills', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run('other-user', 'Netflix', 15, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'NETFLIX.COM',
      15,
      '2025-01',
    );

    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(0);
  });

  it('matches multiple different bills in one month', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Netflix', 15, 'monthly');
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Spotify', 11, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'NETFLIX.COM CHARGE',
      15,
      '2025-01',
    );
    db.prepare(`INSERT INTO transactions VALUES (2,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'SPOTIFY SUBSCRIPTION',
      11,
      '2025-01',
    );

    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(2);
  });

  it('allows $2 amount tolerance for a match', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Electric', 100, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'CITY ELECTRIC BILL',
      101.99,
      '2025-01',
    );

    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(1);
  });

  it('allows 10% relative amount tolerance for a match', () => {
    db.prepare(
      `INSERT INTO fixed_expenses (user_id,label,amount,period,active) VALUES (?,?,?,?,1)`,
    ).run(USER, 'Electric', 100, 'monthly');
    db.prepare(`INSERT INTO transactions VALUES (1,?,?,?,?,'Other','manual',datetime('now'))`).run(
      USER,
      'CITY ELECTRIC BILL',
      108,
      '2025-01',
    );

    expect(autoMatchBills(db, USER, ['2025-01'])).toBe(1);
  });
});
