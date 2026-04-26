import { describe, expect, it } from 'vitest';

import { parseLes } from '../les-parser';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal LES text snippet with just the supplied lines. */
function les(lines: string[]): string {
  return lines.join('\n');
}

/**
 * Representative LES text (anonymised).
 * Each field is on its own line — the parser is line-oriented and takes the
 * last dollar amount per line, so combining two fields on one line would give
 * the wrong value for the first field. Real myPay single-column exports and
 * copy-pasted PDFs both produce one-field-per-line output.
 */
const SAMPLE_LES = `
LEAVE AND EARNINGS STATEMENT
NAME: DOE JOHN A               SSN: XXX-XX-1234
PAY DATE: 03/31/2026
BRANCH: AIR FORCE

ENTITLEMENTS
BASE PAY            3,198.00
BAS RATE              470.88
BAH TYPE            1,839.00

DEDUCTIONS
FEDERAL TAXES        158.72
FICA-SOC SECURITY    198.28
FICA-MEDICARE         46.34
SGLI                  26.00
AFRH                   0.50
TSP                   159.90
`.trim();

// ── Period-end date (lesPeriodDate) ──────────────────────────────────────────

describe('parseLes — lesPeriodDate', () => {
  it('returns full YYYY-MM-DD from PAY DATE MM/DD/YYYY', () => {
    const { lesPeriodDate } = parseLes(les(['PAY DATE: 03/31/2026', 'BASE PAY 3,198.00']));
    expect(lesPeriodDate).toBe('2026-03-31');
  });

  it('returns full YYYY-MM-DD for ISO pay date', () => {
    const { lesPeriodDate } = parseLes(les(['PAY DATE: 2026-03-31', 'BASE PAY 3,198.00']));
    expect(lesPeriodDate).toBe('2026-03-31');
  });

  it('month and lesPeriodDate share the same year-month', () => {
    const { month, lesPeriodDate } = parseLes(les(['PAY DATE: 03/31/2026', 'BASE PAY 3,198.00']));
    expect(lesPeriodDate?.slice(0, 7)).toBe(month);
  });

  it('is null when no date found', () => {
    const { lesPeriodDate } = parseLes(les(['BASE PAY 3,198.00']));
    expect(lesPeriodDate).toBeNull();
  });
});

// ── Leave balance ─────────────────────────────────────────────────────────────

describe('parseLes — leaveBalance', () => {
  it('extracts EOM BAL from a single-line format', () => {
    const { leaveBalance } = parseLes(les(['PAY DATE: 03/31/2026', 'EOM BAL 35.0']));
    expect(leaveBalance).toBe(35.0);
  });

  it('extracts LEAVE BALANCE from a labelled single line', () => {
    const { leaveBalance } = parseLes(les(['PAY DATE: 03/31/2026', 'LEAVE BALANCE 42.5']));
    expect(leaveBalance).toBe(42.5);
  });

  it('extracts LEAVE BAL abbreviation', () => {
    const { leaveBalance } = parseLes(les(['PAY DATE: 03/31/2026', 'LEAVE BAL 28.0']));
    expect(leaveBalance).toBe(28.0);
  });

  it('extracts EOM BAL from a two-line table header + data row', () => {
    const text = les([
      'PAY DATE: 03/31/2026',
      'BF BAL  ERND  USED  CR LDFTED  EOM BAL  USE/LOSE',
      '32.5    2.5   0.0   0.0        35.0     19OCT26',
    ]);
    const { leaveBalance } = parseLes(text);
    expect(leaveBalance).toBe(35.0);
  });

  it('strips spaced USE/LOSE date ("19 OCT 26") before picking last number', () => {
    const text = les([
      'BF BAL  ERND  USED  EOM BAL  USE/LOSE',
      '32.5    2.5   0.0   35.0     19 OCT 26',
    ]);
    const { leaveBalance } = parseLes(text);
    expect(leaveBalance).toBe(35.0);
  });

  it('returns null when no leave data is present', () => {
    const { leaveBalance } = parseLes(les(['PAY DATE: 03/31/2026', 'BASE PAY 3,198.00']));
    expect(leaveBalance).toBeNull();
  });

  it('handles integer leave balance (no decimal)', () => {
    const { leaveBalance } = parseLes(les(['PAY DATE: 03/31/2026', 'EOM BAL 42']));
    expect(leaveBalance).toBe(42);
  });

  it('does not confuse dollar amounts with leave balance', () => {
    // Dollar amounts have two decimal places — leave balance has 0–1
    const text = les([
      'PAY DATE: 03/31/2026',
      'BASE PAY 3,198.00',
      'FEDERAL TAXES 158.72',
      'EOM BAL 35.0',
    ]);
    const { leaveBalance } = parseLes(text);
    expect(leaveBalance).toBe(35.0);
  });
});

