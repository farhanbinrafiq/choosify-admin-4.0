import React, { useCallback, useEffect, useMemo, useState, CSSProperties } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useRbac } from '../../../contexts/RbacContext';
import { useImpersonation } from '../../../contexts/ImpersonationContext';
import { Loader2, AlertTriangle, Phone, Mail, ArrowLeft, LogIn } from 'lucide-react';
import { AdminMessageUserButton } from '../../../components/messaging/AdminMessageUserButton';
import { authApi, type UserDetail } from '../../../services/authApi';
import { catalogApi } from '../../../services/catalogApi';
import { operationsApi, type OpsReview, type OpsStorefrontOrder, type ShopperSignalItem, type ShopperSignals } from '../../../services/operationsApi';
import type { CatalogBrand } from '../../../types/catalog';
import { Avatar } from '../../../components/shared/Avatar';
import { personaCoverGradient } from '../../../components/admin/profile/personaTheme';
import { AdminEditHistory, AdminEditModeStrip, AdminEditUserButton, useAdminEditUser } from '../../../components/admin/profile/AdminEditUser';
import { OrderHistoryTable, ReviewsPanel } from '../../../components/admin/profile/ProfileSections';
import { ProfileContactActions } from '../../../components/admin/profile/ProfileContactActions';

// ============================================================================
// Consumer Profile — the Super Admin 360° view at /admin/consumers/:id.
//
// VIEW ONLY. Every section reads a canonical source:
//   Account Information → GET /auth/users/:id (identity, lifecycle, primary phone)
//   Order History       → Order Console orders placed by this buyer (each opens /admin/orders/:orderId)
//   Reviews & Score     → review store: reviews this consumer posted
//   Saved Brands & Products, Followed Creators, Search History → shopper-signals
//     record the Web storefront syncs while the shopper is signed in
//   Followed Brands     → brand-follow store
// The former prototype widgets (lifetime value, wallet, tickets, addresses,
// connected accounts, sessions) have no server-side record, so they are not shown.
// ============================================================================

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

const TABS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'account', label: 'Account Information', icon: '⚙' },
  { key: 'orders', label: 'Order History', icon: '▤' },
  { key: 'reviews', label: 'Reviews & Score', icon: '⭐' },
  { key: 'saved', label: 'Saved Brands & Products', icon: '♡' },
  { key: 'search', label: 'Search History', icon: '⌕' },
  { key: 'brands', label: 'Followed Brands & Creators', icon: '♦' },
];

const taka = (n: number) => `৳${Math.round(n).toLocaleString('en-US')}`;

