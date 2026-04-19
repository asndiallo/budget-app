'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { CATEGORIES, INPUT_CLS, LABEL_CLS } from '@/lib/config';
import type { CategorizationRule } from '@/lib/types';

export default function AutoCategorizationPanel() {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState<string>(CATEGORIES[0]);

  const reload = () => api.categorizationRules.list().then(setRules);

  useEffect(() => {
    reload();
  }, []);

  async function addRule() {
    if (!newKeyword.trim()) return;
    await api.categorizationRules.add(newKeyword.trim(), newCategory);
    setNewKeyword('');
    reload();
  }

  async function removeRule(id: number) {
    await api.categorizationRules.remove(id);
    reload();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Auto-categorization rules</h3>
        {rules.length > 0 && (
          <span className="text-text-4 text-[10px]">
            {rules.length} rule{rules.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <p className="text-text-4 mb-3 text-[11px]">
        When a transaction description contains a keyword, it's automatically assigned to that
        category on import.
      </p>

      {rules.length > 0 && (
        <div className="mb-4 space-y-1">
          {rules.map((r) => (
            <div
              key={r.id}
              className="bg-bg border-border-dim hover:border-border group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors"
            >
              <code className="text-text flex-1 font-mono text-xs">{r.keyword}</code>
              <span className="text-text-4 text-xs">→</span>
              <span className="text-xs font-medium text-[#4a8cff]">{r.category}</span>
              <button
                onClick={() => removeRule(r.id)}
                className="text-text-4 text-xs opacity-0 transition-colors group-hover:opacity-100 hover:text-[#ff4560]"
                title="Remove rule"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRule()}
          placeholder="keyword (e.g. mcdonald)"
          className={`min-w-32 flex-1 ${INPUT_CLS}`}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="bg-bg border-border text-text cursor-pointer rounded-lg border px-2 py-1.5 text-sm transition-colors focus:border-blue-600 focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={addRule}
          className="border-border text-text-2 hover:text-text rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-[#2d4080]"
        >
          + Add rule
        </button>
      </div>
    </div>
  );
}