// ── Month extraction ─────────────────────────────────────────────────────────

describe('parseLes — month extraction', () => {
  it('extracts month from PAY DATE MM/DD/YYYY', () => {
    const { month } = parseLes(les(['PAY DATE: 03/31/2026', 'BASE PAY 3,198.00']));
    expect(month).toBe('2026-03');
  });

  it('extracts month from PAY DATE with spaces', () => {
    const { month } = parseLes(les(['PAY DATE   01/15/2026', 'BASE PAY 2,836.80']));
    expect(month).toBe('2026-01');
  });

  it('extracts month from PERIOD COVERED range', () => {
    const { month } = parseLes(
      les(['PERIOD COVERED: 03/01/2026 - 03/31/2026', 'BASE PAY 3,198.00']),
    );
    expect(month).toBe('2026-03');
  });

  it('extracts month from ISO pay date (YYYY-MM-DD)', () => {
    const { month } = parseLes(les(['PAY DATE: 2026-03-31', 'BASE PAY 3,198.00']));
    expect(month).toBe('2026-03');
  });

  it('falls back to last MM/DD/YYYY date in text', () => {
    const { month } = parseLes(
      les(['SOME EARLIER DATE 01/01/2026', 'BASE PAY 3,198.00', 'ANOTHER DATE 03/31/2026']),
    );
    expect(month).toBe('2026-03');
  });

  it('returns null and adds warning when no date found', () => {
    const { month, warnings } = parseLes(les(['BASE PAY 3,198.00']));
    expect(month).toBeNull();
    expect(warnings.some((w) => /date/i.test(w))).toBe(true);
  });

  it('handles 2-digit year (20xx)', () => {
    const { month } = parseLes(les(['PAY DATE: 03/31/26', 'BASE PAY 3,198.00']));
    expect(month).toBe('2026-03');
  });

  it('handles December (month 12)', () => {
    const { month } = parseLes(les(['PAY DATE: 12/31/2026', 'BASE PAY 3,198.00']));
    expect(month).toBe('2026-12');
  });

  it('handles January (month 01)', () => {
    const { month } = parseLes(les(['PAY DATE: 01/31/2026', 'BASE PAY 3,198.00']));
    expect(month).toBe('2026-01');
  });
});

// ── Field extraction ─────────────────────────────────────────────────────────

