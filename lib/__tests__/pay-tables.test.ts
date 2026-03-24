import {
  BASE_PAY_TABLE,
  BAS_RATES,
  ENLISTED_GRADES,
  INSTALLATIONS,
  OFFICER_GRADES,
  PAY_GRADES,
  WARRANT_GRADES,
  YOS_TIERS,
  getBAH,
  getBAS,
  getBasePay,
  getRankTitle,
  isOfficer,
} from '../pay-tables';
/**
 * Pay table tests — 2026 DoD rates (effective 1 Jan 2026)
 *
 * Every assertion is cross-referenced against the official values baked into
 * lib/pay-tables.ts. If a rate is updated there, the corresponding test must
 * be updated too, making discrepancies immediately visible.
 */
import { describe, expect, it } from 'vitest';

// ── isOfficer ────────────────────────────────────────────────────────────────

describe('isOfficer', () => {
  it('returns false for all enlisted grades', () => {
    for (const g of ENLISTED_GRADES) {
      expect(isOfficer(g), `expected ${g} to not be officer`).toBe(false);
    }
  });

  it('returns true for all officer grades', () => {
    for (const g of OFFICER_GRADES) {
      expect(isOfficer(g), `expected ${g} to be officer`).toBe(true);
    }
  });

  it('returns true for all warrant grades', () => {
    for (const g of WARRANT_GRADES) {
      expect(isOfficer(g), `expected ${g} to be officer`).toBe(true);
    }
  });

  it('handles specific grade checks', () => {
    expect(isOfficer('E-1')).toBe(false);
    expect(isOfficer('E-9')).toBe(false);
    expect(isOfficer('W-1')).toBe(true);
    expect(isOfficer('W-5')).toBe(true);
    expect(isOfficer('O-1')).toBe(true);
    expect(isOfficer('O-10')).toBe(true);
  });
});

// ── getBasePay ───────────────────────────────────────────────────────────────

