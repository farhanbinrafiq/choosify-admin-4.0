import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { SellerInsight } from '../../types/sellerDashboard';
import WidgetShell from './WidgetShell';

type Props = {
  insights?: SellerInsight[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export default function SellerInsightsPanel({ insights, loading, error, onRetry }: Props) {
  return (
    <WidgetShell
      title="Seller Insights"
      subtitle="Signals to improve conversion"
      loading={loading}
      error={error}
      isEmpty={!insights?.length}
      emptyTitle="No insights yet"
      emptyMessage="Insights will appear once enough product activity is available."
      onRetry={onRetry}
    >
      <div className="space-y-3">
        {insights?.map((insight) => (
          <div
            key={insight.id}
            className="p-4 rounded-2xl bg-app-bg border border-app-border flex items-start gap-3"
          >
            <Lightbulb className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-white">{insight.message}</p>
              {insight.productTitle ? (
                <p className="text-xs text-app-accent mt-1">{insight.productTitle}</p>
              ) : null}
              {insight.isPlaceholder ? (
                <p className="text-[10px] text-app-text-secondary mt-2 uppercase tracking-widest">
                  Estimated insight
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
