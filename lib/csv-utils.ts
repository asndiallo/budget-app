// Pure CSV import helpers — extracted here so they can be unit-tested.

import {
  CSV_CATEGORY_MAP,
  DEFAULT_CATEGORY,
  GIG_INCOME_PLATFORMS,
  INVESTMENT_CATEGORY,
} from './config';
import type { CsvRow, DetectedIncomeRow } from './types';
import { parseCSVLine } from './utils';

/** Returns the display source name if `description` matches a known gig-income platform. */
function matchGigIncome(description: string): string | null {
  const lower = description.toLowerCase();
  return GIG_INCOME_PLATFORMS.find((p) => lower.includes(p.keyword))?.source ?? null;
}

/**
 * Parses a date string from a CSV row into a normalised month + ISO date.
 * Accepts MM/DD/YYYY and YYYY-MM-DD formats.
 * Returns null for empty or unrecognised strings.
 */
export function parseDate(dateStr: string): { month: string; date: string } | null {
  if (!dateStr) return null;

  const slash = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return { month: `${y}-${m.padStart(2, '0')}`, date };
  }

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso)
    return {
      month: `${iso[1]}-${iso[2]}`,
      date: `${iso[1]}-${iso[2]}-${iso[3]}`,
    };

  return null;
}

/**
 * Maps a raw CSV category label (e.g. "Food & Drink") to an internal
 * app category using CSV_CATEGORY_MAP. Falls back to DEFAULT_CATEGORY.
 */
