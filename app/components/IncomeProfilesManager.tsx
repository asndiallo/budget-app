'use client';

import {
  BTN_BLUE_CLS,
  INCOME_PROFILE_FIELD_OPTIONS,
  INCOME_PROFILE_TYPES,
  INPUT_CLS,
  LABEL_CLS,
} from '@/lib/config';
import type { IncomeProfile, IncomeProfileType } from '@/lib/types';

import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonth(ym: string) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function profileColor(type: IncomeProfileType) {
  return INCOME_PROFILE_TYPES[type]?.color ?? '#b085f5';
}

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  INCOME_PROFILE_FIELD_OPTIONS.map((f) => [f.key, f.label]),
);

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: IncomeProfileType }) {
  const cfg = INCOME_PROFILE_TYPES[type] ?? INCOME_PROFILE_TYPES.custom;
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: cfg.color + '22', color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

/** Inline add/remove field override editor. */
function FieldOverrideEditor({
  fields,
  onChange,
}: {
  fields: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const [addKey, setAddKey] = useState('');
  const [addVal, setAddVal] = useState('');
  const usedKeys = Object.keys(fields);
  const availableOptions = INCOME_PROFILE_FIELD_OPTIONS.filter(
    (o) => !usedKeys.includes(o.key),
  );

  function add() {
    if (!addKey || addVal === '') return;
    onChange({ ...fields, [addKey]: parseFloat(addVal) || 0 });
    setAddKey('');
    setAddVal('');
  }

  function remove(key: string) {
    const next = { ...fields };
    delete next[key];
    onChange(next);
  }

  function updateVal(key: string, raw: string) {
    onChange({ ...fields, [key]: parseFloat(raw) || 0 });
  }

  return (
    <div className="space-y-1.5">
      {usedKeys.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-text-2 truncate">
            {FIELD_LABEL[key] ?? key}
          </span>
          <span className="text-[11px] text-text-4">$</span>
          <input
            type="number"
            defaultValue={fields[key]}
            onBlur={(e) => updateVal(key, e.target.value)}
            className="w-20 text-xs text-right font-mono bg-bg border border-border rounded px-2 py-0.5 text-text focus:outline-none focus:border-blue-600"
          />
          <button
            onClick={() => remove(key)}
            className="text-text-4 hover:text-[#ff4560] text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      ))}

      {availableOptions.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={addKey}
            onChange={(e) => setAddKey(e.target.value)}
            className={`flex-1 text-xs ${INPUT_CLS} py-1`}
          >
            <option value="">+ add field override…</option>
            {availableOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {addKey && (
            <>
              <span className="text-[11px] text-text-4">$</span>
              <input
                type="number"
                value={addVal}
                onChange={(e) => setAddVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="0"
                className="w-20 text-xs text-right font-mono bg-bg border border-border rounded px-2 py-0.5 text-text focus:outline-none focus:border-blue-600"
              />
              <button
                onClick={add}
                className="text-[11px] px-2 py-0.5 rounded bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors"
              >
                Add
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Inline create/edit form. */
function ProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<IncomeProfile>;
  onSave: (data: Omit<IncomeProfile, 'id' | 'created_at'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<IncomeProfileType>(
    initial?.type ?? 'custom',
  );
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [ongoing, setOngoing] = useState(!initial?.end_date);
  const [fields, setFields] = useState<Record<string, number>>(
    initial?.fields ?? {},
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function handleTypeChange(t: IncomeProfileType) {
    setType(t);
    // Pre-populate default fields only when creating (not editing)
    if (!initial?.id) {
      setFields(INCOME_PROFILE_TYPES[t].defaultFields ?? {});
    }
  }

  function submit() {
    if (!name.trim() || !startDate) return;
    onSave({
      name: name.trim(),
      type,
      start_date: startDate,
      end_date: ongoing ? null : endDate || null,
      fields,
      notes: notes.trim() || null,
    });
  }

  const hint = INCOME_PROFILE_TYPES[type]?.hint;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      {/* Name + type */}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Profile name…"
          className={`flex-1 text-sm ${INPUT_CLS}`}
        />
        <select
          value={type}
          onChange={(e) =>
            handleTypeChange(e.target.value as IncomeProfileType)
          }
          className={`text-sm ${INPUT_CLS}`}
        >
          {Object.entries(INCOME_PROFILE_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {hint && <p className="text-[11px] text-text-4">{hint}</p>}

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-3">From</span>
          <input
            type="month"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`text-sm ${INPUT_CLS} py-1`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-3">to</span>
          {ongoing ? (
            <span className="text-[11px] text-text-3 italic">ongoing</span>
          ) : (
            <input
              type="month"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`text-sm ${INPUT_CLS} py-1`}
            />
          )}
          <label className="flex items-center gap-1 text-[11px] text-text-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ongoing}
              onChange={(e) => setOngoing(e.target.checked)}
              className="accent-[#4a8cff]"
            />
            ongoing
          </label>
        </div>
      </div>

      {/* Field overrides */}
      <div>
        <p className={`${LABEL_CLS} mb-2`}>Field overrides</p>
        <FieldOverrideEditor fields={fields} onChange={setFields} />
        {Object.keys(fields).length === 0 && (
          <p className="text-[11px] text-text-4 mt-1">
            No overrides — applying this profile has no effect on income fields
            (useful for notes only).
          </p>
        )}
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className={`w-full text-sm resize-none ${INPUT_CLS}`}
      />

      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={!name.trim() || !startDate}
          className={`text-sm px-3 py-1.5 ${BTN_BLUE_CLS} disabled:opacity-40`}
        >
          {initial?.id ? 'Save changes' : 'Create profile'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm px-3 py-1.5 rounded-lg text-text-3 hover:text-text-2 hover:bg-surface-raised transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IncomeProfilesManager({
  profiles,
  onRefresh,
}: {
  profiles: IncomeProfile[];
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleCreate(data: Omit<IncomeProfile, 'id' | 'created_at'>) {
    await api.incomeProfiles.create(data);
    setShowCreate(false);
    onRefresh();
  }

  async function handleUpdate(
    id: number,
    data: Omit<IncomeProfile, 'id' | 'created_at'>,
  ) {
    await api.incomeProfiles.update(id, data);
    setEditingId(null);
    onRefresh();
  }

  async function handleDelete(id: number) {
    await api.incomeProfiles.remove(id);
    onRefresh();
  }

  return (
    <div className="space-y-3">
      {/* Profile list */}
      {profiles.length === 0 && !showCreate && (
        <p className="text-[11px] text-text-4">
          No profiles yet — create one to track deployments, TDY, or other
          income changes with a date range.
        </p>
      )}

      {profiles.map((p) =>
        editingId === p.id ? (
          <ProfileForm
            key={p.id}
            initial={p}
            onSave={(data) => handleUpdate(p.id, data)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <ProfileCard
            key={p.id}
            profile={p}
            onEdit={() => setEditingId(p.id)}
            onDelete={() => handleDelete(p.id)}
          />
        ),
      )}

      {/* Create form / button */}
      {showCreate ? (
        <ProfileForm
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="text-[11px] px-3 py-1.5 rounded-lg border border-dashed border-border text-text-3 hover:text-text-2 hover:border-border-focus transition-colors w-full"
        >
          + New profile
        </button>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: IncomeProfile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = profileColor(profile.type);
  const fieldCount = Object.keys(profile.fields).length;

  return (
    <div className="rounded-xl border border-border p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text">{profile.name}</span>
          <TypeBadge type={profile.type} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="text-[11px] px-2 py-0.5 rounded text-text-3 hover:text-text-2 hover:bg-surface-raised transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-[11px] px-2 py-0.5 rounded text-text-4 hover:text-[#ff4560] hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <p className="text-[11px] text-text-3">
        {fmtMonth(profile.start_date)}
        {' — '}
        {profile.end_date ? fmtMonth(profile.end_date) : 'ongoing'}
      </p>

      {fieldCount > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
          {Object.entries(profile.fields).map(([k, v]) => (
            <span key={k} className="text-[10px] font-mono" style={{ color }}>
              {FIELD_LABEL[k] ?? k}:{' '}
              {k === 'combat_zone' ? (v ? 'on' : 'off') : formatCurrency(v)}
            </span>
          ))}
        </div>
      )}

      {profile.notes && (
        <p className="text-[11px] text-text-4 italic">{profile.notes}</p>
      )}
    </div>
  );
}
