'use client';

import { differenceInMonths, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { authClient } from '@/lib/auth-client';
import {
  BRANCHES,
  COMPONENTS,
  ENLISTED_GRADES,
  OFFICER_GRADES,
  WARRANT_GRADES,
} from '@/lib/pay-tables';
import type { Branch, Component, UserProfile } from '@/lib/types';

import DatePicker from './DatePicker';
import DutyStationSelect from './DutyStationSelect';

interface Props {
  user: UserProfile;
  onProfileUpdate: () => void;
}

type Panel = 'none' | 'profile';

export default function UserNav({ user, onProfileUpdate }: Props) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>('none');
  const [saving, setSaving] = useState(false);

  // Edit state
  const [displayName, setDisplayName] = useState(user.name);
  const [branch, setBranch] = useState<Branch>(user.branch);
  const [payGrade, setPayGrade] = useState(user.pay_grade);
  const [mos, setMos] = useState(user.mos);
  const [dutyStation, setDutyStation] = useState(user.duty_station);
  const [component, setComponent] = useState<Component>(user.component);
  const [dependents, setDependents] = useState(user.dependents);
  const [joinedAt, setJoinedAt] = useState(user.joined_at ?? '');
  const [reseedIncome, setReseedIncome] = useState(false);

  async function handleLogout() {
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          branch,
          pay_grade: payGrade,
          mos,
          duty_station: dutyStation,
          component,
          dependents,
          years_of_service: computedYos(),
          joined_at: joinedAt,
          reseed_income: reseedIncome,
        }),
      });
      setPanel('none');
      setReseedIncome(false);
      onProfileUpdate();
    } finally {
      setSaving(false);
    }
  }

  /** Years of service derived from join date, rounded to nearest 0.5 */
  function computedYos(): number {
    if (!joinedAt) return 0;
    try {
      const months = differenceInMonths(new Date(), parseISO(joinedAt));
      return Math.round((months / 12) * 2) / 2; // nearest 0.5
    } catch {
      return 0;
    }
  }

  const gradeLabel = `${user.pay_grade} · ${user.branch}`;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setPanel(panel === 'profile' ? 'none' : 'profile')}
        className="hover:bg-surface-raised hover:border-border flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-text text-xs leading-tight font-medium">{user.name || user.email}</p>
          <p className="text-text-3 text-[10px] leading-tight">{gradeLabel}</p>
        </div>
        <svg className="text-text-3 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {panel === 'profile' && (
        <div className="bg-surface border-border absolute top-full right-0 z-50 mt-2 w-80 rounded-xl border p-4 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-text text-sm font-semibold">Military Profile</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                user.role === 'admin'
                  ? 'bg-amber-500/20 text-amber-400'
                  : user.role === 'viewer'
                    ? 'bg-gray-500/20 text-gray-400'
                    : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {user.role}
            </span>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="text-text-3 mb-0.5 block text-[10px]">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-text-3 mb-0.5 block text-[10px]">Branch</label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value as Branch)}
                  className={inputCls}
                >
                  {BRANCHES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-text-3 mb-0.5 block text-[10px]">Component</label>
                <select
                  value={component}
                  onChange={(e) => setComponent(e.target.value as Component)}
                  className={inputCls}
                >
                  {COMPONENTS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-text-3 mb-0.5 block text-[10px]">Pay grade</label>
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
                  <optgroup label="Warrant">
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
              </div>
              <div>
                <label className="text-text-3 mb-0.5 block text-[10px]">Years of service</label>
                <div
                  className={`${inputCls} text-text-3 bg-surface-raised cursor-default select-none`}
                >
                  {joinedAt ? `${computedYos()} yrs` : '—'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-text-3 mb-0.5 block text-[10px]">Service start</label>
                <DatePicker value={joinedAt} onChange={setJoinedAt} placeholder="Select date" />
              </div>
              <div>
                <label className="text-text-3 mb-0.5 block text-[10px]">Dependents</label>
                <select
                  value={dependents}
                  onChange={(e) => setDependents(parseInt(e.target.value))}
                  className={inputCls}
                >
                  <option value={0}>Without</option>
                  <option value={1}>With</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-text-3 mb-0.5 block text-[10px]">Duty station</label>
              <DutyStationSelect value={dutyStation} onChange={setDutyStation} />
            </div>

            <div>
              <label className="text-text-3 mb-0.5 block text-[10px]">MOS / Rate / AFSC</label>
              <input
                value={mos}
                onChange={(e) => setMos(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="4N0"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={reseedIncome}
                onChange={(e) => setReseedIncome(e.target.checked)}
                className="accent-[#4a8cff]"
              />
              <span className="text-text-3 text-xs">Recalculate income from pay tables</span>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="border-border text-text-3 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:border-[#ff4560]/40 hover:text-[#ff4560]"
              >
                Sign out
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full px-2 py-1 text-xs rounded-lg bg-bg border border-border text-text focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors';
