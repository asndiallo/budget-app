// 2025 DoD Military Pay Tables (effective 1 Jan 2025, ~5.2% increase)
// Source: Defense Finance and Accounting Service (DFAS)

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
  'E-1','E-2','E-3','E-4','E-5','E-6','E-7','E-8','E-9',
] as const;
export const WARRANT_GRADES = ['W-1','W-2','W-3','W-4','W-5'] as const;
export const OFFICER_GRADES = [
  'O-1','O-2','O-3','O-4','O-5','O-6','O-7','O-8','O-9','O-10',
] as const;

export const PAY_GRADES = [
  ...ENLISTED_GRADES,
  ...WARRANT_GRADES,
  ...OFFICER_GRADES,
] as const;

export type PayGrade = (typeof PAY_GRADES)[number];

// Years-of-service tiers used in pay table columns
export const YOS_TIERS = [0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26] as const;

// Base pay table: grade → [pay at each YOS tier]
// Index matches YOS_TIERS order: <2, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26+
export const BASE_PAY_TABLE: Record<PayGrade, number[]> = {
  'E-1': [1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30, 1833.30],
  'E-2': [2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70, 2055.70],
  'E-3': [2161.50, 2296.80, 2371.80, 2371.80, 2371.80, 2371.80, 2371.80, 2371.80, 2371.80, 2371.80, 2371.80, 2371.80, 2371.80, 2371.80, 2371.80],
  'E-4': [2393.40, 2516.40, 2642.40, 2837.40, 2837.40, 2837.40, 2837.40, 2837.40, 2837.40, 2837.40, 2837.40, 2837.40, 2837.40, 2837.40, 2837.40],
  'E-5': [2606.10, 2779.80, 2878.80, 2980.80, 3149.70, 3341.40, 3462.60, 3462.60, 3462.60, 3462.60, 3462.60, 3462.60, 3462.60, 3462.60, 3462.60],
  'E-6': [2845.20, 3130.20, 3228.00, 3328.50, 3434.10, 3615.30, 3783.90, 3891.90, 3950.70, 3950.70, 3950.70, 3950.70, 3950.70, 3950.70, 3950.70],
  'E-7': [3290.40, 3593.40, 3693.30, 3847.80, 3999.30, 4163.40, 4343.10, 4491.00, 4774.50, 4963.50, 5063.40, 5063.40, 5063.40, 5063.40, 5063.40],
  'E-8': [4736.70, 4907.40, 4986.60, 5148.60, 5283.00, 5496.30, 5680.20, 5812.20, 6058.80, 6058.80, 6058.80, 6058.80, 6058.80, 6058.80, 6058.80],
  'E-9': [5789.10, 5987.70, 6082.80, 6249.60, 6498.90, 6748.20, 7001.40, 7254.60, 7254.60, 7254.60, 7254.60, 7254.60, 7254.60, 7254.60, 7254.60],
  'W-1': [3213.00, 3469.50, 3614.70, 3813.60, 4010.10, 4216.50, 4481.10, 4749.60, 4919.40, 5066.40, 5200.50, 5200.50, 5200.50, 5200.50, 5200.50],
  'W-2': [3617.40, 3975.30, 4108.50, 4268.70, 4440.00, 4669.50, 4907.70, 5101.20, 5327.70, 5527.80, 5706.90, 5706.90, 5706.90, 5706.90, 5706.90],
  'W-3': [4189.50, 4532.10, 4672.20, 4820.40, 4976.40, 5196.90, 5447.40, 5603.10, 5803.20, 6068.40, 6257.40, 6458.40, 6458.40, 6458.40, 6458.40],
  'W-4': [4622.70, 5060.70, 5193.90, 5337.30, 5499.00, 5738.70, 6023.10, 6273.30, 6452.40, 6628.20, 6926.40, 7243.50, 7243.50, 7243.50, 7243.50],
  'W-5': [5749.80, 5749.80, 5749.80, 5749.80, 5749.80, 6124.80, 6447.00, 6750.30, 6990.00, 7233.00, 7590.90, 7950.90, 8207.10, 8207.10, 8207.10],
  'O-1': [3477.30, 3614.70, 4479.90, 4479.90, 4479.90, 4479.90, 4479.90, 4479.90, 4479.90, 4479.90, 4479.90, 4479.90, 4479.90, 4479.90, 4479.90],
  'O-2': [4006.50, 4560.30, 5264.10, 5445.00, 5554.50, 5554.50, 5554.50, 5554.50, 5554.50, 5554.50, 5554.50, 5554.50, 5554.50, 5554.50, 5554.50],
  'O-3': [4636.50, 5248.80, 5665.80, 6148.80, 6418.20, 6586.80, 6812.40, 7038.00, 7131.00, 7131.00, 7131.00, 7131.00, 7131.00, 7131.00, 7131.00],
  'O-4': [5273.10, 6101.10, 6509.70, 6933.30, 7356.90, 7626.30, 7850.10, 8140.50, 8437.50, 8621.10, 8709.60, 8709.60, 8709.60, 8709.60, 8709.60],
  'O-5': [6112.50, 6885.00, 7359.30, 7434.30, 7679.10, 7995.60, 8234.10, 8476.20, 8869.50, 9253.80, 9453.90, 9638.40, 9638.40, 9638.40, 9638.40],
  'O-6': [7332.90, 8062.20, 8585.10, 8585.10, 8620.20, 8969.70, 9031.80, 9031.80, 9359.40, 9929.10, 10456.50, 10781.40, 11073.60, 11073.60, 11073.60],
  'O-7': [9668.40, 10152.30, 10491.30, 10665.30, 10908.00, 11199.00, 11634.90, 11934.30, 12234.90, 12534.30, 12534.30, 12534.30, 12534.30, 12534.30, 12534.30],
  'O-8': [11679.30, 12073.50, 12457.80, 12625.50, 12974.40, 13316.10, 13671.00, 14000.40, 14000.40, 14000.40, 14000.40, 14000.40, 14000.40, 14000.40, 14000.40],
  'O-9': [14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10, 14348.10],
  'O-10': [16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30, 16608.30],
};

