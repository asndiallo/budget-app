// BRS (Blended Retirement System) vs Legacy High-3 pension calculations.
// All monetary inputs/outputs are monthly dollar amounts unless noted.
// Assumes constant base pay — actual retirement pay will be higher due to promotions.

/** Monthly DoD TSP contribution rate under BRS given a member's contribution rate. */
export function dodMatchRate(memberRate: number): number {
  // 1% automatic + dollar-for-dollar on first 3% + $0.50 per dollar on next 2%
  const match = Math.min(memberRate, 0.03) + 0.5 * Math.max(0, Math.min(memberRate - 0.03, 0.02));
  return 0.01 + match; // 1% auto always, max 5% total at 5%+ member rate
}

/** Future value of fixed monthly contributions compounding monthly. */
function fvAnnuity(monthlyPmt: number, annualRate: number, months: number): number {
  if (months <= 0 || monthlyPmt <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return monthlyPmt * months;
  return monthlyPmt * ((Math.pow(1 + r, months) - 1) / r);
}

export interface BrsInputs {
  /** Current monthly base pay */
  basePay: number;
  /** Member's TSP contribution rate (0–1) */
  tspRate: number;
  /** Current years of service */
  currentYos: number;
  /** Target retirement YOS (≥ 20) */
  retirementYos: number;
  /** Assumed annual investment return (e.g. 0.06) */
  annualReturn: number;
  /** Continuation pay multiplier (minimum 2.5 for active duty) */
  contPayMultiplier: number;
}

export interface BrsResult {
  // Pensions
  legacyPension: number;
  brsPension: number;
  /** legacyPension − brsPension (positive = legacy pays more per month) */
  pensionShortfall: number;

  // TSP at retirement date
  memberContribMonthly: number;
  dodMatchMonthly: number;
  dodMatchTotalCareer: number; // undiscounted sum of all DoD contributions
  tspWithMatch: number; // BRS: member + DoD match compounded
  tspWithoutMatch: number; // Legacy: member only compounded

  // Continuation pay (BRS, at 12 YOS; 0 if already past 12)
  contPayLumpSum: number;
  contPayFvAtRetirement: number;

  // Total portable wealth at retirement (TSP + cont pay)
  legacyWealthAtRetirement: number;
  brsWealthAtRetirement: number;

  /**
   * Months of retirement after which legacy's higher pension accumulates
   * enough to surpass BRS's lump-sum head-start.
   * null when BRS wealth ≤ legacy wealth at retirement (legacy wins from day 1).
   */
  breakEvenMonths: number | null;
  breakEvenYears: number | null;
}

export function calcBrs(inputs: BrsInputs): BrsResult {
  const { basePay, tspRate, currentYos, retirementYos, annualReturn, contPayMultiplier } = inputs;

  const monthsToRetirement = Math.max(0, (retirementYos - currentYos) * 12);

  // ── Pensions ─────────────────────────────────────────────────────────────────
  const legacyPension = basePay * 0.025 * retirementYos;
  const brsPension = basePay * 0.02 * retirementYos;
  const pensionShortfall = legacyPension - brsPension;

  // ── TSP ───────────────────────────────────────────────────────────────────────
  const memberContribMonthly = basePay * tspRate;
  const dodMatchMonthly = basePay * dodMatchRate(tspRate);
  const dodMatchTotalCareer = dodMatchMonthly * monthsToRetirement;

  const tspWithMatch = fvAnnuity(
    memberContribMonthly + dodMatchMonthly,
    annualReturn,
    monthsToRetirement,
  );
  const tspWithoutMatch = fvAnnuity(memberContribMonthly, annualReturn, monthsToRetirement);

  // ── Continuation pay ─────────────────────────────────────────────────────────
  // Paid at 12 YOS, only relevant if member hasn't passed that point.
  const contPayLumpSum = currentYos < 12 ? basePay * contPayMultiplier : 0;
  const monthsContPayToRetirement =
    contPayLumpSum > 0 ? Math.max(0, (retirementYos - Math.max(currentYos, 12)) * 12) : 0;
  const contPayFvAtRetirement =
    contPayLumpSum > 0
      ? contPayLumpSum * Math.pow(1 + annualReturn / 12, monthsContPayToRetirement)
      : 0;

  // ── Wealth at retirement ──────────────────────────────────────────────────────
  const legacyWealthAtRetirement = tspWithoutMatch;
  const brsWealthAtRetirement = tspWithMatch + contPayFvAtRetirement;

  // ── Break-even ────────────────────────────────────────────────────────────────
  // Cumulative legacy at month N: legacyPension × N + legacyWealth
  // Cumulative BRS at month N:    brsPension    × N + brsWealth
  //
  // BRS ahead when: brsWealth − legacyWealth > pensionShortfall × N
  // Legacy overtakes at N = (brsWealth − legacyWealth) / pensionShortfall
  const wealthAdvantage = brsWealthAtRetirement - legacyWealthAtRetirement;

  let breakEvenMonths: number | null = null;
  let breakEvenYears: number | null = null;

  if (wealthAdvantage > 0 && pensionShortfall > 0) {
    breakEvenMonths = Math.ceil(wealthAdvantage / pensionShortfall);
    breakEvenYears = Math.round((breakEvenMonths / 12) * 10) / 10;
  }

  return {
    legacyPension,
    brsPension,
    pensionShortfall,
    memberContribMonthly,
    dodMatchMonthly,
    dodMatchTotalCareer,
    tspWithMatch,
    tspWithoutMatch,
    contPayLumpSum,
    contPayFvAtRetirement,
    legacyWealthAtRetirement,
    brsWealthAtRetirement,
    breakEvenMonths,
    breakEvenYears,
  };
}

/** Determine likely retirement system from join date ("YYYY-MM" or ""). */
export function inferRetirementSystem(
  joinedAt: string,
): 'brs' | 'legacy' | 'uncertain' | 'unknown' {
  if (!joinedAt) return 'unknown';
  if (joinedAt >= '2018-01') return 'brs';
  if (joinedAt < '2016-08') return 'legacy';
  return 'uncertain'; // eligible to have opted in during the 2018 window
}
