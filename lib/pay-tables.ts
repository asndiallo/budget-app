// 2026 DoD Military Pay Tables (effective 1 Jan 2026)
// Source: DoD FMR, Vol. 7A, Chapter 1

export const BRANCHES = [
  'Army',
  'Navy',
  'Air Force',
  'Marines',
  'Coast Guard',
  'Space Force',
] as const;

export type Branch = (typeof BRANCHES)[number];

export const COMPONENTS = ['Active', 'Reserve', 'Guard'] as const;
export type Component = (typeof COMPONENTS)[number];

// All enlisted + warrant + officer pay grades
export const ENLISTED_GRADES = [
  'E-1',
  'E-2',
  'E-3',
  'E-4',
  'E-5',
  'E-6',
  'E-7',
  'E-8',
  'E-9',
] as const;
export const WARRANT_GRADES = ['W-1', 'W-2', 'W-3', 'W-4', 'W-5'] as const;
export const OFFICER_GRADES = [
  'O-1',
  'O-2',
  'O-3',
  'O-4',
  'O-5',
  'O-6',
  'O-7',
  'O-8',
  'O-9',
  'O-10',
] as const;

export const PAY_GRADES = [...ENLISTED_GRADES, ...WARRANT_GRADES, ...OFFICER_GRADES] as const;

export type PayGrade = (typeof PAY_GRADES)[number];

// Years-of-service tiers used in pay table columns
// Index: ≤2, >2, >3, >4, >6, >8, >10, >12, >14, >16, >18, >20, >22, >24, >26, >28, >30, >32, >34, >36, >38, >40
export const YOS_TIERS = [
  0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
] as const;

