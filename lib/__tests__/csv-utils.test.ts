import { describe, expect, it } from 'vitest';

import { CATEGORIES, CSV_CATEGORY_MAP, DEFAULT_CATEGORY, INVESTMENT_CATEGORY } from '../config';
import { mapCategory, parseBankCsv, parseDate } from '../csv-utils';

// ── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  describe('MM/DD/YYYY format (Apple Card, Capital One, Chase)', () => {
    it('parses a standard date', () => {
      expect(parseDate('01/15/2026')).toEqual({
        month: '2026-01',
        date: '2026-01-15',
      });
    });

    it('zero-pads single-digit month and day', () => {
      expect(parseDate('3/5/2026')).toEqual({
        month: '2026-03',
        date: '2026-03-05',
      });
    });

    it('handles December', () => {
      expect(parseDate('12/31/2025')).toEqual({
        month: '2025-12',
        date: '2025-12-31',
      });
    });

    it('handles January', () => {
      expect(parseDate('01/01/2026')).toEqual({
        month: '2026-01',
        date: '2026-01-01',
      });
    });

    it('extracts month correctly across all months', () => {
      for (let m = 1; m <= 12; m++) {
        const padded = String(m).padStart(2, '0');
        const result = parseDate(`${padded}/15/2026`);
        expect(result?.month).toBe(`2026-${padded}`);
      }
    });
  });

  describe('YYYY-MM-DD format (ISO)', () => {
    it('parses ISO format', () => {
      expect(parseDate('2026-03-15')).toEqual({
        month: '2026-03',
        date: '2026-03-15',
      });
    });

    it('handles ISO with trailing content', () => {
      // The regex uses a non-anchored match, accepts extra chars after the date
      const result = parseDate('2026-03-15T00:00:00');
      expect(result?.month).toBe('2026-03');
      expect(result?.date).toBe('2026-03-15');
    });
  });

  describe('invalid / empty input', () => {
    it('returns null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });

    it('returns null for unrecognised format', () => {
      expect(parseDate('March 15 2026')).toBeNull();
      expect(parseDate('15-03-2026')).toBeNull();
      expect(parseDate('2026/03/15')).toBeNull();
    });

    it('returns null for partial dates', () => {
      expect(parseDate('01/2026')).toBeNull();
      expect(parseDate('2026-03')).toBeNull();
    });
  });
});

// ── mapCategory ──────────────────────────────────────────────────────────────

describe('mapCategory', () => {
  describe('Food mappings', () => {
    it('maps "food and drink" → Food', () => {
      expect(mapCategory('Food and Drink')).toBe('Food');
    });

    it('maps "food & drink" → Food', () => {
      expect(mapCategory('Food & Drink')).toBe('Food');
    });

    it('maps "restaurants" → Food', () => {
      expect(mapCategory('Restaurants')).toBe('Food');
    });

    it('maps "groceries" → Food', () => {
      expect(mapCategory('Groceries')).toBe('Food');
    });

    it('maps "grocery" → Food', () => {
      expect(mapCategory('Grocery')).toBe('Food');
    });
  });

  describe('Transport mappings', () => {
    it('maps "transportation" → Transport', () => {
      expect(mapCategory('Transportation')).toBe('Transport');
    });

    it('maps "gas" → Transport', () => {
      expect(mapCategory('Gas')).toBe('Transport');
    });

    it('maps "tolls" → Transport', () => {
      expect(mapCategory('Tolls')).toBe('Transport');
    });

    it('maps "automotive" → Transport', () => {
      expect(mapCategory('Automotive')).toBe('Transport');
    });

    it('maps "travel" → Transport', () => {
      expect(mapCategory('Travel')).toBe('Transport');
    });
  });

  describe('Shopping mappings', () => {
    it('maps "shopping" → Shopping', () => {
      expect(mapCategory('Shopping')).toBe('Shopping');
    });

    it('maps "home" → Shopping', () => {
      expect(mapCategory('Home')).toBe('Shopping');
    });
  });

  describe('Entertainment mappings', () => {
    it('maps "entertainment" → Entertainment', () => {
      expect(mapCategory('Entertainment')).toBe('Entertainment');
    });
  });

  describe('Personal care mappings', () => {
    it('maps "health" → Personal care', () => {
      expect(mapCategory('Health')).toBe('Personal care');
    });

    it('maps "health & wellness" → Personal care', () => {
      expect(mapCategory('Health & Wellness')).toBe('Personal care');
    });
  });

  describe('Subscriptions mappings', () => {
    it('maps "subscriptions" → Subscriptions', () => {
      expect(mapCategory('Subscriptions')).toBe('Subscriptions');
    });
  });

  describe('Utilities mappings', () => {
    it('maps "utilities" → Utilities', () => {
      expect(mapCategory('Utilities')).toBe('Utilities');
    });

    it('maps "bills & utilities" → Utilities', () => {
      expect(mapCategory('Bills & Utilities')).toBe('Utilities');
    });
  });

  describe('Family mappings', () => {
    it('maps "family" → Family', () => {
      expect(mapCategory('Family')).toBe('Family');
    });
  });

  describe('Other / fallback mappings', () => {
    it('maps "services" → Other', () => {
      expect(mapCategory('Services')).toBe('Other');
    });

    it('maps "fees & adjustments" → Other', () => {
      expect(mapCategory('Fees & Adjustments')).toBe('Other');
    });

    it('returns DEFAULT_CATEGORY for completely unknown input', () => {
      expect(mapCategory('Totally Unknown Category')).toBe(DEFAULT_CATEGORY);
      expect(mapCategory('')).toBe(DEFAULT_CATEGORY);
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of case', () => {
      expect(mapCategory('GROCERIES')).toBe('Food');
      expect(mapCategory('groceries')).toBe('Food');
      expect(mapCategory('Groceries')).toBe('Food');
    });
  });

  describe('substring matching', () => {
    it('matches when the key appears anywhere in the string', () => {
      // "groceries" inside a longer category label
      expect(mapCategory('supermarket groceries')).toBe('Food');
      expect(mapCategory('auto gas station')).toBe('Transport');
    });
  });

  describe('all CSV_CATEGORY_MAP values are valid app categories', () => {
    it('every mapped value is a member of CATEGORIES', () => {
      const validCategories = new Set<string>(CATEGORIES);
      for (const [key, value] of Object.entries(CSV_CATEGORY_MAP)) {
        expect(
          validCategories.has(value),
          `CSV_CATEGORY_MAP["${key}"] = "${value}" is not a valid category`,
        ).toBe(true);
      }
    });
  });
});