export function mapCategory(raw: string): string {
  const lower = (raw || '').toLowerCase();
  for (const [key, val] of Object.entries(CSV_CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return DEFAULT_CATEGORY;
}

/**
 * Parses a raw bank/card CSV export (as text) into transactions ready for
 * api.transactions.importCsv(), plus any recognized gig-income deposits
 * (see GIG_INCOME_PLATFORMS) ready for income_entries. Detects the source
 * format from its column headers — NFCU, Capital One (card and
 * checking-export shapes), USAA, BofA (bank and credit) — and falls back to
 * a generic description/amount/category/date column scan for anything else
 * (Chase, Apple Card, etc.).
 *
 * Transactions only keep debits (spending) — deposits, transfers between the
 * user's own accounts, payroll, and card payments already tracked via their
 * own CSV import are filtered out per format, since counting a checking-
 * account "payment to Capital One" alongside the Capital One card's own
 * charges would double the spend. A credit that matches a gig-income
 * platform is the one deposit type that's kept, routed to `income` instead.
 */
export function parseBankCsv(text: string): {
  transactions: CsvRow[];
  income: DetectedIncomeRow[];
} {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());

  const creditDebitIdx = headers.findIndex((h) => h === 'credit debit indicator');
  const typeGroupIdx = headers.findIndex((h) => h === 'type group');
  const isNavyFed = creditDebitIdx >= 0 && typeGroupIdx >= 0;
  const debitIdx = headers.findIndex((h) => h === 'debit');
  const creditIdx = headers.findIndex((h) => h === 'credit');
  const isCapitalOne = debitIdx >= 0 && creditIdx >= 0 && !isNavyFed;
  // Capital One Checking: Account Number, Transaction Description, Transaction Date, Transaction Type, Transaction Amount, Balance
  const acctNumIdx = headers.findIndex((h) => h === 'account number');
  const txTypeIdx = headers.findIndex((h) => h === 'transaction type');
  const txAmtIdx = headers.findIndex((h) => h === 'transaction amount');
  const isCapOneChecking = acctNumIdx >= 0 && txTypeIdx >= 0 && txAmtIdx >= 0;
  // USAA: has 'original description' and 'status' columns
  const origDescIdx = headers.findIndex((h) => h === 'original description');
  const statusIdx = headers.findIndex((h) => h === 'status');
  const isUsaa = origDescIdx >= 0 && statusIdx >= 0;
  // BofA bank: has 'running bal.' column
  const runningBalIdx = headers.findIndex((h) => h.includes('running bal'));
  const isBofaBank = runningBalIdx >= 0;
  // BofA credit: has 'reference number' and 'payee' columns
  const refNumIdx = headers.findIndex((h) => h === 'reference number');
  const payeeIdx = headers.findIndex((h) => h === 'payee');
  const isBofaCredit = refNumIdx >= 0 && payeeIdx >= 0;

  const dateIdx = headers.findIndex((h) => h.includes('transaction date') || h === 'date');
  const merchantIdx = headers.findIndex((h) => h === 'merchant');
  const descIdx = headers.findIndex((h) => h === 'description');
  const catIdx = headers.findIndex((h) => h === 'category');
  const typeIdx = headers.findIndex((h) => h === 'type');
  const amtIdx = headers.findIndex(
    (h) => h.includes('amount') && !h.includes('transaction amount'),
  );

  // Normalize MM/DD/YY → YYYY-MM-DD (Capital One Checking uses 2-digit year)
  function normalizeDate(d: string): string {
    const twoDigit = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (twoDigit)
      return `${2000 + parseInt(twoDigit[3])}-${twoDigit[1].padStart(2, '0')}-${twoDigit[2].padStart(2, '0')}`;
    return d;
  }

  // Payment services — transfers to these go to real people, not own accounts
  const PAYMENT_SERVICES = ['zelle', 'taptap', 'venmo', 'paypal', 'cash app', 'cashapp'];

  // Capital One Checking-shaped format: patterns that mean "this withdrawal is already
  // counted elsewhere" (a credit card payment, tracked via that card's own CSV import)
  // or "this is a transfer to another untracked account of the user's own" — not a
  // general catch-all, since that would also swallow real, singular bills (a mortgage
  // or loan auto-debit) that aren't duplicated in any other import.
  const OWN_TRANSFER_OR_CARD_PATTERNS = [
    'credit crd', // credit card autopay/epay (tracked via that card's own CSV)
    'crcardpmt', // credit card payment (tracked via that card's own CSV)
    'mobile pmt', // credit card mobile payment (tracked via that card's own CSV)
    'gsbank payment', // Apple Card payment — Goldman Sachs Bank (tracked via Apple Card's own CSV)
    'gs savings transfer', // transfer to/from an untracked Apple Savings account
    'performance savings', // transfer to an untracked savings account
    'checking account xxxxxx', // transfer to another untracked checking account
  ];

  const rows: CsvRow[] = [];
  const income: DetectedIncomeRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 2) continue;

    const description =
      vals[merchantIdx >= 0 ? merchantIdx : descIdx >= 0 ? descIdx : 2] || 'Unknown';
    const isTaptap = description.toLowerCase().includes('taptap');

    if (isUsaa) {
      // USAA: negative amounts = debits (expenses), positive = credits
      const rawAmt = (vals[amtIdx >= 0 ? amtIdx : vals.length - 2] || '0').replace(/[^0-9.-]/g, '');
      const rawNum = parseFloat(rawAmt);
      const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';
      if (rawNum >= 0) {
        // Credits/deposits are skipped, except a recognized gig-income payout.
        const gigSource = matchGigIncome(description);
        if (gigSource && rawNum > 0)
          income.push({ description, amount: rawNum, date, source: gigSource });
        continue;
      }
      const amount = Math.abs(rawNum);
      const category = isTaptap ? 'Family' : vals[catIdx >= 0 ? catIdx : 3] || DEFAULT_CATEGORY;
      if (amount > 0) rows.push({ description, amount, category, date });
      continue;
    }

    if (isBofaBank) {
      // BofA bank: Date, Description, Amount, Running Bal.
      // negative Amount = withdrawal (expense)
      const rawAmt = (vals[2] || '0').replace(/[^0-9.-]/g, '');
      const rawNum = parseFloat(rawAmt);
      const bofaDesc = vals[1] || 'Unknown';
      const date = vals[0] || '';
      if (rawNum >= 0) {
        // Deposits are skipped, except a recognized gig-income payout.
        const gigSource = matchGigIncome(bofaDesc);
        if (gigSource && rawNum > 0)
          income.push({ description: bofaDesc, amount: rawNum, date, source: gigSource });
        continue;
      }
      const amount = Math.abs(rawNum);
      if (amount > 0)
        rows.push({
          description: bofaDesc,
          amount,
          category: DEFAULT_CATEGORY,
          date,
        });
      continue;
    }

    if (isBofaCredit) {
      // BofA credit: Transaction Date, Posted Date, Reference Number, Payee, Address, Amount
      // negative Amount = charge (expense)
      const rawAmt = (vals[amtIdx >= 0 ? amtIdx : vals.length - 1] || '0').replace(/[^0-9.-]/g, '');
      const rawNum = parseFloat(rawAmt);
      const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';
      const desc = vals[payeeIdx] || 'Unknown';
      if (rawNum >= 0) {
        // Payments/credits are skipped, except a recognized gig-income payout.
        const gigSource = matchGigIncome(desc);
        if (gigSource && rawNum > 0)
          income.push({ description: desc, amount: rawNum, date, source: gigSource });
        continue;
      }
      const amount = Math.abs(rawNum);
      if (amount > 0) rows.push({ description: desc, amount, category: DEFAULT_CATEGORY, date });
      continue;
    }

    if (isCapOneChecking) {
      const txType = (vals[txTypeIdx] || '').trim().toLowerCase();
      const desc = vals[1] || 'Unknown';
      const descLower = desc.toLowerCase();
      if (txType !== 'debit') {
        // Credits (deposits, transfers in) are skipped, except a recognized
        // gig-income payout.
        const gigSource = matchGigIncome(desc);
        if (gigSource) {
          const gigAmount = Math.abs(parseFloat((vals[txAmtIdx] || '0').replace(/[^0-9.-]/g, '')));
          if (gigAmount > 0) {
            const gigDate = normalizeDate(vals[dateIdx >= 0 ? dateIdx : 2] || '');
            income.push({ description: desc, amount: gigAmount, date: gigDate, source: gigSource });
          }
        }
        continue;
      }
      // Skip internal savings/account transfers
      if (
        descLower.includes('autopilot transfer') ||
        descLower.includes('paycheck percentage transfer')
      )
        continue;
      // Skip only known duplicate-tracked (credit card payments, already counted via that
      // card's own CSV import) or true internal-transfer destinations (another untracked
      // account of the user's own). A blanket "withdrawal from/to X" skip is too broad — it
      // silently drops real, singular bills like a mortgage or loan auto-debit that aren't
      // tracked anywhere else, so only skip specific known patterns here.
      if (OWN_TRANSFER_OR_CARD_PATTERNS.some((p) => descLower.includes(p))) continue;
      const amount = Math.abs(parseFloat((vals[txAmtIdx] || '0').replace(/[^0-9.-]/g, '')));
      if (!amount) continue;
      const date = normalizeDate(vals[dateIdx >= 0 ? dateIdx : 2] || '');
      rows.push({ description: desc, amount, category: DEFAULT_CATEGORY, date });
      continue;
    }

    if (isCapitalOne) {
      // Skip credits/payments — only keep rows with a debit value
      const debitVal = vals[debitIdx]?.trim();
      if (!debitVal) continue;
      const capCat = (vals[catIdx] || '').toLowerCase();
      if (capCat === 'payment/credit') continue;
      const amount = Math.abs(parseFloat(debitVal.replace(/[^0-9.-]/g, '')));
      const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';
      const category = isTaptap ? 'Family' : vals[catIdx] || DEFAULT_CATEGORY;
      if (amount > 0) rows.push({ description, amount, category, date });
      continue;
    }

    if (isNavyFed) {
      const indicator = (vals[creditDebitIdx] || '').toLowerCase();
      if (indicator === 'credit') {
        // Credits (income, deposits, transfers in) are skipped, except a
        // recognized gig-income payout.
        const gigSource = matchGigIncome(description);
        if (gigSource) {
          const gigAmount = Math.abs(
            parseFloat((vals[amtIdx >= 0 ? amtIdx : 2] || '0').replace(/[^0-9.-]/g, '')),
          );
          if (gigAmount > 0) {
            const gigDate = vals[dateIdx >= 0 ? dateIdx : 1] || '';
            income.push({ description, amount: gigAmount, date: gigDate, source: gigSource });
          }
        }
        continue;
      }
      // Skip payroll (tracked in income config) and investment income (dividends)
      const typeGroup = (vals[typeGroupIdx] || '').toLowerCase();
      if (typeGroup === 'paychecks/salary' || typeGroup === 'investment income') continue;
      // Skip credit card payments — spending already tracked via card CSV imports
      const nfCategory = (vals[catIdx >= 0 ? catIdx : 11] || '').toLowerCase();
      if (nfCategory === 'credit card payments') continue;
      // Skip own-account transfers ("Transfer to Apple", "Transfer to Capital One", etc.)
      // but keep transfers to payment services (Zelle, Taptap) — those go to real people
      const descLower = description.toLowerCase();
      if (
        descLower.startsWith('transfer to ') &&
        !PAYMENT_SERVICES.some((svc) => descLower.includes(svc))
      )
        continue;
      const amount = Math.abs(
        parseFloat((vals[amtIdx >= 0 ? amtIdx : 2] || '0').replace(/[^0-9.-]/g, '')),
      );
      if (!amount) continue;
      const date = vals[dateIdx >= 0 ? dateIdx : 1] || '';
      let category: string;
      if (isTaptap) {
        category = 'Family';
      } else if (typeGroup === 'securities trades') {
        category = INVESTMENT_CATEGORY;
      } else {
        category = DEFAULT_CATEGORY;
      }
      rows.push({ description, amount, category, date });
      continue;
    } else {
      const type = (vals[typeIdx] || '').toLowerCase();
      if (['payment', 'return', 'reversal', 'adjustment'].includes(type)) continue;
    }

    const rawAmount = parseFloat(
      (vals[amtIdx >= 0 ? amtIdx : vals.length - 1] || '0').replace(/[^0-9.-]/g, ''),
    );
    const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';

    // A positive amount matching a gig-income platform is a payout, not spending.
    if (rawAmount > 0) {
      const gigSource = matchGigIncome(description);
      if (gigSource) {
        income.push({ description, amount: rawAmount, date, source: gigSource });
        continue;
      }
    }

    const amount = Math.abs(rawAmount);
    let category: string;
    if (isTaptap) {
      category = 'Family';
    } else {
      category = vals[catIdx >= 0 ? catIdx : 4] || DEFAULT_CATEGORY;
    }

    if (amount > 0) rows.push({ description, amount, category, date });
  }

  return { transactions: rows, income };
}
