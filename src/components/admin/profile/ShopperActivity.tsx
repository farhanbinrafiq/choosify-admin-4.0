import React, { useCallback, useEffect, useMemo, useState, CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi, type StoredCustomerAddress } from '../../../services/authApi';
import { catalogApi } from '../../../services/catalogApi';
import { operationsApi, type OpsReview, type OpsStorefrontOrder, type ShopperSignals } from '../../../services/operationsApi';
import { warrantyClaimsApi, type WarrantyClaim } from '../../../services/warrantyClaimsApi';
import type { ReturnRequest } from '../../../contexts/ReturnsContext';
import type { CatalogBrand } from '../../../types/catalog';
import { OrderHistoryTable, ReviewsPanel } from './ProfileSections';
import {
  CancellationsPanel,
  RefundsPanel,
  ReturnsPanel,
  SavedAddressesPanel,
  SearchHistoryPanel,
  SignalList,
  ToPayPanel,
  WarrantyPanel,
  cancelledOrders,
  refundCases,
  toPayOrders,
  Thumb,
  useCatalogThumbs,
} from './ConsumerActivityPanels';

/**
 * The shopping side of ANY account (consumer, seller or creator): everything
 * the person did as a shopper on the storefront. Used by the seller / creator
 * 360 profiles' "Shopping" mode, so staff see one person in one place.
 */
const TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'to-pay', label: 'To Pay' },
  { key: 'cancellations', label: 'Cancellations' },
  { key: 'returns', label: 'Returns' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'reviews', label: 'Reviews posted' },
  { key: 'saved', label: 'Saved' },
  { key: 'search', label: 'Search History' },
  { key: 'followed', label: 'Followed' },
  { key: 'addresses', label: 'Addresses' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const S: Record<string, CSSProperties> = {
  tabBar: { display: 'flex', gap: 16, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 14, padding: '0 16px', overflowX: 'auto' },
  tab: { padding: '12px 4px', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '2px solid transparent', color: '#6B7280', background: 'transparent', borderTop: 0, borderLeft: 0, borderRight: 0 },
  tabActive: { color: 'var(--cms-accent)', borderBottom: '2px solid var(--cms-accent)' },
  panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 14, padding: 16 },
  error: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 14, padding: 16, color: '#DC2626', fontSize: 12, fontWeight: 700 },
};

