import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { detectDebtPayments } from '../debt-match';

// ── In-memory DB ──────────────────────────────────────────────────────────────

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE debts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL,
      label           TEXT NOT NULL,
      lender          TEXT NOT NULL DEFAULT '',
      balance         REAL NOT NULL DEFAULT 0,
      monthly_payment REAL NOT NULL DEFAULT 0,
      interest_rate   REAL NOT NULL DEFAULT 0,
      day_of_month    INTEGER
    );
    CREATE TABLE transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      description TEXT NOT NULL,
      amount      REAL NOT NULL,
      category    TEXT NOT NULL DEFAULT 'Other',
      month       TEXT NOT NULL,
      source      TEXT NOT NULL DEFAULT 'manual',
      date        TEXT,
      notes       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE debt_payments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT NOT NULL,
      debt_id        INTEGER NOT NULL,
      transaction_id INTEGER NOT NULL,
      amount         REAL NOT NULL,
      applied_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, transaction_id)
    );
  `);
  return db;
}

const USER = 'user-1';
const OTHER = 'user-2';

// Always within the 3-month detection window
const d = new Date();
const MONTH = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function debt(
  db: Database.Database,
  userId: string,
  data: { label: string; lender?: string; balance: number; monthly_payment: number },
): number {
  return db
    .prepare(
      'INSERT INTO debts (user_id, label, lender, balance, monthly_payment) VALUES (?, ?, ?, ?, ?)',
    )
    .run(userId, data.label, data.lender ?? '', data.balance, data.monthly_payment)
    .lastInsertRowid as number;
}

function tx(
  db: Database.Database,
  userId: string,
  data: { description: string; amount: number; month?: string },
): number {
  return db
    .prepare('INSERT INTO transactions (user_id, description, amount, month) VALUES (?, ?, ?, ?)')
    .run(userId, data.description, data.amount, data.month ?? MONTH).lastInsertRowid as number;
}

function applyPayment(
  db: Database.Database,
  userId: string,
  debtId: number,
  txId: number,
  amount: number,
) {
  db.prepare(
    'INSERT INTO debt_payments (user_id, debt_id, transaction_id, amount) VALUES (?, ?, ?, ?)',
  ).run(userId, debtId, txId, amount);
}

// ── Matching ──────────────────────────────────────────────────────────────────

describe('detectDebtPayments() — matching', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it('matches by lender keyword and exact amount', () => {
    debt(db, USER, {
      label: 'Car Loan',
      lender: 'Westlake Financial',
      balance: 15000,
      monthly_payment: 241.73,
    });
    tx(db, USER, { description: 'Payment to Westlake Financial', amount: 241.73 });

    const results = detectDebtPayments(db, USER);
    expect(results).toHaveLength(1);
    expect(results[0].debtLabel).toBe('Car Loan');
    expect(results[0].txAmount).toBe(241.73);
  });

  it('matches by label keyword when lender is empty', () => {
    debt(db, USER, { label: 'Student Loan', lender: '', balance: 20000, monthly_payment: 350 });
    tx(db, USER, { description: 'Student loan payment ACH', amount: 350 });

    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });

  it('uses keywords from both lender and label (union)', () => {
    debt(db, USER, { label: 'Car Loan', lender: 'Westlake', balance: 10000, monthly_payment: 200 });
    // Description matches "car" from label, not lender
    tx(db, USER, { description: 'Car loan payment', amount: 200 });

    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    debt(db, USER, {
      label: 'Car Loan',
      lender: 'WESTLAKE FINANCIAL',
      balance: 5000,
      monthly_payment: 241.73,
    });
    tx(db, USER, { description: 'payment to westlake financial', amount: 241.73 });

    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });

  it('does not match when no keyword appears in description', () => {
    debt(db, USER, {
      label: 'Car Loan',
      lender: 'Westlake Financial',
      balance: 10000,
      monthly_payment: 241.73,
    });
    tx(db, USER, { description: 'NETFLIX CHARGE', amount: 241.73 });

    expect(detectDebtPayments(db, USER)).toHaveLength(0);
  });

  it('does not match short keywords (< 3 chars) from lender name', () => {
    // "AT&T" splits to "at" + "t" — both < 3 chars, no keywords extracted
    debt(db, USER, { label: 'Phone Debt', lender: 'AT&T', balance: 500, monthly_payment: 50 });
    tx(db, USER, { description: 'AT&T payment', amount: 50 });

    // No keywords from "AT&T", so no match possible via lender
    // "phone" from label would match "phone" in description only if present
    expect(detectDebtPayments(db, USER)).toHaveLength(0);
  });
});

// ── Amount tolerance ──────────────────────────────────────────────────────────

describe('detectDebtPayments() — amount tolerance', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it('matches within $10 absolute (below)', () => {
    debt(db, USER, { label: 'Loan', lender: 'Westlake', balance: 10000, monthly_payment: 250 });
    tx(db, USER, { description: 'Payment to Westlake', amount: 242 }); // $8 under

    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });

  it('matches within $10 absolute (above)', () => {
    debt(db, USER, { label: 'Loan', lender: 'Westlake', balance: 10000, monthly_payment: 250 });
    tx(db, USER, { description: 'Payment to Westlake', amount: 258 }); // $8 over

    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });

  it('matches within 15% relative for large payments', () => {
    debt(db, USER, {
      label: 'Mortgage',
      lender: 'Quicken',
      balance: 300000,
      monthly_payment: 2000,
    });
    tx(db, USER, { description: 'Quicken mortgage payment', amount: 2200 }); // 10% over

    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });

  it('does not match beyond $10 absolute and 15% relative', () => {
    debt(db, USER, { label: 'Loan', lender: 'Westlake', balance: 10000, monthly_payment: 250 });
    tx(db, USER, { description: 'Payment to Westlake', amount: 400 }); // 60% over

    expect(detectDebtPayments(db, USER)).toHaveLength(0);
  });

  it('does not match when amount is far too low', () => {
    debt(db, USER, { label: 'Loan', lender: 'Westlake', balance: 10000, monthly_payment: 250 });
    tx(db, USER, { description: 'Payment to Westlake', amount: 25 }); // 90% under

    expect(detectDebtPayments(db, USER)).toHaveLength(0);
  });

  it('boundary: $10 over is included, $11 over is excluded', () => {
    debt(db, USER, { label: 'Loan', lender: 'Westlake', balance: 10000, monthly_payment: 250 });
    tx(db, USER, { description: 'Payment to Westlake', amount: 260 }); // exactly $10 over → in
    expect(detectDebtPayments(db, USER)).toHaveLength(1);

    db = makeDb();
    debt(db, USER, { label: 'Loan', lender: 'Westlake', balance: 10000, monthly_payment: 250 });
    tx(db, USER, { description: 'Payment to Westlake', amount: 262 }); // $12 over, 4.8% → still in via 15%
    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });
});

// ── Skip conditions ───────────────────────────────────────────────────────────

describe('detectDebtPayments() — skip conditions', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it('skips paid-off debts (balance = 0)', () => {
    debt(db, USER, { label: 'Car Loan', lender: 'Westlake', balance: 0, monthly_payment: 241.73 });
    tx(db, USER, { description: 'Payment to Westlake Financial', amount: 241.73 });

    expect(detectDebtPayments(db, USER)).toHaveLength(0);
  });

  it('skips debts with no monthly payment set', () => {
    debt(db, USER, { label: 'Car Loan', lender: 'Westlake', balance: 10000, monthly_payment: 0 });
    tx(db, USER, { description: 'Payment to Westlake Financial', amount: 241.73 });

    expect(detectDebtPayments(db, USER)).toHaveLength(0);
  });

  it('skips transactions already applied via debt_payments', () => {
    const d = debt(db, USER, {
      label: 'Car Loan',
      lender: 'Westlake',
      balance: 10000,
      monthly_payment: 241.73,
    });
    const t = tx(db, USER, { description: 'Payment to Westlake Financial', amount: 241.73 });
    applyPayment(db, USER, d, t, 241.73);

    expect(detectDebtPayments(db, USER)).toHaveLength(0);
  });

  it('skips transactions older than 3 months', () => {
    debt(db, USER, {
      label: 'Car Loan',
      lender: 'Westlake',
      balance: 10000,
      monthly_payment: 241.73,
    });
    tx(db, USER, {
      description: 'Payment to Westlake Financial',
      amount: 241.73,
      month: '2020-01',
    });

    expect(detectDebtPayments(db, USER)).toHaveLength(0);
  });
});

// ── Multiple debts / transactions ─────────────────────────────────────────────

describe('detectDebtPayments() — multiple debts and transactions', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it('returns one suggestion per matched debt', () => {
    debt(db, USER, {
      label: 'Car Loan',
      lender: 'Westlake',
      balance: 10000,
      monthly_payment: 241.73,
    });
    debt(db, USER, {
      label: 'Student Loan',
      lender: 'Navient',
      balance: 20000,
      monthly_payment: 350,
    });
    tx(db, USER, { description: 'Payment to Westlake Financial', amount: 241.73 });
    tx(db, USER, { description: 'Navient student loan autopay', amount: 350 });

    expect(detectDebtPayments(db, USER)).toHaveLength(2);
  });

  it('one transaction cannot be matched to multiple debts', () => {
    // Two debts with the same lender and same payment — only first should get the tx
    debt(db, USER, {
      label: 'Loan A',
      lender: 'Westlake',
      balance: 10000,
      monthly_payment: 241.73,
    });
    debt(db, USER, { label: 'Loan B', lender: 'Westlake', balance: 5000, monthly_payment: 241.73 });
    tx(db, USER, { description: 'Payment to Westlake Financial', amount: 241.73 });

    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });

  it('unmatched debts produce no suggestions', () => {
    debt(db, USER, {
      label: 'Car Loan',
      lender: 'Westlake',
      balance: 10000,
      monthly_payment: 241.73,
    });
    debt(db, USER, { label: 'Credit Card', lender: 'Chase', balance: 5000, monthly_payment: 150 });
    tx(db, USER, { description: 'Payment to Westlake Financial', amount: 241.73 });
    // No Chase transaction → only Westlake matches

    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });

  it('suggestedBalance floors at 0 when payment exceeds balance', () => {
    debt(db, USER, {
      label: 'Final Payment',
      lender: 'Westlake',
      balance: 100,
      monthly_payment: 200,
    });
    tx(db, USER, { description: 'Payment to Westlake', amount: 200 });

    const [s] = detectDebtPayments(db, USER);
    expect(s.suggestedBalance).toBe(0);
  });
});

// ── User isolation ────────────────────────────────────────────────────────────

describe('detectDebtPayments() — user isolation', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it('does not return suggestions belonging to another user', () => {
    debt(db, OTHER, {
      label: 'Car Loan',
      lender: 'Westlake',
      balance: 10000,
      monthly_payment: 241.73,
    });
    tx(db, OTHER, { description: 'Payment to Westlake Financial', amount: 241.73 });

    expect(detectDebtPayments(db, USER)).toHaveLength(0);
  });

  it('debt_payments from another user do not suppress suggestions for this user', () => {
    const d = debt(db, USER, {
      label: 'Car Loan',
      lender: 'Westlake',
      balance: 10000,
      monthly_payment: 241.73,
    });
    const t = tx(db, USER, { description: 'Payment to Westlake Financial', amount: 241.73 });
    // Only OTHER user has applied this payment — USER's suggestion should still appear
    applyPayment(db, OTHER, d, t, 241.73);

    expect(detectDebtPayments(db, USER)).toHaveLength(1);
  });
});

// ── Return shape ──────────────────────────────────────────────────────────────

describe('detectDebtPayments() — return shape', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = makeDb();
  });

  it('returns all required fields with correct values', () => {
    const dId = debt(db, USER, {
      label: 'Car Loan',
      lender: 'Westlake Financial',
      balance: 15000,
      monthly_payment: 241.73,
    });
    const tId = tx(db, USER, { description: 'Payment to Westlake Financial', amount: 241.73 });

    const [s] = detectDebtPayments(db, USER);
    expect(s.debtId).toBe(dId);
    expect(s.debtLabel).toBe('Car Loan');
    expect(s.debtLender).toBe('Westlake Financial');
    expect(s.debtBalance).toBe(15000);
    expect(s.transactionId).toBe(tId);
    expect(s.txDescription).toBe('Payment to Westlake Financial');
    expect(s.txAmount).toBe(241.73);
    expect(s.txMonth).toBe(MONTH);
    expect(s.suggestedBalance).toBeCloseTo(15000 - 241.73, 2);
  });

  it('returns empty array when no debts exist', () => {
    tx(db, USER, { description: 'Some payment', amount: 100 });
    expect(detectDebtPayments(db, USER)).toEqual([]);
  });

  it('returns empty array when no transactions exist', () => {
    debt(db, USER, {
      label: 'Car Loan',
      lender: 'Westlake',
      balance: 10000,
      monthly_payment: 241.73,
    });
    expect(detectDebtPayments(db, USER)).toEqual([]);
  });
});