// ── parseBankCsv ─────────────────────────────────────────────────────────────

describe('parseBankCsv', () => {
  describe('empty / header-only input', () => {
    it('returns [] for a header-only file', () => {
      expect(parseBankCsv('Date,Description,Amount,Category,Type,Memo').transactions).toEqual([]);
    });
  });

  describe('generic fallback format (Chase, Apple Card)', () => {
    it('parses a Chase-shaped export and skips payment rows', () => {
      const csv = [
        'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
        '08/21/2026,08/23/2026,Amazon.com*5A5RZ6R31,Shopping,Sale,-14.27,',
        '08/21/2026,08/21/2026,Payment Thank You-Mobile,,Payment,1800.00,',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toEqual([
        {
          description: 'Amazon.com*5A5RZ6R31',
          amount: 14.27,
          category: 'Shopping',
          date: '08/21/2026',
        },
      ]);
    });

    it('parses an Apple Card export using the Merchant column for description', () => {
      const csv = [
        'Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD),Purchased By',
        '09/01/2026,09/02/2026,"APPLE.COM/BILL","Apple Services","Other","Purchase","20.00","Assane Diallo"',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toEqual([
        { description: 'Apple Services', amount: 20, category: 'Other', date: '09/01/2026' },
      ]);
    });

    it('routes a Taptap Send description to the Family category', () => {
      const csv = [
        'Date,Description,Amount,Category,Type,Memo',
        '08/01/2026,TAPTAP SEND NEW YORK NY,-91.91,Transfers,Sale,',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows[0].category).toBe('Family');
    });
  });

  describe('Capital One card format (Debit/Credit columns)', () => {
    it('keeps debit rows and skips Payment/Credit rows', () => {
      const csv = [
        'Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit',
        '2026-08-07,2026-08-07,3067,CAPITAL ONE MOBILE PYMT,Payment/Credit,,391.80',
        '2026-07-30,2026-07-31,3067,WAL-MART #3391,Merchandise,52.96,',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toEqual([
        {
          description: 'WAL-MART #3391',
          amount: 52.96,
          category: 'Merchandise',
          date: '2026-07-30',
        },
      ]);
    });
  });

  describe('Capital One Checking-shaped format (Account Number + Transaction Type + Transaction Amount)', () => {
    it('keeps only Debit rows', () => {
      const csv = [
        'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
        '9097,Deposit from ZG - Your Rental Rent-#3 11,09/03/26,Credit,750,1915.96',
        '9097,Digital Card Purchase - TAPTAP SEND NEW YORK NY,06/05/26,Debit,91.91,352.58',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        description: 'Digital Card Purchase - TAPTAP SEND NEW YORK NY',
        amount: 91.91,
        category: DEFAULT_CATEGORY,
        date: '2026-06-05',
      });
    });

    it('skips internal Autopilot / paycheck-percentage transfers', () => {
      const csv = [
        'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
        '9097,Autopilot Transfer,09/01/26,Debit,17,1000',
        '9097,Paycheck Percentage Transfer,09/03/26,Debit,17,1898.96',
      ].join('\n');
      expect(parseBankCsv(csv).transactions).toEqual([]);
    });

    it('skips withdrawals to own accounts but keeps withdrawals to payment services', () => {
      const csv = [
        'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
        '9097,Withdrawal from CHASE CREDIT CRD EPAY,09/02/26,Debit,949.24,956.76',
        '9097,Digital Card Purchase - TAPTAP SEND NEW YORK NY,06/05/26,Debit,91.91,352.58',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toContain('TAPTAP');
    });

    it('skips known duplicate-tracked card payments and true internal transfers', () => {
      const csv = [
        'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
        '9097,Withdrawal from CHASE CREDIT CRD AUTOPAY,01/20/26,Debit,272.94,2473.63',
        '9097,Withdrawal from CAPITAL ONE CRCARDPMT,01/07/26,Debit,152,417.42',
        '9097,Withdrawal from CAPITAL ONE MOBILE PMT,06/15/26,Debit,83.05,94.51',
        '9097,Withdrawal from APPLECARD GSBANK PAYMENT,01/02/26,Debit,96.08,531.1',
        '9097,Withdrawal from APPLE GS SAVINGS TRANSFER,02/12/26,Debit,1200.95,81.68',
        '9097,Withdrawal to 360 Performance Savings XXXXXXX0294,01/28/26,Debit,1000,173.49',
        '9097,Preauthorized Withdrawal to NAVY FEDERAL CREDIT UNION checking account XXXXXX6188,04/02/26,Debit,73.53,0',
      ].join('\n');
      expect(parseBankCsv(csv).transactions).toEqual([]);
    });

    it('does NOT drop a real singular bill just because it says "withdrawal from/to" — e.g. a mortgage or loan auto-debit', () => {
      // Regression test: the filter used to skip ANY "withdrawal from/to X" description,
      // which silently dropped a real mortgage payment that isn't duplicated in any other
      // CSV import (unlike a credit card payment, which the card's own CSV already counts).
      const csv = [
        'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
        '9097,Withdrawal from NFCU MORT DEBIT,09/01/26,Debit,2333.23,1306',
        '9097,Withdrawal from WF PAYMENT,01/05/26,Debit,252.55,272.43',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.amount)).toEqual([2333.23, 252.55]);
    });
  });

  describe('NFCU / primary checking format (Credit Debit Indicator + Type Group)', () => {
    const header =
      'Posting Date,Transaction Date,Amount,Credit Debit Indicator,type,Type Group,Reference,Instructed Currency,Currency Exchange Rate,Instructed Amount,Description,Category,Check Serial Number,Card Ending,Rewards Total,Rewards Type';

    it('skips credits (deposits, payroll, investment income)', () => {
      const csv = [
        header,
        '08/28/2026,08/28/2026,1923.16,Credit,ACH Credit,ACH Credit,,,,,Salary/Regular Income from DFAS,Paychecks/Salary,10203650,,,',
        '08/31/2026,08/31/2026,0.15,Credit,Credit,Credit,,,,,Dividend,Investment Income,,,,',
      ].join('\n');
      expect(parseBankCsv(csv).transactions).toEqual([]);
    });

    it('categorizes a Securities Trades debit as Investment', () => {
      const csv = [
        header,
        '08/31/2026,08/31/2026,250.00,Debit,ACH Debit,Securities Trades,,,,,Fidelity Investments,Securities Trades,7100015,,,',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows[0]).toMatchObject({
        description: 'Fidelity Investments',
        amount: 250,
        category: INVESTMENT_CATEGORY,
      });
    });

    it('skips credit card payments and own-account transfers, keeps transfers to payment services', () => {
      const csv = [
        header,
        '08/24/2026,08/24/2026,1800.00,Debit,ACH Debit,ACH Debit,,,,,Payment to Chase,Credit Card Payments,2100002,,,',
        '09/01/2026,09/01/2026,91.14,Debit,POS,POS,,,,,Transfer to Taptap Send,Transfers,,,,',
        '08/03/2026,08/03/2026,31.22,Debit,ACH Debit,ACH Debit,,,,,Transfer to Apple,Transfers,,,,',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ description: 'Transfer to Taptap Send', category: 'Family' });
    });
  });

  describe('USAA format (Original Description + Status columns)', () => {
    it('keeps only negative (debit) amounts', () => {
      const csv = [
        'Date,Original Description,Description,Category,Amount,Status',
        '08/01/2026,WAL-MART,WAL-MART,Groceries,-52.96,Posted',
        '08/02/2026,DEPOSIT,DEPOSIT,Income,1200.00,Posted',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ amount: 52.96, category: 'Groceries' });
    });
  });

  describe('BofA bank format (Running Bal. column)', () => {
    it('keeps only negative (withdrawal) amounts, uses DEFAULT_CATEGORY', () => {
      const csv = [
        'Date,Description,Amount,Running Bal.',
        '08/01/2026,GROCERY STORE,-40.00,960.00',
        '08/02/2026,PAYROLL,1000.00,1960.00',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toEqual([
        {
          description: 'GROCERY STORE',
          amount: 40,
          category: DEFAULT_CATEGORY,
          date: '08/01/2026',
        },
      ]);
    });
  });

  describe('BofA credit format (Reference Number + Payee columns)', () => {
    it('keeps only negative (charge) amounts and uses the Payee column', () => {
      const csv = [
        'Transaction Date,Posted Date,Reference Number,Payee,Address,Amount',
        '08/01/2026,08/02/2026,REF123,GROCERY STORE,123 Main St,-40.00',
        '08/03/2026,08/03/2026,REF124,Payment Received,,200.00',
      ].join('\n');
      const { transactions: rows } = parseBankCsv(csv);
      expect(rows).toEqual([
        {
          description: 'GROCERY STORE',
          amount: 40,
          category: DEFAULT_CATEGORY,
          date: '08/01/2026',
        },
      ]);
    });
  });

  describe('gig-income detection (DoorDash, Uber, Walmart Spark)', () => {
    it('routes a recognized gig deposit to income instead of dropping it (Capital One Checking shape)', () => {
      const csv = [
        'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
        '9097,Deposit from DoorDash,08/12/26,Credit,62.40,1000',
        '9097,Deposit from Uber USA 6787 EDI PAYMNT,08/13/26,Credit,38.15,1038.15',
        '9097,Deposit from ZG - Your Rental Rent-#3 11,08/10/26,Credit,750,1788.15',
      ].join('\n');
      const { transactions, income } = parseBankCsv(csv);
      expect(transactions).toEqual([]); // no debits in this sample, and the rent deposit isn't a gig platform
      expect(income).toEqual([
        {
          description: 'Deposit from DoorDash',
          amount: 62.4,
          date: '2026-08-12',
          source: 'DoorDash',
        },
        {
          description: 'Deposit from Uber USA 6787 EDI PAYMNT',
          amount: 38.15,
          date: '2026-08-13',
          source: 'Uber',
        },
      ]);
    });

    it('routes a Walmart Spark deposit to income (NFCU/primary checking shape)', () => {
      const csv = [
        'Posting Date,Transaction Date,Amount,Credit Debit Indicator,type,Type Group,Reference,Instructed Currency,Currency Exchange Rate,Instructed Amount,Description,Category,Check Serial Number,Card Ending,Rewards Total,Rewards Type',
        '08/14/2026,08/14/2026,21.00,Credit,ACH Credit,ACH Credit,,,,,Deposit from Spark Driver Walmart,Other Income,,,,',
      ].join('\n');
      const { transactions, income } = parseBankCsv(csv);
      expect(transactions).toEqual([]);
      expect(income).toEqual([
        {
          description: 'Deposit from Spark Driver Walmart',
          amount: 21,
          date: '08/14/2026',
          source: 'Walmart Spark',
        },
      ]);
    });

    it('does not route an ordinary deposit to income just because it is a credit', () => {
      const csv = [
        'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
        '9097,Deposit from IRS TREAS 310 TAX REF,08/12/26,Credit,300,1000',
      ].join('\n');
      const { transactions, income } = parseBankCsv(csv);
      expect(transactions).toEqual([]);
      expect(income).toEqual([]);
    });

    it('still skips a normal debit even when the description happens to match a gig keyword', () => {
      // e.g. paying for an Uber ride is spending, not income — only a *credit* counts
      const csv = [
        'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
        '9097,UBER TRIP HELP.UBER.COM,08/12/26,Debit,18.50,981.50',
      ].join('\n');
      const { transactions, income } = parseBankCsv(csv);
      expect(income).toEqual([]);
      expect(transactions).toEqual([
        {
          description: 'UBER TRIP HELP.UBER.COM',
          amount: 18.5,
          category: DEFAULT_CATEGORY,
          date: '2026-08-12',
        },
      ]);
    });
  });
});
