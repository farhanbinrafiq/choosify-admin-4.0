import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  PackagePlus,
  Boxes,
  Building2,
  MessagesSquare,
  ClipboardList,
  RotateCcw,
  ShieldAlert,
  Bell,
  Megaphone,
} from 'lucide-react';
import { FileText } from 'lucide-react';
import { operationsApi, type OpsStorefrontOrder, type OpsReview } from '../../../services/operationsApi';
import { catalogApi } from '../../../services/catalogApi';
import type { CatalogProduct, CatalogBrand } from '../../../types/catalog';
import { useAuth } from '../../../contexts/AuthContext';
import {
  resolveOrderHubViewer,
  orderDetailsPath,
  invoicePath,
  invoiceActionEligible,
  visibleSubOrders,
} from '../orderHubModel';
import { useNavAttention } from '../../../contexts/NavAttentionContext';
import {
  DashShell,
  RangeToggle,
  KpiPanel,
  KpiTile,
  ContentCard,
  CardColumns,
  MiniStat,
  EmptyState,
  ActionRowList,
  QuickActionGrid,
  TrendChart,
  RANGE_LABEL,
  type RangeKey,
  type ActionItem,
  type QuickAction,
} from './primitives';

const RANGE_DAYS: Record<RangeKey, number> = { '7d': 7, '30d': 30, '90d': 90 };