export function ShopperActivity({ userId }: { userId: string }) {
  const [tab, setTab] = useState<TabKey>('orders');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OpsStorefrontOrder[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [reviews, setReviews] = useState<OpsReview[]>([]);
  const [signals, setSignals] = useState<ShopperSignals | null>(null);
  const [followed, setFollowed] = useState<CatalogBrand[]>([]);
  const thumbs = useCatalogThumbs();
  const [addresses, setAddresses] = useState<StoredCustomerAddress[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const errs: Record<string, string> = {};
    const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
    await Promise.all([
      operationsApi.listOrders({ buyerId: userId }).then(setOrders).catch((e) => (errs.orders = msg(e, 'Could not load orders.'))),
      operationsApi.listReturns({ buyerId: userId }).then(setReturns).catch((e) => (errs.returns = msg(e, 'Could not load returns.'))),
      warrantyClaimsApi.list({ consumerId: userId }).then(setClaims).catch((e) => (errs.warranty = msg(e, 'Could not load warranty claims.'))),
      operationsApi.listReviews({ userId }).then(setReviews).catch((e) => (errs.reviews = msg(e, 'Could not load reviews.'))),
      operationsApi.getUserShopperSignals(userId).then(setSignals).catch((e) => (errs.signals = msg(e, 'Could not load saved items and searches.'))),
      operationsApi
        .listUserFollowedBrandIds(userId)
        .then(async (ids) => {
          if (!ids.length) return setFollowed([]);
          const all = await catalogApi.listBrands();
          setFollowed(all.filter((b) => ids.includes(b.id)));
        })
        .catch((e) => (errs.followed = msg(e, 'Could not load followed brands.'))),
      authApi
        .getUserDetail(userId)
        .then((u) => setAddresses(u.addresses ?? []))
        .catch((e) => (errs.addresses = msg(e, 'Could not load addresses.'))),
    ]);
    setErrors(errs);
    setLoading(false);
  }, [userId]);
  useEffect(() => {
    void load();
  }, [load]);

  const counts: Partial<Record<TabKey, number>> = useMemo(
    () => ({
      orders: orders.length,
      'to-pay': toPayOrders(orders).length,
      cancellations: cancelledOrders(orders).length,
      returns: returns.length,
      refunds: refundCases(returns).length,
      warranty: claims.length,
      reviews: reviews.length,
      saved: (signals?.savedProducts.length || 0) + (signals?.savedBrands.length || 0),
      search: signals?.searches.length || 0,
      followed: followed.length + (signals?.followedCreators.length || 0),
      addresses: addresses.length,
    }),
    [orders, returns, claims, reviews, signals, followed, addresses],
  );

  if (loading) {
    return (
      <div style={{ ...S.panel, display: 'flex', justifyContent: 'center' }}>
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="shopper-activity">
      <div style={S.tabBar} role="tablist" aria-label="Shopping activity">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-shopper-tab={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...S.tab, ...(tab === t.key ? S.tabActive : {}) }}
          >
            {t.label}
            {counts[t.key] != null ? <span style={{ marginLeft: 4, color: '#9CA3AF' }}>{counts[t.key]}</span> : null}
          </button>
        ))}
      </div>
      {tab === 'orders' && (errors.orders ? <div style={S.error}>{errors.orders}</div> : <OrderHistoryTable orders={orders} perspective="buyer" />)}
      {tab === 'to-pay' && <ToPayPanel orders={orders} error={errors.orders} />}
      {tab === 'cancellations' && <CancellationsPanel orders={orders} error={errors.orders} />}
      {tab === 'returns' && <ReturnsPanel returns={returns} error={errors.returns} />}
      {tab === 'refunds' && <RefundsPanel returns={returns} error={errors.returns} />}
      {tab === 'warranty' && <WarrantyPanel claims={claims} error={errors.warranty} />}
      {tab === 'reviews' && <ReviewsPanel direction="posted" reviews={reviews} error={errors.reviews} emptyText="No reviews posted as a shopper." />}
      {tab === 'saved' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {errors.signals ? <div style={S.error}>{errors.signals}</div> : null}
          <SignalList
            title="SAVED PRODUCTS"
            items={signals?.savedProducts || []}
            empty="No saved products."
            to={(i) => `/admin/products/${encodeURIComponent(i.id)}/preview`}
            testId="shopper-saved-products"
          />
          <SignalList title="SAVED BRANDS" items={signals?.savedBrands || []} empty="No saved brands." thumbFor={thumbs.brand} testId="shopper-saved-brands" />
        </div>
      )}
      {tab === 'search' && <SearchHistoryPanel searches={signals?.searches || []} error={errors.signals} />}
      {tab === 'followed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SignalList
            title="FOLLOWED CREATORS"
            items={signals?.followedCreators || []}
            empty="Not following any creators."
            to={(i) => `/admin/creator-review?creatorId=${encodeURIComponent(i.id)}`}
            thumbFor={thumbs.creator}
            testId="shopper-followed-creators"
          />
          <div style={S.panel} data-testid="shopper-followed-brands">
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', marginBottom: 8 }}>FOLLOWED BRANDS ({followed.length})</div>
            {errors.followed ? (
              <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{errors.followed}</div>
            ) : followed.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontStyle: 'italic', padding: '16px 0' }}>Not following any brands.</div>
            ) : (
              followed.map((b) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #F1F3F5', fontSize: 11.5, fontWeight: 700 }}>
                  <Thumb src={b.logo} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {b.name} <span style={{ color: '#9CA3AF', fontWeight: 600 }}>· {b.category}</span>
                  </span>
                  {b.sellerId ? (
                    <Link to={`/admin/seller-profile?sellerId=${encodeURIComponent(b.sellerId)}`} style={{ color: 'var(--cms-accent)', textDecoration: 'none', fontWeight: 800 }}>
                      Seller profile →
                    </Link>
                  ) : (
                    <span style={{ color: '#9CA3AF' }}>Community brand</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {tab === 'addresses' && (errors.addresses ? <div style={S.error}>{errors.addresses}</div> : <SavedAddressesPanel addresses={addresses} />)}
    </div>
  );
}

/** Business / Shopping switch for seller and creator profiles. */
export function ProfileModeSwitch({
  mode,
  onChange,
  businessLabel,
}: {
  mode: 'business' | 'shopping';
  onChange: (m: 'business' | 'shopping') => void;
  businessLabel: string;
}) {
  const btn = (m: 'business' | 'shopping', label: string) => (
    <button
      type="button"
      onClick={() => onChange(m)}
      aria-pressed={mode === m}
      data-mode={m}
      style={{
        padding: '7px 16px',
        borderRadius: 999,
        border: 0,
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
        background: mode === m ? 'var(--cms-accent)' : 'transparent',
        color: mode === m ? '#fff' : '#4B5563',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} data-testid="profile-mode-switch">
      <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #E8EDF2', borderRadius: 999, padding: 3 }}>
        {btn('business', businessLabel)}
        {btn('shopping', 'Shopping')}
      </div>
      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
        {mode === 'business'
          ? `This account's ${businessLabel.toLowerCase()} side.`
          : 'What this account did as a shopper on the storefront — same login, same CF ID.'}
      </span>
    </div>
  );
}
