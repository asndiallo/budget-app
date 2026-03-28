// Shared domain types — used by both API routes (server) and components (client)

// ── User & Auth ───────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user' | 'viewer';
export type Branch =
  | 'Army'
  | 'Navy'
  | 'Air Force'
  | 'Marines'
  | 'Coast Guard'
  | 'Space Force';
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
  monthsAnalyzed: number;
  categoryInsights: CategoryInsight[];
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
