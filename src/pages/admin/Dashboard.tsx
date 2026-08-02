import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Building2,
  ArrowUpRight,
  TrendingUp,
  LayoutTemplate,
  Send,
  Star,
  Mail,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Layers,
  Megaphone,
  ShieldAlert,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { operationsApi, type AnalyticsSummary } from '../../services/operationsApi';
import { catalogApi } from '../../services/catalogApi';
import type { HomepageConfig, SiteConfig } from '../../types/catalog';
import { useTrust } from '../../contexts/TrustContext';

type RangeKey = '7d' | '30d' | '90d';

interface CatalogSnapshot {
  products: number;
  brands: number;
  categories: number;
  deals: number;
  placements: number;
  homepage: HomepageConfig | null;
  site: SiteConfig | null;
  pendingSellerOffers: number;
}

const StatCard = ({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  href?: string;
}) => {
  const body = (
    <div className="dash-kpi-tile rounded-[18px] p-5 group transition-all relative overflow-hidden">
      <div className="dash-kpi-label text-[11px] uppercase tracking-[0.15em] font-bold mb-3">{label}</div>
      <div className="dash-kpi-value text-[28px] font-extrabold tracking-tight mb-2 leading-none">{value}</div>
      <div className="dash-kpi-sub text-[11px] font-medium flex items-center gap-1">
        {sub}
        {href && <ArrowUpRight className="w-3.5 h-3.5 text-[#FF5B00] opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
    </div>
  );

  if (!href) return body;
  return (
    <Link to={href} className="block">
      {body}
    </Link>
  );
};

export default function Dashboard() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const { trustScores, trustAlerts } = useTrust();

  const load = async () => {
    setLoading(true);
    try {
      const [ops, products, brands, categories, deals, homepage, site, placements, offers] = await Promise.all([
        operationsApi.getAnalytics(range),
        catalogApi.listProducts().catch(() => []),
        catalogApi.listBrands().catch(() => []),
        catalogApi.listCategories().catch(() => []),
        catalogApi.listDeals().catch(() => []),
        catalogApi.getHomepage().catch(() => null),
        catalogApi.getSiteConfig().catch(() => null),
        catalogApi.listPlacements().catch(() => []),
        operationsApi.listSellerOffers().catch(() => []),
      ]);

      setAnalytics(ops);
      setCatalog({
        products: products.length,
        brands: brands.length,
        categories: categories.length,
        deals: deals.length,
        placements: placements.length,
        homepage,
        site,
        pendingSellerOffers: offers.filter((offer: any) => offer.status === 'pending').length,
      });
    } catch {
      setAnalytics(null);
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [range]);

  const trafficData = useMemo(
    () =>
      analytics?.daily.slice(-7).map((row) => ({
        name: row.date.slice(5),
        orders: row.orders,
        revenue: row.revenue,
      })) || [],
    [analytics],
  );

  const visibleHomeSections =
    catalog?.homepage?.sections.filter((section) => section.isVisible).length ?? 0;
  const activePopularSearches =
    catalog?.site?.popularSearches.filter((item) => item.isActive).length ?? 0;
  const announcementLive = Boolean(
    catalog?.site?.announcementBarEnabled && catalog?.site?.announcementBarText?.trim(),
  );

  const trustStats = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const verifiedSellers = trustScores.filter((s) => s.entity_type === 'seller' && s.current_score >= 70).length;
    const fraudReports = trustAlerts.filter(
      (a) =>
        (a.alert_type === 'Suspicious Seller Activity' || a.alert_type === 'Complaint Spike') &&
        new Date(a.created_at).getTime() >= thirtyDaysAgo,
    ).length;
    const fakeReviewFlags = trustAlerts.filter((a) => a.alert_type === 'Fake Review Detection').length;
    const criticalAlerts = trustAlerts.filter((a) => a.status === 'unresolved' && a.severity === 'Critical').length;
    return { verifiedSellers, fraudReports, fakeReviewFlags, criticalAlerts };
  }, [trustScores, trustAlerts]);

  const actionQueues = [
    {
      label: 'Seller Offer Queue',
      count: catalog?.pendingSellerOffers ?? 0,
      href: '/admin/seller-offers',
      icon: Send,
    },
    {
      label: 'Lead Inbox',
      count: analytics?.leads.new ?? 0,
      href: '/admin/leads',
      icon: Mail,
    },
    {
      label: 'Review Moderation',
      count: analytics?.reviews.pending ?? 0,
      href: '/admin/reviews',
      icon: Star,
    },
    {
      label: 'Active Shipments',
      count: analytics?.shipments.pending ?? 0,
      href: '/admin/logistics/shipments',
      icon: RefreshCw,
    },
  ].filter((item) => item.count > 0 || loading);

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text-primary tracking-tight">Platform Command Center</h1>
          <p className="text-app-text-secondary text-sm">
            Live storefront health for choosify.bd — catalog, CMS, and operational queues from dashboard.choosify.bd
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-app-border">
            {(['7d', '30d', '90d'] as RangeKey[]).map((t) => (
              <button
                key={t}
                onClick={() => setRange(t)}
                className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                  range === t
                    ? 'bg-app-accent text-white'
                    : 'text-app-text-secondary hover:text-app-text-primary'
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <a
            href="https://choosify.bd"
            target="_blank"
            rel="noopener noreferrer"
            title="View Live Site"
            className="p-2.5 bg-app-card border border-app-border rounded-xl text-app-text-secondary hover:text-app-accent hover:border-app-accent/40 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <Link
            to="/admin/website-cms"
            className="px-4 py-2.5 bg-white border border-app-accent text-app-accent rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-app-accent/10 transition-all"
          >
            <LayoutTemplate className="w-4 h-4" /> Website Manager
          </Link>
        </div>
      </div>

      <div className="rounded-[20px] p-5" style={{ backgroundImage: 'linear-gradient(120deg, rgba(255,91,0,0.1), rgba(0,4,53,0.06))' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Storefront Orders"
          value={analytics ? String(analytics.orders.total) : loading ? '…' : '—'}
          sub={analytics ? `৳ ${analytics.orders.revenue.toLocaleString()} revenue` : 'Checkout pipeline'}
          href="/admin/orders"
        />
        <StatCard
          label="Catalog Products"
          value={catalog ? String(catalog.products) : loading ? '…' : '—'}
          sub={`${catalog?.brands ?? 0} brands · ${catalog?.categories ?? 0} categories`}
          href="/admin/products"
        />
        <StatCard
          label="CMS Homepage"
          value={catalog?.homepage ? `${visibleHomeSections} live sections` : loading ? '…' : '—'}
          sub={
            announcementLive
              ? 'Announcement bar active on choosify.bd'
              : `${activePopularSearches} popular search terms configured`
          }
          href="/admin/website-cms"
        />
        <StatCard
          label="Promoted Placements"
          value={catalog ? String(catalog.placements) : loading ? '…' : '—'}
          sub={`${catalog?.deals ?? 0} active deals in catalog`}
          href="/admin/ads-sponsors"
        />
      </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-app-card border border-app-border rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-bold text-app-text-primary tracking-tight">Order & Revenue Trend</h3>
              <p className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">
                Last 7 days from storefront checkout
              </p>
            </div>
          </div>
          <div className="min-h-[280px]">
            {trafficData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trafficData}>
                  <defs>
                    <linearGradient id="dashRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EB4501" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#EB4501" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-app-card)',
                      border: '1px solid var(--color-app-border)',
                      borderRadius: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#EB4501" strokeWidth={2} fill="url(#dashRev)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-app-text-secondary text-sm">
                No order analytics yet for this range.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-app-text-primary mb-6 uppercase tracking-wider">Action Queues</h3>
            <div className="space-y-3">
              {actionQueues.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="flex items-center justify-between p-3 bg-app-bg border border-app-border rounded-xl hover:border-app-accent/40 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-app-accent/10 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-app-accent" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-app-text-primary">{item.label}</div>
                        <div className="text-[9px] text-app-text-secondary">Needs attention</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-app-accent">{item.count}</span>
                      <ChevronRight className="w-4 h-4 text-app-text-secondary group-hover:text-app-accent" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-app-text-primary mb-4 uppercase tracking-wider">CMS Publish Health</h3>
            <div className="space-y-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Site config updated</span>
                <span className="font-bold text-app-text-primary">
                  {catalog?.site?.updatedAt ? new Date(catalog.site.updatedAt).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Homepage updated</span>
                <span className="font-bold text-app-text-primary">
                  {catalog?.homepage?.updatedAt
                    ? new Date(catalog.homepage.updatedAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Active placements</span>
                <span className="font-bold text-app-text-primary">{catalog?.placements ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Product badges configured</span>
                <span className="font-bold text-app-text-primary">
                  {catalog?.site?.productBadges?.filter((b) => b.isActive).length ?? 0}
                </span>
              </div>
            </div>
            <Link
              to="/admin/website-cms"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-app-accent text-white text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-all"
            >
              <Megaphone className="w-3.5 h-3.5" /> Publish to choosify.bd
            </Link>
          </div>

          <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Trust & Safety</h3>
              {trustStats.criticalAlerts > 0 && (
                <span className="flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                  <ShieldAlert className="w-3 h-3" /> {trustStats.criticalAlerts} Alert{trustStats.criticalAlerts > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="space-y-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Verified Sellers</span>
                <span className="font-bold text-app-text-primary">{trustStats.verifiedSellers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Fraud Reports (30d)</span>
                <span className="font-bold text-app-text-primary">{trustStats.fraudReports}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-text-secondary">Fake Review Flags</span>
                <span className="font-bold text-app-text-primary">{trustStats.fakeReviewFlags}</span>
              </div>
            </div>
            <Link
              to="/admin/trust-center"
              className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-app-accent hover:underline"
            >
              View Trust Center <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/admin/products"
          className="bg-app-card border border-app-border rounded-2xl p-6 hover:border-app-accent/40 transition-all flex items-center gap-4"
        >
          <Package className="w-8 h-8 text-app-accent" />
          <div>
            <div className="font-bold text-app-text-primary">Product Catalog</div>
            <div className="text-[11px] text-app-text-secondary">Manage live storefront SKUs</div>
          </div>
        </Link>
        <Link
          to="/admin/sellers"
          className="bg-app-card border border-app-border rounded-2xl p-6 hover:border-app-accent/40 transition-all flex items-center gap-4"
        >
          <Building2 className="w-8 h-8 text-blue-500" />
          <div>
            <div className="font-bold text-app-text-primary">Brand Studio</div>
            <div className="text-[11px] text-app-text-secondary">Verified merchants & listings</div>
          </div>
        </Link>
        <Link
          to="/admin/categories"
          className="bg-app-card border border-app-border rounded-2xl p-6 hover:border-app-accent/40 transition-all flex items-center gap-4"
        >
          <Layers className="w-8 h-8 text-emerald-500" />
          <div>
            <div className="font-bold text-app-text-primary">Category Management Studio</div>
            <div className="text-[11px] text-app-text-secondary">Navigation & discovery structure</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
