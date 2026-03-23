'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { BRANCHES, COMPONENTS, ENLISTED_GRADES, WARRANT_GRADES, OFFICER_GRADES } from '@/lib/pay-tables';
import type { Branch, Component } from '@/lib/types';

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
  const [displayName, setDisplayName] = useState(user.display_name);
  const [branch, setBranch] = useState<Branch>(user.branch);
  const [payGrade, setPayGrade] = useState(user.pay_grade);
  const [mos, setMos] = useState(user.mos);
  const [dutyStation, setDutyStation] = useState(user.duty_station);
  const [component, setComponent] = useState<Component>(user.component);
  const [dependents, setDependents] = useState(user.dependents);
  const [yos, setYos] = useState(user.years_of_service);
  const [reseedIncome, setReseedIncome] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
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
          display_name: displayName,
          branch,
          pay_grade: payGrade,
          mos,
          duty_station: dutyStation,
          component,
          dependents,
          years_of_service: yos,
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

  const gradeLabel = `${user.pay_grade} · ${user.branch}`;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setPanel(panel === 'profile' ? 'none' : 'profile')}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-card)] transition-colors border border-transparent hover:border-[var(--border)]"
      >
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
          {(user.display_name || user.username).charAt(0).toUpperCase()}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">
            {user.display_name || user.username}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] leading-tight">{gradeLabel}</p>
        </div>
        <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {panel === 'profile' && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-50 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Military Profile</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' :
              user.role === 'viewer' ? 'bg-gray-500/20 text-gray-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {user.role}
            </span>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Branch</label>
                <select value={branch} onChange={(e) => setBranch(e.target.value as Branch)} className={inputCls}>
                  {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Component</label>
                <select value={component} onChange={(e) => setComponent(e.target.value as Component)} className={inputCls}>
                  {COMPONENTS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Pay grade</label>
                <select value={payGrade} onChange={(e) => setPayGrade(e.target.value)} className={inputCls}>
                  <optgroup label="Enlisted">
                    {ENLISTED_GRADES.map((g) => <option key={g}>{g}</option>)}
                  </optgroup>
                  <optgroup label="Warrant">
                    {WARRANT_GRADES.map((g) => <option key={g}>{g}</option>)}
                  </optgroup>
                  <optgroup label="Officer">
                    {OFFICER_GRADES.map((g) => <option key={g}>{g}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">YOS</label>
                <input type="number" min={0} max={40} step={0.5} value={yos} onChange={(e) => setYos(parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Duty station</label>
              <input value={dutyStation} onChange={(e) => setDutyStation(e.target.value)} className={inputCls} placeholder="e.g. JBSA Fort Sam Houston" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">MOS / Rate</label>
                <input value={mos} onChange={(e) => setMos(e.target.value.toUpperCase())} className={inputCls} placeholder="4N0" />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Dependents</label>
                <select value={dependents} onChange={(e) => setDependents(parseInt(e.target.value))} className={inputCls}>
                  <option value={0}>Without</option>
                  <option value={1}>With</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={reseedIncome} onChange={(e) => setReseedIncome(e.target.checked)} className="rounded" />
              <span className="text-xs text-[var(--text-muted)]">Update income from 2025 pay tables</span>
            </label>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex-1 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              <button type="button" onClick={handleLogout} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-400 transition-colors">
                Sign out
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full px-2 py-1 text-xs rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500';