// 2025 BAS rates (monthly)
export const BAS_RATES = {
  enlisted: 460.24,
  officer: 318.45,
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
// Representative 2025 BAH rates (monthly) for major installations.
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
export function getBAH(
  installationName: string,
  grade: PayGrade,
  withDependents: boolean,
): number {
  const inst = INSTALLATIONS.find(
    (i) => i.name.toLowerCase() === installationName.toLowerCase(),
  );
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
    'E-1': 'Private (PVT)', 'E-2': 'Private 2nd Class (PV2)',
    'E-3': 'Private 1st Class (PFC)', 'E-4': 'Specialist (SPC)',
    'E-5': 'Sergeant (SGT)', 'E-6': 'Staff Sergeant (SSG)',
    'E-7': 'Sergeant 1st Class (SFC)', 'E-8': 'Master Sergeant / 1SG (MSG/1SG)',
    'E-9': 'Sergeant Major (SGM/CSM/SMA)',
    'W-1': 'Warrant Officer 1 (WO1)', 'W-2': 'Chief Warrant 2 (CW2)',
    'W-3': 'Chief Warrant 3 (CW3)', 'W-4': 'Chief Warrant 4 (CW4)',
    'W-5': 'Chief Warrant 5 (CW5)',
    'O-1': '2nd Lieutenant (2LT)', 'O-2': '1st Lieutenant (1LT)',
    'O-3': 'Captain (CPT)', 'O-4': 'Major (MAJ)',
    'O-5': 'Lieutenant Colonel (LTC)', 'O-6': 'Colonel (COL)',
    'O-7': 'Brigadier General (BG)', 'O-8': 'Major General (MG)',
    'O-9': 'Lieutenant General (LTG)', 'O-10': 'General (GEN)',
  },
  'Air Force': {
    'E-1': 'Airman Basic (AB)', 'E-2': 'Airman (Amn)',
    'E-3': 'Airman 1st Class (A1C)', 'E-4': 'Senior Airman (SrA)',
    'E-5': 'Staff Sergeant (SSgt)', 'E-6': 'Technical Sergeant (TSgt)',
    'E-7': 'Master Sergeant (MSgt)', 'E-8': 'Senior Master Sergeant (SMSgt)',
    'E-9': 'Chief Master Sergeant (CMSgt)',
    'O-1': '2nd Lieutenant (2d Lt)', 'O-2': '1st Lieutenant (1st Lt)',
    'O-3': 'Captain (Capt)', 'O-4': 'Major (Maj)',
    'O-5': 'Lieutenant Colonel (Lt Col)', 'O-6': 'Colonel (Col)',
  },
  Navy: {
    'E-1': 'Seaman Recruit (SR)', 'E-2': 'Seaman Apprentice (SA)',
    'E-3': 'Seaman (SN)', 'E-4': 'Petty Officer 3rd Class (PO3)',
    'E-5': 'Petty Officer 2nd Class (PO2)', 'E-6': 'Petty Officer 1st Class (PO1)',
    'E-7': 'Chief Petty Officer (CPO)', 'E-8': 'Senior Chief Petty Officer (SCPO)',
    'E-9': 'Master Chief Petty Officer (MCPO)',
    'W-1': 'Warrant Officer 1', 'W-2': 'Chief Warrant Officer 2 (CWO2)',
    'W-3': 'Chief Warrant Officer 3 (CWO3)', 'W-4': 'Chief Warrant Officer 4 (CWO4)',
    'O-1': 'Ensign (ENS)', 'O-2': 'Lieutenant Junior Grade (LTJG)',
    'O-3': 'Lieutenant (LT)', 'O-4': 'Lieutenant Commander (LCDR)',
    'O-5': 'Commander (CDR)', 'O-6': 'Captain (CAPT)',
  },
  Marines: {
    'E-1': 'Private (Pvt)', 'E-2': 'Private 1st Class (PFC)',
    'E-3': 'Lance Corporal (LCpl)', 'E-4': 'Corporal (Cpl)',
    'E-5': 'Sergeant (Sgt)', 'E-6': 'Staff Sergeant (SSgt)',
    'E-7': 'Gunnery Sergeant (GySgt)', 'E-8': 'Master Sergeant / 1st Sgt (MSgt/1stSgt)',
    'E-9': 'Master Gunnery Sgt / Sgt Major (MGySgt/SgtMaj)',
    'W-1': 'Warrant Officer 1 (WO1)', 'W-2': 'Chief Warrant Officer 2 (CWO2)',
    'W-3': 'Chief Warrant Officer 3 (CWO3)', 'W-4': 'Chief Warrant Officer 4 (CWO4)',
    'W-5': 'Chief Warrant Officer 5 (CWO5)',
    'O-1': '2nd Lieutenant (2ndLt)', 'O-2': '1st Lieutenant (1stLt)',
    'O-3': 'Captain (Capt)', 'O-4': 'Major (Maj)',
    'O-5': 'Lieutenant Colonel (LtCol)', 'O-6': 'Colonel (Col)',
  },
};

export function getRankTitle(branch: Branch, grade: PayGrade): string {
  return RANK_TITLES[branch]?.[grade] ?? grade;
}
