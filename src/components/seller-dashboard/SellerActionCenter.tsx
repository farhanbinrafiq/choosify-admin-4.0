import React from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import type { SellerActionRecommendation } from '../../types/sellerDashboard';
import WidgetShell from './WidgetShell';

type Props = {
  actions?: SellerActionRecommendation[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

const priorityStyles = {
  high: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  medium: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  low: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
};

export default function SellerActionCenter({ actions, loading, error, onRetry }: Props) {
  return (
    <WidgetShell
      title="Action Center"
      subtitle="Recommended next steps"
      loading={loading}
      error={error}
      isEmpty={!actions?.length}
      emptyTitle="No actions needed"
      emptyMessage="Your store looks healthy. Check back after new activity."
      onRetry={onRetry}
    >
      <div className="space-y-3">
        {actions?.map((action) => (
          <div
            key={action.id}
            className="p-4 rounded-2xl bg-app-bg border border-app-border hover:border-app-accent/30 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${priorityStyles[action.priority]}`}
                  >
                    {action.priority}
                  </span>
                  <h4 className="text-sm font-bold text-white">{action.title}</h4>
                </div>
                <p className="text-xs text-app-text-secondary">{action.reason}</p>
                <p className="text-xs text-app-accent mt-2 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  {action.suggestedAction}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-app-text-secondary shrink-0 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
