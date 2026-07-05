import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { operationsApi, type RoleAnalyticsPayload } from '../../services/operationsApi';

const ROLE_QUICK_LINKS: Record<string, { label: string; path: string }[]> = {
  admin: [
    { label: 'Orders Hub', path: '/admin/orders' },
    { label: 'Lead Inbox', path: '/admin/leads' },
    { label: 'Seller Offer Queue', path: '/admin/seller-offers' },
    { label: 'Website CMS Studio', path: '/admin/website-cms' },
  ],
  moderator: [
    { label: 'Moderation Center', path: '/admin/moderation' },
    { label: 'Review Queue', path: '/admin/reviews' },
    { label: 'Disputes', path: '/admin/disputes' },
  ],
  finance_manager: [
    { label: 'Monetization Center', path: '/admin/payouts' },
    { label: 'Promo Codes', path: '/admin/coupons' },
    { label: 'Cashbook', path: '/admin/cashbook' },
  ],
  support_agent: [
    { label: 'Orders Hub', path: '/admin/orders' },
    { label: 'Shipment Console', path: '/admin/logistics/shipments' },
    { label: 'Messages', path: '/admin/messages' },
  ],
  marketing_manager: [
    { label: 'Website CMS Studio', path: '/admin/website-cms' },
    { label: 'Ads & Sponsors', path: '/admin/ads-sponsors' },
    { label: 'Lead Inbox', path: '/admin/leads' },
  ],
};

const ROLE_LABELS: Record<string, { title: string; subtitle: string }> = {
  admin: {
    title: 'Operations Dashboard',
    subtitle: 'Storefront orders, shipments, leads, and review queue',
  },
  moderator: {
    title: 'Moderation Dashboard',
    subtitle: 'Review pipeline and content safety metrics',
  },
  finance_manager: {
    title: 'Finance Dashboard',
    subtitle: 'Revenue, promo discounts, and coupon redemptions',
  },
  support_agent: {
    title: 'Support Dashboard',
    subtitle: 'Orders, shipments, leads, and customer issues',
  },
  marketing_manager: {
    title: 'Marketing Dashboard',
    subtitle: 'Leads, campaigns, coupons, and CMS publishing for choosify.bd',
  },
};

type Props = {
  roleKey: string;
};

export default function RoleOpsDashboard({ roleKey }: Props) {
  const labels = ROLE_LABELS[roleKey] || {
    title: 'Role Dashboard',
    subtitle: 'Live metrics from platform operations',
  };
  const [data, setData] = useState<RoleAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');

  const load = async () => {
    setLoading(true);
    try {
      setData(await operationsApi.getRoleAnalytics(roleKey, range));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [roleKey, range]);

  const chartData =
    data?.summary.daily.map((row) => ({
      name: row.date.slice(5),
      orders: row.orders,
      revenue: row.revenue,
    })) || [];

  const quickLinks = data?.quickLinks?.length ? data.quickLinks : ROLE_QUICK_LINKS[roleKey] || ROLE_QUICK_LINKS.admin;

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text-primary tracking-tight">{labels.title}</h1>
          <p className="text-app-text-secondary text-sm">{labels.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase ${
                range === r
                  ? 'bg-app-accent text-white'
                  : 'bg-slate-100 text-app-text-secondary hover:text-app-text-primary'
              }`}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            onClick={load}
            className="p-2 rounded-lg border border-app-border text-app-text-secondary hover:text-app-text-primary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(data?.cards || []).map((card) => (
          <div
            key={card.label}
            className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl"
          >
            <div className="text-[11px] text-app-text-secondary uppercase tracking-[0.15em] font-bold mb-3">
              {card.label}
            </div>
            <div className="text-3xl font-extrabold text-app-text-primary tracking-tight mb-2">
              {loading ? '…' : card.value}
            </div>
            {card.sub && (
              <div className="text-[11px] text-app-text-secondary font-medium">{card.sub}</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
          <h3 className="text-lg font-bold text-app-text-primary mb-6">Activity Trend</h3>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="orders" stroke="#F4631E" fill="#F4631E33" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-app-text-secondary">
                {loading ? 'Loading chart…' : 'No activity in this range yet. Place a storefront order to see data.'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
          <h3 className="text-lg font-bold text-app-text-primary mb-6">Quick Actions</h3>
          <div className="space-y-2">
            {(quickLinks).map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-app-border hover:border-app-accent/40 hover:bg-app-accent/5 transition-all text-sm font-medium text-app-text-primary"
              >
                {link.label}
                <ChevronRight className="w-4 h-4 text-app-text-secondary" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
