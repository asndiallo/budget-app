'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import {
  BTN_BLUE_CLS,
  CAT_COLORS,
  CATEGORIES,
  DEFAULT_CATEGORY,
  INPUT_CLS,
  LABEL_CLS,
} from '@/lib/config';
import type { PaymentSource, Transaction } from '@/lib/types';
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
  const [filterCat, setFilterCat] = useState<string | null>(initialCategory ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Transaction[] | null>(null);
  const [period, setPeriod] = useState<'all' | '1' | '2'>('all');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [managingCards, setManagingCards] = useState(false);
  const [newCard, setNewCard] = useState('');
  const [undoTx, setUndoTx] = useState<{
    id: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkCat, setBulkCat] = useState<string>(CATEGORIES[0]);
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
  const [pendingRows, setPendingRows] = useState<
    { description: string; amount: number; category: string; date: string }[]
  >([]);
  const [committing, setCommitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadImportHistory = () => api.importHistory.list().then(setImportHistory);

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
  }, []);

  async function addTx() {
    if (!desc.trim() || !amt) return;
    const tx = await api.transactions.add({
      description: desc.trim(),
      amount: parseFloat(amt),
      category: cat,
      month,
      source,
    });
    setDesc('');
    setAmt('');
    if (undoTx) clearTimeout(undoTx.timer);
    const timer = setTimeout(() => setUndoTx(null), 6000);
    setUndoTx({ id: tx.id, timer });
    reloadTxs();
    onUpdate();
  }

  async function handleUndoAdd() {
    if (!undoTx) return;
    clearTimeout(undoTx.timer);
    setUndoTx(null);
    await api.transactions.remove(undoTx.id);
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

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id)),
    );
  }

  async function bulkDelete() {
    if (!selectedIds.size) return;
    await api.transactions.bulkDelete([...selectedIds]);
    setSelectedIds(new Set());
    setSelectMode(false);
    reloadTxs();
    onUpdate();
  }

  async function bulkRecategorize() {
    if (!selectedIds.size) return;
    await api.transactions.bulkRecategorize([...selectedIds], bulkCat);
    setSelectedIds(new Set());
    setSelectMode(false);
    reloadTxs();
    onUpdate();
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');

    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());

    const creditDebitIdx = headers.findIndex((h) => h === 'credit debit indicator');
    const isNavyFed = creditDebitIdx >= 0 && headers.some((h) => h === 'type group');
    const debitIdx = headers.findIndex((h) => h === 'debit');
    const creditIdx = headers.findIndex((h) => h === 'credit');
    const isCapitalOne = debitIdx >= 0 && creditIdx >= 0 && !isNavyFed;
    // USAA: has 'original description' and 'status' columns
    const origDescIdx = headers.findIndex((h) => h === 'original description');
    const statusIdx = headers.findIndex((h) => h === 'status');
    const isUsaa = origDescIdx >= 0 && statusIdx >= 0;
    // BofA bank: has 'running bal.' column
    const runningBalIdx = headers.findIndex((h) => h.includes('running bal'));
    const isBofaBank = runningBalIdx >= 0;
    // BofA credit: has 'reference number' and 'payee' columns
    const refNumIdx = headers.findIndex((h) => h === 'reference number');
    const payeeIdx = headers.findIndex((h) => h === 'payee');
    const isBofaCredit = refNumIdx >= 0 && payeeIdx >= 0;

    const dateIdx = headers.findIndex((h) => h.includes('transaction date') || h === 'date');
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
        vals[merchantIdx >= 0 ? merchantIdx : descIdx >= 0 ? descIdx : 2] || 'Unknown';
      const isTaptap = description.toLowerCase().includes('taptap');

      if (isUsaa) {
        // USAA: negative amounts = debits (expenses), positive = credits
        const rawAmt = (vals[amtIdx >= 0 ? amtIdx : vals.length - 2] || '0').replace(
          /[^0-9.-]/g,
          '',
        );
        const rawNum = parseFloat(rawAmt);
        if (rawNum >= 0) continue; // skip credits/deposits
        const amount = Math.abs(rawNum);
        const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';
        const category = isTaptap ? 'Family' : vals[catIdx >= 0 ? catIdx : 3] || DEFAULT_CATEGORY;
        if (amount > 0) rows.push({ description, amount, category, date });
        continue;
      }

      if (isBofaBank) {
        // BofA bank: Date, Description, Amount, Running Bal.
        // negative Amount = withdrawal (expense)
        const rawAmt = (vals[2] || '0').replace(/[^0-9.-]/g, '');
        const rawNum = parseFloat(rawAmt);
        if (rawNum >= 0) continue; // skip deposits
        const amount = Math.abs(rawNum);
        const date = vals[0] || '';
        if (amount > 0)
          rows.push({
            description: vals[1] || 'Unknown',
            amount,
            category: DEFAULT_CATEGORY,
            date,
          });
        continue;
      }

      if (isBofaCredit) {
        // BofA credit: Transaction Date, Posted Date, Reference Number, Payee, Address, Amount
        // negative Amount = charge (expense)
        const rawAmt = (vals[amtIdx >= 0 ? amtIdx : vals.length - 1] || '0').replace(
          /[^0-9.-]/g,
          '',
        );
        const rawNum = parseFloat(rawAmt);
        if (rawNum >= 0) continue; // skip payments/credits
        const amount = Math.abs(rawNum);
        const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';
        const desc = vals[payeeIdx] || 'Unknown';
        if (amount > 0) rows.push({ description: desc, amount, category: DEFAULT_CATEGORY, date });
        continue;
      }

      if (isCapitalOne) {
        // Skip credits/payments — only keep rows with a debit value
        const debitVal = vals[debitIdx]?.trim();
        if (!debitVal) continue;
        const capCat = (vals[catIdx] || '').toLowerCase();
        if (capCat === 'payment/credit') continue;
        const amount = Math.abs(parseFloat(debitVal.replace(/[^0-9.-]/g, '')));
        const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';
        const category = isTaptap ? 'Family' : vals[catIdx] || DEFAULT_CATEGORY;
        if (amount > 0) rows.push({ description, amount, category, date });
        continue;
      }

      if (isNavyFed) {
        const indicator = (vals[creditDebitIdx] || '').toLowerCase();
        if (indicator === 'credit') continue;
        if (!isTaptap) continue;
      } else {
        const type = (vals[typeIdx] || '').toLowerCase();
        if (['payment', 'return', 'reversal', 'adjustment'].includes(type)) continue;
      }

      const amount = Math.abs(
        parseFloat((vals[amtIdx >= 0 ? amtIdx : vals.length - 1] || '0').replace(/[^0-9.-]/g, '')),
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

    setImporting(false);
    setPendingRows(rows);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function applyPendingImport() {
    if (!pendingRows.length) return;
    setCommitting(true);
    const data = await api.transactions.importCsv(pendingRows, month, csvSource);
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
    const billsMsg =
      data.billsMatched > 0
        ? ` · ${data.billsMatched} bill${data.billsMatched !== 1 ? 's' : ''} auto-matched`
        : '';
    setImportMsg(
      `Imported ${data.imported} transaction${data.imported !== 1 ? 's' : ''}` +
        (monthLabels ? ` · ${monthLabels}` : '') +
        billsMsg,
    );
    setPendingRows([]);
    setCommitting(false);
    reloadTxs();
    reloadImportHistory();
    onUpdate();
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
    const iso = src.match(/^\d{4}-\d{2}-(\d{2})/);
    if (iso) return parseInt(iso[1]);
    const us = src.match(/^\d{1,2}\/(\d{1,2})\/\d{4}/);
    if (us) return parseInt(us[1]);
    return null;
  }

  function exportCsv(rows: Transaction[], m: string, catFilter: string | null) {
    const header = 'Date,Description,Amount,Category,Source,Notes';
    const lines = rows.map((t) => {
      const date = t.date || t.created_at.slice(0, 10);
      const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
      const notes = t.notes ? `"${t.notes.replace(/"/g, '""')}"` : '';
      return [date, desc, t.amount.toFixed(2), t.category, t.source, notes].join(',');
    });
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${m}${catFilter ? `-${catFilter}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isSearching = searchResults !== null;
  const displayTxs = isSearching ? searchResults : txs;

  const periodFiltered =
    isSearching || period === 'all'
      ? displayTxs
      : displayTxs.filter((t) => {
          const day = txDayOfMonth(t);
          if (day === null) return true;
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
      {/* CSV import card */}
      <div className="bg-bg border-border rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-text text-sm font-semibold">Import CSV</p>
            <p className="text-text-3 mt-0.5 text-xs">
              Apple Card · Chase · Capital One · Navy Federal · USAA · BofA
            </p>
            {sources.length > 0 && (
              <select
                value={csvSource}
                onChange={(e) => setCsvSource(e.target.value)}
                className="bg-surface border-border text-text-2 mt-2 cursor-pointer rounded-lg border px-2 py-1 text-xs transition-colors focus:border-blue-600 focus:outline-none"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <label className="shrink-0 cursor-pointer">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm whitespace-nowrap transition-all ${
                importing
                  ? 'border-border text-text-3'
                  : 'border-border text-text-2 hover:bg-surface-blue/40 hover:border-[#4a8cff]/40 hover:text-[#4a8cff]'
              }`}
            >
              {importing ? (
                <>
                  <span className="opacity-50">↻</span> Importing…
                </>
              ) : (
                <>↑ Upload CSV</>
              )}
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
          <p className="mt-2.5 flex items-center gap-1.5 font-mono text-xs text-[#00d98a]">
            <span>✓</span> {importMsg}
          </p>
        )}
      </div>

      {/* CSV review grid */}
      {pendingRows.length > 0 && (
        <div className="bg-bg border-border overflow-hidden rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-text text-sm font-semibold">Review import</p>
              <p className="text-text-3 mt-0.5 text-xs">
                {pendingRows.length} transaction
                {pendingRows.length !== 1 ? 's' : ''} ·{' '}
                <span className="text-amber-400">
                  {
                    pendingRows.filter(
                      (r) => r.category === DEFAULT_CATEGORY || r.category === 'Other',
                    ).length
                  }{' '}
                  uncategorized
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPendingRows([])}
                className="border-border text-text-3 hover:text-text-2 rounded-lg border px-3 py-1.5 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyPendingImport}
                disabled={committing}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                {committing ? 'Importing…' : `Import ${pendingRows.length}`}
              </button>
            </div>
          </div>
          {/* Column headers */}
          <div className="bg-surface-raised border-border-dim grid grid-cols-[90px_1fr_80px_140px] gap-2 border-b px-4 py-2">
            <span className="text-text-4 text-[10px] font-semibold tracking-wider uppercase">
              Date
            </span>
            <span className="text-text-4 text-[10px] font-semibold tracking-wider uppercase">
              Description
            </span>
            <span className="text-text-4 text-right text-[10px] font-semibold tracking-wider uppercase">
              Amount
            </span>
            <span className="text-text-4 text-[10px] font-semibold tracking-wider uppercase">
              Category
            </span>
          </div>
          <div className="divide-border-dim max-h-80 divide-y overflow-y-auto">
            {pendingRows.map((row, i) => {
              const isUncategorized = row.category === DEFAULT_CATEGORY || row.category === 'Other';
              return (
                <div
                  key={i}
                  className={`grid grid-cols-[90px_1fr_80px_140px] items-center gap-2 px-4 py-2 transition-colors ${
                    isUncategorized ? 'bg-amber-500/5' : 'hover:bg-surface/40'
                  }`}
                >
                  <span className="text-text-4 truncate font-mono text-[11px]">
                    {row.date || '—'}
                  </span>
                  <span className="text-text truncate text-xs" title={row.description}>
                    {row.description}
                  </span>
                  <span className="text-text text-right font-mono text-xs">
                    ${row.amount.toFixed(2)}
                  </span>
                  <select
                    value={row.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setPendingRows((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, category: cat } : r)),
                      );
                    }}
                    className={`bg-surface cursor-pointer rounded-lg border px-2 py-1 text-xs transition-colors focus:border-blue-500 focus:outline-none ${
                      isUncategorized
                        ? 'border-amber-500/40 text-amber-400'
                        : 'border-border text-text'
                    }`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Import history */}
      {importHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowImportHistory((v) => !v)}
            className="text-text-3 hover:text-text-2 flex items-center gap-1 text-xs transition-colors"
          >
            <span className="text-[10px]">{showImportHistory ? '▾' : '▸'}</span>
            Recent imports
            <span className="text-text-4 ml-0.5 font-mono">({importHistory.length})</span>
          </button>
          {showImportHistory && (
            <div className="bg-bg border-border divide-border-dim mt-2 divide-y overflow-hidden rounded-xl border">
              {importHistory.map((imp) => {
                const label =
                  imp.min_month === imp.max_month
                    ? imp.min_month
                    : `${imp.min_month} – ${imp.max_month}`;
                const when = new Date(imp.imported_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={imp.import_id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="text-text text-xs font-medium">{imp.source}</span>
                      <span className="text-text-4 ml-2 text-xs">
                        {imp.count} txns · {label} · {when}
                      </span>
                    </div>
                    <button
                      onClick={() => undoImport(imp.import_id)}
                      className="text-text-3 shrink-0 text-xs transition-colors hover:text-[#ff4560]"
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
          className="text-text-3 hover:text-text-2 flex items-center gap-1 text-xs transition-colors"
        >
          <span className="text-[10px]">{managingCards ? '▾' : '▸'}</span>
          Manage cards
        </button>
        {managingCards && (
          <div className="bg-bg border-border mt-2 space-y-2 rounded-xl border p-3">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-text text-sm">{s.label}</span>
                <button
                  onClick={() => removeCard(s.id)}
                  className="text-text-3 text-xs transition-colors hover:text-[#ff4560]"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="mt-2 flex gap-2">
              <input
                value={newCard}
                onChange={(e) => setNewCard(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCard()}
                placeholder="Card name"
                className="bg-surface border-border text-text placeholder-text-4 flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors focus:border-blue-600 focus:outline-none"
              />
              <button onClick={addCard} className={`px-3 py-1.5 text-sm ${BTN_BLUE_CLS}`}>
                + Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="text-text-4 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm select-none">
          ⌕
        </span>
        <input
          data-search-input
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search all transactions…"
          className="bg-bg border-border text-text placeholder-text-4 w-full rounded-xl border py-2 pr-4 pl-8 text-sm transition-colors focus:border-blue-600 focus:outline-none"
        />
        {isSearching && (
          <span className="text-text-4 absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[10px]">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Pay period toggle */}
      {!isSearching && (
        <div className="flex items-center gap-1">
          <span className="text-text-4 mr-1 text-[10px] font-semibold tracking-widest uppercase">
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
              className={`rounded-lg border px-2.5 py-1 text-xs transition-all ${
                period === key
                  ? 'bg-surface-raised border-border text-text font-medium'
                  : 'text-text-4 hover:text-text-3 border-transparent'
              }`}
            >
              {label}
              {total !== null && total > 0 && (
                <span className="text-text-4 ml-1 font-mono">
                  ${Math.round(total).toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Category filter chips */}
      {Object.keys(catTotals).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCat(null)}
            className={`rounded-full border px-3 py-1 text-xs transition-all ${
              !filterCat
                ? 'bg-text text-bg border-text font-medium'
                : 'border-border text-text-3 hover:border-border hover:text-text-2'
            }`}
          >
            All · ${Math.round(grandTotal).toLocaleString()}
          </button>
          {Object.entries(catTotals)
            .sort(([, a], [, b]) => b - a)
            .map(([c, total]) => (
              <button
                key={c}
                onClick={() => setFilterCat(filterCat === c ? null : c)}
                className={`rounded-full border px-3 py-1 text-xs transition-all ${
                  filterCat === c
                    ? `${CAT_COLORS[c] ?? 'bg-gray-500/10 text-gray-500'} border-current`
                    : 'border-border text-text-3 hover:text-text-2'
                }`}
              >
                {c} · ${Math.round(total).toLocaleString()}
              </button>
            ))}
        </div>
      )}

      {/* Transaction list */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className={LABEL_CLS}>{isSearching ? 'Search results' : 'Transactions'}</h3>
          <div className="flex items-center gap-3">
            {filtered.length > 0 && !selectMode && (
              <>
                <button
                  onClick={() => exportCsv(filtered, month, filterCat)}
                  className="text-text-4 hover:text-text-2 text-[10px] transition-colors"
                  title="Export visible transactions as CSV"
                >
                  ↓ CSV
                </button>
                <button
                  onClick={() => setSelectMode(true)}
                  className="text-text-4 hover:text-text-2 text-[10px] transition-colors"
                >
                  Select
                </button>
              </>
            )}
            {selectMode && (
              <button
                onClick={exitSelectMode}
                className="text-text-4 hover:text-text-2 text-[10px] transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectMode && filtered.length > 0 && (
          <div className="bg-surface border-border mb-3 flex items-center gap-3 rounded-xl border px-3 py-2">
            <input
              type="checkbox"
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="cursor-pointer accent-[#4a8cff]"
            />
            <span className="text-text-3 flex-1 text-xs">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
            </span>
            {selectedIds.size > 0 && (
              <>
                <select
                  value={bulkCat}
                  onChange={(e) => setBulkCat(e.target.value)}
                  className="bg-bg border-border text-text cursor-pointer rounded-lg border px-2 py-1 text-xs transition-colors focus:border-blue-600 focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={bulkRecategorize}
                  className={`px-2.5 py-1 text-xs ${BTN_BLUE_CLS} whitespace-nowrap`}
                >
                  Re-categorize
                </button>
                <button
                  onClick={bulkDelete}
                  className="rounded-lg border border-[#ff4560]/20 px-2.5 py-1 text-xs text-[#ff4560] transition-colors hover:bg-[#ff4560]/10"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {filtered.length === 0 && (
          <p className="text-text-3 py-4 text-sm">
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
            selectMode={selectMode}
            selected={selectedIds.has(t.id)}
            onToggleSelect={() => toggleSelect(t.id)}
            onUpdate={(data) => updateTx(t.id, data)}
            onDelete={() => deleteTx(t.id)}
          />
        ))}
      </div>

      {/* Undo toast */}
      {undoTx && (
        <div className="bg-surface border-border animate-in fade-in flex items-center gap-3 rounded-xl border px-3 py-2 text-xs">
          <span className="text-text-2">Transaction added</span>
          <button
            onClick={handleUndoAdd}
            className="ml-auto font-medium text-[#4a8cff] transition-colors hover:text-[#4a8cff]/80"
          >
            Undo
          </button>
        </div>
      )}

      {/* Add transaction */}
      <div>
        <h3 className={`${LABEL_CLS} mb-3`}>Add manually</h3>
        <div className="flex flex-wrap gap-2">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTx()}
            placeholder="Description"
            className={`min-w-40 flex-1 ${INPUT_CLS}`}
          />
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTx()}
            placeholder="$"
            type="number"
            className={`w-20 font-mono ${INPUT_CLS}`}
          />
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className={`${INPUT_CLS} cursor-pointer`}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={`${INPUT_CLS} cursor-pointer`}
          >
            <option value="manual">Manual</option>
            {sources.map((s) => (
              <option key={s.id} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
          <button onClick={addTx} className={`px-3 py-1.5 text-sm ${BTN_BLUE_CLS}`}>
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
  selectMode,
  selected,
  onToggleSelect,
  onUpdate,
  onDelete,
}: {
  tx: Transaction;
  showMonth?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onUpdate: (
    data: Partial<Pick<Transaction, 'description' | 'amount' | 'category' | 'notes'>>,
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
    if (desc.trim() && desc !== tx.description) onUpdate({ description: desc.trim() });
  }, [desc, tx.description, onUpdate]);

  const saveAmt = useCallback(() => {
    setEditingAmt(false);
    const n = parseFloat(amt);
    if (!isNaN(n) && n !== tx.amount) onUpdate({ amount: n });
  }, [amt, tx.amount, onUpdate]);

  return (
    <div
      className={`border-border-dim group flex items-center gap-3 border-b py-2.5 ${selected ? 'bg-surface-blue/20' : ''}`}
      onClick={selectMode ? onToggleSelect : undefined}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-pointer accent-[#4a8cff]"
        />
      )}
      <div className="min-w-0 flex-1">
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
            className="text-text w-full border-b border-[#4a8cff]/50 bg-transparent text-sm outline-none"
          />
        ) : (
          <p
            className="text-text hover:text-text-2 cursor-pointer truncate text-sm transition-colors"
            onClick={() => setEditingDesc(true)}
            title="Click to edit"
          >
            {tx.description}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-2">
          <select
            value={tx.category}
            onChange={(e) => onUpdate({ category: e.target.value })}
            className={`cursor-pointer rounded-full border-0 px-2 py-0.5 text-xs ${CAT_COLORS[tx.category] ?? CAT_COLORS[DEFAULT_CATEGORY]}`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {tx.source !== 'manual' && <span className="text-text-4 text-xs">{tx.source}</span>}
          {showMonth && <span className="text-text-4 font-mono text-xs">{tx.month}</span>}
        </div>

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
            className="text-text-3 placeholder-text-4 mt-1 w-full border-b border-[#4a8cff]/40 bg-transparent text-xs outline-none"
          />
        ) : tx.notes ? (
          <p
            className="text-text-4 hover:text-text-3 mt-1 cursor-pointer text-xs italic transition-colors"
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
          className="text-text w-20 border-b border-[#4a8cff]/50 bg-transparent text-right font-mono text-sm outline-none"
        />
      ) : (
        <span
          className="hover:text-text-2 cursor-pointer font-mono text-sm whitespace-nowrap text-[#ff4560] transition-colors"
          onClick={() => setEditingAmt(true)}
          title="Click to edit"
        >
          −${tx.amount.toLocaleString()}
        </span>
      )}

      {!selectMode && (
        <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
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
            className="text-text-3 text-xs transition-colors hover:text-[#ff4560]"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
