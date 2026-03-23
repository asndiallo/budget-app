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
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      username         TEXT    NOT NULL UNIQUE,
      password_hash    TEXT    NOT NULL,
      role             TEXT    NOT NULL DEFAULT 'user',
      display_name     TEXT    NOT NULL DEFAULT '',
      branch           TEXT    NOT NULL DEFAULT 'Army',
      pay_grade        TEXT    NOT NULL DEFAULT 'E-3',
      mos              TEXT    NOT NULL DEFAULT '',
      duty_station     TEXT    NOT NULL DEFAULT '',
      bah_zip          TEXT    NOT NULL DEFAULT '',
      component        TEXT    NOT NULL DEFAULT 'Active',
      dependents       INTEGER NOT NULL DEFAULT 0,
      years_of_service REAL    NOT NULL DEFAULT 0,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS income_config (
      user_id INTEGER NOT NULL DEFAULT 1,
      month   TEXT    NOT NULL,
      key     TEXT    NOT NULL,
      value   REAL    NOT NULL,
      PRIMARY KEY (user_id, month, key)
    );

    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL DEFAULT 1,
      label         TEXT    NOT NULL,
      amount        REAL    NOT NULL,
      period        TEXT    NOT NULL DEFAULT 'monthly',
      day_of_month  INTEGER,
      notes         TEXT,
      is_investment INTEGER NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL DEFAULT 1,
      description TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      category    TEXT    NOT NULL DEFAULT 'Other',
      month       TEXT    NOT NULL,
      source      TEXT    NOT NULL DEFAULT 'manual',
      date        TEXT,
      import_id   TEXT,
      notes       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_dedup
      ON transactions(user_id, description, amount, date, source)
      WHERE date IS NOT NULL;

    CREATE TABLE IF NOT EXISTS goals (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name    TEXT    NOT NULL,
      target  REAL    NOT NULL,
      saved   REAL    NOT NULL DEFAULT 0,
      color   TEXT    NOT NULL DEFAULT 'blue',
      active  INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id    INTEGER NOT NULL,
      amount     REAL    NOT NULL,
      note       TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_sources (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      label   TEXT    NOT NULL,
      UNIQUE(user_id, label)
    );

    CREATE TABLE IF NOT EXISTS debts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL DEFAULT 1,
      label           TEXT    NOT NULL,
      lender          TEXT    NOT NULL DEFAULT '',
      balance         REAL    NOT NULL DEFAULT 0,
      monthly_payment REAL    NOT NULL DEFAULT 0,
      interest_rate   REAL    NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS income_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL DEFAULT 1,
      description TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      month       TEXT    NOT NULL,
      source      TEXT    NOT NULL DEFAULT 'Other'
    );

    CREATE TABLE IF NOT EXISTS receivables (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL DEFAULT 1,
      name          TEXT    NOT NULL,
      description   TEXT    NOT NULL DEFAULT '',
      amount        REAL    NOT NULL,
      amount_paid   REAL    NOT NULL DEFAULT 0,
      month_created TEXT    NOT NULL,
      month_paid    TEXT,
      paid          INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS category_budgets (
      user_id  INTEGER NOT NULL DEFAULT 1,
      category TEXT    NOT NULL,
      budget   REAL    NOT NULL,
      PRIMARY KEY (user_id, category)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL DEFAULT 1,
      label      TEXT    NOT NULL,
      category   TEXT    NOT NULL DEFAULT 'Other',
      balance    REAL    NOT NULL DEFAULT 0,
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Seed admin user ───────────────────────────────────────────────────────────
  const noUsers =
    (db.prepare('SELECT count(*) as n FROM users').get() as { n: number }).n ===
    0;

  if (noUsers) {
    db.prepare(`
      INSERT INTO users (username, password_hash, role, display_name, pay_grade, duty_station)
      VALUES ('admin', '', 'admin', 'Admin', 'E-3', 'JBSA Fort Sam Houston')
    `).run();
  }

  // ── Seed financial data (only on fresh DB) ────────────────────────────────────
  const empty = (table: string) =>
    (db.prepare(`SELECT count(*) as n FROM ${table}`).get() as { n: number })
      .n === 0;

  if (empty('income_config')) {
    const ins = db.prepare(
      'INSERT INTO income_config (user_id, month, key, value) VALUES (?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const [key, value] of Object.entries(SEED_INCOME))
        ins.run(1, '0000-00', key, value);
    })();
  }

  if (empty('fixed_expenses')) {
    const ins = db.prepare(
      'INSERT INTO fixed_expenses (user_id, label, amount, period) VALUES (?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const { label, amount, period } of SEED_FIXED_EXPENSES)
        ins.run(1, label, amount, period);
    })();
  }

  if (empty('payment_sources')) {
    const ins = db.prepare(
      'INSERT INTO payment_sources (user_id, label) VALUES (?, ?)',
    );
    db.transaction(() => {
      for (const { label } of SEED_PAYMENT_SOURCES) ins.run(1, label);
    })();
  }

  if (empty('debts')) {
    const ins = db.prepare(
      'INSERT INTO debts (user_id, label, lender, balance, monthly_payment, interest_rate) VALUES (?, ?, ?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const { label, lender, balance, monthly_payment, interest_rate } of SEED_DEBTS)
        ins.run(1, label, lender, balance, monthly_payment, interest_rate);
    })();
  }

  if (empty('goals')) {
    const ins = db.prepare(
      'INSERT INTO goals (user_id, name, target, saved, color) VALUES (?, ?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const { name, target, saved, color } of SEED_GOALS)
        ins.run(1, name, target, saved, color);
    })();
  }
}