describe('getBasePay', () => {
  describe('YOS tier boundary behaviour', () => {
    // YOS_TIERS = [0,2,3,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40]
    // E-3 row: [2836.8, 3015.0, 3198.0, 3198.0, ...] (caps out at 3198.0 from index 2)

    it('E-3 at 0 YOS → entry-level rate', () => {
      expect(getBasePay('E-3', 0)).toBe(2836.8);
    });

    it('E-3 at 2 YOS → still entry-level (tier is > 2, not >= 2)', () => {
      // tier index: YOS=2 matches tier[1]=2 (last index where 2>=t)
      expect(getBasePay('E-3', 2)).toBe(3015.0);
    });

    it('E-3 at 3 YOS → second tier', () => {
      expect(getBasePay('E-3', 3)).toBe(3198.0);
    });

    it('E-3 at 20 YOS → capped at max (3198.0)', () => {
      expect(getBasePay('E-3', 20)).toBe(3198.0);
    });

    it('E-5 follows correct tiers', () => {
      // E-5 row: [3342.9, 3598.2, 3775.8, 3946.8, 4110.0, 4299.9, 4395.3, 4421.7, ...]
      expect(getBasePay('E-5', 0)).toBe(3342.9); // tier 0
      expect(getBasePay('E-5', 2)).toBe(3598.2); // tier 1 (>=2)
      expect(getBasePay('E-5', 3)).toBe(3775.8); // tier 2 (>=3)
      expect(getBasePay('E-5', 4)).toBe(3946.8); // tier 3 (>=4)
      expect(getBasePay('E-5', 6)).toBe(4110.0); // tier 4 (>=6)
      expect(getBasePay('E-5', 8)).toBe(4299.9); // tier 5 (>=8)
      expect(getBasePay('E-5', 10)).toBe(4395.3); // tier 6 (>=10)
      expect(getBasePay('E-5', 12)).toBe(4421.7); // tier 7 (>=12) — caps here
      expect(getBasePay('E-5', 40)).toBe(4421.7); // still capped
    });

    it('E-7 has rates across more tiers', () => {
      // E-7: [3932.1, 4291.5, 4456.2, 4673.1, 4843.8, 5135.7, 5300.4, 5591.7,
      //        5835.0, 6000.9, 6177.3, 6245.7, 6475.2, 6598.2, 7067.4, ...]
      expect(getBasePay('E-7', 0)).toBe(3932.1);
      expect(getBasePay('E-7', 14)).toBe(5835.0); // tier 8 (>=14)
      expect(getBasePay('E-7', 26)).toBe(7067.4); // tier 14 (>=26) — caps
    });

    it('O-1 at 0 YOS', () => {
      const pay = getBasePay('O-1', 0);
      expect(pay).toBeGreaterThan(3000);
      expect(pay).toBe(BASE_PAY_TABLE['O-1'][0]);
    });

    it('O-3 increases with YOS', () => {
      const atZero = getBasePay('O-3', 0);
      const atEight = getBasePay('O-3', 8);
      const atTwenty = getBasePay('O-3', 20);
      expect(atZero).toBeLessThan(atEight);
      expect(atEight).toBeLessThan(atTwenty);
    });
  });

  describe('all grades return positive values', () => {
    it('every grade at 0 YOS returns a positive number', () => {
      for (const g of PAY_GRADES) {
        const pay = getBasePay(g, 0);
        expect(pay, `${g} at 0 YOS should be > 0`).toBeGreaterThan(0);
      }
    });

    it('every grade has exactly 22 pay tiers in the table', () => {
      for (const g of PAY_GRADES) {
        expect(BASE_PAY_TABLE[g].length, `${g} should have 22 tiers`).toBe(
          YOS_TIERS.length,
        );
      }
    });

    it('pay never decreases with additional YOS for any grade', () => {
      for (const g of PAY_GRADES) {
        const row = BASE_PAY_TABLE[g];
        for (let i = 1; i < row.length; i++) {
          expect(
            row[i],
            `${g}: pay at tier ${i} should be >= tier ${i - 1}`,
          ).toBeGreaterThanOrEqual(row[i - 1]);
        }
      }
    });
  });

  describe('unknown grade', () => {
    it('returns 0 for an unrecognised pay grade', () => {
      // @ts-expect-error intentionally testing invalid grade
      expect(getBasePay('X-9', 0)).toBe(0);
    });
  });

  describe('E-1 and E-2 flat rates', () => {
    it('E-1 is flat at 2407.2 regardless of YOS', () => {
      expect(getBasePay('E-1', 0)).toBe(2407.2);
      expect(getBasePay('E-1', 20)).toBe(2407.2);
      expect(getBasePay('E-1', 40)).toBe(2407.2);
    });

    it('E-2 is flat at 2697.9 regardless of YOS', () => {
      expect(getBasePay('E-2', 0)).toBe(2697.9);
      expect(getBasePay('E-2', 10)).toBe(2697.9);
    });
  });

  describe('fractional YOS', () => {
    it('handles fractional years (1.5 treated as tier for >=1)', () => {
      // 1.5 YOS: last tier where 1.5 >= t → tier[0]=0, so index 0
      expect(getBasePay('E-3', 1.5)).toBe(2836.8);
    });

    it('2.5 YOS falls in 2-year tier', () => {
      expect(getBasePay('E-5', 2.5)).toBe(3598.2);
    });
  });
});

// ── getBAS ───────────────────────────────────────────────────────────────────

describe('getBAS', () => {
  it('returns enlisted rate (470.88) for all E grades', () => {
    for (const g of ENLISTED_GRADES) {
      expect(getBAS(g), `${g} should get enlisted BAS`).toBe(
        BAS_RATES.enlisted,
      );
    }
    expect(BAS_RATES.enlisted).toBe(470.88);
  });

  it('returns officer rate (324.68) for all O grades', () => {
    for (const g of OFFICER_GRADES) {
      expect(getBAS(g), `${g} should get officer BAS`).toBe(BAS_RATES.officer);
    }
    expect(BAS_RATES.officer).toBe(324.68);
  });

  it('returns officer rate for all warrant grades', () => {
    for (const g of WARRANT_GRADES) {
      expect(getBAS(g), `${g} should get officer BAS`).toBe(BAS_RATES.officer);
    }
  });

  it('enlisted BAS is higher than officer BAS', () => {
    expect(BAS_RATES.enlisted).toBeGreaterThan(BAS_RATES.officer);
  });
});

// ── getBAH ───────────────────────────────────────────────────────────────────

