import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  LayoutTemplate,
  Package,
  Building2,
  Users,
  Layers,
  Megaphone,
  ShieldCheck,
  FileCheck2,
  Star,
  RotateCcw,
  BadgeCheck,
  BarChart3,
  ShoppingCart,
  Tag,
} from 'lucide-react';
import { operationsApi, type AnalyticsSummary } from '../../../services/operationsApi';
import { catalogApi } from '../../../services/catalogApi';
import { useNavAttention } from '../../../contexts/NavAttentionContext';
import {
  DashShell,
  RangeToggle,
  KpiPanel,
  KpiTile,
  ContentCard,
  CardColumns,
  MiniStat,
  ActionRowList,
  QuickActionGrid,
  DualTrendChart,
  RANGE_LABEL,
  type RangeKey,
  type ActionItem,
  type QuickAction,
} from './primitives';

type Snapshot = {
  products: number;
  brands: number;
  liveCreators: number;
  categories: number;
  activeDeals: number;
  liveHomeSections: number;
  siteUpdatedAt?: string;
  homeUpdatedAt?: string;
  placements: number;
  consumers: number | null;
};

/**
 * Platform Command Center — super_admin / admin / moderator.
 *
 * Every number is platform-scoped and traceable:
 *   GMV / Orders / trend      → GET /operations/analytics (admin shape) — orders.revenue / orders.total / daily[]
 *   Active Brands / Products  → GET /catalog/brands|products (staff = full catalog) — length
 *   Customers                 → GET /operations/users (staff only) — count(role === 'Consumer')
 *   Creators / Categories / CMS → GET /catalog/creators|categories + homepage/site config
 *   Platform Action Center    → GET /dashboard/nav-attention (admin branch) — server counts
 */
