import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SellerPerformanceCharts } from '../../types/sellerDashboard';
import WidgetShell from './WidgetShell';

type Props = {
  performance?: SellerPerformanceCharts;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

const tooltipStyle = {
  backgroundColor: '#0A0E1A',
  border: '1px solid #1E293B',
  borderRadius: '12px',
};

export default function SellerPerformancePanel({ performance, loading, error, onRetry }: Props) {
  const isEmpty = !performance;

  return (
    <WidgetShell
      title="Seller Performance"
      subtitle="Traffic and product momentum"
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle="No performance data"
      emptyMessage="Performance charts will populate after product activity is detected."
      onRetry={onRetry}
    >
      {performance ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Daily Product Views</h4>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performance.dailyProductViews}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                    <XAxis dataKey="date" stroke="#888" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#888" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="views" stroke="#F4631E" fill="#F4631E22" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-4">Weekly Traffic</h4>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performance.weeklyTraffic}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                    <XAxis dataKey="week" stroke="#888" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#888" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="views" fill="#F4631E" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="orders" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-app-bg border border-app-border rounded-2xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-app-text-secondary mb-3">
                Top Performing Products
              </h4>
              <div className="space-y-2">
                {performance.topPerformingProducts.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-app-border/50 last:border-0">
                    <span className="text-sm text-white truncate pr-3">{item.title}</span>
                    <span className="text-xs font-mono text-emerald-400">{item.score}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-app-bg border border-app-border rounded-2xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-app-text-secondary mb-3">
                Category Performance
              </h4>
              <div className="space-y-2">
                {performance.categoryPerformance.slice(0, 5).map((item) => (
                  <div key={item.category} className="flex items-center justify-between py-2 border-b border-app-border/50 last:border-0">
                    <span className="text-sm text-white">{item.category}</span>
                    <span className="text-xs text-app-text-secondary">{item.views} views</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-app-bg border border-app-border rounded-2xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-app-text-secondary mb-3">
              Traffic Sources {performance.trafficSources.some((s) => s.isPlaceholder) ? '(Estimated)' : ''}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {performance.trafficSources.map((source) => (
                <div key={source.source} className="p-3 rounded-xl border border-app-border/60 bg-app-card/40">
                  <div className="text-sm font-bold text-white">{source.source}</div>
                  <div className="text-lg font-mono text-app-accent mt-1">{source.share}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </WidgetShell>
  );
}