describe('parseLes — field extraction', () => {
  describe('base pay', () => {
    it('extracts BASE PAY', () => {
      const { fields } = parseLes(les(['BASE PAY 3,198.00']));
      expect(fields.base_pay).toBe(3198.0);
    });

    it('extracts base pay with dollar sign', () => {
      const { fields } = parseLes(les(['BASE PAY $3,198.00']));
      expect(fields.base_pay).toBe(3198.0);
    });

    it('extracts base pay regardless of surrounding text', () => {
      const { fields } = parseLes(les(['BASIC PAY IS BASE PAY 2,836.80 YTD']));
      // takes last amount on line
      expect(fields.base_pay).toBe(2836.8);
    });
  });

  describe('BAS', () => {
    it('extracts BAS RATE', () => {
      const { fields } = parseLes(les(['BAS RATE 470.88']));
      expect(fields.bas).toBe(470.88);
    });

    it('extracts SUBSISTENCE ALLOW', () => {
      const { fields } = parseLes(les(['SUBSISTENCE ALLOWANCE 470.88']));
      expect(fields.bas).toBe(470.88);
    });

    it('extracts plain BAS', () => {
      const { fields } = parseLes(les(['BAS 470.88']));
      expect(fields.bas).toBe(470.88);
    });

    it('extracts BASIC ALLOW SUB variant', () => {
      const { fields } = parseLes(les(['BASIC ALLOWANCE SUBSISTENCE 470.88']));
      expect(fields.bas).toBe(470.88);
    });
  });

  describe('BAH', () => {
    it('extracts BAH w/dep', () => {
      const { fields } = parseLes(les(['BAH W/DEP 1,839.00']));
      expect(fields.bah).toBe(1839.0);
    });

    it('extracts BAH w/o dep', () => {
      const { fields } = parseLes(les(['BAH W/O DEP 1,479.00']));
      expect(fields.bah).toBe(1479.0);
    });

    it('extracts BAH TYPE', () => {
      const { fields } = parseLes(les(['BAH TYPE II 1,479.00']));
      expect(fields.bah).toBe(1479.0);
    });

    it('extracts plain BAH', () => {
      const { fields } = parseLes(les(['BAH 1,839.00']));
      expect(fields.bah).toBe(1839.0);
    });

    it('extracts OHA (overseas housing)', () => {
      const { fields } = parseLes(les(['OHA 2,100.00']));
      expect(fields.bah).toBe(2100.0);
    });

    it('extracts BASIC ALLOW HOUSING', () => {
      const { fields } = parseLes(les(['BASIC ALLOWANCE HOUSING 1,800.00']));
      expect(fields.bah).toBe(1800.0);
    });
  });

  describe('taxes and FICA', () => {
    it('extracts FEDERAL TAXES', () => {
      const { fields } = parseLes(les(['FEDERAL TAXES 158.72']));
      expect(fields.taxes).toBe(158.72);
    });

    it('extracts FED WITHHOLDING', () => {
      const { fields } = parseLes(les(['FED WITHHOLDING 200.00']));
      expect(fields.taxes).toBe(200.0);
    });

    it('extracts FEDERAL TAX', () => {
      const { fields } = parseLes(les(['FEDERAL TAX 300.00']));
      expect(fields.taxes).toBe(300.0);
    });

    it('extracts FICA-SOC SECURITY', () => {
      const { fields } = parseLes(les(['FICA-SOC SECURITY 198.28']));
      expect(fields.fica_soc_security).toBe(198.28);
    });

    it('extracts SOC SECURITY (no FICA prefix)', () => {
      const { fields } = parseLes(les(['SOC SECURITY 198.28']));
      expect(fields.fica_soc_security).toBe(198.28);
    });

    it('extracts FICA-MEDICARE', () => {
      const { fields } = parseLes(les(['FICA-MEDICARE 46.34']));
      expect(fields.fica_medicare).toBe(46.34);
    });

    it('extracts MEDICARE (no FICA prefix)', () => {
      const { fields } = parseLes(les(['MEDICARE 46.34']));
      expect(fields.fica_medicare).toBe(46.34);
    });
  });

  describe('other deductions', () => {
    it('extracts SGLI', () => {
      const { fields } = parseLes(les(['SGLI 26.00']));
      expect(fields.sgli).toBe(26.0);
    });

    it('extracts AFRH', () => {
      const { fields } = parseLes(les(['AFRH 0.50']));
      expect(fields.afrh).toBe(0.5);
    });

    it('extracts MEAL DEDUCT', () => {
      const { fields } = parseLes(les(['MEAL DEDUCTION 382.20']));
      expect(fields.meal_deduction).toBe(382.2);
    });

    it('extracts MEAL DED abbreviation', () => {
      const { fields } = parseLes(les(['MEAL DED 100.00']));
      expect(fields.meal_deduction).toBe(100.0);
    });

    it('extracts SUBSISTENCE DEDUCTION', () => {
      const { fields } = parseLes(les(['SUBSISTENCE DEDUCTION 382.20']));
      expect(fields.meal_deduction).toBe(382.2);
    });
  });
});

