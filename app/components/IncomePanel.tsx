'use client';

// SRP: This component manages income sources and deductions only.
// Fixed expenses live in FixedExpensesPanel.

import { DEDUCTION_FIELDS, INCOME_FIELDS, TSP_CONFIG } from '@/lib/config';
import { useEffect, useState } from 'react';

import type { IncomeConfig } from '@/lib/types';
import { api } from '@/lib/api';

export default function IncomePanel({ onUpdate }: { onUpdate: () => void }) {
  const [income, setIncome] = useState<IncomeConfig | null>(null);

  useEffect(() => {
    api.income.get().then(setIncome);
  }, []);

  if (!income) return <div className="text-sm text-gray-400">Loading…</div>;

  const tsp = Math.round((income.base_pay || 0) * TSP_CONFIG.rate);

  async function saveIncome(key: string, value: number) {
    setIncome((prev) => (prev ? { ...prev, [key]: value } : prev));
    await api.income.update({ [key]: value });
    onUpdate();
  }

  return (
    <div className="space-y-6">
      <Section title="Military pay">
        {INCOME_FIELDS.map((f) => (
          <Row
            key={f.key}
            label={f.label}
            note={f.note}
            value={income[f.key] ?? 0}
            onChange={(v) => saveIncome(f.key, v)}
          />
        ))}
      </Section>

      <Section title="Deductions">
        <div className="flex items-center py-2.5 border-b border-gray-100">
          <div className="flex-1">
            <p className="text-sm text-gray-800">{TSP_CONFIG.label}</p>
            <p className="text-xs text-gray-400">{TSP_CONFIG.note}</p>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded mr-3">
            auto
          </span>
          <span className="text-sm font-medium text-gray-500 w-24 text-right">
            −${tsp.toLocaleString()}
          </span>
        </div>
        {DEDUCTION_FIELDS.map((f) => (
          <Row
            key={f.key}
            label={f.label}
            note={f.note}
            value={income[f.key] ?? 0}
            onChange={(v) => saveIncome(f.key, v)}
            prefix="-"
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  note,
  value,
  onChange,
  prefix = '',
}: {
  label: string;
  note?: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
}) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  return (
    <div className="flex items-center py-2.5 border-b border-gray-100">
      <div className="flex-1">
        <p className="text-sm text-gray-800">{label}</p>
        {note && <p className="text-xs text-gray-400">{note}</p>}
      </div>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
        <span className="text-sm text-gray-400">$</span>
        <input
          type="number"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(parseFloat(local) || 0)}
          className="w-24 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
