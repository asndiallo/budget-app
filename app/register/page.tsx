'use client';

import { differenceInMonths, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import DatePicker from '@/app/components/DatePicker';
import DutyStationSelect from '@/app/components/DutyStationSelect';
import { authClient } from '@/lib/auth-client';

const BRANCHES = ['Army', 'Navy', 'Marine Corps', 'Air Force', 'Space Force', 'Coast Guard'];
const COMPONENTS = ['Active', 'Reserve', 'National Guard'];
const PAY_GRADES = [
  'E-1',
  'E-2',
  'E-3',
  'E-4',
  'E-5',
  'E-6',
  'E-7',
  'E-8',
  'E-9',
  'W-1',
  'W-2',
  'W-3',
  'W-4',
  'W-5',
  'O-1',
  'O-2',
  'O-3',
  'O-4',
  'O-5',
  'O-6',
  'O-7',
  'O-8',
  'O-9',
  'O-10',
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — account
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 — military profile
  const [branch, setBranch] = useState('Air Force');
  const [component, setComponent] = useState('Active');
  const [payGrade, setPayGrade] = useState('E-3');
  const [mos, setMos] = useState('');
  const [dutyStation, setDutyStation] = useState('JBSA Fort Sam Houston');
  const [bahZip, setBahZip] = useState('');
  const [dependents, setDependents] = useState(0);
  const [joinedAt, setJoinedAt] = useState('');

  function computedYos(): number {
    if (!joinedAt) return 0;
    try {
      const months = differenceInMonths(new Date(), parseISO(joinedAt));
      return Math.round((months / 12) * 2) / 2;
    } catch {
      return 0;
    }
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await authClient.signUp.email({
        name,
        email,
        password,
        // @ts-expect-error — additional fields passed through
        branch,
        component,
        pay_grade: payGrade,
        mos,
        duty_station: dutyStation,
        bah_zip: bahZip,
        dependents,
        years_of_service: computedYos(),
        joined_at: joinedAt,
      });
      if (err) {
        setError(err.message ?? 'Registration failed');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-blue-500 transition-colors';
  const selectCls = inputCls + ' cursor-pointer';

  return (
    <div className="bg-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-text text-2xl font-bold">Budget Tracker</h1>
          <p className="text-text-3 mt-1 text-sm">Personal Military Finance</p>
        </div>

        <div className="bg-bg-card border-border rounded-2xl border p-6 shadow-lg">
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            {(['1', '2'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    step >= Number(s)
                      ? 'bg-blue-600 text-white'
                      : 'bg-bg border-border text-text-3 border'
                  }`}
                >
                  {s}
                </div>
                {i === 0 && (
                  <div
                    className={`h-px flex-1 ${step >= 2 ? 'bg-blue-600' : 'bg-border'}`}
                    style={{ width: 80 }}
                  />
                )}
              </div>
            ))}
            <span className="text-text-3 ml-1 text-xs">
              {step === 1 ? 'Account' : 'Military Profile'}
            </span>
          </div>

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="text-text-3 mb-1 block text-xs">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="Jane Smith"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-text-3 mb-1 block text-xs">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="text-text-3 mb-1 block text-xs">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="••••••••  (min 6 chars)"
                  required
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Next →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-3 mb-1 block text-xs">Branch</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className={selectCls}
                  >
                    {BRANCHES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-text-3 mb-1 block text-xs">Component</label>
                  <select
                    value={component}
                    onChange={(e) => setComponent(e.target.value)}
                    className={selectCls}
                  >
                    {COMPONENTS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-3 mb-1 block text-xs">Pay grade</label>
                  <select
                    value={payGrade}
                    onChange={(e) => setPayGrade(e.target.value)}
                    className={selectCls}
                  >
                    {PAY_GRADES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-text-3 mb-1 block text-xs">Years of service</label>
                  <div className={`${inputCls} text-text-3 bg-surface cursor-default`}>
                    {joinedAt ? `${computedYos()} yrs` : '—'}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-text-3 mb-1 block text-xs">MOS / Rate / AFSC</label>
                <input
                  type="text"
                  value={mos}
                  onChange={(e) => setMos(e.target.value)}
                  className={inputCls}
                  placeholder="11B, 4N0X1, 0311…"
                />
              </div>

              <div>
                <label className="text-text-3 mb-1 block text-xs">Duty station</label>
                <DutyStationSelect value={dutyStation} onChange={setDutyStation} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-3 mb-1 block text-xs">BAH zip code</label>
                  <input
                    type="text"
                    value={bahZip}
                    onChange={(e) => setBahZip(e.target.value)}
                    className={inputCls}
                    placeholder="28307"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="text-text-3 mb-1 block text-xs">Dependents</label>
                  <input
                    type="number"
                    min={0}
                    value={dependents}
                    onChange={(e) => setDependents(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="text-text-3 mb-1 block text-xs">Service start date</label>
                <DatePicker
                  value={joinedAt}
                  onChange={setJoinedAt}
                  placeholder="When did you enlist?"
                />
                <p className="text-text-4 mt-1 text-[10px]">
                  Income won&apos;t be shown for months before this date.
                </p>
              </div>

              <p className="text-text-3 text-xs">
                Pay, BAS, and BAH will be pre-filled from 2026 DoD tables based on your profile.
              </p>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="border-border text-text-2 hover:border-text-3 flex-1 rounded-lg border py-2 text-sm font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          )}

          <p className="text-text-3 mt-6 text-center text-xs">
            Already have an account?{' '}
            <a href="/login" className="text-blue-400 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
