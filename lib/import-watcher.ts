import fs from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

import { importTransactions } from './csv-import';
import { parseBankCsv } from './csv-utils';
import { takeNetWorthSnapshot } from './db';
import { parseCSVLine } from './utils';

type Db = Database.Database;

const CSV_DIR = path.join(process.cwd(), 'import', 'csv');
const BALANCES_DIR = path.join(process.cwd(), 'import', 'balances');

function csvFilesIn(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.csv'))
    .map((e) => e.name);
}

function moveTo(dir: string, subdir: string, file: string) {
  const destDir = path.join(dir, subdir);
  fs.mkdirSync(destDir, { recursive: true });
  fs.renameSync(path.join(dir, file), path.join(destDir, file));
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Matches a dropped filename against known source labels — the user's saved
 * payment sources plus every source string already used on this user's
 * transactions (e.g. label "Chase 0174" matches "Chase0174_Activity_20260903.csv"
 * despite the space). Matching an *existing* source, not just a plausible-looking
 * new one, matters here: it's what makes the transactions unique-constraint dedupe
 * a re-dropped file instead of re-importing it under a slightly different source
 * string. Falls back to the filename stem so a genuinely new source still imports.
 */
function sourceForFilename(db: Db, userId: string, filename: string): string {
  const stem = filename.replace(/\.csv$/i, '');
  const normName = normalize(stem);
  const labels = new Set([
    ...(
      db.prepare('SELECT label FROM payment_sources WHERE user_id = ?').all(userId) as {
        label: string;
      }[]
    ).map((r) => r.label),
    ...(
      db.prepare('SELECT DISTINCT source FROM transactions WHERE user_id = ?').all(userId) as {
        source: string;
      }[]
    ).map((r) => r.source),
  ]);
  for (const label of labels) {
    if (normName.includes(normalize(label))) return label;
  }
  return stem;
}

function scanTransactionCsvs(db: Db, userId: string, dir: string): void {
  for (const file of csvFilesIn(dir)) {
    try {
      const text = fs.readFileSync(path.join(dir, file), 'utf-8');
      const { transactions, income } = parseBankCsv(text);
      const source = sourceForFilename(db, userId, file);
      const result = importTransactions(db, userId, {
        rows: transactions,
        incomeEntries: income,
        month: new Date().toISOString().slice(0, 7),
        source,
      });
      console.log(
        `[import-watcher] ${file} → ${result.imported} transaction(s), source "${source}"`,
      );
      moveTo(dir, 'processed', file);
    } catch (e) {
      console.warn(`[import-watcher] failed to import ${file}:`, e);
      moveTo(dir, 'failed', file);
    }
  }
}

/** Balance file format: one row per account, `label,balance` or `label,category,balance`. */
function scanBalanceCsvs(db: Db, userId: string, dir: string): void {
  const findByLabel = db.prepare(
    'SELECT id FROM assets WHERE user_id = ? AND lower(label) = lower(?)',
  );
  const update = db.prepare(
    "UPDATE assets SET balance = ?, updated_at = datetime('now') WHERE id = ?",
  );
  const insert = db.prepare(
    'INSERT INTO assets (user_id, label, category, balance) VALUES (?, ?, ?, ?)',
  );

  for (const file of csvFilesIn(dir)) {
    try {
      const text = fs.readFileSync(path.join(dir, file), 'utf-8');
      const lines = text.trim().split('\n');
      let updated = 0;
      db.transaction(() => {
        for (const line of lines) {
          const vals = parseCSVLine(line).map((v) => v.trim());
          if (vals.length < 2 || !vals[0] || /^label/i.test(vals[0])) continue; // skip header row
          const label = vals[0];
          const balance = parseFloat(vals[vals.length - 1].replace(/[^0-9.-]/g, ''));
          const category = vals.length >= 3 ? vals[1] : 'Other';
          if (!label || Number.isNaN(balance)) continue;

          const existing = findByLabel.get(userId, label) as { id: number } | undefined;
          if (existing) {
            update.run(balance, existing.id);
          } else {
            insert.run(userId, label, category, balance);
          }
          updated++;
        }
      })();
      if (updated > 0) takeNetWorthSnapshot(db, userId);
      console.log(`[import-watcher] ${file} → ${updated} balance(s) updated`);
      moveTo(dir, 'processed', file);
    } catch (e) {
      console.warn(`[import-watcher] failed to import ${file}:`, e);
      moveTo(dir, 'failed', file);
    }
  }
}

export function scanImportFolders(
  db: Db,
  userId: string,
  dirs: { csvDir?: string; balancesDir?: string } = {},
): void {
  scanTransactionCsvs(db, userId, dirs.csvDir ?? CSV_DIR);
  scanBalanceCsvs(db, userId, dirs.balancesDir ?? BALANCES_DIR);
}
