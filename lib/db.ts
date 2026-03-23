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
  // ── App settings (key/value store, used for JWT secret etc.) ─────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // ── Users table ───────────────────────────────────────────────────────────────
  db.exec(`
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
  `);

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
    `);

    // Will be recreated with user_id below
    db.exec(`
      CREATE TABLE income_config (
        user_id INTEGER NOT NULL DEFAULT 1,
        month   TEXT    NOT NULL,
        key     TEXT    NOT NULL,
        value   REAL    NOT NULL,
        PRIMARY KEY (user_id, month, key)
      );
    `);

    // Migrate existing data to sentinel base month '0000-00', user_id=1
    if (existingRows.length > 0) {
      const ins = db.prepare(
        'INSERT INTO income_config (user_id, month, key, value) VALUES (?, ?, ?, ?)',
      );
      db.transaction(() => {
        for (const { key, value } of existingRows)
          ins.run(1, '0000-00', key, value);
      })();
    }
  } else if (!incomeColNames.includes('user_id')) {
    // Has 'month' but no 'user_id' yet — migrate to user-scoped PK
    // Rename old table, create new one, copy data, drop old
    db.exec(`
      ALTER TABLE income_config RENAME TO _income_config_old;

      CREATE TABLE income_config (
        user_id INTEGER NOT NULL DEFAULT 1,
        month   TEXT    NOT NULL,
        key     TEXT    NOT NULL,
        value   REAL    NOT NULL,
        PRIMARY KEY (user_id, month, key)
      );

      INSERT INTO income_config (user_id, month, key, value)
        SELECT 1, month, key, value FROM _income_config_old;

      DROP TABLE _income_config_old;
    `);
  }

  // ── Core tables ───────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL DEFAULT 1,
      label     TEXT    NOT NULL,
      amount    REAL    NOT NULL,
      active    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL DEFAULT 1,
      description TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      category    TEXT    NOT NULL DEFAULT 'Other',
      month       TEXT    NOT NULL,
      source      TEXT    NOT NULL DEFAULT 'manual',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name    TEXT    NOT NULL,
      target  REAL    NOT NULL,
      saved   REAL    NOT NULL DEFAULT 0,
      color   TEXT    NOT NULL DEFAULT 'blue',
      active  INTEGER NOT NULL DEFAULT 1
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

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id    INTEGER NOT NULL,
      amount     REAL    NOT NULL,
      note       TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Column migrations (backward compat for existing databases) ────────────────
  _addColIfMissing(db, 'fixed_expenses', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  _addColIfMissing(db, 'fixed_expenses', 'period', "TEXT NOT NULL DEFAULT 'monthly'");
  _addColIfMissing(db, 'fixed_expenses', 'day_of_month', 'INTEGER');
  _addColIfMissing(db, 'fixed_expenses', 'notes', 'TEXT');
  _addColIfMissing(db, 'fixed_expenses', 'is_investment', 'INTEGER NOT NULL DEFAULT 0');

  _addColIfMissing(db, 'transactions', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  _addColIfMissing(db, 'transactions', 'notes', 'TEXT');
  _addColIfMissing(db, 'transactions', 'import_id', 'TEXT');

  if (!_addColIfMissing(db, 'transactions', 'date', 'TEXT')) {
    // Column just added — create the dedup index
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_dedup
      ON transactions(description, amount, date, source)
      WHERE date IS NOT NULL
    `);
  }

  _addColIfMissing(db, 'receivables', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  _addColIfMissing(db, 'receivables', 'amount_paid', 'REAL NOT NULL DEFAULT 0');

  _addColIfMissing(db, 'goals', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  _addColIfMissing(db, 'debts', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  _addColIfMissing(db, 'income_entries', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  _addColIfMissing(db, 'payment_sources', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  _addColIfMissing(db, 'assets', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  _addColIfMissing(db, 'assets', 'category', "TEXT NOT NULL DEFAULT 'Other'");
  _addColIfMissing(db, 'assets', 'updated_at', "TEXT NOT NULL DEFAULT (datetime('now'))");

  // Migrate legacy category_budgets (old PK was just `category`)
  const cbCols = _cols(db, 'category_budgets');
  if (cbCols.length > 0 && !cbCols.includes('user_id')) {
    db.exec(`
      ALTER TABLE category_budgets RENAME TO _cb_old;
      CREATE TABLE category_budgets (
        user_id  INTEGER NOT NULL DEFAULT 1,
        category TEXT    NOT NULL,
        budget   REAL    NOT NULL,
        PRIMARY KEY (user_id, category)
      );
      INSERT INTO category_budgets (user_id, category, budget)
        SELECT 1, category, budget FROM _cb_old;
      DROP TABLE _cb_old;
    `);
  }

  // ── Migrate legacy payment_sources unique constraint ─────────────────────────
  // Old schema had UNIQUE(label); we need UNIQUE(user_id, label).
  // Simplest safe migration: just ensure the column exists (done above).
  // The old UNIQUE(label) index won't cause problems since we filter by user_id.

  // ── Legacy source value fix ───────────────────────────────────────────────────
  db.prepare(
    "UPDATE transactions SET source = 'Apple Card' WHERE source = 'apple_card'",
  ).run();

  // ── Seed first admin user if no users exist ───────────────────────────────────
  const userCount = (
    db.prepare('SELECT count(*) as n FROM users').get() as { n: number }
  ).n;

  if (userCount === 0) {
    // Insert a placeholder admin — will be replaced during setup wizard.
    // password_hash is empty: the setup wizard forces a password on first login.
    db.prepare(`
      INSERT INTO users (username, password_hash, role, display_name, pay_grade, duty_station)
      VALUES ('admin', '', 'admin', 'Admin', 'E-3', 'JBSA Fort Sam Houston')
    `).run();
  }

  // ── Seed financial data (only on fresh DB, assign to user 1) ─────────────────
  const count = (table: string) =>
    (db.prepare(`SELECT count(*) as n FROM ${table}`).get() as { n: number }).n;

  if (count('income_config') === 0) {
    const ins = db.prepare(
      'INSERT INTO income_config (user_id, month, key, value) VALUES (?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const [key, value] of Object.entries(SEED_INCOME))
        ins.run(1, '0000-00', key, value);
    })();
  }

  if (count('fixed_expenses') === 0) {
    const ins = db.prepare(
      'INSERT INTO fixed_expenses (user_id, label, amount, period) VALUES (?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const { label, amount, period } of SEED_FIXED_EXPENSES)
        ins.run(1, label, amount, period);
    })();
  }

  if (count('payment_sources') === 0) {
    const ins = db.prepare(
      'INSERT INTO payment_sources (user_id, label) VALUES (?, ?)',
    );
    db.transaction(() => {
      for (const { label } of SEED_PAYMENT_SOURCES) ins.run(1, label);
    })();
  }

  if (count('debts') === 0) {
    const ins = db.prepare(
      'INSERT INTO debts (user_id, label, lender, balance, monthly_payment, interest_rate) VALUES (?, ?, ?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const {
        label,
        lender,
        balance,
        monthly_payment,
        interest_rate,
      } of SEED_DEBTS)
        ins.run(1, label, lender, balance, monthly_payment, interest_rate);
    })();
  }

  if (count('goals') === 0) {
    const ins = db.prepare(
      'INSERT INTO goals (user_id, name, target, saved, color) VALUES (?, ?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const { name, target, saved, color } of SEED_GOALS)
        ins.run(1, name, target, saved, color);
    })();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns column names for a table, or [] if table doesn't exist. */
function _cols(db: Database.Database, table: string): string[] {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  ).map((c) => c.name);
}

/**
 * Adds a column to a table if it doesn't already exist.
 * Returns true if the column already existed, false if it was just added.
 */
function _addColIfMissing(
  db: Database.Database,
  table: string,
  col: string,
  definition: string,
): boolean {
  const cols = _cols(db, table);
  if (cols.length === 0) return true; // table doesn't exist yet
  if (cols.includes(col)) return true;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
  return false;
}
