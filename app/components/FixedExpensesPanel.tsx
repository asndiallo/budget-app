'use client';

// SRP: This component manages fixed expenses only.
// Income sources and deductions live in IncomePanel.

import { useEffect, useState } from 'react';

import type { FixedExpense } from '@/lib/types';
import { api } from '@/lib/api';

function monthlyAmount(f: FixedExpense) {
  return f.period === 'annual' ? f.amount / 12 : f.amount;
}

export default function FixedExpensesPanel({
  onUpdate,
}: {
  onUpdate: () => void;
}) {
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [newPeriod, setNewPeriod] = useState<'monthly' | 'annual'>('monthly');

  const reload = () => api.fixedExpenses.list().then(setFixed);

  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addFixed() {
    if (!newLabel.trim() || !newAmt) return;
    await api.fixedExpenses.add(newLabel.trim(), parseFloat(newAmt), newPeriod);
    setNewLabel('');
    setNewAmt('');
    setNewPeriod('monthly');
    reload();
    onUpdate();
  }

  async function removeFixed(id: number) {
    await api.fixedExpenses.remove(id);
    reload();
    onUpdate();
  }

  async function togglePeriod(f: FixedExpense) {
    const period = f.period === 'annual' ? 'monthly' : 'annual';
    await api.fixedExpenses.update(f.id, f.label, f.amount, period);
    reload();
    onUpdate();
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        Fixed expenses
      </h3>
      {fixed.map((f) => {
        const mo = monthlyAmount(f);
        return (
          <div
            key={f.id}
            className="flex items-center py-2.5 border-b border-gray-100 gap-2"
          >
            <p className="flex-1 text-sm text-gray-800">{f.label}</p>
            <button
              onClick={() => togglePeriod(f)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                f.period === 'annual'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-gray-400 hover:border-gray-400'
              }`}
              title="Toggle monthly / annual"
            >
              {f.period === 'annual' ? '/yr' : '/mo'}
            </button>
            <button
              onClick={() => removeFixed(f.id)}
              className="text-gray-300 hover:text-red-400 text-xs transition-colors"
            >
              ✕
            </button>
            <div className="text-right w-28 shrink-0">
              <p className="text-sm font-medium text-gray-700">
                −${f.amount.toLocaleString()}
                {f.period === 'annual' ? '/yr' : ''}
              </p>
              {f.period === 'annual' && (
                <p className="text-xs text-gray-400">${mo.toFixed(2)}/mo</p>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex gap-2 mt-3 flex-wrap">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label"
          className="flex-1 min-w-32 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          value={newAmt}
          onChange={(e) => setNewAmt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFixed()}
          placeholder="$"
          type="number"
          className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={newPeriod}
          onChange={(e) => setNewPeriod(e.target.value as 'monthly' | 'annual')}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="monthly">/mo</option>
          <option value="annual">/yr</option>
        </select>
        <button
          onClick={addFixed}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
