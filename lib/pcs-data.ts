// PCS (Permanent Change of Station) entitlement data — JTR 2026.
// All dollar amounts and weights are reference values; verify at move.mil before your move.

import type { PayGrade } from './pay-tables';

export interface WeightAllowance {
  withoutDependents: number;
  withDependents: number;
}

// JTR Appendix A — HHG weight allowances (lbs), effective 2026
export const JTR_WEIGHT_ALLOWANCE: Partial<Record<PayGrade, WeightAllowance>> =
  {
    'E-1': { withoutDependents: 5_000, withDependents: 8_000 },
    'E-2': { withoutDependents: 5_000, withDependents: 8_000 },
    'E-3': { withoutDependents: 5_000, withDependents: 8_000 },
    'E-4': { withoutDependents: 7_000, withDependents: 8_000 },
    'E-5': { withoutDependents: 9_000, withDependents: 11_000 },
    'E-6': { withoutDependents: 9_000, withDependents: 11_000 },
    'E-7': { withoutDependents: 11_000, withDependents: 13_000 },
    'E-8': { withoutDependents: 11_000, withDependents: 13_000 },
    'E-9': { withoutDependents: 11_000, withDependents: 13_000 },
    'W-1': { withoutDependents: 10_000, withDependents: 12_000 },
    'W-2': { withoutDependents: 10_000, withDependents: 12_000 },
    'W-3': { withoutDependents: 12_000, withDependents: 14_500 },
    'W-4': { withoutDependents: 12_000, withDependents: 14_500 },
    'W-5': { withoutDependents: 12_000, withDependents: 14_500 },
    'O-1': { withoutDependents: 10_000, withDependents: 14_500 },
    'O-2': { withoutDependents: 10_000, withDependents: 14_500 },
    'O-3': { withoutDependents: 12_000, withDependents: 14_500 },
    'O-4': { withoutDependents: 13_000, withDependents: 14_500 },
    'O-5': { withoutDependents: 14_000, withDependents: 17_000 },
    'O-6': { withoutDependents: 14_000, withDependents: 17_000 },
    'O-7': { withoutDependents: 14_500, withDependents: 18_000 },
    'O-8': { withoutDependents: 14_500, withDependents: 18_000 },
    'O-9': { withoutDependents: 14_500, withDependents: 18_000 },
    'O-10': { withoutDependents: 14_500, withDependents: 18_000 },
  };

/** Pro-gear weight allowance — separate from HHG, not counted against weight limit */
export const PRO_GEAR_LBS = { member: 2_000, spouse: 500 };

/** TLE daily lodging + M&IE rate caps (CONUS, 2026 estimate) */
export const TLE_DAILY_RATE = { withDependents: 290, withoutDependents: 145 };
/** Maximum TLE days: 5 at losing PDS + 5 at gaining PDS */
export const TLE_MAX_DAYS = 10;

/** MALT reimbursement rate per POV per mile (DoD, 2026) */
export const MALT_RATE_PER_MILE = 0.21;

/**
 * PPM (Personally Procured Move) incentive rate per pound-mile.
 * The government pays 95 % of its estimated transportation cost (GTC).
 * GTC ≈ weight_lbs × distance_miles × this rate.
 * Based on DoD/TRANSCOM national average — verify at my.move.mil.
 */
export const PPM_RATE_PER_LB_MILE = 0.0008;

/** PPM incentive = GTC × this factor (JTR §5353) */
export const PPM_INCENTIVE_FACTOR = 0.95;

/** Returns HHG weight entitlement for the member's grade and dependent status. */
export function getWeightAllowanceLbs(
  grade: PayGrade,
  hasDependents: boolean,
): number {
  const entry = JTR_WEIGHT_ALLOWANCE[grade];
  if (!entry) return 0;
  return hasDependents ? entry.withDependents : entry.withoutDependents;
}
