'use client';

import type { HealthScore } from '@/lib/types';
import { LABEL_CLS } from '@/lib/config';

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
    <div className="bg-surface border border-border rounded-xl p-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${grade.color}cc, ${grade.color}33 60%, transparent)`,
        }}
      />
      <div className="flex items-start justify-between mb-3">
        <p className={LABEL_CLS}>
          Financial Health
        </p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: grade.color, background: `${grade.color}18` }}
        >
          {grade.label}
        </span>
      </div>
      <p
        className="text-[22px] font-mono font-semibold leading-none mb-3"
        style={{ color: grade.color }}
      >
        {score.total}
        <span className="text-sm font-normal text-text-4">/100</span>
      </p>
      <div className="space-y-2">
        {score.components.map((c) => (
          <div key={c.name}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-text-3">{c.name}</span>
              <span className="text-[10px] font-mono text-text-2">
                {c.score}
                <span className="text-text-4">/{c.max}</span>
              </span>
            </div>
            <div className="h-1 bg-bg rounded-full overflow-hidden">
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
            <p className="text-[9px] text-text-4 mt-0.5">{c.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