describe('getBAH', () => {
  describe('JBSA Fort Sam Houston (TX)', () => {
    const station = 'JBSA Fort Sam Houston';

    it('E-5 with dependents → 1839', () => {
      expect(getBAH(station, 'E-5', true)).toBe(1839);
    });

    it('E-5 without dependents → 1479', () => {
      expect(getBAH(station, 'E-5', false)).toBe(1479);
    });

    it('E-1 with dependents → 1548', () => {
      expect(getBAH(station, 'E-1', true)).toBe(1548);
    });

    it('E-1 without dependents → 1224', () => {
      expect(getBAH(station, 'E-1', false)).toBe(1224);
    });

    it('O-3 with dependents → 2265', () => {
      expect(getBAH(station, 'O-3', true)).toBe(2265);
    });

    it('O-3 without dependents → 1818', () => {
      expect(getBAH(station, 'O-3', false)).toBe(1818);
    });

    it('O-6 with dependents → 2994', () => {
      expect(getBAH(station, 'O-6', true)).toBe(2994);
    });

    it('with dependents is always >= without dependents', () => {
      const inst = INSTALLATIONS.find((i) => i.name === station)!;
      for (const [, rates] of Object.entries(inst.bah)) {
        expect(rates.withDep).toBeGreaterThanOrEqual(rates.withoutDep);
      }
    });
  });

  describe('Fort Liberty, NC', () => {
    const station = 'Fort Liberty (Bragg)';

    it('E-5 with dependents → 1440', () => {
      expect(getBAH(station, 'E-5', true)).toBe(1440);
    });

    it('E-5 without dependents → 1218', () => {
      expect(getBAH(station, 'E-5', false)).toBe(1218);
    });
  });

  describe('Eglin AFB (FL)', () => {
    const station = 'Eglin AFB';

    it('E-5 with dependents → 1578', () => {
      expect(getBAH(station, 'E-5', true)).toBe(1578);
    });

    it('O-4 with dependents → 2196', () => {
      expect(getBAH(station, 'O-4', true)).toBe(2196);
    });
  });

  describe('Quantico (VA)', () => {
    const station = 'Quantico';

    it('E-5 with dependents → 2427', () => {
      expect(getBAH(station, 'E-5', true)).toBe(2427);
    });

    it('O-3 with dependents → 3081', () => {
      expect(getBAH(station, 'O-3', true)).toBe(3081);
    });
  });

  describe('case insensitivity', () => {
    it('matches installation names case-insensitively', () => {
      expect(getBAH('jbsa fort sam houston', 'E-5', true)).toBe(1839);
      expect(getBAH('JBSA FORT SAM HOUSTON', 'E-5', true)).toBe(1839);
      expect(getBAH('Jbsa Fort Sam Houston', 'E-5', true)).toBe(1839);
    });
  });

  describe('unknown installation', () => {
    it('returns 0 for an unknown installation', () => {
      expect(getBAH('Fake Base, Nowhere', 'E-5', true)).toBe(0);
      expect(getBAH('', 'E-5', false)).toBe(0);
    });
  });

  describe('fallback for grades not in BAH table', () => {
    // E-1/E-2 share E-1 rate, E-3/E-4 share E-3 rate in some tables
    // W- grades fall back to O-3 (officer path)
    it('W-1 falls back to O-3 rate (officer fallback)', () => {
      const station = 'JBSA Fort Sam Houston';
      // W-1 is not in the JBSA BAH table, falls back to O-3
      const w1 = getBAH(station, 'W-1', true);
      const o3 = getBAH(station, 'O-3', true);
      expect(w1).toBe(o3);
    });

    it('W-2 falls back to O-3 rate (officer fallback)', () => {
      const station = 'Fort Liberty (Bragg)';
      const w2 = getBAH(station, 'W-2', false);
      const o3 = getBAH(station, 'O-3', false);
      expect(w2).toBe(o3);
    });
  });

  describe('CONUS rates are positive', () => {
    it('every installation has positive BAH for E-5 with dependents', () => {
      for (const inst of INSTALLATIONS) {
        const bah = getBAH(inst.name, 'E-5', true);
        expect(bah, `${inst.name} should have positive BAH`).toBeGreaterThan(0);
      }
    });
  });

  describe('high-cost areas have higher BAH', () => {
    // Pentagon / NCR (VA) should exceed Fort Cavazos (TX)
    it('Pentagon NCR BAH > Fort Cavazos BAH for E-5', () => {
      const pentagon = getBAH('Pentagon / NCR', 'E-5', true);
      const cavazos = getBAH('Fort Cavazos (Hood)', 'E-5', true);
      expect(pentagon).toBeGreaterThan(cavazos);
    });

    // Hawaii should exceed Fort Liberty (NC)
    it('Pearl Harbor BAH > Fort Liberty BAH for E-5', () => {
      const hawaii = getBAH('Pearl Harbor-Hickam', 'E-5', true);
      const bragg = getBAH('Fort Liberty (Bragg)', 'E-5', true);
      expect(hawaii).toBeGreaterThan(bragg);
    });
  });
});

