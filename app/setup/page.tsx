'use client';

import {
  BRANCHES,
  COMPONENTS,
  ENLISTED_GRADES,
  OFFICER_GRADES,
  WARRANT_GRADES,
} from '@/lib/pay-tables';
import type { Branch, Component } from '@/lib/types';
import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

type Step = 'credentials' | 'profile' | 'pay-preview';

interface PayPreview {
  basePay: number;
  bas: number;
  bah: number;
  grossMonthly: number;
  rankTitle: string;
  installations: { name: string; state: string }[];
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');

  // Credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Military profile
  const [displayName, setDisplayName] = useState('');
  const [branch, setBranch] = useState<Branch>('Army');
  const [payGrade, setPayGrade] = useState('E-3');
  const [mos, setMos] = useState('');
  const [dutyStation, setDutyStation] = useState('JBSA Fort Sam Houston');
  const [component, setComponent] = useState<Component>('Active');
  const [dependents, setDependents] = useState(0);
  const [yos, setYos] = useState(0);

  const [preview, setPreview] = useState<PayPreview | null>(null);
  const [installations, setInstallations] = useState<
    { name: string; state: string }[]
  >([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load pay preview whenever profile fields change
  useEffect(() => {
    if (step !== 'pay-preview') return;
    const params = new URLSearchParams({
      grade: payGrade,
      yos: String(yos),
      station: dutyStation,
      dependents: String(dependents),
      branch,
    });
    fetch(`/api/pay-lookup?${params}`)
      .then((r) => r.json())
      .then((d: PayPreview) => {
        setPreview(d);
        if (d.installations?.length && installations.length === 0) {
          setInstallations(d.installations);
        }
      })
      .catch(() => {});
  }, [
    step,
    payGrade,
    yos,
    dutyStation,
    dependents,
    branch,
    installations.length,
  ]);

  // Fetch installation list once
  useEffect(() => {
    fetch('/api/pay-lookup?grade=E-3&yos=0&station=&dependents=0&branch=Army')
      .then((r) => r.json())
      .then((d: PayPreview) => setInstallations(d.installations ?? []))
      .catch(() => {});
  }, []);

  function handleCredentialsNext(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setStep('profile');
  }

  function handleProfileNext(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setStep('pay-preview');
  }

  async function handleFinish() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          display_name: displayName || username,
          branch,
          pay_grade: payGrade,
          mos,
          duty_station: dutyStation,
          bah_zip: '',
          component,
          dependents,
          years_of_service: yos,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Registration failed');
        setStep('credentials');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

  const ALL_GRADES = [...ENLISTED_GRADES, ...WARRANT_GRADES, ...OFFICER_GRADES];

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--bg-base) p-4">
      <div className="w-full max-w-lg bg-(--bg-card) border border-border rounded-2xl p-8 shadow-xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="text-3xl mb-2">🎖️</div>
          <h1 className="text-xl font-bold text-(--text-primary)">
            Create Your Account
          </h1>
          <p className="text-sm text-(--text-muted) mt-1">
            {step === 'credentials' && 'Step 1 of 3 — Credentials'}
            {step === 'profile' && 'Step 2 of 3 — Military Profile'}
            {step === 'pay-preview' && 'Step 3 of 3 — Pay Preview'}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 mb-6">
          {(['credentials', 'profile', 'pay-preview'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full ${
                step === s
                  ? 'bg-blue-500'
                  : i <
                      (
                        ['credentials', 'profile', 'pay-preview'] as Step[]
                      ).indexOf(step)
                    ? 'bg-blue-500/40'
                    : 'bg-border'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* ── Step 1: Credentials ── */}
        {step === 'credentials' && (
          <form onSubmit={handleCredentialsNext} className="space-y-4">
            <Field label="Username">
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputCls}
                placeholder="jsmith"
                required
              />
            </Field>
            <Field label="Display name (optional)">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
                placeholder="John Smith"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="Min. 6 characters"
                required
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
                required
              />
            </Field>
            <button type="submit" className={btnCls}>
              Next →
            </button>
          </form>
        )}

        {/* ── Step 2: Military Profile ── */}
        {step === 'profile' && (
          <form onSubmit={handleProfileNext} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Branch">
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value as Branch)}
                  className={inputCls}
                >
                  {BRANCHES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </Field>
              <Field label="Component">
                <select
                  value={component}
                  onChange={(e) => setComponent(e.target.value as Component)}
                  className={inputCls}
                >
                  {COMPONENTS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Pay grade / Rank">
                <select
                  value={payGrade}
                  onChange={(e) => setPayGrade(e.target.value)}
                  className={inputCls}
                >
                  <optgroup label="Enlisted">
                    {ENLISTED_GRADES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Warrant Officer">
                    {WARRANT_GRADES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Officer">
                    {OFFICER_GRADES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              <Field label="Years of service">
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={0.5}
                  value={yos}
                  onChange={(e) => setYos(parseFloat(e.target.value) || 0)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="MOS / Rate / AFSC (job code)">
              <input
                type="text"
                value={mos}
                onChange={(e) => setMos(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="e.g. 11B, 4N0, 0311, 1C2X1"
              />
            </Field>

            <Field label="Duty station">
              <select
                value={dutyStation}
                onChange={(e) => setDutyStation(e.target.value)}
                className={inputCls}
              >
                <option value="">— Other / Off-post —</option>
                {installations.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name} ({i.state})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Dependents">
              <select
                value={dependents}
                onChange={(e) => setDependents(parseInt(e.target.value))}
                className={inputCls}
              >
                <option value={0}>Without dependents</option>
                <option value={1}>With dependents</option>
              </select>
            </Field>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className={`${btnCls} bg-transparent border border-border text-(--text-primary) hover:bg-(--bg-base)`}
              >
                ← Back
              </button>
              <button type="submit" className={btnCls}>
                Next →
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Pay Preview ── */}
        {step === 'pay-preview' && (
          <div className="space-y-5">
            {preview ? (
              <>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-xs text-blue-400 font-medium mb-3">
                    2025 Pay estimate for {preview.rankTitle}
                  </p>
                  <div className="space-y-2">
                    <PayRow label="Base Pay" value={fmt(preview.basePay)} />
                    <PayRow label="BAS" value={fmt(preview.bas)} />
                    <PayRow
                      label={`BAH (${dependents > 0 ? 'w/' : 'w/o'} dependents)`}
                      value={fmt(preview.bah)}
                      note={!dutyStation ? 'No station selected' : undefined}
                    />
                    <div className="border-t border-blue-500/20 pt-2 mt-2">
                      <PayRow
                        label="Gross monthly"
                        value={fmt(preview.grossMonthly)}
                        bold
                      />
                    </div>
                  </div>
                  <p className="text-xs text-(--text-muted) mt-3">
                    These values will pre-fill your income panel. You can adjust
                    them any time.
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-400 font-medium mb-1">
                    Deductions not included above
                  </p>
                  <p className="text-xs text-(--text-muted)">
                    FICA, federal taxes, SGLI, and meal deductions will be
                    estimated and editable in the income panel.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-(--text-muted) text-sm">
                Loading pay preview…
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('profile')}
                className={`${btnCls} bg-transparent border border-border text-(--text-primary) hover:bg-(--bg-base)`}
              >
                ← Back
              </button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className={btnCls}
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-(--text-muted)">
          Already have an account?{' '}
          <a href="/login" className="text-blue-400 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-(--text-muted) mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function PayRow({
  label,
  value,
  note,
  bold,
}: {
  label: string;
  value: string;
  note?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span
        className={`text-sm ${bold ? 'font-semibold text-(--text-primary)' : 'text-(--text-muted)'}`}
      >
        {label}
        {note && <span className="text-xs text-amber-400 ml-1">({note})</span>}
      </span>
      <span
        className={`text-sm font-mono ${bold ? 'font-bold text-blue-400' : 'text-(--text-primary)'}`}
      >
        {value}
      </span>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnCls =
  'flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors';
