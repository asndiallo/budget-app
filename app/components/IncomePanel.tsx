'use client';

import { useEffect, useState } from 'react';

interface IncomeConfig {
  base_pay: number;
  bas: number;
  bah: number;
  other: number;
  roth_ira: number;
  taxes: number;
  sgli: number;
}

interface FixedExpense {
  id: number;
  label: string;
  amount: number;
}

export default function IncomePanel({ onUpdate }: { onUpdate: () => void }) {
  const [income, setIncome] = useState<IncomeConfig | null>(null);
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/income')
      .then((r) => r.json())
      .then(setIncome);
    fetch('/api/fixed-expenses')
      .then((r) => r.json())
      .then(setFixed);
  }, []);

  if (!income) return <div className="text-sm text-gray-400">Loading…</div>;

  const tsp = Math.round((income.base_pay || 0) * 0.2);

  async function saveIncome(key: string, value: number) {
    setIncome((prev) => (prev ? { ...prev, [key]: value } : prev));
    await fetch('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    onUpdate();
  }

  async function addFixed() {
    if (!newLabel.trim() || !newAmt) return;
    const res = await fetch('/api/fixed-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: newLabel.trim(),
        amount: parseFloat(newAmt),
      }),
    });
    const item = await res.json();
    setFixed((prev) => [...prev, item]);
    setNewLabel('');
    setNewAmt('');
    onUpdate();
  }

  async function removeFixed(id: number) {
    setFixed((prev) => prev.filter((f) => f.id !== id));
    await fetch('/api/fixed-expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    onUpdate();
  }

  return (
    <div className="space-y-6">
      {/* Military pay */}
      <Section title="Military pay">
        <Row
          label="Base pay"
          note="E-3 < 2 yrs"
          value={income.base_pay}
          onChange={(v) => saveIncome('base_pay', v)}
        />
        <Row
          label="BAS"
          value={income.bas}
          onChange={(v) => saveIncome('bas', v)}
        />
        <Row
          label="BAH"
          note="w/ dependents · San Antonio"
          value={income.bah}
          onChange={(v) => saveIncome('bah', v)}
        />
        <Row
          label="Other"
          value={income.other}
          onChange={(v) => saveIncome('other', v)}
        />
      </Section>

      {/* Deductions */}
      <Section title="Deductions">
        <div className="flex items-center py-2.5 border-b border-gray-100">
          <div className="flex-1">
            <p className="text-sm text-gray-800">TSP — 20% of base</p>
            <p className="text-xs text-gray-400">C:70 · S:20 · I:10</p>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded mr-3">
            auto
          </span>
          <span className="text-sm font-medium text-gray-500 w-24 text-right">
            −${tsp.toLocaleString()}
          </span>
        </div>
        <Row
          label="Roth IRA / month"
          note="Fidelity · FZROX 80 / FZILX 20"
          value={income.roth_ira}
          onChange={(v) => saveIncome('roth_ira', v)}
          prefix="-"
        />
        <Row
          label="Federal taxes (est.)"
          value={income.taxes}
          onChange={(v) => saveIncome('taxes', v)}
          prefix="-"
        />
        <Row
          label="SGLI + other deductions"
          value={income.sgli}
          onChange={(v) => saveIncome('sgli', v)}
          prefix="-"
        />
      </Section>

      {/* Fixed expenses */}
      <Section title="Fixed monthly expenses">
        {fixed.map((f) => (
          <div
            key={f.id}
            className="flex items-center py-2.5 border-b border-gray-100"
          >
            <p className="flex-1 text-sm text-gray-800">{f.label}</p>
            <button
              onClick={() => removeFixed(f.id)}
              className="text-gray-300 hover:text-red-400 text-xs mr-3 transition-colors"
            >
              ✕
            </button>
            <span className="text-sm font-medium text-gray-700 w-24 text-right">
              −${f.amount.toLocaleString()}
            </span>
          </div>
        ))}
        <div className="flex gap-2 mt-3">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            value={newAmt}
            onChange={(e) => setNewAmt(e.target.value)}
            placeholder="$"
            type="number"
            className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={addFixed}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            + Add
          </button>
        </div>
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
