import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSellerDashboard } from '../../hooks/useSellerDashboard';
import SellerActionCenter from './SellerActionCenter';
import SellerHealthScoreCard from './SellerHealthScoreCard';
import SellerInsightsPanel from './SellerInsightsPanel';
import SellerInventoryAlerts from './SellerInventoryAlerts';
import SellerNotificationWidget from './SellerNotificationWidget';
import SellerOverviewCards from './SellerOverviewCards';
import SellerPerformancePanel from './SellerPerformancePanel';
import SellerProductIntelligenceTable from './SellerProductIntelligenceTable';

export default function SellerBusinessIntelligence() {
  const { profile } = useAuth();
  const sellerId = profile?.id || 'seller_001';
  const { data, loading, error, refresh, range, setRange } = useSellerDashboard({
    sellerId,
    sellerName: profile?.displayName,
    storeName: profile?.displayName,
    range: '7d',
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-white">Business Intelligence</h3>
          <p className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">
            Actionable insights for {profile?.displayName || 'your store'}
          </p>
        </div>
        <div className="flex gap-2 p-1 bg-app-bg border border-app-border rounded-xl">
          {(['7d', '30d', '90d'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                range === option
                  ? 'bg-app-accent text-white'
                  : 'text-app-text-secondary hover:text-white'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <SellerOverviewCards
        overview={data?.overview}
        loading={loading}
        error={error}
        onRetry={refresh}
      />

      <SellerPerformancePanel
        performance={data?.performance}
        loading={loading}
        error={error}
        onRetry={refresh}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <SellerProductIntelligenceTable
            products={data?.products}
            loading={loading}
            error={error}
            onRetry={refresh}
          />
          <SellerInsightsPanel
            insights={data?.insights}
            loading={loading}
            error={error}
            onRetry={refresh}
          />
        </div>

        <div className="space-y-8">
          <SellerHealthScoreCard
            healthScore={data?.healthScore}
            loading={loading}
            error={error}
            onRetry={refresh}
          />
          <SellerActionCenter
            actions={data?.actionCenter}
            loading={loading}
            error={error}
            onRetry={refresh}
          />
          <SellerInventoryAlerts
            alerts={data?.inventoryAlerts}
            loading={loading}
            error={error}
            onRetry={refresh}
          />
          <SellerNotificationWidget
            notifications={data?.notifications}
            loading={loading}
            error={error}
            onRetry={refresh}
          />
        </div>
      </div>
    </div>
  );
}
