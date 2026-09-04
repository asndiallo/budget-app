import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initSchema } from '../db';
import { scanImportFolders } from '../import-watcher';

const USER = 'user-1';

function buildDb(): Database.Database {
  const db = new Database(':memory:');
  initSchema(db);
  db.exec('CREATE TABLE users (id TEXT PRIMARY KEY, joined_at TEXT)');
  db.prepare('INSERT INTO users (id, joined_at) VALUES (?, NULL)').run(USER);
  return db;
}

describe('scanImportFolders()', () => {
  let db: Database.Database;
  let root: string;
  let csvDir: string;
  let balancesDir: string;

  beforeEach(() => {
    db = buildDb();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fieldbook-import-'));
    csvDir = path.join(root, 'csv');
    balancesDir = path.join(root, 'balances');
    fs.mkdirSync(csvDir, { recursive: true });
    fs.mkdirSync(balancesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('does nothing when both folders are empty', () => {
    expect(() => scanImportFolders(db, USER, { csvDir, balancesDir })).not.toThrow();
  });

  describe('transaction CSVs', () => {
    it('imports a bank CSV and moves it to processed/', () => {
      fs.writeFileSync(
        path.join(csvDir, 'transactions.csv'),
        'Date,Description,Category,Amount\n2026-06-01,Coffee Shop,Dining,4.50\n',
      );

      scanImportFolders(db, USER, { csvDir, balancesDir });

      const rows = db
        .prepare('SELECT description, amount FROM transactions WHERE user_id = ?')
        .all(USER);
      expect(rows).toEqual([{ description: 'Coffee Shop', amount: 4.5 }]);
      expect(fs.existsSync(path.join(csvDir, 'transactions.csv'))).toBe(false);
      expect(fs.existsSync(path.join(csvDir, 'processed', 'transactions.csv'))).toBe(true);
    });

    it('picks the source from a matching payment source label in the filename', () => {
      db.prepare('INSERT INTO payment_sources (user_id, label) VALUES (?, ?)').run(USER, 'Chase');
      fs.writeFileSync(
        path.join(csvDir, 'Chase0174_Activity_20260601.csv'),
        'Date,Description,Category,Amount\n2026-06-01,Grocery Store,Food,25.00\n',
      );

      scanImportFolders(db, USER, { csvDir, balancesDir });

      const row = db.prepare('SELECT source FROM transactions WHERE user_id = ?').get(USER) as {
        source: string;
      };
      expect(row.source).toBe('Chase');
    });

    it('imports nothing but still archives an empty file', () => {
      fs.writeFileSync(path.join(csvDir, 'empty.csv'), '');

      expect(() => scanImportFolders(db, USER, { csvDir, balancesDir })).not.toThrow();
      const rows = db.prepare('SELECT * FROM transactions WHERE user_id = ?').all(USER);
      expect(rows).toEqual([]);
      expect(fs.existsSync(path.join(csvDir, 'processed', 'empty.csv'))).toBe(true);
    });
  });

  describe('balance CSVs', () => {
    it('creates a new asset from a label,balance row', () => {
      fs.writeFileSync(
        path.join(balancesDir, 'balances.csv'),
        'label,balance\nFidelity Roth IRA,12326\n',
      );

      scanImportFolders(db, USER, { csvDir, balancesDir });

      const asset = db
        .prepare('SELECT label, category, balance FROM assets WHERE user_id = ?')
        .get(USER) as { label: string; category: string; balance: number };
      expect(asset).toEqual({ label: 'Fidelity Roth IRA', category: 'Other', balance: 12326 });
      expect(fs.existsSync(path.join(balancesDir, 'processed', 'balances.csv'))).toBe(true);
    });

    it('updates an existing asset matched case-insensitively by label', () => {
      db.prepare('INSERT INTO assets (user_id, label, category, balance) VALUES (?, ?, ?, ?)').run(
        USER,
        'TSP (Thrift Savings Plan)',
        'Retirement',
        4502,
      );
      fs.writeFileSync(
        path.join(balancesDir, 'balances.csv'),
        'tsp (thrift savings plan),4811.20\n',
      );

      scanImportFolders(db, USER, { csvDir, balancesDir });

      const assets = db.prepare('SELECT balance FROM assets WHERE user_id = ?').all(USER);
      expect(assets).toEqual([{ balance: 4811.2 }]);
    });

    it('takes a net worth snapshot when balances change', () => {
      fs.writeFileSync(path.join(balancesDir, 'balances.csv'), 'label,balance\nChecking,1000\n');

      scanImportFolders(db, USER, { csvDir, balancesDir });

      const snapshots = db
        .prepare('SELECT assets FROM net_worth_snapshots WHERE user_id = ?')
        .all(USER);
      expect(snapshots).toEqual([{ assets: 1000 }]);
    });

    it('honors an explicit category column', () => {
      fs.writeFileSync(
        path.join(balancesDir, 'balances.csv'),
        'label,category,balance\n117 Willow CV,Property,300000\n',
      );

      scanImportFolders(db, USER, { csvDir, balancesDir });

      const asset = db.prepare('SELECT category FROM assets WHERE user_id = ?').get(USER) as {
        category: string;
      };
      expect(asset.category).toBe('Property');
    });
  });
});
