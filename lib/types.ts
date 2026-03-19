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
