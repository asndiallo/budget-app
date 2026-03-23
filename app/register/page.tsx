'use client';

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const BRANCHES = [
  'Army',
  'Navy',
  'Marine Corps',
  'Air Force',
  'Space Force',
  'Coast Guard',
];
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
  const [branch, setBranch] = useState('Army');
  const [component, setComponent] = useState('Active');
  const [payGrade, setPayGrade] = useState('E-3');
  const [mos, setMos] = useState('');
  const [dutyStation, setDutyStation] = useState('');
  const [bahZip, setBahZip] = useState('');
  const [dependents, setDependents] = useState(0);
  const [yos, setYos] = useState(0);

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
        years_of_service: yos,
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
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text">Budget Tracker</h1>
          <p className="text-sm text-text-3 mt-1">Personal Military Finance</p>
        </div>

        <div className="bg-bg-card border border-border rounded-2xl p-6 shadow-lg">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {(['1', '2'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    step >= Number(s)
                      ? 'bg-blue-600 text-white'
                      : 'bg-bg border border-border text-text-3'
                  }`}
                >
                  {s}
                </div>
                {i === 0 && (
                  <div
                    className={`flex-1 h-px ${step >= 2 ? 'bg-blue-600' : 'bg-border'}`}
                    style={{ width: 80 }}
                  />
                )}
              </div>
            ))}
            <span className="text-xs text-text-3 ml-1">
              {step === 1 ? 'Account' : 'Military Profile'}
            </span>
          </div>

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="block text-xs text-text-3 mb-1">
                  Full name
                </label>
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
                <label className="block text-xs text-text-3 mb-1">Email</label>
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
                <label className="block text-xs text-text-3 mb-1">
                  Password
                </label>
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
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                Next →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-3 mb-1">
                    Branch
                  </label>
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
                  <label className="block text-xs text-text-3 mb-1">
                    Component
                  </label>
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
                  <label className="block text-xs text-text-3 mb-1">
                    Pay grade
                  </label>
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
                  <label className="block text-xs text-text-3 mb-1">
                    Years of service
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={yos}
                    onChange={(e) => setYos(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-3 mb-1">
                  MOS / Rate / AFSC
                </label>
                <input
                  type="text"
                  value={mos}
                  onChange={(e) => setMos(e.target.value)}
                  className={inputCls}
                  placeholder="11B, 4N0X1, 0311…"
                />
              </div>

              <div>
                <label className="block text-xs text-text-3 mb-1">
                  Duty station
                </label>
                <input
                  type="text"
                  value={dutyStation}
                  onChange={(e) => setDutyStation(e.target.value)}
                  className={inputCls}
                  placeholder="Fort Liberty, NC"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-3 mb-1">
                    BAH zip code
                  </label>
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
                  <label className="block text-xs text-text-3 mb-1">
                    Dependents
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={dependents}
                    onChange={(e) => setDependents(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <p className="text-xs text-text-3">
                Pay, BAS, and BAH will be pre-filled from 2026 DoD tables based
                on your profile.
              </p>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border border-border text-text-2 font-medium py-2 rounded-lg text-sm hover:border-text-3 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
                >
                  {loading ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-xs text-text-3 mt-6">
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
