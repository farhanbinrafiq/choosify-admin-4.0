import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { SellerInventoryAlert } from '../../types/sellerDashboard';
import WidgetShell from './WidgetShell';

type Props = {
  alerts?: SellerInventoryAlert[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

const typeLabels: Record<SellerInventoryAlert['type'], string> = {
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  hidden: 'Hidden Products',
  rejected: 'Rejected Products',
  pending_review: 'Pending Review',
  draft: 'Draft Products',
};

export default function SellerInventoryAlerts({ alerts, loading, error, onRetry }: Props) {
  return (
    <WidgetShell
      title="Inventory Alerts"
      subtitle="Listing health and stock risks"
      loading={loading}
      error={error}
      isEmpty={!alerts?.length}
      emptyTitle="No inventory alerts"
      emptyMessage="All products are healthy. No stock or review issues detected."
      onRetry={onRetry}
    >
      <div className="space-y-3">
        {alerts?.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-app-bg border border-app-border"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                {typeLabels[alert.type]}
              </div>
              <div className="text-sm font-bold text-white truncate">{alert.productTitle}</div>
              <div className="text-xs text-app-text-secondary">{alert.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