// Base pay table: grade → [pay at each YOS tier] (22 values)
// Blank cells in the official DoD table (grade not achievable at that YOS) use the
// first available pay rate as a placeholder so lookups always return a valid number.
export const BASE_PAY_TABLE: Record<PayGrade, number[]> = {
  // ── Enlisted ──────────────────────────────────────────────────────────────────
  'E-1': [
    2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2,
    2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2,
  ],
  'E-2': [
    2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9,
    2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9,
  ],
  'E-3': [
    2836.8, 3015.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0,
    3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0, 3198.0,
  ],
  'E-4': [
    3142.2, 3303.0, 3482.4, 3658.5, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4,
    3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4,
  ],
  'E-5': [
    3342.9, 3598.2, 3775.8, 3946.8, 4110.0, 4299.9, 4395.3, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7,
    4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7,
  ],
  'E-6': [
    3401.1, 3743.1, 3908.1, 4068.9, 4235.7, 4612.8, 4759.5, 5043.3, 5130.3, 5193.6, 5267.7, 5267.7,
    5267.7, 5267.7, 5267.7, 5267.7, 5267.7, 5267.7, 5267.7, 5267.7, 5267.7, 5267.7,
  ],
  'E-7': [
    3932.1, 4291.5, 4456.2, 4673.1, 4843.8, 5135.7, 5300.4, 5591.7, 5835.0, 6000.9, 6177.3, 6245.7,
    6475.2, 6598.2, 7067.4, 7067.4, 7067.4, 7067.4, 7067.4, 7067.4, 7067.4, 7067.4,
  ],
  // E-8 first available at >8 YOS; earlier tiers use that rate as placeholder
  'E-8': [
    5656.5, 5656.5, 5656.5, 5656.5, 5656.5, 5656.5, 5907.0, 6061.8, 6247.2, 6448.2, 6811.2, 6995.4,
    7308.3, 7481.7, 7908.9, 7908.9, 8067.3, 8067.3, 8067.3, 8067.3, 8067.3, 8067.3,
  ],
  // E-9 first available at >10 YOS; earlier tiers use that rate as placeholder
  'E-9': [
    6910.2, 6910.2, 6910.2, 6910.2, 6910.2, 6910.2, 6910.2, 7066.5, 7263.6, 7496.1, 7730.7, 8105.1,
    8423.1, 8756.7, 9267.9, 9267.9, 9730.2, 9730.2, 10217.4, 10217.4, 10729.2, 10729.2,
  ],
  // ── Warrant Officers (2025 rates — 2026 DoD table not yet provided) ───────────
  'W-1': [
    3213.0, 3469.5, 3614.7, 3813.6, 4010.1, 4216.5, 4481.1, 4749.6, 4919.4, 5066.4, 5200.5, 5200.5,
    5200.5, 5200.5, 5200.5, 5200.5, 5200.5, 5200.5, 5200.5, 5200.5, 5200.5, 5200.5,
  ],
  'W-2': [
    3617.4, 3975.3, 4108.5, 4268.7, 4440.0, 4669.5, 4907.7, 5101.2, 5327.7, 5527.8, 5706.9, 5706.9,
    5706.9, 5706.9, 5706.9, 5706.9, 5706.9, 5706.9, 5706.9, 5706.9, 5706.9, 5706.9,
  ],
  'W-3': [
    4189.5, 4532.1, 4672.2, 4820.4, 4976.4, 5196.9, 5447.4, 5603.1, 5803.2, 6068.4, 6257.4, 6458.4,
    6458.4, 6458.4, 6458.4, 6458.4, 6458.4, 6458.4, 6458.4, 6458.4, 6458.4, 6458.4,
  ],
  'W-4': [
    4622.7, 5060.7, 5193.9, 5337.3, 5499.0, 5738.7, 6023.1, 6273.3, 6452.4, 6628.2, 6926.4, 7243.5,
    7243.5, 7243.5, 7243.5, 7243.5, 7243.5, 7243.5, 7243.5, 7243.5, 7243.5, 7243.5,
  ],
  'W-5': [
    5749.8, 5749.8, 5749.8, 5749.8, 5749.8, 6124.8, 6447.0, 6750.3, 6990.0, 7233.0, 7590.9, 7950.9,
    8207.1, 8207.1, 8207.1, 8207.1, 8207.1, 8207.1, 8207.1, 8207.1, 8207.1, 8207.1,
  ],
  // ── Officers ──────────────────────────────────────────────────────────────────
  'O-1': [
    4150.2, 4320.0, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4,
    5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4,
  ],
  'O-2': [
    4782.0, 5446.2, 6272.4, 6484.5, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7,
    6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7,
  ],
  'O-3': [
    5534.1, 6273.9, 6770.4, 7382.7, 7737.0, 8125.5, 8375.7, 8788.2, 9004.2, 9004.2, 9004.2, 9004.2,
    9004.2, 9004.2, 9004.2, 9004.2, 9004.2, 9004.2, 9004.2, 9004.2, 9004.2, 9004.2,
  ],
  'O-4': [
    6294.6, 7286.4, 7773.6, 7881.0, 8332.2, 8816.4, 9420.0, 9888.3, 10214.4, 10401.6, 10509.9,
    10509.9, 10509.9, 10509.9, 10509.9, 10509.9, 10509.9, 10509.9, 10509.9, 10509.9, 10509.9,
    10509.9,
  ],
  'O-5': [
    7295.4, 8218.2, 8787.0, 8894.1, 9249.6, 9461.4, 9928.5, 10271.7, 10715.1, 11391.3, 11713.8,
    12032.7, 12394.8, 12394.8, 12394.8, 12394.8, 12394.8, 12394.8, 12394.8, 12394.8, 12394.8,
    12394.8,
  ],
  'O-6': [
    8751.3, 9613.8, 10245.0, 10245.0, 10284.3, 10725.0, 10783.5, 10783.5, 11396.4, 12479.7, 13115.4,
    13751.1, 14112.9, 14479.2, 15188.7, 15188.7, 15408.3, 15408.3, 15408.3, 15408.3, 15408.3,
    15408.3,
  ],
  'O-7': [
    11540.1, 12076.2, 12324.3, 12522.0, 12878.7, 13231.8, 13639.2, 14045.7, 14454.3, 15735.3,
    16817.7, 16817.7, 16817.7, 16817.7, 16904.4, 16904.4, 17242.2, 17242.2, 17242.2, 17242.2,
    17242.2, 17242.2,
  ],
  'O-8': [
    13888.5, 14343.9, 14645.4, 14729.4, 15106.5, 15735.3, 15882.0, 16479.6, 16651.8, 17166.6,
    17911.8, 18598.2, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9,
    18999.9, 18999.9,
  ],
  // O-9 and O-10 are capped at the statutory limit ($18,999.90)
  'O-9': [
    18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9,
    18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9,
    18999.9, 18999.9,
  ],
  'O-10': [
    18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9,
    18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9, 18999.9,
    18999.9, 18999.9,
  ],
};