// ── Special & incentive pays ─────────────────────────────────────────────────

describe('parseLes — special and incentive pays', () => {
  describe('flight pay', () => {
    it('extracts AVIATION CAREER INCENTIVE PAY (ACIP)', () => {
      const { fields } = parseLes(les(['AVIATION CAREER INCENTIVE PAY 250.00']));
      expect(fields.flight_pay).toBe(250.0);
    });

    it('extracts ACIP abbreviation', () => {
      const { fields } = parseLes(les(['ACIP 250.00']));
      expect(fields.flight_pay).toBe(250.0);
    });

    it('extracts FLIGHT PAY', () => {
      const { fields } = parseLes(les(['FLIGHT PAY 150.00']));
      expect(fields.flight_pay).toBe(150.0);
    });
  });

  describe('hazardous duty pay', () => {
    it('extracts HAZARDOUS DUTY', () => {
      const { fields } = parseLes(les(['HAZARDOUS DUTY PAY 150.00']));
      expect(fields.hazardous_duty_pay).toBe(150.0);
    });

    it('extracts HDZP abbreviation', () => {
      const { fields } = parseLes(les(['HDZP 150.00']));
      expect(fields.hazardous_duty_pay).toBe(150.0);
    });
  });

  describe('jump pay', () => {
    it('extracts JUMP PAY', () => {
      const { fields } = parseLes(les(['JUMP PAY 150.00']));
      expect(fields.jump_pay).toBe(150.0);
    });

    it('extracts PARACHUTE DUTY', () => {
      const { fields } = parseLes(les(['PARACHUTE DUTY 150.00']));
      expect(fields.jump_pay).toBe(150.0);
    });
  });

  describe('hostile fire / IDP', () => {
    it('extracts HOSTILE FIRE', () => {
      const { fields } = parseLes(les(['HOSTILE FIRE/IDP 225.00']));
      expect(fields.hostile_fire_idp).toBe(225.0);
    });

    it('extracts IMMINENT DANGER', () => {
      const { fields } = parseLes(les(['IMMINENT DANGER PAY 225.00']));
      expect(fields.hostile_fire_idp).toBe(225.0);
    });

    it('extracts plain IDP', () => {
      const { fields } = parseLes(les(['IDP 225.00']));
      expect(fields.hostile_fire_idp).toBe(225.0);
    });
  });

  describe('SDAP', () => {
    it('extracts SDAP abbreviation', () => {
      const { fields } = parseLes(les(['SDAP 300.00']));
      expect(fields.sdap).toBe(300.0);
    });

    it('extracts SPECIAL DUTY ASSIGNMENT', () => {
      const { fields } = parseLes(les(['SPECIAL DUTY ASSIGNMENT PAY 300.00']));
      expect(fields.sdap).toBe(300.0);
    });
  });

  describe('reenlistment bonus (SRB)', () => {
    it('extracts SRB abbreviation', () => {
      const { fields } = parseLes(les(['SRB 500.00']));
      expect(fields.sep).toBe(500.0);
    });

    it('extracts SELECTIVE REENLISTMENT', () => {
      const { fields } = parseLes(les(['SELECTIVE REENLISTMENT BONUS 500.00']));
      expect(fields.sep).toBe(500.0);
    });
  });

  it('special pays appear in preview field order after base entitlements', () => {
    const text = les([
      'PAY DATE: 03/31/2026',
      'BASE PAY 3,198.00',
      'BAS 470.88',
      'HOSTILE FIRE/IDP 225.00',
      'SDAP 300.00',
      'FEDERAL TAXES 158.72',
      'FICA-SOC SECURITY 198.28',
      'FICA-MEDICARE 46.34',
    ]);
    const { preview } = parseLes(text);
    const keys = preview.map((p) => p.key);
    expect(keys.indexOf('base_pay')).toBeLessThan(keys.indexOf('hostile_fire_idp'));
    expect(keys.indexOf('hostile_fire_idp')).toBeLessThan(keys.indexOf('taxes'));
  });
});

