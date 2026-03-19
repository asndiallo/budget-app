// Shared domain types — used by both API routes (server) and components (client)

export type IncomeConfig = Record<string, number>;

export interface FixedExpense {
  id: number;
  label: string;
  amount: number;
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

export interface CsvRow {
  description: string;
  amount: number;
  category: string;
  date: string;
}
