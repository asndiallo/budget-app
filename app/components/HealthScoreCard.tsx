'use client';

import { LABEL_CLS } from '@/lib/config';
import type { HealthScore } from '@/lib/types';

export default function HealthScoreCard({ score }: { score: HealthScore }) {
  const grade =
    score.total >= 85
      ? { label: 'Excellent', color: '#00d98a' }
      : score.total >= 70
        ? { label: 'Good', color: '#4a8cff' }
        : score.total >= 50
          ? { label: 'Fair', color: '#f5aa2a' }
          : { label: 'Needs work', color: '#ff4560' };

  return (
    <div className="bg-surface border-border relative overflow-hidden rounded-xl border p-4">
      <div
        className="absolute top-0 right-0 left-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${grade.color}cc, ${grade.color}33 60%, transparent)`,
        }}
      />
      <div className="mb-3 flex items-start justify-between">
        <p className={LABEL_CLS}>Financial Health</p>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ color: grade.color, background: `${grade.color}18` }}
        >
          {grade.label}
        </span>
      </div>
      <p
        className="mb-3 font-mono text-[22px] leading-none font-semibold"
        style={{ color: grade.color }}
      >
        {score.total}
        <span className="text-text-4 text-sm font-normal">/100</span>
      </p>
      <div className="space-y-2">
        {score.components.map((c) => (
          <div key={c.name}>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-text-3 text-[10px]">{c.name}</span>
              <span className="text-text-2 font-mono text-[10px]">
                {c.score}
                <span className="text-text-4">/{c.max}</span>
              </span>
            </div>
            <div className="bg-bg h-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(c.score / c.max) * 100}%`,
                  backgroundColor:
                    c.score >= 20
                      ? '#00d98a'
                      : c.score >= 12
                        ? '#4a8cff'
                        : c.score >= 6
                          ? '#f5aa2a'
                          : '#ff4560',
                }}
              />
            </div>
            <p className="text-text-4 mt-0.5 text-[9px]">{c.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