export default function AdminHomeDashboard() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const { counts } = useNavAttention();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [ops, products, brands, creators, categories, deals, homepage, site, placements, users] =
        await Promise.all([
          operationsApi.getAnalytics(range).catch(() => null),
          catalogApi.listProducts().catch(() => []),
          catalogApi.listBrands().catch(() => []),
          catalogApi.listCreators().catch(() => []),
          catalogApi.listCategories().catch(() => []),
          catalogApi.listDeals().catch(() => []),
          catalogApi.getHomepage().catch(() => null),
          catalogApi.getSiteConfig().catch(() => null),
          catalogApi.listPlacements().catch(() => []),
          operationsApi.listUsers().catch(() => null),
        ]);
      if (cancelled) return;
      // `getAnalytics` returns the admin AnalyticsSummary for staff; a
      // role-scoped payload (has `.cards`) only for seller/creator, which never
      // reaches this component.
      setAnalytics(ops && !('cards' in (ops as object)) ? (ops as AnalyticsSummary) : null);
      const consumers = Array.isArray(users)
        ? (users as Array<{ role?: string }>).filter(
            (u) => String(u.role || '').toLowerCase() === 'consumer',
          ).length
        : null;
      setSnap({
        products: products.length,
        brands: brands.length,
        liveCreators: (creators as Array<{ status?: string }>).filter((c) => c.status === 'live')
          .length,
        categories: categories.length,
        activeDeals: (deals as Array<{ active?: boolean; status?: string }>).filter(
          (d) => d.active === true || d.status === 'active',
        ).length,
        liveHomeSections:
          homepage?.sections?.filter((s: { isVisible?: boolean }) => s.isVisible).length ?? 0,
        siteUpdatedAt: site?.updatedAt,
        homeUpdatedAt: homepage?.updatedAt,
        placements: placements.length,
        consumers,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const orders = analytics?.orders;
  // The whole selected range (7 / 30 / 90 days) from /operations/analytics daily[].
  // daily[] lists only days that had activity; a day it omits had zero orders,
  // so the range is filled with real zero days (nothing is estimated).
  const trend = useMemo(() => {
    if (!analytics) return [];
    const byDate = new Map(
      (Array.isArray(analytics.daily) ? analytics.daily : []).map((row) => [String(row?.date ?? ''), row]),
    );
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const end = new Date(analytics.generatedAt || Date.now());
    const out: Array<{ date: string; label: string; revenue: number; orders: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i));
      const iso = d.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      out.push({
        date: iso,
        label: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }),
        revenue: Number(row?.revenue || 0),
        orders: Number(row?.orders || 0),
      });
    }
    return out;
  }, [analytics, range]);

  const dash = (v: string) => (loading ? '…' : v);
  const money = (n?: number) => `৳ ${Number(n || 0).toLocaleString()}`;

  const actionSources: Array<Omit<ActionItem, 'count'>> = [
    { key: 'brands', label: 'Seller applications awaiting review', icon: BadgeCheck, to: '/admin/brand-verification' },
    { key: 'creators', label: 'Creator applications awaiting review', icon: BadgeCheck, to: '/admin/brand-verification' },
    { key: 'verificationCenter', label: 'Verification dossiers awaiting review', icon: FileCheck2, to: '/admin/brand-verification' },
    { key: 'returnsRefunds', label: 'Return / refund cases need action', icon: RotateCcw, to: '/admin/returns' },
    { key: 'reviews', label: 'Reviews awaiting moderation', icon: Star, to: '/admin/reviews' },
    { key: 'contentStudio', label: 'Guides awaiting approval', icon: FileCheck2, to: '/admin/guides' },
    { key: 'products', label: 'Product listings awaiting review', icon: Package, to: '/admin/products' },
    { key: 'adsDealsStudio', label: 'Ads / promotions awaiting approval', icon: Megaphone, to: '/admin/ads-deals-studio' },
    { key: 'featureRequests', label: 'Feature requests awaiting review', icon: ShieldCheck, to: '/admin/feature-access' },
  ];
  const actionItems: ActionItem[] = actionSources
    .map((row): ActionItem | null => {
      const entry = counts[row.key];
      return entry && entry.count > 0 ? { ...row, count: entry.count } : null;
    })
    .filter((x): x is ActionItem => x !== null);

  const quickActions: QuickAction[] = [
    { key: 'orders', label: 'Orders', sub: 'Storefront checkout pipeline', to: '/admin/orders', icon: Package },
    { key: 'brands', label: 'Sellers & Brands', sub: 'Merchants & listings', to: '/admin/brand-studio', icon: Building2 },
    { key: 'creators', label: 'Creators', sub: 'Guides & creator economy', to: '/admin/creator-studio', icon: Users },
    { key: 'products', label: 'Products', sub: 'Platform catalog & stock', to: '/admin/products', icon: Package },
    { key: 'categories', label: 'Category Studio', sub: 'Navigation & discovery', to: '/admin/categories', icon: Layers },
    { key: 'ads', label: 'Ads & Deals', sub: 'Sponsored placements', to: '/admin/ads-deals-studio', icon: Megaphone },
  ];

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  return (
    <DashShell
      title="Platform Command Center"
      subtitle="What is happening across Choosify, and what requires your attention."
      actions={
        <>
          <RangeToggle value={range} onChange={setRange} />
          <a
            href="https://choosify.bd"
            target="_blank"
            rel="noopener noreferrer"
            title="View live site"
            aria-label="View live site"
            className="h-[42px] w-[42px] inline-flex items-center justify-center bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#F96500] hover:border-[#F96500]/40 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <Link
            to="/admin/website-cms"
            className="h-[42px] px-4 bg-white border-[1.5px] border-[#F96500] text-[#000435] rounded-xl font-bold text-[13px] inline-flex items-center gap-2 hover:bg-[#FFF0E8] transition-all no-underline"
          >
            <LayoutTemplate className="w-4 h-4 text-[#F96500]" /> Website Manager
          </Link>
        </>
      }
    >
      <KpiPanel cols={4} branded>
        <KpiTile
          label="GMV / Revenue"
          value={dash(orders ? money(orders.revenue) : '—')}
          sub={orders ? `${orders.total} orders · ${RANGE_LABEL[range]}` : 'Storefront checkout'}
          to="/admin/orders"
          icon={BarChart3}
          tone="orange"
        />
        <KpiTile
          label="Orders"
          value={dash(orders ? String(orders.total) : '—')}
          sub={orders ? `${orders.cod} COD · ${RANGE_LABEL[range]}` : 'Checkout pipeline'}
          to="/admin/orders"
          icon={ShoppingCart}
          tone="blue"
        />
        <KpiTile
          label="Active Brands"
          value={dash(snap ? String(snap.brands) : '—')}
          sub={`${snap?.products ?? 0} products listed`}
          to="/admin/brand-studio"
          icon={Tag}
          tone="green"
        />
        <KpiTile
          label="Customers"
          value={dash(snap && snap.consumers !== null ? String(snap.consumers) : '—')}
          sub={`${snap?.liveCreators ?? 0} live creators`}
          to="/admin/consumers"
          icon={Users}
          tone="purple"
        />
      </KpiPanel>

      <ContentCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3
              className="text-[20px] font-extrabold text-[#000435] tracking-tight m-0"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Platform GMV &amp; Orders Trend
            </h3>
            <p className="text-[11px] text-[#64748B] uppercase font-bold tracking-[0.12em] mt-1.5 mb-0">
              {RANGE_LABEL[range]} · All storefront checkout
            </p>
          </div>
          {/* Same range as the page toggle — one source of truth. */}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            aria-label="Trend range"
            className="h-[38px] px-3 pr-8 bg-white border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#000435] cursor-pointer"
          >
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
              <option key={k} value={k}>
                {RANGE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <DualTrendChart
          data={trend}
          loading={loading}
          emptyMessage="No platform orders in this period yet."
        />
      </ContentCard>

      <CardColumns>
        <ContentCard title="Platform Action Center">
          <ActionRowList items={actionItems} emptyMessage="Nothing needs your attention right now." />
        </ContentCard>

        <ContentCard title="Marketplace Health">
          <MiniStat label="Catalog Products" value={String(snap?.products ?? 0)} to="/admin/products" />
          <MiniStat label="Brands" value={String(snap?.brands ?? 0)} to="/admin/brand-studio" />
          <MiniStat label="Live Creators" value={String(snap?.liveCreators ?? 0)} to="/admin/creator-studio" />
          <MiniStat label="Categories" value={String(snap?.categories ?? 0)} to="/admin/categories" />
          <MiniStat label="Active Deals" value={String(snap?.activeDeals ?? 0)} to="/admin/ads-deals-studio" />
          <MiniStat label="Live CMS Sections" value={String(snap?.liveHomeSections ?? 0)} to="/admin/website-cms" />
        </ContentCard>

        <ContentCard title="CMS Publish Health">
          <MiniStat label="Site config updated" value={fmtDate(snap?.siteUpdatedAt)} />
          <MiniStat label="Homepage updated" value={fmtDate(snap?.homeUpdatedAt)} />
          <MiniStat label="Active placements" value={String(snap?.placements ?? 0)} />
          <MiniStat label="Live homepage sections" value={String(snap?.liveHomeSections ?? 0)} to="/admin/website-cms" />
          <Link
            to="/admin/website-cms"
            className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-app-accent text-white text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-all no-underline"
          >
            <Megaphone className="w-3.5 h-3.5" /> Open Website Manager
          </Link>
        </ContentCard>
      </CardColumns>

      <QuickActionGrid actions={quickActions} />
    </DashShell>
  );
}