function SignalList({ title, items, empty, to, testId }: { title: string; items: ShopperSignalItem[]; empty: string; to?: (i: ShopperSignalItem) => string; testId: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 }} data-testid={testId}>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 2 }}>{title} ({items.length})</div>
      <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, marginBottom: 10 }}>Recorded from the storefront while signed in.</div>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '16px 0' }}>{empty}</div>
      ) : (
        items.map((i) => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #F1F3F5', fontSize: 11.5, fontWeight: 700 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#F4F7F9', overflow: 'hidden', flexShrink: 0 }}>
              {i.image ? <img src={i.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            </div>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {to ? <Link to={to(i)} style={{ color: '#111827', textDecoration: 'none' }}>{i.label}</Link> : i.label}
            </span>
            <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 10.5 }}>{new Date(i.at).toLocaleDateString()}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default function ConsumerProfileView() {
  const { id } = useParams<{ id: string }>();
  const uid = id ? decodeURIComponent(id) : '';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { can } = useRbac();
  const { state: impersonation, openLoginAsConfirm } = useImpersonation();

  const [account, setAccount] = useState<UserDetail | null>(null);
  const [orders, setOrders] = useState<OpsStorefrontOrder[]>([]);
  const [reviews, setReviews] = useState<OpsReview[]>([]);
  const [followed, setFollowed] = useState<CatalogBrand[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [signals, setSignals] = useState<ShopperSignals | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab');
    return t && TABS.some((x) => x.key === t) ? t : 'account';
  });

  const load = useCallback(async () => {
    if (!uid) {
      setError('No account id in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAccount(await authApi.getUserDetail(uid));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account detail.');
      setLoading(false);
      return;
    }
    const errs: Record<string, string> = {};
    await Promise.all([
      operationsApi.listOrders({ buyerId: uid }).then(setOrders).catch((e) => (errs.orders = e instanceof Error ? e.message : 'Could not load orders.')),
      operationsApi.listReviews({ userId: uid }).then(setReviews).catch((e) => (errs.reviews = e instanceof Error ? e.message : 'Could not load reviews.')),
      operationsApi
        .listUserFollowedBrandIds(uid)
        .then(async (ids) => {
          setFollowedIds(ids);
          if (!ids.length) return setFollowed([]);
          const all = await catalogApi.listBrands();
          setFollowed(all.filter((b) => ids.includes(b.id)));
        })
        .catch((e) => (errs.brands = e instanceof Error ? e.message : 'Could not load followed brands.')),
      operationsApi.getUserShopperSignals(uid).then(setSignals).catch((e) => (errs.signals = e instanceof Error ? e.message : 'Could not load saved items and searches.')),
    ]);
    setSectionErrors(errs);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = account?.displayName || '(no name on file)';
  const email = account?.email || '';
  const phone = account?.phone || '';
  const cfId = account?.choosifyUserId || '—';
  const joined = account?.createdAt ? new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const isSelf = Boolean(profile?.id && account?.uid && profile.id === account.uid);
  const showLoginAsUser = can('impersonate') && !impersonation.active && !isSelf && Boolean(account?.uid);
  const edit = useAdminEditUser({ targetUserId: uid, targetRole: 'consumer', targetLabel: name });
  const spent = useMemo(() => orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.overallTotal) || 0), 0), [orders]);
  const paidOrders = orders.filter((o) => o.status !== 'cancelled').length;

  const requestLoginAs = useCallback(() => {
    if (!account) return;
    openLoginAsConfirm({
      targetUserId: account.uid,
      displayName: account.displayName || 'User',
      roleLabel: 'Consumer',
      choosifyUserId: account.choosifyUserId || undefined,
      email: account.email,
      avatarUrl: account.avatarUrl || '',
    });
  }, [account, openLoginAsConfirm]);

  // ?impersonate=1 auto-opens the Login As confirmation (existing deep-link behaviour).
  useEffect(() => {
    if (!showLoginAsUser) return;
    if (searchParams.get('impersonate') !== '1') return;
    requestLoginAs();
    const next = new URLSearchParams(searchParams);
    next.delete('impersonate');
    setSearchParams(next, { replace: true });
  }, [showLoginAsUser, searchParams, setSearchParams, requestLoginAs]);

  const S: Record<string, CSSProperties> = useMemo(() => ({
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 },
    h1: { fontSize: 15, fontWeight: 800, color: '#111827' },
    sub: { fontSize: '11.5px', color: '#9CA3AF', fontWeight: 600, marginTop: 2 },
    hBtn: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: '11.5px', fontWeight: 800, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    grid: { display: 'grid', gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)', gap: 16, alignItems: 'start' },
    card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, overflow: 'hidden' },
    cover: { height: 80, background: personaCoverGradient('consumer'), display: 'flex', alignItems: 'center', justifyContent: 'center' },
    coverLabel: { fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', color: '#fff' },
    avatar: { width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginTop: -42, marginBottom: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
    pName: { fontSize: '13.5px', fontWeight: 800 },
    kv: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 },
    kLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.02em' },
    kValue: { fontSize: '11.5px', fontWeight: 700, marginTop: 2, color: '#111827', overflowWrap: 'anywhere' },
    kRow: { borderTop: '1px solid #F1F3F5', paddingTop: 8 },
    contact: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
    contactLink: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#2563EB', textDecoration: 'none', overflowWrap: 'anywhere' },
    panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 },
    panelTitle: { fontSize: '12.5px', fontWeight: 800, marginBottom: 2 },
    panelSub: { fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, marginBottom: 12 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 14 },
    statLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF' },
    statValue: { fontSize: 18, fontWeight: 800, color: '#111827', marginTop: 6 },
    tabBar: { display: 'flex', gap: 16, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '0 16px', overflowX: 'auto' },
    tab: { padding: '12px 4px', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '2px solid transparent', color: '#6B7280', background: 'transparent', borderTop: 0, borderLeft: 0, borderRight: 0 },
    tabActive: { color: ACCENT, borderBottom: `2px solid ${ACCENT}` },
    emptyBox: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '24px 0' },
  }), []);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
        <Loader2 size={24} className="animate-spin" style={{ opacity: 0.5, marginBottom: 10 }} />
        <div>Loading account detail…</div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <p style={{ color: '#DC2626', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error || 'Account not found.'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
          <button onClick={() => void load()} style={S.hBtn}>Retry</button>
          <button onClick={() => navigate('/admin/consumers')} style={S.hBtn}>← All Consumers</button>
        </div>
      </div>
    );
  }

  const kv = (label: string, value: React.ReactNode, mono = false, first = false) => (
    <div style={first ? undefined : S.kRow}>
      <div style={S.kLabel}>{label}</div>
      <div style={{ ...S.kValue, ...(mono ? { fontFamily: 'monospace' } : {}) }}>{value}</div>
    </div>
  );

  return (
    <div style={{ color: '#111827' }}>
      <div style={S.headRow}>
        <div>
          <div style={S.h1}>Consumer Profile</div>
          <div style={S.sub}>Read-only 360° view of this shopper across Choosify</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }} data-testid="profile-header-actions">
          {account.uid ? <AdminMessageUserButton targetUserId={account.uid} /> : null}
          {showLoginAsUser && (
            <button onClick={requestLoginAs} style={{ ...S.hBtn, borderColor: ACCENT, color: ACCENT, background: ACCENT_WASH }}>
              <LogIn size={13} /> Login As User
            </button>
          )}
          <AdminEditUserButton state={edit} />
          <button onClick={() => navigate('/admin/consumers')} style={S.hBtn}>
            <ArrowLeft size={13} /> All Consumers
          </button>
        </div>
      </div>

      <AdminEditModeStrip state={edit} />

      <div style={S.grid} className="cpv-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card} data-testid="profile-identity">
            <div style={S.cover} data-testid="consumer-cover"><span style={S.coverLabel}>CONSUMER</span></div>
            <div style={{ padding: 16, position: 'relative' }}>
              <Avatar src={account.avatarUrl} name={name} size={56} style={S.avatar} />
              <div style={S.pName}>{name}</div>
              <ProfileContactActions targetUserId={account.uid} targetName={name} email={email} phone={phone} />
              <div style={S.kv}>
                {kv('ROLE', 'Consumer', false, true)}
                {kv('CHOOSIFY USER ID', cfId, true)}
                {kv('JOINED', joined)}
                {kv('PROFILE STATUS', account.profileStatusPrimary || account.profileStatus || '—')}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={S.statGrid}>
            <div style={S.statCard}><div style={S.statLabel}>TOTAL ORDERS</div><div style={S.statValue}>{orders.length}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{orders.filter((o) => o.status === 'completed').length} completed · {orders.filter((o) => o.status === 'cancelled').length} cancelled</div></div>
            <div style={S.statCard}><div style={S.statLabel}>AVG ORDER VALUE</div><div style={S.statValue}>{paidOrders ? taka(spent / paidOrders) : '—'}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Excludes cancelled orders</div></div>
            <div style={S.statCard}><div style={S.statLabel}>SAVED ITEMS</div><div style={S.statValue}>{(signals?.savedProducts.length || 0) + (signals?.savedBrands.length || 0)}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{signals?.savedProducts.length || 0} products · {signals?.savedBrands.length || 0} brands</div></div>
            <div style={S.statCard}><div style={S.statLabel}>LIFETIME SPENT</div><div style={S.statValue}>{orders.length ? taka(spent) : '—'}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Excludes cancelled orders</div></div>
            <div style={S.statCard}><div style={S.statLabel}>REVIEWS POSTED</div><div style={S.statValue}>{reviews.length}</div></div>
            <div style={S.statCard}><div style={S.statLabel}>FOLLOWED BRANDS</div><div style={S.statValue}>{followedIds.length}</div></div>
          </div>

          <div style={S.tabBar} role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key} data-tab={t.key} onClick={() => setActiveTab(t.key)} style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'account' && (
            <>
              <div style={S.panel}>
                <div style={S.panelTitle}>ACCOUNT</div>
                <div style={S.panelSub}>From the auth service.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
                  {kv('EMAIL', email || '—', false, true)}
                  {kv('PRIMARY PHONE', phone || 'Not added', false, true)}
                  {kv('IDENTITY VERIFIED', typeof account.identityVerified === 'boolean' ? (account.identityVerified ? 'Yes' : 'No') : '—', false, true)}
                  {kv('ACCOUNT ACCESS', account.marketplaceAccess === false ? 'Limited' : 'Active', false, true)}
                </div>
              </div>
              <div style={{ ...S.panel, background: '#F8FAFC' }}>
                <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, lineHeight: 1.5 }}>
                  Delivery addresses are saved on each order (see Order History), not on the account. Saved items, followed creators and
                  search history are recorded from the storefront while the shopper is signed in; activity from before that, or while
                  signed out, stays only in their browser.
                  {edit.editing ? ' No consumer account fields can be edited by staff in this release.' : ''}
                </div>
              </div>
              <AdminEditHistory state={edit} />
            </>
          )}

          {activeTab === 'orders' &&
            (sectionErrors.orders ? (
              <div style={{ ...S.panel, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{sectionErrors.orders}</div>
            ) : (
              <OrderHistoryTable orders={orders} perspective="buyer" />
            ))}

          {activeTab === 'reviews' && <ReviewsPanel direction="posted" reviews={reviews} error={sectionErrors.reviews} emptyText="This shopper has not posted any reviews." />}

          {activeTab === 'saved' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="consumer-saved">
              {sectionErrors.signals ? <div style={{ ...S.panel, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{sectionErrors.signals}</div> : null}
              <SignalList
                title="SAVED PRODUCTS"
                items={signals?.savedProducts || []}
                empty="No saved products."
                to={(i) => `/admin/products/${encodeURIComponent(i.id)}/preview`}
                testId="consumer-saved-products"
              />
              <SignalList title="SAVED BRANDS" items={signals?.savedBrands || []} empty="No saved brands." testId="consumer-saved-brands" />
            </div>
          )}

          {activeTab === 'search' && (
            <div style={S.panel} data-testid="consumer-search-history">
              <div style={S.panelTitle}>SEARCH HISTORY</div>
              <div style={S.panelSub}>Recent storefront searches while signed in (newest first, last 50).</div>
              {sectionErrors.signals ? (
                <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{sectionErrors.signals}</div>
              ) : !signals?.searches.length ? (
                <div style={S.emptyBox}>No searches recorded.</div>
              ) : (
                signals.searches.map((s, i) => (
                  <div key={`${s.q}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid #F1F3F5', fontSize: 11.5, fontWeight: 700 }}>
                    <span>“{s.q}”</span>
                    <span style={{ color: '#9CA3AF', fontWeight: 600 }}>{new Date(s.at).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'brands' && (
            <SignalList
              title="FOLLOWED CREATORS"
              items={signals?.followedCreators || []}
              empty="Not following any creators."
              to={(i) => `/admin/creator-review?creatorId=${encodeURIComponent(i.id)}`}
              testId="consumer-followed-creators"
            />
          )}

          {activeTab === 'brands' && (
            <div style={S.panel} data-testid="consumer-followed-brands">
              <div style={S.panelTitle}>FOLLOWED BRANDS</div>
              <div style={S.panelSub}>From the brand-follow store.</div>
              {sectionErrors.brands ? (
                <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{sectionErrors.brands}</div>
              ) : followedIds.length === 0 ? (
                <div style={S.emptyBox}>Not following any brands.</div>
              ) : (
                followed.map((b) => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: '1px solid #F1F3F5', fontSize: 11.5, fontWeight: 700 }}>
                    <span>{b.name} <span style={{ color: '#9CA3AF', fontWeight: 600 }}>· {b.category}</span></span>
                    {b.sellerId ? (
                      <Link to={`/admin/seller-profile?sellerId=${encodeURIComponent(b.sellerId)}`} style={{ color: ACCENT, textDecoration: 'none', fontWeight: 800 }}>Seller profile →</Link>
                    ) : (
                      <span style={{ color: '#9CA3AF' }}>Community brand</span>
                    )}
                  </div>
                ))
              )}
              {followedIds.length > followed.length ? (
                <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, marginTop: 6 }}>{followedIds.length - followed.length} followed brand(s) no longer exist in the catalog.</div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 860px){ .cpv-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>
      {edit.dialog}
    </div>
  );
}