// ── TSP rate derivation ──────────────────────────────────────────────────────

describe('parseLes — TSP rate', () => {
  it('derives TSP rate from TSP amount / base pay', () => {
    const { fields } = parseLes(les(['BASE PAY 3,198.00', 'TSP 159.90']));
    // 159.90 / 3198.00 = 0.05 (5%)
    expect(fields.tsp_rate).toBeCloseTo(0.05, 3);
  });

  it('rounds TSP rate to 3 decimal places', () => {
    const { fields } = parseLes(
      les([
        'BASE PAY 3,000.00',
        'TSP 100.00', // 100/3000 = 0.0333...
      ]),
    );
    expect(fields.tsp_rate).toBeCloseTo(0.033, 3);
  });

  it('computes 20% TSP rate correctly', () => {
    const { fields } = parseLes(
      les([
        'BASE PAY 2,836.80',
        'TSP 567.36', // 567.36 / 2836.80 = 0.2
      ]),
    );
    expect(fields.tsp_rate).toBeCloseTo(0.2, 3);
  });

  it('clamps TSP rate to maximum 1.0', () => {
    const { fields } = parseLes(
      les([
        'BASE PAY 100.00',
        'TSP 200.00', // would be 2.0 — must clamp to 1
      ]),
    );
    expect(fields.tsp_rate).toBe(1);
  });

  it('skips TSP rate derivation when no base pay found', () => {
    const { fields } = parseLes(les(['TSP 159.90']));
    expect(fields.tsp_rate).toBeUndefined();
  });

  it('skips TSP rate when TSP amount is zero', () => {
    const { fields } = parseLes(les(['BASE PAY 3,198.00']));
    // No TSP line → no tsp_rate
    expect(fields.tsp_rate).toBeUndefined();
  });

  it('captures Roth TSP separately from traditional TSP', () => {
    const { fields } = parseLes(les(['BASE PAY 3,198.00', 'TSP 159.90', 'ROTH TSP 100.00']));
    expect(fields.tsp_rate).toBeCloseTo(0.05, 3); // traditional
    expect(fields.roth_ira).toBe(100.0); // roth stored separately
  });

  it('captures TSP ROTH variant as roth_ira', () => {
    const { fields } = parseLes(les(['BASE PAY 3,000.00', 'TSP ROTH 150.00']));
    expect(fields.roth_ira).toBe(150.0);
    // tsp_rate should NOT be set (Roth consumed the TSP line)
    expect(fields.tsp_rate).toBeUndefined();
  });

  it('uses rightmost amount on two-column lines', () => {
    // Two-column format: "TSP  YTD_amount  current_amount"
    const { fields } = parseLes(
      les([
        'BASE PAY 3,198.00',
        'TSP 1,918.80 159.90', // YTD first, current last → should use 159.90
      ]),
    );
    expect(fields.tsp_rate).toBeCloseTo(0.05, 3);
  });
});

// ── Full LES sample ──────────────────────────────────────────────────────────

describe('parseLes — full sample LES', () => {
  it('extracts all expected fields from the sample LES', () => {
    const { fields, month } = parseLes(SAMPLE_LES);

    expect(month).toBe('2026-03');
    expect(fields.base_pay).toBe(3198.0);
    expect(fields.bas).toBe(470.88);
    expect(fields.bah).toBe(1839.0);
    expect(fields.taxes).toBe(158.72);
    expect(fields.fica_soc_security).toBe(198.28);
    expect(fields.fica_medicare).toBe(46.34);
    expect(fields.sgli).toBe(26.0);
    expect(fields.afrh).toBe(0.5);
  });

  it('computes TSP rate from the sample', () => {
    const { fields } = parseLes(SAMPLE_LES);
    // 159.90 / 3198.00 ≈ 0.05
    expect(fields.tsp_rate).toBeCloseTo(0.05, 2);
  });

  it('preview is ordered correctly', () => {
    const { preview } = parseLes(SAMPLE_LES);
    const keys = preview.map((p) => p.key);
    // base_pay should appear before deductions
    expect(keys.indexOf('base_pay')).toBeLessThan(keys.indexOf('taxes'));
  });

  it('preview values match fields', () => {
    const { preview, fields } = parseLes(SAMPLE_LES);
    for (const { key, value } of preview) {
      expect(value).toBe(fields[key]);
    }
  });
});

