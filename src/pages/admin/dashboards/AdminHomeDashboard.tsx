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
  TrendChart,
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
  const trend = useMemo(
    () =>
      (Array.isArray(analytics?.daily) ? analytics!.daily : []).slice(-14).map((row) => ({
        name: String(row?.date ?? '').slice(5),
        value: Number(row?.revenue || 0),
      })),
    [analytics],
  );

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
        </>
      }
    >
      <KpiPanel cols={4} branded>
        <KpiTile
          label="GMV / Revenue"
          value={dash(orders ? money(orders.revenue) : '—')}
          sub={orders ? `${orders.total} orders · ${RANGE_LABEL[range]}` : 'Storefront checkout'}
          to="/admin/orders"
        />
        <KpiTile
          label="Orders"
          value={dash(orders ? String(orders.total) : '—')}
          sub={orders ? `${orders.cod} COD · ${RANGE_LABEL[range]}` : 'Checkout pipeline'}
          to="/admin/orders"
        />
        <KpiTile
          label="Active Brands"
          value={dash(snap ? String(snap.brands) : '—')}
          sub={`${snap?.products ?? 0} products listed`}
          to="/admin/brand-studio"
        />
        <KpiTile
          label="Customers"
          value={dash(snap && snap.consumers !== null ? String(snap.consumers) : '—')}
          sub={`${snap?.liveCreators ?? 0} live creators`}
          to="/admin/consumers"
        />
      </KpiPanel>

      <ContentCard>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-app-text-primary tracking-tight m-0">
            Platform GMV &amp; Orders Trend
          </h3>
          <p className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">
            {RANGE_LABEL[range]} · all storefront checkout
          </p>
        </div>
        <TrendChart
          data={trend}
          seriesLabel="Revenue (৳)"
          valuePrefix="৳ "
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
