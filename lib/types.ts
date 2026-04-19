// Shared domain types — used by both API routes (server) and components (client)

// ── User & Auth ───────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user' | 'viewer';
export type Branch = 'Army' | 'Navy' | 'Air Force' | 'Marines' | 'Coast Guard' | 'Space Force';
export type Component = 'Active' | 'Reserve' | 'Guard';

export interface UserProfile {
  id: string; // Better Auth UUID
  email: string;
  name: string; // display name
  role: UserRole;
  branch: Branch;
  pay_grade: string; // E-3, O-4, W-2, etc.
  mos: string; // job code: 11B, 4N0, 0311, etc.
  duty_station: string; // installation name
  bah_zip: string;
  component: Component;
  dependents: number; // 0 = without, 1+ = with
  years_of_service: number;
  /** Military service start month: "YYYY-MM" or empty string */
  joined_at: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  branch: Branch;
  pay_grade: string;
  duty_station: string;
  component: Component;
  created_at: string;
}

export type IncomeConfig = Record<string, number>;

export interface FixedExpense {
  id: number;
  label: string;
  amount: number;
  period: 'monthly' | 'annual';
  day_of_month?: number | null;
  notes?: string | null;
  is_investment?: number | null;
  goal_id?: number | null;
  /** 'monthly' (default) | 'biweekly' — controls calendar display only */
  recurrence?: 'monthly' | 'biweekly' | null;
  /** First occurrence date (YYYY-MM-DD); also serves as the biweekly phase anchor */
  recurrence_anchor?: string | null;
  /** Last occurrence date (YYYY-MM-DD, optional) */
  end_date?: string | null;
}

export interface LeaveEvent {
  id: number;
  taken_at: string; // YYYY-MM-DD
  days: number;
  note?: string | null;
  created_at: string;
}

export interface GoalContribution {
  id: number;
  goal_id: number;
  amount: number;
  note?: string | null;
  created_at: string;
}

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  month: string;
  source: string;
  created_at: string;
  date?: string | null;
  notes?: string | null;
}

export interface Goal {
  id: number;
  name: string;
  target: number;
  saved: number;
  color: string;
}

export interface IncomeEntry {
  id: number;
  description: string;
  amount: number;
  month: string;
  source: string;
}

export interface Receivable {
  id: number;
  name: string;
  description: string;
  amount: number;
  amount_paid: number;
  month_created: string;
  month_paid: string | null;
  paid: number;
}

export interface CsvRow {
  description: string;
  amount: number;
  category: string;
  date: string;
}

export interface PaymentSource {
  id: number;
  label: string;
}

export interface Debt {
  id: number;
  label: string;
  lender: string;
  balance: number;
  monthly_payment: number;
  interest_rate: number;
  day_of_month?: number | null;
}

export interface CategoryBudget {
  category: string;
  budget: number;
  /** If set, budget is computed as this % of monthly income instead of a fixed $ */
  percentage?: number | null;
}

export interface BillPayment {
  id: number;
  fixed_expense_id: number;
  month: string;
  paid_at: string;
  /** Set when the payment was auto-matched from a transaction (not manually checked). */
  matched_tx_id?: number | null;
}

export interface CategorizationRule {
  id: number;
  keyword: string;
  category: string;
}

export interface CategoryInsight {
  category: string;
  /** Average spending over the last 3 complete months. */
  avg3m: number;
  /** Average spending over the last 6 complete months. */
  avg6m: number;
  /** Spending in the most-recent analysed month. */
  lastMonth: number;
  /** Trend direction: spending going up, down, or stable vs 6-month baseline. */
  trend: 'up' | 'down' | 'stable';
  /** Suggested monthly budget (rounded to nearest $5). */
  suggestedBudget: number;
}

export interface SpendingInsights {
  avgMonthlyExpenses: number;
  /** Average (income − TSP − Roth − spending) across analysed months. */
  avgMonthlyNet: number;
  suggestedEmergencyFund: number;
  /** Non-investment fixed expenses + active debt payments (current snapshot, not averaged). */
  avgMonthlyCommitted: number;
  monthsAnalyzed: number;
  categoryInsights: CategoryInsight[];
}

// ── Tax year summary ──────────────────────────────────────────────────────────

