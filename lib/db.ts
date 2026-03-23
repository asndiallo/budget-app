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
  // ── Migrate income_config from flat (key PK) → monthly (month+key PK) ──────
  // Detect old schema by checking if 'month' column is missing
  const incomeColNames = (
    db.prepare('PRAGMA table_info(income_config)').all() as { name: string }[]
  ).map((c) => c.name);

  if (!incomeColNames.includes('month')) {
    // Read existing flat data before dropping the table
    const existingRows =
      incomeColNames.length > 0
        ? (db.prepare('SELECT key, value FROM income_config').all() as {
            key: string;
            value: number;
          }[])
        : [];

    db.exec(`
      DROP TABLE IF EXISTS income_config;
      CREATE TABLE income_config (
        month TEXT NOT NULL,
        key   TEXT NOT NULL,
        value REAL NOT NULL,
        PRIMARY KEY (month, key)
      );
    `);

    // Migrate existing data to sentinel base month '0000-00'
    if (existingRows.length > 0) {
      const ins = db.prepare(
        'INSERT INTO income_config (month, key, value) VALUES (?, ?, ?)',
      );
      db.transaction(() => {
        for (const { key, value } of existingRows)
          ins.run('0000-00', key, value);
      })();
    }
  }

  db.exec(`
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

    CREATE TABLE IF NOT EXISTS income_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount      REAL NOT NULL,
      month       TEXT NOT NULL,
      source      TEXT NOT NULL DEFAULT 'Other'
    );

    CREATE TABLE IF NOT EXISTS receivables (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      amount        REAL NOT NULL,
      amount_paid   REAL NOT NULL DEFAULT 0,
      month_created TEXT NOT NULL,
      month_paid    TEXT,
      paid          INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS category_budgets (
      category TEXT PRIMARY KEY,
      budget   REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      label      TEXT NOT NULL,
      category   TEXT NOT NULL DEFAULT 'Other',
      balance    REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id    INTEGER NOT NULL,
      amount     REAL NOT NULL,
      note       TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

  `);

  // ── Column migrations ────────────────────────────────────────────────────────
  const fixedCols = (
    db.prepare('PRAGMA table_info(fixed_expenses)').all() as { name: string }[]
  ).map((c) => c.name);
  if (!fixedCols.includes('period')) {
    db.exec(
      "ALTER TABLE fixed_expenses ADD COLUMN period TEXT NOT NULL DEFAULT 'monthly'",
    );
  }
  if (!fixedCols.includes('day_of_month')) {
    db.exec('ALTER TABLE fixed_expenses ADD COLUMN day_of_month INTEGER');
  }
  if (!fixedCols.includes('notes')) {
    db.exec('ALTER TABLE fixed_expenses ADD COLUMN notes TEXT');
  }
  if (!fixedCols.includes('is_investment')) {
    db.exec(
      'ALTER TABLE fixed_expenses ADD COLUMN is_investment INTEGER NOT NULL DEFAULT 0',
    );
  }

  const receivableCols = (
    db.prepare('PRAGMA table_info(receivables)').all() as { name: string }[]
  ).map((c) => c.name);
  if (receivableCols.length > 0 && !receivableCols.includes('amount_paid')) {
    db.exec(
      'ALTER TABLE receivables ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0',
    );
  }

  const txCols = (
    db.prepare('PRAGMA table_info(transactions)').all() as { name: string }[]
  ).map((c) => c.name);
  if (!txCols.includes('date')) {
    db.exec('ALTER TABLE transactions ADD COLUMN date TEXT');
    // Unique index for idempotent CSV imports — NULLs are intentionally excluded
    // (manual transactions have no date and are never deduplicated this way)
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_dedup
      ON transactions(description, amount, date, source)
      WHERE date IS NOT NULL
    `);
  }

  if (!txCols.includes('import_id')) {
    db.exec('ALTER TABLE transactions ADD COLUMN import_id TEXT');
  }

  if (!txCols.includes('notes')) {
    db.exec('ALTER TABLE transactions ADD COLUMN notes TEXT');
  }

  const assetCols = (
    db.prepare('PRAGMA table_info(assets)').all() as { name: string }[]
  ).map((c) => c.name);
  if (assetCols.length > 0 && !assetCols.includes('category')) {
    db.exec(
      "ALTER TABLE assets ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'",
    );
  }
  if (assetCols.length > 0 && !assetCols.includes('updated_at')) {
    db.exec(
      "ALTER TABLE assets ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
    );
  }

  // ── Migrate legacy transaction source value ──────────────────────────────────
  db.prepare(
    "UPDATE transactions SET source = 'Apple Card' WHERE source = 'apple_card'",
  ).run();

  // ── Seed data (only on fresh DB) ─────────────────────────────────────────────
  const count = (table: string) =>
    (db.prepare(`SELECT count(*) as n FROM ${table}`).get() as { n: number }).n;

  if (count('income_config') === 0) {
    const ins = db.prepare(
      'INSERT INTO income_config (month, key, value) VALUES (?, ?, ?)',
    );
    db.transaction(() => {
      for (const [key, value] of Object.entries(SEED_INCOME))
        ins.run('0000-00', key, value);
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
