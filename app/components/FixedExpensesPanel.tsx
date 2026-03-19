'use client';

// SRP: This component manages fixed monthly expenses only.
// Income sources and deductions live in IncomePanel.

import { useEffect, useState } from 'react';

import type { FixedExpense } from '@/lib/types';
import { api } from '@/lib/api';

export default function FixedExpensesPanel({
  onUpdate,
}: {
  onUpdate: () => void;
}) {
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newAmt, setNewAmt] = useState('');

  useEffect(() => {
    api.fixedExpenses.list().then(setFixed);
  }, []);

  async function addFixed() {
    if (!newLabel.trim() || !newAmt) return;
    const item = await api.fixedExpenses.add(
      newLabel.trim(),
      parseFloat(newAmt),
    );
    setFixed((prev) => [...prev, item]);
    setNewLabel('');
    setNewAmt('');
    onUpdate();
  }

  async function removeFixed(id: number) {
    setFixed((prev) => prev.filter((f) => f.id !== id));
    await api.fixedExpenses.remove(id);
    onUpdate();
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        Fixed monthly expenses
      </h3>
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
    </div>
  );
}