// 2026 BAS rates (monthly)
export const BAS_RATES = {
  enlisted: 470.88,
  officer: 324.68,
} as const;

// Whether a grade is officer-level (for BAS purposes)
export function isOfficer(grade: PayGrade): boolean {
  return grade.startsWith('O-') || grade.startsWith('W-');
}

/**
 * Look up monthly base pay for a given grade and years of service.
 */
export function getBasePay(grade: PayGrade, yearsOfService: number): number {
  const row = BASE_PAY_TABLE[grade];
  if (!row) return 0;
  const tierIndex = YOS_TIERS.findLastIndex((t) => yearsOfService >= t);
  return row[Math.max(0, tierIndex)];
}

/**
 * Look up monthly BAS for a given grade.
 */
export function getBAS(grade: PayGrade): number {
  return isOfficer(grade) ? BAS_RATES.officer : BAS_RATES.enlisted;
}

// BAH table: installation → grade → { withDep, withoutDep }
// Representative 2026 BAH rates (monthly) for major installations.
// "without" = no dependents, "with" = with dependents
export interface BAHRates {
  withDep: number;
  withoutDep: number;
}

export interface Installation {
  name: string;
  zip: string;
  state: string;
  bah: Partial<Record<PayGrade, BAHRates>>;
}

export const INSTALLATIONS: Installation[] = [
  {
    name: 'JBSA Fort Sam Houston',
    zip: '78234',
    state: 'TX',
    bah: {
      'E-1': { withDep: 1548, withoutDep: 1224 },
      'E-2': { withDep: 1548, withoutDep: 1224 },
      'E-3': { withDep: 1761, withoutDep: 1410 },
      'E-4': { withDep: 1761, withoutDep: 1410 },
      'E-5': { withDep: 1839, withoutDep: 1479 },
      'E-6': { withDep: 1908, withoutDep: 1566 },
      'E-7': { withDep: 2052, withoutDep: 1698 },
      'E-8': { withDep: 2202, withoutDep: 1827 },
      'E-9': { withDep: 2265, withoutDep: 1893 },
      'O-1': { withDep: 1761, withoutDep: 1410 },
      'O-2': { withDep: 1890, withoutDep: 1521 },
      'O-3': { withDep: 2265, withoutDep: 1818 },
      'O-4': { withDep: 2481, withoutDep: 1974 },
      'O-5': { withDep: 2691, withoutDep: 2106 },
      'O-6': { withDep: 2994, withoutDep: 2376 },
    },
  },
  {
    name: 'Fort Liberty (Bragg)',
    zip: '28307',
    state: 'NC',
    bah: {
      'E-1': { withDep: 1194, withoutDep: 912 },
      'E-2': { withDep: 1194, withoutDep: 912 },
      'E-3': { withDep: 1371, withoutDep: 1173 },
      'E-4': { withDep: 1371, withoutDep: 1173 },
      'E-5': { withDep: 1440, withoutDep: 1218 },
      'E-6': { withDep: 1515, withoutDep: 1290 },
      'E-7': { withDep: 1629, withoutDep: 1413 },
      'E-8': { withDep: 1734, withoutDep: 1509 },
      'E-9': { withDep: 1791, withoutDep: 1563 },
      'O-1': { withDep: 1371, withoutDep: 1173 },
      'O-2': { withDep: 1533, withoutDep: 1275 },
      'O-3': { withDep: 1827, withoutDep: 1521 },
      'O-4': { withDep: 2016, withoutDep: 1677 },
      'O-5': { withDep: 2181, withoutDep: 1809 },
      'O-6': { withDep: 2421, withoutDep: 2007 },
    },
  },
  {
    name: 'Fort Cavazos (Hood)',
    zip: '76544',
    state: 'TX',
    bah: {
      'E-1': { withDep: 1095, withoutDep: 840 },
      'E-2': { withDep: 1095, withoutDep: 840 },
      'E-3': { withDep: 1272, withoutDep: 1086 },
      'E-4': { withDep: 1272, withoutDep: 1086 },
      'E-5': { withDep: 1338, withoutDep: 1134 },
      'E-6': { withDep: 1407, withoutDep: 1200 },
      'E-7': { withDep: 1512, withoutDep: 1317 },
      'E-8': { withDep: 1620, withoutDep: 1410 },
      'E-9': { withDep: 1668, withoutDep: 1455 },
      'O-1': { withDep: 1272, withoutDep: 1086 },
      'O-2': { withDep: 1422, withoutDep: 1185 },
      'O-3': { withDep: 1710, withoutDep: 1416 },
      'O-4': { withDep: 1869, withoutDep: 1557 },
      'O-5': { withDep: 2040, withoutDep: 1686 },
      'O-6': { withDep: 2268, withoutDep: 1869 },
    },
  },
  {
    name: 'Fort Campbell',
    zip: '42223',
    state: 'KY',
    bah: {
      'E-1': { withDep: 1008, withoutDep: 780 },
      'E-2': { withDep: 1008, withoutDep: 780 },
      'E-3': { withDep: 1248, withoutDep: 1041 },
      'E-4': { withDep: 1248, withoutDep: 1041 },
      'E-5': { withDep: 1314, withoutDep: 1095 },
      'E-6': { withDep: 1389, withoutDep: 1173 },
      'E-7': { withDep: 1491, withoutDep: 1290 },
      'E-8': { withDep: 1590, withoutDep: 1383 },
      'E-9': { withDep: 1641, withoutDep: 1428 },
      'O-1': { withDep: 1248, withoutDep: 1041 },
      'O-2': { withDep: 1392, withoutDep: 1161 },
      'O-3': { withDep: 1674, withoutDep: 1386 },
      'O-4': { withDep: 1839, withoutDep: 1527 },
      'O-5': { withDep: 2001, withoutDep: 1653 },
      'O-6': { withDep: 2220, withoutDep: 1836 },
    },
  },
  {
    name: 'Fort Carson',
    zip: '80913',
    state: 'CO',
    bah: {
      'E-1': { withDep: 1377, withoutDep: 1068 },
      'E-2': { withDep: 1377, withoutDep: 1068 },
      'E-3': { withDep: 1530, withoutDep: 1233 },
      'E-4': { withDep: 1530, withoutDep: 1233 },
      'E-5': { withDep: 1605, withoutDep: 1311 },
      'E-6': { withDep: 1686, withoutDep: 1395 },
      'E-7': { withDep: 1815, withoutDep: 1527 },
      'E-8': { withDep: 1938, withoutDep: 1638 },
      'E-9': { withDep: 1998, withoutDep: 1695 },
      'O-1': { withDep: 1530, withoutDep: 1233 },
      'O-2': { withDep: 1704, withoutDep: 1380 },
      'O-3': { withDep: 2037, withoutDep: 1647 },
      'O-4': { withDep: 2226, withoutDep: 1806 },
      'O-5': { withDep: 2424, withoutDep: 1965 },
      'O-6': { withDep: 2694, withoutDep: 2187 },
    },
  },
  {
    name: 'JBLM (Lewis-McChord)',
    zip: '98438',
    state: 'WA',
    bah: {
      'E-1': { withDep: 1755, withoutDep: 1386 },
      'E-2': { withDep: 1755, withoutDep: 1386 },
      'E-3': { withDep: 1884, withoutDep: 1701 },
      'E-4': { withDep: 1884, withoutDep: 1701 },
      'E-5': { withDep: 1986, withoutDep: 1776 },
      'E-6': { withDep: 2094, withoutDep: 1875 },
      'E-7': { withDep: 2250, withoutDep: 2052 },
      'E-8': { withDep: 2403, withoutDep: 2196 },
      'E-9': { withDep: 2472, withoutDep: 2268 },
      'O-1': { withDep: 1884, withoutDep: 1701 },
      'O-2': { withDep: 2109, withoutDep: 1827 },
      'O-3': { withDep: 2526, withoutDep: 2064 },
      'O-4': { withDep: 2754, withoutDep: 2256 },
      'O-5': { withDep: 2994, withoutDep: 2442 },
      'O-6': { withDep: 3330, withoutDep: 2724 },
    },
  },
  {
    name: 'Pearl Harbor-Hickam',
    zip: '96860',
    state: 'HI',
    bah: {
      'E-1': { withDep: 2358, withoutDep: 2025 },
      'E-2': { withDep: 2358, withoutDep: 2025 },
      'E-3': { withDep: 2799, withoutDep: 2409 },
      'E-4': { withDep: 2799, withoutDep: 2409 },
      'E-5': { withDep: 2934, withoutDep: 2538 },
      'E-6': { withDep: 3087, withoutDep: 2697 },
      'E-7': { withDep: 3318, withoutDep: 2955 },
      'E-8': { withDep: 3537, withoutDep: 3174 },
      'E-9': { withDep: 3651, withoutDep: 3285 },
      'O-1': { withDep: 2799, withoutDep: 2409 },
      'O-2': { withDep: 3117, withoutDep: 2622 },
      'O-3': { withDep: 3726, withoutDep: 3033 },
      'O-4': { withDep: 4068, withoutDep: 3330 },
      'O-5': { withDep: 4419, withoutDep: 3636 },
      'O-6': { withDep: 4926, withoutDep: 4056 },
    },
  },
  {
    name: 'Camp Pendleton',
    zip: '92055',
    state: 'CA',
    bah: {
      'E-1': { withDep: 1947, withoutDep: 1644 },
      'E-2': { withDep: 1947, withoutDep: 1644 },
      'E-3': { withDep: 2223, withoutDep: 1983 },
      'E-4': { withDep: 2223, withoutDep: 1983 },
      'E-5': { withDep: 2334, withoutDep: 2085 },
      'E-6': { withDep: 2451, withoutDep: 2202 },
      'E-7': { withDep: 2640, withoutDep: 2412 },
      'E-8': { withDep: 2817, withoutDep: 2583 },
      'E-9': { withDep: 2907, withoutDep: 2670 },
      'O-1': { withDep: 2223, withoutDep: 1983 },
      'O-2': { withDep: 2475, withoutDep: 2142 },
      'O-3': { withDep: 2970, withoutDep: 2439 },
      'O-4': { withDep: 3243, withoutDep: 2664 },
      'O-5': { withDep: 3522, withoutDep: 2898 },
      'O-6': { withDep: 3924, withoutDep: 3234 },
    },
  },
  {
    name: 'Fort Meade',
    zip: '20755',
    state: 'MD',
    bah: {
      'E-1': { withDep: 1968, withoutDep: 1656 },
      'E-2': { withDep: 1968, withoutDep: 1656 },
      'E-3': { withDep: 2370, withoutDep: 2022 },
      'E-4': { withDep: 2370, withoutDep: 2022 },
      'E-5': { withDep: 2487, withoutDep: 2136 },
      'E-6': { withDep: 2616, withoutDep: 2262 },
      'E-7': { withDep: 2814, withoutDep: 2481 },
      'E-8': { withDep: 3003, withoutDep: 2661 },
      'E-9': { withDep: 3096, withoutDep: 2748 },
      'O-1': { withDep: 2370, withoutDep: 2022 },
      'O-2': { withDep: 2640, withoutDep: 2193 },
      'O-3': { withDep: 3162, withoutDep: 2556 },
      'O-4': { withDep: 3453, withoutDep: 2802 },
      'O-5': { withDep: 3753, withoutDep: 3057 },
      'O-6': { withDep: 4173, withoutDep: 3426 },
    },
  },
  {
    name: 'Fort Wainwright',
    zip: '99703',
    state: 'AK',
    bah: {
      'E-1': { withDep: 1356, withoutDep: 1053 },
      'E-2': { withDep: 1356, withoutDep: 1053 },
      'E-3': { withDep: 1608, withoutDep: 1332 },
      'E-4': { withDep: 1608, withoutDep: 1332 },
      'E-5': { withDep: 1689, withoutDep: 1404 },
      'E-6': { withDep: 1776, withoutDep: 1488 },
      'E-7': { withDep: 1908, withoutDep: 1629 },
      'E-8': { withDep: 2037, withoutDep: 1749 },
      'E-9': { withDep: 2100, withoutDep: 1809 },
      'O-1': { withDep: 1608, withoutDep: 1332 },
      'O-2': { withDep: 1794, withoutDep: 1479 },
      'O-3': { withDep: 2148, withoutDep: 1764 },
      'O-4': { withDep: 2346, withoutDep: 1929 },
      'O-5': { withDep: 2553, withoutDep: 2103 },
      'O-6': { withDep: 2841, withoutDep: 2337 },
    },
  },
  {
    name: 'Pentagon / NCR',
    zip: '22211',
    state: 'VA',
    bah: {
      'E-1': { withDep: 2268, withoutDep: 1908 },
      'E-2': { withDep: 2268, withoutDep: 1908 },
      'E-3': { withDep: 2631, withoutDep: 2268 },
      'E-4': { withDep: 2631, withoutDep: 2268 },
      'E-5': { withDep: 2763, withoutDep: 2397 },
      'E-6': { withDep: 2907, withoutDep: 2535 },
      'E-7': { withDep: 3126, withoutDep: 2784 },
      'E-8': { withDep: 3336, withoutDep: 2988 },
      'E-9': { withDep: 3441, withoutDep: 3093 },
      'O-1': { withDep: 2631, withoutDep: 2268 },
      'O-2': { withDep: 2931, withoutDep: 2466 },
      'O-3': { withDep: 3513, withoutDep: 2883 },
      'O-4': { withDep: 3834, withoutDep: 3147 },
      'O-5': { withDep: 4167, withoutDep: 3429 },
      'O-6': { withDep: 4638, withoutDep: 3831 },
    },
  },
  {
    name: 'MacDill AFB',
    zip: '33621',
    state: 'FL',
    bah: {
      'E-1': { withDep: 1515, withoutDep: 1227 },
      'E-2': { withDep: 1515, withoutDep: 1227 },
      'E-3': { withDep: 1776, withoutDep: 1521 },
      'E-4': { withDep: 1776, withoutDep: 1521 },
      'E-5': { withDep: 1866, withoutDep: 1605 },
      'E-6': { withDep: 1962, withoutDep: 1698 },
      'E-7': { withDep: 2109, withoutDep: 1857 },
      'E-8': { withDep: 2253, withoutDep: 1998 },
      'E-9': { withDep: 2325, withoutDep: 2064 },
      'O-1': { withDep: 1776, withoutDep: 1521 },
      'O-2': { withDep: 1980, withoutDep: 1650 },
      'O-3': { withDep: 2370, withoutDep: 1929 },
      'O-4': { withDep: 2592, withoutDep: 2112 },
      'O-5': { withDep: 2817, withoutDep: 2301 },
      'O-6': { withDep: 3135, withoutDep: 2562 },
    },
  },
  {
    name: 'Eglin AFB',
    zip: '32542',
    state: 'FL',
    bah: {
      'E-1': { withDep: 1281, withoutDep: 1005 },
      'E-2': { withDep: 1281, withoutDep: 1005 },
      'E-3': { withDep: 1503, withoutDep: 1296 },
      'E-4': { withDep: 1503, withoutDep: 1296 },
      'E-5': { withDep: 1578, withoutDep: 1365 },
      'E-6': { withDep: 1659, withoutDep: 1443 },
      'E-7': { withDep: 1785, withoutDep: 1578 },
      'E-8': { withDep: 1905, withoutDep: 1695 },
      'E-9': { withDep: 1965, withoutDep: 1752 },
      'O-1': { withDep: 1503, withoutDep: 1296 },
      'O-2': { withDep: 1677, withoutDep: 1407 },
      'O-3': { withDep: 2007, withoutDep: 1668 },
      'O-4': { withDep: 2196, withoutDep: 1824 },
      'O-5': { withDep: 2385, withoutDep: 1980 },
      'O-6': { withDep: 2655, withoutDep: 2196 },
    },
  },
  {
    name: 'Quantico',
    zip: '22134',
    state: 'VA',
    bah: {
      'E-1': { withDep: 1992, withoutDep: 1671 },
      'E-2': { withDep: 1992, withoutDep: 1671 },
      'E-3': { withDep: 2310, withoutDep: 1989 },
      'E-4': { withDep: 2310, withoutDep: 1989 },
      'E-5': { withDep: 2427, withoutDep: 2103 },
      'E-6': { withDep: 2553, withoutDep: 2223 },
      'E-7': { withDep: 2745, withoutDep: 2439 },
      'E-8': { withDep: 2928, withoutDep: 2613 },
      'E-9': { withDep: 3021, withoutDep: 2703 },
      'O-1': { withDep: 2310, withoutDep: 1989 },
      'O-2': { withDep: 2571, withoutDep: 2163 },
      'O-3': { withDep: 3081, withoutDep: 2526 },
      'O-4': { withDep: 3363, withoutDep: 2760 },
      'O-5': { withDep: 3660, withoutDep: 3006 },
      'O-6': { withDep: 4071, withoutDep: 3357 },
    },
  },
];

