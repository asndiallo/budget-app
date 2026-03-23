'use client';

import { CATEGORIES, CAT_COLORS, DEFAULT_CATEGORY } from '@/lib/config';
import type { PaymentSource, Transaction } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

import MonthlyBudgetStatus from './MonthlyBudgetStatus';
import { api } from '@/lib/api';
import { parseCSVLine } from '@/lib/utils';

export default function TransactionsPanel({
  month,
  onUpdate,
  initialCategory,
}: {
  month: string;
  onUpdate: () => void;
  initialCategory?: string | null;
}) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [sources, setSources] = useState<PaymentSource[]>([]);
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState<string>(CATEGORIES[0]);
  const [source, setSource] = useState('manual');
  const [csvSource, setCsvSource] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(
    initialCategory ?? null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Transaction[] | null>(
    null,
  );
  const [period, setPeriod] = useState<'all' | '1' | '2'>('all');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [managingCards, setManagingCards] = useState(false);
  const [newCard, setNewCard] = useState('');
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [importHistory, setImportHistory] = useState<
    {
      import_id: string;
      source: string;
      count: number;
      min_month: string;
      max_month: string;
      imported_at: string;
    }[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadImportHistory = () =>
    api.importHistory.list().then(setImportHistory);

  // Sync initialCategory when drill-through arrives
  useEffect(() => {
    if (initialCategory) setFilterCat(initialCategory);
  }, [initialCategory]);

  const reloadTxs = () => api.transactions.list(month).then(setTxs);
  const reloadSources = () =>
    api.paymentSources.list().then((s) => {
      setSources(s);
      if (s.length > 0) {
        setCsvSource((prev) => prev || s[0].label);
      }
    });

  useEffect(() => {
    reloadTxs();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reloadSources();
    reloadImportHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addTx() {
    if (!desc.trim() || !amt) return;
    await api.transactions.add({
      description: desc.trim(),
      amount: parseFloat(amt),
      category: cat,
      month,
      source,
    });
    setDesc('');
    setAmt('');
    reloadTxs();
    onUpdate();
  }

  async function updateTx(
    id: number,
    data: Partial<Pick<Transaction, 'description' | 'amount' | 'category'>>,
  ) {
    await api.transactions.update(id, data);
    reloadTxs();
    onUpdate();
  }

  async function deleteTx(id: number) {
    await api.transactions.remove(id);
    reloadTxs();
    onUpdate();
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');

    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0]
      .split(',')
      .map((h) => h.replace(/"/g, '').trim().toLowerCase());

    const creditDebitIdx = headers.findIndex(
      (h) => h === 'credit debit indicator',
    );
    const isNavyFed =
      creditDebitIdx >= 0 && headers.some((h) => h === 'type group');

    const dateIdx = headers.findIndex(
      (h) => h.includes('transaction date') || h === 'date',
    );
    const merchantIdx = headers.findIndex((h) => h === 'merchant');
    const descIdx = headers.findIndex((h) => h === 'description');
    const catIdx = headers.findIndex((h) => h === 'category');
    const typeIdx = headers.findIndex((h) => h === 'type');
    const amtIdx = headers.findIndex((h) => h.includes('amount'));

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (vals.length < 2) continue;

      const description =
        vals[merchantIdx >= 0 ? merchantIdx : descIdx >= 0 ? descIdx : 2] ||
        'Unknown';
      const isTaptap = description.toLowerCase().includes('taptap');

      if (isNavyFed) {
        const indicator = (vals[creditDebitIdx] || '').toLowerCase();
        if (indicator === 'credit') continue;
        if (!isTaptap) continue;
      } else {
        const type = (vals[typeIdx] || '').toLowerCase();
        if (['payment', 'return', 'reversal', 'adjustment'].includes(type))
          continue;
      }

      const amount = Math.abs(
        parseFloat(
          (vals[amtIdx >= 0 ? amtIdx : vals.length - 1] || '0').replace(
            /[^0-9.-]/g,
            '',
          ),
        ),
      );
      const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';

      let category: string;
      if (isTaptap) {
        category = 'Family';
      } else {
        category = vals[catIdx >= 0 ? catIdx : 4] || DEFAULT_CATEGORY;
      }

      if (amount > 0) rows.push({ description, amount, category, date });
    }

    const data = await api.transactions.importCsv(rows, month, csvSource);
    const monthLabels = (data.months ?? [])
      .sort()
      .map((m) => {
        const [y, mo] = m.split('-');
        return new Date(+y, +mo - 1).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });
      })
      .join(', ');
    setImportMsg(
      `Imported ${data.imported} transaction${data.imported !== 1 ? 's' : ''}` +
        (monthLabels ? ` · ${monthLabels}` : ''),
    );
    setImporting(false);
    reloadTxs();
    reloadImportHistory();
    onUpdate();
    if (fileRef.current) fileRef.current.value = '';
  }

  async function addCard() {
    if (!newCard.trim()) return;
    await api.paymentSources.add(newCard.trim());
    setNewCard('');
    reloadSources();
  }

  async function removeCard(id: number) {
    await api.paymentSources.remove(id);
    reloadSources();
  }

  async function undoImport(importId: string) {
    await api.importHistory.remove(importId);
    reloadTxs();
    reloadImportHistory();
    onUpdate();
  }

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    searchRef.current = setTimeout(() => {
      api.transactions.search(q).then(setSearchResults);
    }, 300);
  }

  const catTotals = txs.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  function txDayOfMonth(t: Transaction): number | null {
    const src = t.date || t.created_at;
    if (!src) return null;
    // ISO: YYYY-MM-DD
    const iso = src.match(/^\d{4}-\d{2}-(\d{2})/);
    if (iso) return parseInt(iso[1]);
    // US: MM/DD/YYYY or M/D/YYYY
    const us = src.match(/^\d{1,2}\/(\d{1,2})\/\d{4}/);
    if (us) return parseInt(us[1]);
    return null;
  }

  const isSearching = searchResults !== null;
  const displayTxs = isSearching ? searchResults : txs;

  const periodFiltered =
    isSearching || period === 'all'
      ? displayTxs
      : displayTxs.filter((t) => {
          const day = txDayOfMonth(t);
          if (day === null) return true; // no date → show in all periods
          return period === '1' ? day <= 15 : day > 15;
        });

  const filtered = filterCat
    ? periodFiltered.filter((t) => t.category === filterCat)
    : periodFiltered;
  const grandTotal = txs.reduce((s, t) => s + t.amount, 0);

  const p1Total = txs
    .filter((t) => {
      const d = txDayOfMonth(t);
      return d !== null && d <= 15;
    })
    .reduce((s, t) => s + t.amount, 0);
  const p2Total = txs
    .filter((t) => {
      const d = txDayOfMonth(t);
      return d !== null && d > 15;
    })
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      {/* CSV import */}
      <div className="bg-bg rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-text">Import CSV</p>
            <p className="text-xs text-text-3 mt-0.5">
              Apple Card · Chase · Navy Federal
            </p>
            {sources.length > 0 && (
              <select
                value={csvSource}
                onChange={(e) => setCsvSource(e.target.value)}
                className="mt-2 text-xs bg-surface border border-border rounded-lg px-2 py-1 text-text-2 focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <label className="cursor-pointer shrink-0">
            <span className="inline-block text-sm px-3 py-1.5 rounded-lg border border-border text-text-2 hover:border-[#2d4080] hover:text-text transition-colors whitespace-nowrap">
              {importing ? 'Importing…' : 'Upload CSV'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvUpload}
            />
          </label>
        </div>
        {importMsg && (
          <p className="text-xs text-[#00d98a] mt-2 font-mono">{importMsg}</p>
        )}
      </div>

      {/* Import history */}
      {importHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowImportHistory((v) => !v)}
            className="text-xs text-text-3 hover:text-text-2 transition-colors"
          >
            {showImportHistory ? '▾ Hide' : '▸ Recent imports'}{' '}
            <span className="text-text-4">({importHistory.length})</span>
          </button>
          {showImportHistory && (
            <div className="mt-2 bg-bg border border-border rounded-xl divide-y divide-border-dim overflow-hidden">
              {importHistory.map((imp) => {
                const label =
                  imp.min_month === imp.max_month
                    ? imp.min_month
                    : `${imp.min_month} – ${imp.max_month}`;
                const when = new Date(imp.imported_at).toLocaleDateString(
                  'en-US',
                  {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                );
                return (
                  <div
                    key={imp.import_id}
                    className="flex items-center justify-between px-3 py-2 gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-xs text-text">{imp.source}</span>
                      <span className="text-xs text-text-4 ml-2">
                        {imp.count} txns · {label} · {when}
                      </span>
                    </div>
                    <button
                      onClick={() => undoImport(imp.import_id)}
                      className="text-xs text-text-3 hover:text-[#ff4560] transition-colors shrink-0"
                      title="Remove this import batch"
                    >
                      Undo
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manage cards */}
      <div>
        <button
          onClick={() => setManagingCards((v) => !v)}
          className="text-xs text-text-3 hover:text-text-2 transition-colors"
        >
          {managingCards ? '▾ Hide cards' : '▸ Manage cards'}
        </button>
        {managingCards && (
          <div className="mt-2 bg-bg border border-border rounded-xl p-3 space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-sm text-text">{s.label}</span>
                <button
                  onClick={() => removeCard(s.id)}
                  className="text-text-3 hover:text-[#ff4560] text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                value={newCard}
                onChange={(e) => setNewCard(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCard()}
                placeholder="Card name"
                className="flex-1 text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
              />
              <button
                onClick={addCard}
                className="text-sm px-3 py-1.5 rounded-lg bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors"
              >
                + Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-4 text-xs pointer-events-none">
          ⌕
        </span>
        <input
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search all transactions…"
          className="w-full text-sm bg-bg border border-border rounded-xl pl-7 pr-4 py-2 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
        />
        {isSearching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-4">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Budget vs actual (hidden in search mode) */}
      {!isSearching && <MonthlyBudgetStatus month={month} />}

      {/* Pay period toggle (hidden in search mode) */}
      {!isSearching && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-4 mr-1">
            Period
          </span>
          {[
            { key: 'all' as const, label: 'All', total: null },
            { key: '1' as const, label: '1st–15th', total: p1Total },
            { key: '2' as const, label: '16th–end', total: p2Total },
          ].map(({ key, label, total }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                period === key
                  ? 'bg-surface-raised border-border text-text font-medium'
                  : 'border-transparent text-text-4 hover:text-text-3'
              }`}
            >
              {label}
              {total !== null && total > 0 && (
                <span className="ml-1 font-mono text-text-4">
                  ${Math.round(total).toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Category filter chips */}
      {Object.keys(catTotals).length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCat(null)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              !filterCat
                ? 'bg-text text-bg border-text font-medium'
                : 'border-border text-text-3 hover:border-[#2d4080] hover:text-text-2'
            }`}
          >
            All · ${Math.round(grandTotal).toLocaleString()}
          </button>
          {Object.entries(catTotals).map(([c, total]) => (
            <button
              key={c}
              onClick={() => setFilterCat(filterCat === c ? null : c)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                filterCat === c
                  ? 'bg-text text-bg border-text font-medium'
                  : 'border-border text-text-3 hover:border-[#2d4080] hover:text-text-2'
              }`}
            >
              {c} · ${Math.round(total).toLocaleString()}
            </button>
          ))}
        </div>
      )}

      {/* Transaction list */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-3">
          {isSearching ? `Search results` : 'Transactions'}
        </h3>
        {filtered.length === 0 && (
          <p className="text-sm text-text-3 py-4">
            {isSearching
              ? 'No transactions match your search.'
              : 'No transactions yet for this month.'}
          </p>
        )}
        {filtered.map((t) => (
          <TxRow
            key={t.id}
            tx={t}
            showMonth={isSearching}
            onUpdate={(data) => updateTx(t.id, data)}
            onDelete={() => deleteTx(t.id)}
          />
        ))}
      </div>

      {/* Add transaction */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-3">
          Add manually
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTx()}
            placeholder="Description"
            className="flex-1 min-w-40 text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTx()}
            placeholder="$"
            type="number"
            className="w-20 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
          >
            <option value="manual">Manual</option>
            {sources.map((s) => (
              <option key={s.id} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={addTx}
            className="text-sm px-3 py-1.5 rounded-lg bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

function TxRow({
  tx,
  showMonth,
  onUpdate,
  onDelete,
}: {
  tx: Transaction;
  showMonth?: boolean;
  onUpdate: (
    data: Partial<
      Pick<Transaction, 'description' | 'amount' | 'category' | 'notes'>
    >,
  ) => void;
  onDelete: () => void;
}) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingAmt, setEditingAmt] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [desc, setDesc] = useState(tx.description);
  const [amt, setAmt] = useState(String(tx.amount));
  const [notes, setNotes] = useState(tx.notes ?? '');

  useEffect(() => {
    setDesc(tx.description);
  }, [tx.description]);
  useEffect(() => {
    setAmt(String(tx.amount));
  }, [tx.amount]);
  useEffect(() => {
    setNotes(tx.notes ?? '');
  }, [tx.notes]);

  const saveDesc = useCallback(() => {
    setEditingDesc(false);
    if (desc.trim() && desc !== tx.description)
      onUpdate({ description: desc.trim() });
  }, [desc, tx.description, onUpdate]);

  const saveAmt = useCallback(() => {
    setEditingAmt(false);
    const n = parseFloat(amt);
    if (!isNaN(n) && n !== tx.amount) onUpdate({ amount: n });
  }, [amt, tx.amount, onUpdate]);

  return (
    <div className="flex items-center py-2.5 border-b border-border-dim gap-3 group">
      <div className="flex-1 min-w-0">
        {editingDesc ? (
          <input
            autoFocus
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={saveDesc}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveDesc();
              if (e.key === 'Escape') {
                setDesc(tx.description);
                setEditingDesc(false);
              }
            }}
            className="w-full text-sm border-b border-[#4a8cff]/50 bg-transparent outline-none text-text"
          />
        ) : (
          <p
            className="text-sm text-text truncate cursor-pointer hover:text-text-2 transition-colors"
            onClick={() => setEditingDesc(true)}
            title="Click to edit"
          >
            {tx.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <select
            value={tx.category}
            onChange={(e) => onUpdate({ category: e.target.value })}
            className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${CAT_COLORS[tx.category] ?? CAT_COLORS[DEFAULT_CATEGORY]}`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {tx.source !== 'manual' && (
            <span className="text-xs text-text-3">{tx.source}</span>
          )}
          {showMonth && (
            <span className="text-xs font-mono text-text-4">{tx.month}</span>
          )}
        </div>

        {/* Notes */}
        {editingNotes ? (
          <input
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              onUpdate({ notes: notes.trim() || null });
              setEditingNotes(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onUpdate({ notes: notes.trim() || null });
                setEditingNotes(false);
              }
              if (e.key === 'Escape') {
                setNotes(tx.notes ?? '');
                setEditingNotes(false);
              }
            }}
            placeholder="Add a note…"
            className="mt-1 w-full text-xs border-b border-[#4a8cff]/40 bg-transparent outline-none text-text-3 placeholder-text-4"
          />
        ) : tx.notes ? (
          <p
            className="mt-1 text-xs text-text-4 italic cursor-pointer hover:text-text-3 transition-colors"
            onClick={() => setEditingNotes(true)}
          >
            {tx.notes}
          </p>
        ) : null}
      </div>

      {editingAmt ? (
        <input
          autoFocus
          type="number"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          onBlur={saveAmt}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveAmt();
            if (e.key === 'Escape') {
              setAmt(String(tx.amount));
              setEditingAmt(false);
            }
          }}
          className="w-20 text-sm text-right font-mono border-b border-[#4a8cff]/50 bg-transparent outline-none text-text"
        />
      ) : (
        <span
          className="font-mono text-sm text-[#ff4560] cursor-pointer hover:text-text-2 transition-colors whitespace-nowrap"
          onClick={() => setEditingAmt(true)}
          title="Click to edit"
        >
          −${tx.amount.toLocaleString()}
        </span>
      )}

      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!editingNotes && (
          <button
            onClick={() => setEditingNotes(true)}
            title={tx.notes ? 'Edit note' : 'Add note'}
            className="text-text-4 hover:text-text-3 text-xs transition-colors"
          >
            ✎
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-text-3 hover:text-[#ff4560] text-xs transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
