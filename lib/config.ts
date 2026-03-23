// Central configuration — every hardcoded value lives here.
// To add a category, field, color, or seed entry: edit this file only.

// ─── App meta ─────────────────────────────────────────────────────────────────

export const APP_CONFIG = {
  title: 'Budget tracker',
  subtitle: 'E-3 · 4N0 · JBSA Fort Sam Houston',
  transactionsTabLabel: 'Spending',
} as const;

// ─── Income fields ─────────────────────────────────────────────────────────────

interface FieldConfig {
  readonly key: string;
  readonly label: string;
  readonly note?: string;
}

export const INCOME_FIELDS: FieldConfig[] = [
  { key: 'base_pay', label: 'Base pay', note: 'E-3 < 2 yrs' },
  { key: 'bas', label: 'BAS' },
  { key: 'bah', label: 'BAH', note: 'w/ dependents · San Antonio' },
  { key: 'other', label: 'Other' },
];

export const TSP_CONFIG = {
  rate: 0.2,
  label: 'TSP — 20% of base',
  note: 'C:70 · S:20 · I:10',
} as const;

export const DEDUCTION_FIELDS: FieldConfig[] = [
  { key: 'taxes', label: 'Federal taxes' },
  { key: 'fica_soc_security', label: 'FICA-Soc Security' },
  { key: 'fica_medicare', label: 'FICA-Medicare' },
  { key: 'sgli', label: 'SGLI' },
  { key: 'afrh', label: 'AFRH' },
  { key: 'meal_deduction', label: 'Meal deduction' },
];

// ─── Transaction categories ───────────────────────────────────────────────────

export const CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Subscriptions',
  'Personal care',
  'Entertainment',
  'Wedding',
  'Family',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const DEFAULT_CATEGORY: Category = 'Other';

// Hex colors for charts (Recharts doesn't use Tailwind classes)
export const CHART_CAT_COLORS: Record<string, string> = {
  Food: '#f59e0b',
  Transport: '#3b82f6',
  Shopping: '#a855f7',
  Subscriptions: '#0ea5e9',
  'Personal care': '#ec4899',
  Entertainment: '#6366f1',
  Wedding: '#f43f5e',
  Family: '#f97316',
  Other: '#9ca3af',
};

export const CAT_COLORS: Record<string, string> = {
  Food: 'bg-amber-500/10 text-amber-400',
  Transport: 'bg-blue-500/10 text-blue-400',
  Shopping: 'bg-purple-500/10 text-purple-400',
  Subscriptions: 'bg-sky-500/10 text-sky-400',
  'Personal care': 'bg-pink-500/10 text-pink-400',
  Entertainment: 'bg-indigo-500/10 text-indigo-400',
  Wedding: 'bg-rose-500/10 text-rose-400',
  Family: 'bg-orange-500/10 text-orange-400',
  Other: 'bg-gray-500/10 text-gray-500',
};

// ─── CSV import ───────────────────────────────────────────────────────────────

export const CSV_CATEGORY_MAP: Record<string, string> = {
  // Food
  'food and drink': 'Food',
  'food & drink': 'Food',
  restaurants: 'Food',
  groceries: 'Food',
  grocery: 'Food',
  // Transport
  transportation: 'Transport',
  tolls: 'Transport',
  gas: 'Transport',
  automotive: 'Transport',
  travel: 'Transport',
  // Shopping
  shopping: 'Shopping',
  installment: 'Shopping',
  home: 'Shopping',
  // Entertainment
  entertainment: 'Entertainment',
  // Personal care
  health: 'Personal care',
  'health & wellness': 'Personal care',
  // Subscriptions
  subscriptions: 'Subscriptions',
  utilities: 'Subscriptions',
  'bills & utilities': 'Subscriptions',
  // Family
  family: 'Family',
  // Other
  services: 'Other',
  personal: 'Other',
  'fees & adjustments': 'Other',
};

// ─── Goals ───────────────────────────────────────────────────────────────────

export const GOAL_COLORS = [
  'blue',
  'green',
  'amber',
  'rose',
  'purple',
] as const;

export type GoalColor = (typeof GOAL_COLORS)[number];

export const DEFAULT_GOAL_COLOR: GoalColor = 'blue';

export const GOAL_BAR_COLORS: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  purple: 'bg-purple-400',
};

export const GOAL_DOT_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-400',
  green: 'bg-emerald-500/10 text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-400',
  rose: 'bg-rose-500/10 text-rose-400',
  purple: 'bg-purple-500/10 text-purple-400',
};

// ─── Database seed data ───────────────────────────────────────────────────────

export const SEED_INCOME: Record<string, number> = {
  base_pay: 2836.8,
  bas: 460,
  bah: 0,
  other: 0,
  tsp_rate: 0.2,
  taxes: 158.72,
  fica_soc_security: 175.88,
  fica_medicare: 41.13,
  sgli: 26.0,
  afrh: 0.5,
  meal_deduction: 382.2,
  roth_ira: 583,
};

export const SEED_FIXED_EXPENSES: {
  label: string;
  amount: number;
  period: 'monthly' | 'annual';
}[] = [{ label: 'Phone bill', amount: 250, period: 'annual' }];

export const SEED_PAYMENT_SOURCES = [
  { label: 'Apple Card' },
  { label: 'Cash / Other' },
];

export const SEED_DEBTS = [
  {
    label: 'Car Loan',
    lender: 'Westlake Financial',
    balance: 0,
    monthly_payment: 0,
    interest_rate: 0,
  },
];

export const SEED_GOALS = [
  { name: 'VA loan closing costs', target: 8000, saved: 0, color: 'blue' },
  { name: 'Emergency fund (3 months)', target: 6000, saved: 0, color: 'green' },
  { name: 'Wedding costs', target: 3000, saved: 0, color: 'pink' },
  {
    name: 'Car fund (post tech school)',
    target: 5000,
    saved: 0,
    color: 'amber',
  },
];