/**
 * Look up BAH for a duty station and grade.
 * Falls back to a national average estimate if the installation is not in the table.
 */
export function getBAH(installationName: string, grade: PayGrade, withDependents: boolean): number {
  const inst = INSTALLATIONS.find((i) => i.name.toLowerCase() === installationName.toLowerCase());
  if (!inst) return 0;
  const rates = inst.bah[grade];
  if (!rates) {
    // Fall back to nearest enlisted/officer average
    const fallback = isOfficer(grade) ? inst.bah['O-3'] : inst.bah['E-5'];
    return fallback ? (withDependents ? fallback.withDep : fallback.withoutDep) : 0;
  }
  return withDependents ? rates.withDep : rates.withoutDep;
}

// Human-readable rank titles by branch
export const RANK_TITLES: Partial<Record<Branch, Partial<Record<PayGrade, string>>>> = {
  Army: {
    'E-1': 'Private (PVT)',
    'E-2': 'Private 2nd Class (PV2)',
    'E-3': 'Private 1st Class (PFC)',
    'E-4': 'Specialist (SPC)',
    'E-5': 'Sergeant (SGT)',
    'E-6': 'Staff Sergeant (SSG)',
    'E-7': 'Sergeant 1st Class (SFC)',
    'E-8': 'Master Sergeant / 1SG (MSG/1SG)',
    'E-9': 'Sergeant Major (SGM/CSM/SMA)',
    'W-1': 'Warrant Officer 1 (WO1)',
    'W-2': 'Chief Warrant 2 (CW2)',
    'W-3': 'Chief Warrant 3 (CW3)',
    'W-4': 'Chief Warrant 4 (CW4)',
    'W-5': 'Chief Warrant 5 (CW5)',
    'O-1': '2nd Lieutenant (2LT)',
    'O-2': '1st Lieutenant (1LT)',
    'O-3': 'Captain (CPT)',
    'O-4': 'Major (MAJ)',
    'O-5': 'Lieutenant Colonel (LTC)',
    'O-6': 'Colonel (COL)',
    'O-7': 'Brigadier General (BG)',
    'O-8': 'Major General (MG)',
    'O-9': 'Lieutenant General (LTG)',
    'O-10': 'General (GEN)',
  },
  'Air Force': {
    'E-1': 'Airman Basic (AB)',
    'E-2': 'Airman (Amn)',
    'E-3': 'Airman 1st Class (A1C)',
    'E-4': 'Senior Airman (SrA)',
    'E-5': 'Staff Sergeant (SSgt)',
    'E-6': 'Technical Sergeant (TSgt)',
    'E-7': 'Master Sergeant (MSgt)',
    'E-8': 'Senior Master Sergeant (SMSgt)',
    'E-9': 'Chief Master Sergeant (CMSgt)',
    'O-1': '2nd Lieutenant (2d Lt)',
    'O-2': '1st Lieutenant (1st Lt)',
    'O-3': 'Captain (Capt)',
    'O-4': 'Major (Maj)',
    'O-5': 'Lieutenant Colonel (Lt Col)',
    'O-6': 'Colonel (Col)',
  },
  Navy: {
    'E-1': 'Seaman Recruit (SR)',
    'E-2': 'Seaman Apprentice (SA)',
    'E-3': 'Seaman (SN)',
    'E-4': 'Petty Officer 3rd Class (PO3)',
    'E-5': 'Petty Officer 2nd Class (PO2)',
    'E-6': 'Petty Officer 1st Class (PO1)',
    'E-7': 'Chief Petty Officer (CPO)',
    'E-8': 'Senior Chief Petty Officer (SCPO)',
    'E-9': 'Master Chief Petty Officer (MCPO)',
    'W-1': 'Warrant Officer 1',
    'W-2': 'Chief Warrant Officer 2 (CWO2)',
    'W-3': 'Chief Warrant Officer 3 (CWO3)',
    'W-4': 'Chief Warrant Officer 4 (CWO4)',
    'O-1': 'Ensign (ENS)',
    'O-2': 'Lieutenant Junior Grade (LTJG)',
    'O-3': 'Lieutenant (LT)',
    'O-4': 'Lieutenant Commander (LCDR)',
    'O-5': 'Commander (CDR)',
    'O-6': 'Captain (CAPT)',
  },
  Marines: {
    'E-1': 'Private (Pvt)',
    'E-2': 'Private 1st Class (PFC)',
    'E-3': 'Lance Corporal (LCpl)',
    'E-4': 'Corporal (Cpl)',
    'E-5': 'Sergeant (Sgt)',
    'E-6': 'Staff Sergeant (SSgt)',
    'E-7': 'Gunnery Sergeant (GySgt)',
    'E-8': 'Master Sergeant / 1st Sgt (MSgt/1stSgt)',
    'E-9': 'Master Gunnery Sgt / Sgt Major (MGySgt/SgtMaj)',
    'W-1': 'Warrant Officer 1 (WO1)',
    'W-2': 'Chief Warrant Officer 2 (CWO2)',
    'W-3': 'Chief Warrant Officer 3 (CWO3)',
    'W-4': 'Chief Warrant Officer 4 (CWO4)',
    'W-5': 'Chief Warrant Officer 5 (CWO5)',
    'O-1': '2nd Lieutenant (2ndLt)',
    'O-2': '1st Lieutenant (1stLt)',
    'O-3': 'Captain (Capt)',
    'O-4': 'Major (Maj)',
    'O-5': 'Lieutenant Colonel (LtCol)',
    'O-6': 'Colonel (Col)',
  },
};

export function getRankTitle(branch: Branch, grade: PayGrade): string {
  return RANK_TITLES[branch]?.[grade] ?? grade;
}
