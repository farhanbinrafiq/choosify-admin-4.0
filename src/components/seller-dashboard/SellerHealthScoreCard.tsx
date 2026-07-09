import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import type { SellerHealthScore } from '../../types/sellerDashboard';
import WidgetShell from './WidgetShell';

type Props = {
  healthScore?: SellerHealthScore;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

const gradeColor: Record<SellerHealthScore['grade'], string> = {
  excellent: 'text-emerald-400',
  good: 'text-sky-400',
  fair: 'text-amber-400',
  needs_attention: 'text-rose-400',
};

export default function SellerHealthScoreCard({ healthScore, loading, error, onRetry }: Props) {
  return (
    <WidgetShell
      title="Seller Health Score"
      subtitle="Operational readiness index"
      loading={loading}
      error={error}
      isEmpty={!healthScore}
      emptyTitle="Health score unavailable"
      emptyMessage="Complete your profile and publish products to generate a health score."
      onRetry={onRetry}
    >
      {healthScore ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-app-accent/10 border border-app-accent/30 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-app-accent" />
            </div>
            <div>
              <div className="text-4xl font-black text-white">{healthScore.score}</div>
              <div className={`text-sm font-bold uppercase tracking-widest ${gradeColor[healthScore.grade]}`}>
                {healthScore.grade.replace('_', ' ')}
              </div>
              {healthScore.isPartiallyEstimated ? (
                <p className="text-[10px] text-app-text-secondary mt-1">Includes estimated factors</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(healthScore.factors).map(([key, value]) => (
              <div key={key} className="p-3 rounded-xl bg-app-bg border border-app-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-app-text-secondary font-bold">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <Activity className="w-3.5 h-3.5 text-app-accent" />
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-app-accent rounded-full" style={{ width: `${value}%` }} />
                </div>
                <div className="text-xs font-mono text-white mt-1">{value}%</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </WidgetShell>
  );
}