// ── Warnings ─────────────────────────────────────────────────────────────────

describe('parseLes — warnings', () => {
  it('warns about missing base_pay', () => {
    const { warnings } = parseLes(les(['BAS 470.88', 'PAY DATE: 03/31/2026']));
    expect(warnings.some((w) => /base pay/i.test(w))).toBe(true);
  });

  it('warns about missing BAS', () => {
    const { warnings } = parseLes(les(['BASE PAY 3,198.00', 'PAY DATE: 03/31/2026']));
    expect(warnings.some((w) => /bas/i.test(w))).toBe(true);
  });

  it('warns about missing federal taxes', () => {
    const { warnings } = parseLes(les(['BASE PAY 3,198.00', 'PAY DATE: 03/31/2026']));
    expect(warnings.some((w) => /tax/i.test(w))).toBe(true);
  });

  it('warns when no recognizable fields are found', () => {
    const { warnings } = parseLes('this is not an LES');
    expect(warnings.some((w) => /no recognizable/i.test(w))).toBe(true);
  });

  it('warns when pay date is missing', () => {
    const { warnings } = parseLes(les(['BASE PAY 3,198.00']));
    expect(warnings.some((w) => /date/i.test(w))).toBe(true);
  });

  it('produces no spurious warnings when all critical fields are present', () => {
    const text = les([
      'PAY DATE: 03/31/2026',
      'BASE PAY 3,198.00',
      'BAS 470.88',
      'FEDERAL TAXES 158.72',
      'FICA-SOC SECURITY 198.28',
      'FICA-MEDICARE 46.34',
    ]);
    const { warnings } = parseLes(text);
    // No "not found" warnings for critical fields
    const missingWarnings = warnings.filter((w) => /not found/i.test(w));
    expect(missingWarnings).toHaveLength(0);
  });
});

// ── First-match-wins per key ──────────────────────────────────────────────────

describe('parseLes — first match wins per field key', () => {
  it('does not overwrite a field already matched by an earlier pattern', () => {
    // BAH W/DEP should match before plain BAH line
    const { fields } = parseLes(
      les([
        'BAH W/DEP 1,839.00',
        'BAH 999.00', // should be ignored — bah already captured
      ]),
    );
    expect(fields.bah).toBe(1839.0);
  });

  it('taxes first match wins over a second federal line', () => {
    const { fields } = parseLes(
      les([
        'FEDERAL TAXES 158.72',
        'FED WITHHOLDING 999.99', // should be ignored
      ]),
    );
    expect(fields.taxes).toBe(158.72);
  });
});

// ── Multiline / realistic format ─────────────────────────────────────────────

describe('parseLes — Windows line endings (CRLF)', () => {
  it('handles CRLF line endings', () => {
    const text = 'PAY DATE: 03/31/2026\r\nBASE PAY 3,198.00\r\nBAS 470.88\r\n';
    const { fields, month } = parseLes(text);
    expect(month).toBe('2026-03');
    expect(fields.base_pay).toBe(3198.0);
    expect(fields.bas).toBe(470.88);
  });
});

describe('parseLes — 2-digit year ≥50 treated as 19xx', () => {
  it('handles 2-digit year in range 50–99 as 1900s', () => {
    const { month } = parseLes(les(['PAY DATE: 03/31/99', 'BASE PAY 3,198.00']));
    expect(month).toBe('1999-03');
  });
});

describe('parseLes — amounts without decimals are ignored', () => {
  it('does not capture amounts without two decimal places', () => {
    // AMOUNT_RE requires .XX — bare integers should not match
    const { fields } = parseLes(les(['BASE PAY 3198']));
    expect(fields.base_pay).toBeUndefined();
  });
});