export interface TaxYearSummary {
  year: number;
  monthsWithData: number;
  // ── Gross income components ───────────────────────────────────────────────
  /** Sum of base_pay across months with data. */
  grossMilitaryPay: number;
  /** Sum of bas + bah (non-taxable military allowances). */
  allowances: number;
  /** Sum of all special & incentive pays (flight, IDP, jump, etc.). */
  specialPays: number;
  /** Total gross income (all INCOME_FIELDS + SPECIAL_PAY_FIELDS). */
  grossTotal: number;
  // ── Pre-tax deductions (reduce taxable income) ────────────────────────────
  /** Roth TSP contributions — post-tax, does NOT reduce taxable income. */
  rothTspContributions: number;
  sgli: number;
  afrh: number;
  mealDeductions: number;
  /** SGLI + AFRH + meal deduction only (Roth TSP is post-tax). */
  totalPreTaxDeductions: number;
  // ── Combat zone exclusion ─────────────────────────────────────────────────
  combatZoneMonths: number;
  /** Base pay in combat-zone months — excluded from taxable income (enlisted). */
  combatZoneExclusion: number;
  // ── Taxes withheld ────────────────────────────────────────────────────────
  federalTaxWithheld: number;
  ficaSocialSecurity: number;
  ficaMedicare: number;
  totalTaxesWithheld: number;
  // ── Estimates ─────────────────────────────────────────────────────────────
  /** grossMilitaryPay + specialPays − sgli − afrh − mealDeductions − combatZoneExclusion (Roth TSP is post-tax, not subtracted) */
  estimatedTaxableIncome: number;
  /** federalTaxWithheld / estimatedTaxableIncome (0 when taxableIncome ≤ 0) */
  effectiveFederalRate: number;
  // ── Post-tax savings ──────────────────────────────────────────────────────
  /** Roth TSP contributions (same as rothTspContributions — shown here for the post-tax savings section). */
  rothIraContributions: number;
  totalPostTaxSavings: number;
}

export type AssetCategory =
  | 'Checking'
  | 'Savings'
  | 'Brokerage'
  | 'Retirement'
  | 'Property'
  | 'Vehicle'
  | 'Other';

export interface Asset {
  id: number;
  label: string;
  category: AssetCategory;
  balance: number;
  updated_at: string;
}

export interface ContributionLimits {
  year: number;
  limitsYear: number;
  tspYtd: number;
  tspLimit: number;
  tspCatchupLimit: number;
  /** DoD automatic + matching contributions YTD (informational — does not count against elective deferral limit). */
  agencyYtd: number;
  iraYtd: number;
  iraLimit: number;
  iraCatchupLimit: number;
  monthsWithData: number;
}

// ── Allotments ────────────────────────────────────────────────────────────────

export type AllotmentType = 'savings' | 'loan' | 'family' | 'insurance' | 'charity' | 'other';

export interface Allotment {
  id: number;
  label: string;
  amount: number;
  type: AllotmentType;
  /** First month allotment is active (YYYY-MM, inclusive) */
  start_date: string;
  /** Last month allotment is active (YYYY-MM, inclusive), null = ongoing */
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export type IncomeProfileType = 'combat_zone' | 'tdy' | 'training' | 'custom';

export interface IncomeProfile {
  id: number;
  name: string;
  type: IncomeProfileType;
  /** First month the profile is active (YYYY-MM, inclusive) */
  start_date: string;
  /** Last month the profile is active (YYYY-MM, inclusive), null = ongoing */
  end_date: string | null;
  /** Income field overrides — subset of income_config keys */
  fields: Record<string, number>;
  notes: string | null;
  created_at: string;
}

export interface NetWorthSnapshot {
  recorded_at: string; // YYYY-MM-DD
  assets: number;
  liabilities: number;
  net_worth: number;
}

export interface HealthScoreComponent {
  name: string;
  score: number;
  max: 25;
  detail: string;
}

export interface HealthScore {
  total: number;
  components: HealthScoreComponent[];
}

// ── Dashboard summary (computed client-side from income + fixed + transactions) ─

export interface Summary {
  totalIncome: number;
  tsp: number;
  investmentFixed: number;
  committed: number;
  spending: number;
  /** Sum of active allotments for the month — deducted from gross pay like TSP. */
  allotments: number;
  net: number;
  savingsRate: number;
}

export interface YtdSummary {
  year: number;
  monthsRecorded: number;
  totalIncome: number;
  totalInvested: number;
  totalSpending: number;
  /** totalIncome − totalInvested − totalSpending */
  netSaved: number;
}

export interface MonthlyPoint {
  month: string;
  income: number;
  invested: number;
  spending: number;
  net: number;
  savingsRate: number;
  hasData: boolean;
  /** True for months after the current month — income is a projection, spending is 0 */
  projected: boolean;
  /** True for months before the user's service start date */
  preService: boolean;
}

export interface QuarterSummary {
  q: number;
  months: string[];
  income: number;
  invested: number;
  spending: number;
  net: number;
  savingsRate: number;
  hasData: boolean;
}

export interface YearOverview {
  year: number;
  annual: {
    income: number;
    invested: number;
    spending: number;
    net: number;
    savingsRate: number;
    monthsWithData: number;
  };
  quarters: QuarterSummary[];
  monthly: MonthlyPoint[];
  categories: { category: string; total: number }[];
}