function withinRange(iso: string, days: number): boolean {
  const diff = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return diff >= 0 && diff <= days;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Seller Command Center — seller / verified_seller. Everything ownership-scoped
 * by the server before it reaches this component:
 *   Orders / Revenue / trend / recent → GET /operations/orders (server auto-scopes
 *     a non-staff caller to their own orders). The trend is bucketed from those
 *     rows only — the platform-wide checkout series is never read here.
 *   Products / inventory health       → GET /catalog/products (server: p.sellerId === userId)
 *   Owned Brands                      → GET /catalog/brands (server: b.sellerId === userId)
 *   Reviews Snapshot                  → GET /operations/reviews?sellerId=<self> (server resolves
 *     reviews on the seller's own products; cross-seller isolation enforced)
 *   Action Center                     → GET /dashboard/nav-attention (seller branch)
 */
export default function SellerHomeDashboard() {
  const { profile } = useAuth();
  const { counts } = useNavAttention();
  const [range, setRange] = useState<RangeKey>('30d');
  const [orders, setOrders] = useState<OpsStorefrontOrder[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [reviews, setReviews] = useState<OpsReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [o, p, b, r] = await Promise.all([
        operationsApi.listOrders().catch(() => [] as OpsStorefrontOrder[]),
        catalogApi.listProducts().catch(() => [] as CatalogProduct[]),
        catalogApi.listBrands().catch(() => [] as CatalogBrand[]),
        profile?.id
          ? operationsApi.listReviews({ sellerId: profile.id }).catch(() => [] as OpsReview[])
          : Promise.resolve([] as OpsReview[]),
      ]);
      if (cancelled) return;
      setOrders(Array.isArray(o) ? o : []);
      setProducts(Array.isArray(p) ? p : []);
      setBrands(Array.isArray(b) ? b : []);
      setReviews(Array.isArray(r) ? r : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const days = RANGE_DAYS[range];
  const rangeOrders = useMemo(
    () => orders.filter((o) => withinRange(o.createdAt, days)),
    [orders, days],
  );
  const rangeRevenue = useMemo(
    () => rangeOrders.reduce((sum, o) => sum + Number(o.overallTotal || 0), 0),
    [rangeOrders],
  );

  const trend = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets.set(dayKey(d.toISOString()), 0);
    }
    for (const o of rangeOrders) {
      const k = dayKey(o.createdAt);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) || 0) + Number(o.overallTotal || 0));
    }
    const rows = [...buckets.entries()].map(([date, value]) => ({ name: date.slice(5), value }));
    // 90d: weekly-ish thinning so the axis stays readable
    return days > 45 ? rows.filter((_, i) => i % 3 === 0) : rows;
  }, [rangeOrders, days]);

  const liveProducts = products.filter((p) => p.status === 'live' || p.status === 'active').length;
  const draftProducts = products.filter((p) => p.status === 'draft').length;
  const oosProducts = products.filter(
    (p) => p.status === 'out_of_stock' || (typeof p.stock === 'number' && p.stock <= 0),
  ).length;
  const lowStockProducts = products.filter(
    (p) => typeof p.stock === 'number' && p.stock > 0 && p.stock <= 5,
  ).length;

  const reviewCount = reviews.length;
  const unanswered = reviews.filter((r) => !r.response).length;
  const avgRating =
    reviewCount > 0
      ? (reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviewCount).toFixed(1)
      : null;

  const recent = useMemo(
    () =>
      [...orders]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 5),
    [orders],
  );
  const viewer = useMemo(() => resolveOrderHubViewer(profile), [profile]);

  const dash = (v: string) => (loading ? '…' : v);
  const money = (n: number) => `৳ ${Math.round(n).toLocaleString()}`;

  const actionSources: Array<Omit<ActionItem, 'count'>> = [
    { key: 'orders', label: 'Orders require action', icon: ClipboardList, to: '/admin/orders' },
    { key: 'returnsRefunds', label: 'Return / refund requests', icon: RotateCcw, to: '/admin/returns' },
    { key: 'warrantyClaims', label: 'Warranty claims need action', icon: ShieldAlert, to: '/admin/warranty-claims' },
    { key: 'products', label: 'Products out of stock', icon: Boxes, to: '/admin/products' },
    { key: 'adsDealsStudio', label: 'Ads rejected — need updates', icon: Megaphone, to: '/admin/ads-deals-studio' },
    { key: 'messages', label: 'Unread conversations', icon: MessagesSquare, to: '/admin/conversations' },
    { key: 'notifications', label: 'Unread notifications', icon: Bell, to: '/admin/notifications' },
  ];
  const actionItems: ActionItem[] = actionSources
    .map((row): ActionItem | null => {
      const entry = counts[row.key];
      return entry && entry.count > 0 ? { ...row, count: entry.count } : null;
    })
    .filter((x): x is ActionItem => x !== null);

  const appStatus = counts.brandProfile;

  const quickActions: QuickAction[] = [
    { key: 'add', label: 'Add Product', sub: 'List a new SKU', to: '/admin/products', icon: PackagePlus },
    { key: 'manage', label: 'Manage Products', sub: 'Catalog & pricing', to: '/admin/products', icon: Package },
    { key: 'orders', label: 'Orders', sub: 'Fulfilment & dispatch', to: '/admin/orders', icon: ClipboardList },
    { key: 'inventory', label: 'Inventory', sub: 'Stock levels & alerts', to: '/admin/products', icon: Boxes },
    { key: 'brand', label: 'Brand Studio', sub: 'Your brand storefront', to: '/admin/brand-studio', icon: Building2 },
    { key: 'messages', label: 'Messages', sub: 'Buyer conversations', to: '/admin/conversations', icon: MessagesSquare },
  ];

  const statusLabel = (s: OpsStorefrontOrder['status'] | undefined) => {
    const v = String(s || '');
    if (!v) return '—';
    if (v === 'pending_payment') return 'Awaiting payment';
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  return (
    <DashShell
      title="Seller Command Center"
      subtitle="How your business is doing, and what you need to act on now — scoped to your seller account."
      actions={<RangeToggle value={range} onChange={setRange} />}
    >
      {appStatus ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">
          {appStatus.label} —{' '}
          <Link to="/admin/brand-profile" className="underline">
            open your seller profile
          </Link>
        </div>
      ) : null}

      <KpiPanel cols={4}>
        <KpiTile
          label="Orders"
          value={dash(String(rangeOrders.length))}
          sub={orders.length ? `${orders.length} lifetime · ${RANGE_LABEL[range]}` : 'No orders yet'}
          to="/admin/orders"
        />
        <KpiTile
          label="Revenue"
          value={dash(money(rangeRevenue))}
          sub={rangeOrders.length ? `${rangeOrders.length} orders in period` : 'No sales yet'}
          to="/admin/orders"
        />
        <KpiTile
          label="Products"
          value={dash(String(products.length))}
          sub={`${liveProducts} live · ${draftProducts} drafts`}
          to="/admin/products"
        />
        <KpiTile
          label="Owned Brands"
          value={dash(String(brands.length))}
          sub={brands.length ? 'Managed by you' : 'No brand yet'}
          to="/admin/brand-studio"
        />
      </KpiPanel>

      <ContentCard>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-app-text-primary tracking-tight m-0">
            Sales &amp; Order Trend
          </h3>
          <p className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">
            {RANGE_LABEL[range]} · your storefront orders only
          </p>
        </div>
        <TrendChart
          data={trend}
          seriesLabel="Revenue (৳)"
          valuePrefix="৳ "
          emptyMessage={
            orders.length
              ? 'No sales in the selected period.'
              : 'No sales yet — this chart shows only your own orders.'
          }
        />
      </ContentCard>

      <CardColumns>
        <ContentCard title="Action Center">
          <ActionRowList items={actionItems} emptyMessage="Nothing needs your attention right now." />
        </ContentCard>

        <ContentCard title="Inventory & Catalog Health">
          <MiniStat label="Live products" value={String(liveProducts)} to="/admin/products" />
          <MiniStat label="Draft products" value={String(draftProducts)} to="/admin/products" />
          <MiniStat label="Low stock (≤5)" value={String(lowStockProducts)} to="/admin/products" />
          <MiniStat label="Out of stock" value={String(oosProducts)} to="/admin/products" />
        </ContentCard>

        <ContentCard title="Reviews Snapshot">
          {reviewCount === 0 ? (
            <EmptyState message={loading ? 'Loading…' : 'No reviews on your products yet.'} />
          ) : (
            <>
              <MiniStat label="Total reviews" value={String(reviewCount)} to="/admin/reviews" />
              <MiniStat label="Awaiting your reply" value={String(unanswered)} to="/admin/reviews" />
              <MiniStat label="Average rating" value={avgRating ? `${avgRating} / 5` : '—'} />
            </>
          )}
        </ContentCard>
      </CardColumns>

      <ContentCard title="Recent Orders">
        {recent.length === 0 ? (
          <EmptyState message={loading ? 'Loading…' : 'No orders yet.'} />
        ) : (
          <div className="divide-y divide-app-border">
            {recent.map((o) => {
              // Same canonical eligibility policy as Order Hub / Order Details —
              // no separate rule, no separate financial check.
              const eligible = invoiceActionEligible(o, viewer);
              const invoiceSellerId = visibleSubOrders(o, viewer)[0]?.sellerId;
              return (
                <div key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <Link
                    to={orderDetailsPath(viewer, o.orderId)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 hover:opacity-80 transition-opacity"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-app-text-primary truncate">
                        {o.shipping?.fullName || 'Customer'}
                      </div>
                      <div className="text-[10px] text-app-text-secondary font-mono">
                        {o.orderId || o.id} · {new Date(o.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-bold text-app-text-primary">
                        {money(Number(o.overallTotal || 0))}
                      </div>
                      <div className="text-[10px] text-app-text-secondary">{statusLabel(o.status)}</div>
                    </div>
                  </Link>
                  {eligible && invoiceSellerId && (
                    <Link
                      to={invoicePath(o.orderId, invoiceSellerId)}
                      title="Invoice"
                      aria-label={`Invoice for order ${o.orderId || o.id}`}
                      className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border border-app-border text-app-text-secondary hover:text-app-accent hover:border-app-accent/40 transition-colors"
                    >
                      <FileText size={13} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ContentCard>

      <QuickActionGrid actions={quickActions} />
    </DashShell>
  );
}
