'use client';

import { useEffect, useState } from 'react';

import { CATEGORIES, INPUT_CLS, LABEL_CLS } from '@/lib/config';
import type { CategorizationRule } from '@/lib/types';
import { api } from '@/lib/api';

export default function AutoCategorizationPanel() {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState<string>(CATEGORIES[0]);

  const reload = () => api.categorizationRules.list().then(setRules);

  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="flex items-center justify-between mb-3">
        <h3 className={LABEL_CLS}>
          Auto-categorization rules
        </h3>
        {rules.length > 0 && (
          <span className="text-[10px] text-text-4">
            {rules.length} rule{rules.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <p className="text-[11px] text-text-4 mb-3">
        When a transaction description contains a keyword, it's automatically
        assigned to that category on import.
      </p>

      {rules.length > 0 && (
        <div className="space-y-1 mb-4">
          {rules.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-bg border border-border-dim hover:border-border transition-colors group"
            >
              <code className="flex-1 text-xs text-text font-mono">
                {r.keyword}
              </code>
              <span className="text-text-4 text-xs">→</span>
              <span className="text-xs text-[#4a8cff] font-medium">
                {r.category}
              </span>
              <button
                onClick={() => removeRule(r.id)}
                className="text-text-4 hover:text-[#ff4560] text-xs transition-colors opacity-0 group-hover:opacity-100"
                title="Remove rule"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <input
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRule()}
          placeholder="keyword (e.g. mcdonald)"
          className={`flex-1 min-w-32 ${INPUT_CLS}`}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="text-sm bg-bg border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={addRule}
          className="text-sm px-3 py-1.5 rounded-lg border border-border text-text-2 hover:border-[#2d4080] hover:text-text transition-colors"
        >
          + Add rule
        </button>
      </div>
    </div>
  );
}
