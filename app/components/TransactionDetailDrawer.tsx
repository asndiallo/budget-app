'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { ACCOUNT_TYPE_LABELS, BTN_BLUE_CLS, CATEGORIES, INVESTMENT_CATEGORY } from '@/lib/config';
import type { FinancialAccount, Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface Props {
  transaction: Transaction | null;
  accounts: FinancialAccount[];
  onClose: () => void;
  onSaved: () => void;
}

export default function TransactionDetailDrawer({
  transaction,
  accounts,
  onClose,
  onSaved,
}: Props) {
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [taxYear, setTaxYear] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setCategory(transaction.category);
      setNotes(transaction.notes ?? '');
      setAccountId(transaction.account_id ?? null);
      setTaxYear(transaction.tax_year ?? null);
    }
  }, [transaction]);

  if (!transaction) return null;

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const isInvestment = category === INVESTMENT_CATEGORY;
  const isIraAccount = selectedAccount?.type === 'roth_ira' || selectedAccount?.type === 'trad_ira';
  const txYear = parseInt(transaction?.month?.slice(0, 4) ?? '0');

  async function save() {
    if (!transaction) return;
    setSaving(true);
    await api.transactions.update(transaction.id, {
      category,
      notes: notes.trim() || null,
      account_id: accountId,
      tax_year: taxYear,
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  const displayDate = transaction.date
    ? new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : transaction.month;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer panel */}
      <div className="bg-bg border-border relative flex h-full w-full max-w-sm flex-col border-l shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-text text-sm font-semibold">Transaction details</h2>
          <button
            onClick={onClose}
            className="text-text-4 hover:text-text rounded-lg p-1 text-lg leading-none transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Amount + description */}
          <div className="bg-surface rounded-xl px-4 py-3">
            <p
              className={`font-mono text-2xl font-bold ${isInvestment ? 'text-emerald-400' : 'text-text'}`}
            >
              {isInvestment ? '+' : '-'}
              {formatCurrency(transaction.amount)}
            </p>
            <p className="text-text mt-1 text-sm">{transaction.description}</p>
            <p className="text-text-4 mt-1 text-xs">
              {displayDate}
              <span className="mx-1.5">·</span>
              {transaction.source}
            </p>
          </div>

          {/* Investment account badge (shown when linked and category = Investment) */}
          {isInvestment && selectedAccount && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-emerald-400">
                {ACCOUNT_TYPE_LABELS[selectedAccount.type] ?? selectedAccount.type}
              </p>
              <p className="text-text mt-0.5 text-sm font-medium">{selectedAccount.name}</p>
              {selectedAccount.institution && (
                <p className="text-text-4 mt-0.5 text-xs">{selectedAccount.institution}</p>
              )}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="text-text-4 mb-1.5 block text-[11px] font-semibold tracking-widest uppercase">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-surface border-border text-text w-full cursor-pointer rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Account */}
          <div>
            <label className="text-text-4 mb-1.5 block text-[11px] font-semibold tracking-widest uppercase">
              Account
            </label>
            {accounts.length === 0 ? (
              <p className="text-text-4 text-xs">
                No accounts defined yet — add one in &ldquo;Manage accounts&rdquo;.
              </p>
            ) : (
              <select
                value={accountId ?? ''}
                onChange={(e) => setAccountId(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-surface border-border text-text w-full cursor-pointer rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">— None —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.type !== 'other' ? ` (${ACCOUNT_TYPE_LABELS[a.type] ?? a.type})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tax year — only for Investment transactions linked to an IRA account */}
          {isInvestment && isIraAccount && txYear > 0 && (
            <div>
              <label className="text-text-4 mb-1.5 block text-[11px] font-semibold tracking-widest uppercase">
                Tax year
              </label>
              <select
                value={taxYear ?? txYear}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setTaxYear(v === txYear ? null : v);
                }}
                className="bg-surface border-border text-text w-full cursor-pointer rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value={txYear}>{txYear} (transaction year)</option>
                <option value={txYear - 1}>{txYear - 1} (prior year)</option>
              </select>
              {taxYear !== null && taxYear !== txYear && (
                <p className="text-text-4 mt-1.5 text-[11px]">
                  This contribution will count toward your {taxYear} IRS limits.
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-text-4 mb-1.5 block text-[11px] font-semibold tracking-widest uppercase">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              className="bg-surface border-border text-text placeholder-text-4 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Metadata */}
          <div className="border-border border-t pt-4">
            <dl className="space-y-1.5">
              {[
                ['Month', transaction.month],
                ['Source', transaction.source],
                ...(transaction.date ? [['Date', transaction.date]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-text-4 text-xs">{label}</dt>
                  <dd className="text-text-3 font-mono text-xs">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Footer */}
        <div className="border-border flex gap-2 border-t px-4 py-3">
          <button
            onClick={save}
            disabled={saving}
            className={`flex-1 py-2 text-sm font-medium ${BTN_BLUE_CLS} disabled:opacity-50`}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="border-border text-text-3 hover:text-text rounded-lg border px-4 py-2 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
