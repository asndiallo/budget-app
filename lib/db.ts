import {
  SEED_DEBTS,
  SEED_FIXED_EXPENSES,
  SEED_GOALS,
  SEED_INCOME,
  SEED_PAYMENT_SOURCES,
} from './config';

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'budget.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS income_config (
      key   TEXT PRIMARY KEY,
      value REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      label     TEXT NOT NULL,
      amount    REAL NOT NULL,
      active    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount      REAL NOT NULL,
      category    TEXT NOT NULL DEFAULT 'Other',
      month       TEXT NOT NULL,
      source      TEXT NOT NULL DEFAULT 'manual',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT NOT NULL,
      target   REAL NOT NULL,
      saved    REAL NOT NULL DEFAULT 0,
      color    TEXT NOT NULL DEFAULT 'blue',
      active   INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS payment_sources (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS debts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      label           TEXT NOT NULL,
      lender          TEXT NOT NULL DEFAULT '',
      balance         REAL NOT NULL DEFAULT 0,
      monthly_payment REAL NOT NULL DEFAULT 0,
      interest_rate   REAL NOT NULL DEFAULT 0
    );
  `);

  // Migrations — idempotent column additions
  const fixedCols = (
    db.prepare('PRAGMA table_info(fixed_expenses)').all() as { name: string }[]
  ).map((c) => c.name);
  if (!fixedCols.includes('period')) {
    db.exec(
      "ALTER TABLE fixed_expenses ADD COLUMN period TEXT NOT NULL DEFAULT 'monthly'",
    );
  }

  // Ensure all income_config keys exist (INSERT OR IGNORE is safe for existing rows)
  const upsertIncome = db.prepare(
    'INSERT OR IGNORE INTO income_config (key, value) VALUES (?, ?)',
  );
  const newIncomeKeys: Record<string, number> = {
    tsp_rate: 0.2,
    fica_soc_security: 175.88,
    fica_medicare: 41.13,
    afrh: 0.5,
    meal_deduction: 382.2,
  };
  db.transaction(() => {
    for (const [key, value] of Object.entries(newIncomeKeys))
      upsertIncome.run(key, value);
  })();

  // Migrate legacy source value
  db.prepare(
    "UPDATE transactions SET source = 'Apple Card' WHERE source = 'apple_card'",
  ).run();

  const count = (table: string) =>
    (db.prepare(`SELECT count(*) as n FROM ${table}`).get() as { n: number }).n;

  if (count('income_config') === 0) {
    const ins = db.prepare(
      'INSERT INTO income_config (key, value) VALUES (?, ?)',
    );
    db.transaction(() => {
      for (const [key, value] of Object.entries(SEED_INCOME))
        ins.run(key, value);
    })();
  }

  if (count('fixed_expenses') === 0) {
    const ins = db.prepare(
      'INSERT INTO fixed_expenses (label, amount, period) VALUES (?, ?, ?)',
    );
    db.transaction(() => {
      for (const { label, amount, period } of SEED_FIXED_EXPENSES)
        ins.run(label, amount, period);
    })();
  }

  if (count('payment_sources') === 0) {
    const ins = db.prepare('INSERT INTO payment_sources (label) VALUES (?)');
    db.transaction(() => {
      for (const { label } of SEED_PAYMENT_SOURCES) ins.run(label);
    })();
  }

  if (count('debts') === 0) {
    const ins = db.prepare(
      'INSERT INTO debts (label, lender, balance, monthly_payment, interest_rate) VALUES (?, ?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const {
        label,
        lender,
        balance,
        monthly_payment,
        interest_rate,
      } of SEED_DEBTS)
        ins.run(label, lender, balance, monthly_payment, interest_rate);
    })();
  }

  if (count('goals') === 0) {
    const ins = db.prepare(
      'INSERT INTO goals (name, target, saved, color) VALUES (?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const { name, target, saved, color } of SEED_GOALS)
        ins.run(name, target, saved, color);
    })();
  }
}
