// Shared domain types — used by both API routes (server) and components (client)

export type IncomeConfig = Record<string, number>;

export interface FixedExpense {
  id: number;
  label: string;
  amount: number;
  period: 'monthly' | 'annual';
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

export interface YtdSummary {
  year: number;
  monthsRecorded: number;
  totalIncome: number;
  totalInvested: number;
  totalSpending: number;
  /** totalIncome − totalInvested − totalSpending */
  netSaved: number;
}