// ── getRankTitle ─────────────────────────────────────────────────────────────

describe('getRankTitle', () => {
  describe('Army', () => {
    it('E-5 → Sergeant (SGT)', () => {
      expect(getRankTitle('Army', 'E-5')).toBe('Sergeant (SGT)');
    });
    it('E-9 → Sergeant Major', () => {
      expect(getRankTitle('Army', 'E-9')).toContain('Sergeant Major');
    });
    it('O-3 → Captain (CPT)', () => {
      expect(getRankTitle('Army', 'O-3')).toBe('Captain (CPT)');
    });
    it('W-1 → Warrant Officer 1 (WO1)', () => {
      expect(getRankTitle('Army', 'W-1')).toBe('Warrant Officer 1 (WO1)');
    });
  });

  describe('Air Force', () => {
    it('E-4 → Senior Airman (SrA)', () => {
      expect(getRankTitle('Air Force', 'E-4')).toBe('Senior Airman (SrA)');
    });
    it('E-7 → Master Sergeant (MSgt)', () => {
      expect(getRankTitle('Air Force', 'E-7')).toBe('Master Sergeant (MSgt)');
    });
    it('O-3 → Captain (Capt)', () => {
      expect(getRankTitle('Air Force', 'O-3')).toBe('Captain (Capt)');
    });
  });

  describe('Navy', () => {
    it('E-5 → Petty Officer 2nd Class (PO2)', () => {
      expect(getRankTitle('Navy', 'E-5')).toBe('Petty Officer 2nd Class (PO2)');
    });
    it('E-7 → Chief Petty Officer (CPO)', () => {
      expect(getRankTitle('Navy', 'E-7')).toBe('Chief Petty Officer (CPO)');
    });
    it('O-6 → Captain (CAPT)', () => {
      expect(getRankTitle('Navy', 'O-6')).toBe('Captain (CAPT)');
    });
  });

  describe('Marines', () => {
    it('E-3 → Lance Corporal (LCpl)', () => {
      expect(getRankTitle('Marines', 'E-3')).toBe('Lance Corporal (LCpl)');
    });
    it('E-4 → Corporal (Cpl)', () => {
      expect(getRankTitle('Marines', 'E-4')).toBe('Corporal (Cpl)');
    });
  });

  describe('fallback for unknown branch/grade', () => {
    it('returns grade string when branch has no mapping for that grade', () => {
      // Coast Guard has no RANK_TITLES entry — falls back to grade
      expect(getRankTitle('Coast Guard', 'E-5')).toBe('E-5');
    });

    it('returns grade string for branches without warrant mappings', () => {
      // Air Force has no W- grades
      expect(getRankTitle('Air Force', 'W-1')).toBe('W-1');
    });
  });
});

// ── INSTALLATIONS data integrity ─────────────────────────────────────────────

describe('INSTALLATIONS data integrity', () => {
  it('all installations have a name, state, and zip', () => {
    for (const inst of INSTALLATIONS) {
      expect(inst.name, 'missing name').toBeTruthy();
      expect(inst.state, `${inst.name} missing state`).toMatch(/^[A-Z]{2}$/);
      expect(inst.zip, `${inst.name} missing zip`).toMatch(/^\d{5}$/);
    }
  });

  it('all BAH entries have withDep >= withoutDep', () => {
    for (const inst of INSTALLATIONS) {
      for (const [grade, rates] of Object.entries(inst.bah)) {
        expect(
          rates.withDep,
          `${inst.name} ${grade}: withDep should >= withoutDep`,
        ).toBeGreaterThanOrEqual(rates.withoutDep);
      }
    }
  });

  it('all BAH rates are positive', () => {
    for (const inst of INSTALLATIONS) {
      for (const [grade, rates] of Object.entries(inst.bah)) {
        expect(rates.withDep, `${inst.name} ${grade} withDep`).toBeGreaterThan(
          0,
        );
        expect(
          rates.withoutDep,
          `${inst.name} ${grade} withoutDep`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
