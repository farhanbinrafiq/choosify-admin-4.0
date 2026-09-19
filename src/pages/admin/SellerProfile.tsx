import React, { useCallback, useEffect, useMemo, useState, CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRbac } from '../../contexts/RbacContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { Loader2, AlertTriangle, ArrowLeft, LogIn } from 'lucide-react';
import { AdminMessageUserButton } from '../../components/messaging/AdminMessageUserButton';
import { ProfileMessagePopup } from '../../components/messaging/ProfileMessagePopup';
import { catalogApi } from '../../services/catalogApi';
import { authApi, type UserDirectoryEntry } from '../../services/authApi';
import { operationsApi, type OpsVerification, type OpsStorefrontOrder } from '../../services/operationsApi';
import { cashbookApi, type FinanceSummary } from '../../services/cashbookApi';
import type { CatalogBrand, CatalogProduct } from '../../types/catalog';
import { Avatar } from '../../components/shared/Avatar';

// ============================================================================
// Seller Profile — the real /admin/seller-profile?sellerId= destination.
//
// Same approach as ConsumerProfileView.tsx (see its doc comment): PRESENTATION
// keeps the full original tab/section layout from the legacy CmsMirrorHost
// "Brand Profile" (Account Information / Verification Center / Brand Portfolio
// / Product Listings / Order History / My Earnings / Payment Info / Reviews &
// Score / Ads & Deals). FUNCTIONALITY only fills a section with real data when
// a real backend source exists; everything else keeps its shape but renders an
// honest "not available" state -- no fixture/formula-fabricated values are
// reproduced (that fabrication -- Component.BRANDS, fake orders/reviews/ads --
// is exactly what made the legacy destination worthless; see the migration
// audit). Login As User / Message reuse the same ImpersonationContext /
// messaging components as every other real profile page in this app.
//
// A seller can own multiple brands (CatalogBrand.sellerId) -- the left card
// shows the primary (first) brand; Account Information lists every owned
// brand with its own real fields.
// ============================================================================

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

const TABS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'account', label: 'Account Information', icon: '⚙' },
  { key: 'verification', label: 'Verification Center', icon: '▤' },
  { key: 'portfolio', label: 'Brand Portfolio', icon: '♦' },
  { key: 'products', label: 'Product Listings', icon: '▦' },
  { key: 'orders', label: 'Order History', icon: '▤' },
  { key: 'earnings', label: 'My Earnings', icon: '৳' },
  { key: 'payment', label: 'Payment Info', icon: '💳' },
  { key: 'reviews', label: 'Reviews & Score', icon: '●' },
  { key: 'ads', label: 'Ads & Deals', icon: '⛿' },
];

export default function SellerProfile() {
  const [searchParams] = useSearchParams();
  const sellerId = searchParams.get('sellerId') || '';
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = useRbac();
  const { state: impersonation, openLoginAsConfirm } = useImpersonation();
  const [showMessagePopup, setShowMessagePopup] = useState(false);
  const [activeTab, setActiveTab] = useState('account');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<UserDirectoryEntry | null>(null);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [verifications, setVerifications] = useState<OpsVerification[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [orders, setOrders] = useState<OpsStorefrontOrder[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [financeError, setFinanceError] = useState(false);

  const load = useCallback(async () => {
    if (!sellerId) {
      setError('No sellerId in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [allBrands, directory] = await Promise.all([
        catalogApi.listBrands(),
        authApi.getUsersDirectory(),
      ]);
      const ownedBrands = allBrands.filter((b) => b.sellerId === sellerId);
      setBrands(ownedBrands);
      setUser(directory.find((u) => u.uid === sellerId) || null);

      const ownedBrandIds = ownedBrands.map((b) => b.id);
      const [allBrandVerifications, productsByBrand, sellerOrders] = await Promise.all([
        operationsApi.listVerifications({ entityType: 'brand' }),
        Promise.all(ownedBrandIds.map((id) => catalogApi.listProducts({ brandId: id }))),
        operationsApi.listOrders({ sellerId }),
      ]);
      setVerifications(allBrandVerifications.filter((v) => ownedBrandIds.includes(v.entityId)));
      setProducts(productsByBrand.flat());
      setOrders(sellerOrders);

      try {
        setFinance(await cashbookApi.getFinanceSummary(sellerId));
        setFinanceError(false);
      } catch {
        // Staff-only endpoint; a non-privileged viewer or a seller with no
        // cashbook yet gets a real 403/empty state, not a fabricated number.
        setFinanceError(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load seller profile.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const primaryBrand = brands[0];
  const displayName = user?.displayName || primaryBrand?.name || 'Unknown Seller';
  const email = user?.email || '—';
  const cfId = user?.choosifyUserId || '—';
  const verifiedCount = useMemo(() => brands.filter((b) => b.verifiedStatus).length, [brands]);
  const isSelf = Boolean(profile?.id && sellerId && profile.id === sellerId);
  const showLoginAsUser = can('impersonate') && !impersonation.active && !isSelf && Boolean(sellerId);

  const requestLoginAs = useCallback(() => {
    if (!sellerId) return;
    openLoginAsConfirm({
      targetUserId: sellerId,
      displayName,
      roleLabel: 'Seller',
      choosifyUserId: user?.choosifyUserId || undefined,
      email: user?.email,
      avatarUrl: user?.avatarUrl || undefined,
    });
  }, [sellerId, displayName, user, openLoginAsConfirm]);

  const S: Record<string, CSSProperties> = useMemo(() => ({
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 },
    h1: { fontSize: 15, fontWeight: 800, color: '#111827' },
    sub: { fontSize: '11.5px', color: '#9CA3AF', fontWeight: 600, marginTop: 2 },
    hBtn: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: '11.5px', fontWeight: 800, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    grid: { display: 'grid', gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)', gap: 16, alignItems: 'start' },
    card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, overflow: 'hidden' },
    cover: { height: 80, background: `linear-gradient(120deg,#FBCFE8 0%,#FDE68A 50%, ${ACCENT} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    coverLabel: { fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', color: '#fff' },
    avatar: { width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginTop: -42, marginBottom: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
    pName: { fontSize: '13.5px', fontWeight: 800 },
    pEmail: { fontSize: 11, color: '#2563EB', fontWeight: 600, marginTop: 2 },
    kv: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 },
    kLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.02em' },
    kValue: { fontSize: '11.5px', fontWeight: 700, marginTop: 2, color: '#111827' },
    kRow: { borderTop: '1px solid #F1F3F5', paddingTop: 8 },
    btnRow: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' },
    panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 },
    panelTitle: { fontSize: '12.5px', fontWeight: 800, marginBottom: 2 },
    panelSub: { fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, marginBottom: 12 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 14 },
    statLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF' },
    statValue: { fontSize: 18, fontWeight: 800, color: '#111827', marginTop: 6 },
    statEmpty: { fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginTop: 6 },
    tabBar: { display: 'flex', gap: 16, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '0 16px', overflowX: 'auto' },
    tab: { padding: '12px 4px', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '2px solid transparent', color: '#6B7280' },
    tabActive: { color: ACCENT, borderBottom: `2px solid ${ACCENT}` },
    emptyBox: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '24px 0' },
    sectionTitle: { fontSize: 12, fontWeight: 800, marginBottom: 10 },
    row: { fontSize: '11.5px', fontWeight: 700, padding: '10px 0', borderTop: '1px solid #F1F3F5', display: 'flex', justifyContent: 'space-between', gap: 10 },
    badge: { padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' },
  }), []);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
        <Loader2 size={24} className="animate-spin" style={{ opacity: 0.5, marginBottom: 10 }} />
        <div>Loading seller profile…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <p style={{ color: '#DC2626', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
          <button onClick={() => void load()} style={S.hBtn}>Retry</button>
          <button onClick={() => navigate('/admin/seller-management')} style={S.hBtn}>← Seller Management</button>
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
          <div style={S.h1}>Seller Profile</div>
          <div style={S.sub}>Real seller account, verification, and marketplace status</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {sellerId ? <AdminMessageUserButton targetUserId={sellerId} /> : null}
          {showLoginAsUser && (
            <button onClick={requestLoginAs} style={{ ...S.hBtn, borderColor: ACCENT, color: ACCENT, background: ACCENT_WASH }}>
              <LogIn size={13} /> Login As User
            </button>
          )}
          <button onClick={() => navigate('/admin/seller-management')} style={S.hBtn}>
            <ArrowLeft size={13} /> All Sellers
          </button>
        </div>
      </div>

      <div style={S.grid} className="spv-grid">
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card}>
            <div style={S.cover}><span style={S.coverLabel}>SELLER</span></div>
            <div style={{ padding: 16, position: 'relative' }}>
              <Avatar src={user?.avatarUrl || null} name={displayName} size={56} style={S.avatar} />
              <div style={S.pName}>{displayName}</div>
              <div style={S.pEmail}>{email}</div>

              <div style={S.kv}>
                {kv('ROLE', 'Seller', false, true)}
                {kv('CHOOSIFY USER ID', cfId, true)}
                {kv('OWNED BRANDS', brands.length ? brands.map((b) => b.name).join(', ') : '—')}
                {kv('VERIFIED BRANDS', `${verifiedCount} / ${brands.length}`)}
                {kv('PRIMARY CATEGORY', primaryBrand?.category || '—')}
                {kv('WEBSITE', primaryBrand?.website || '—')}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={S.statGrid}>
            <div style={S.statCard}>
              <div style={S.statLabel}>OWNED BRANDS</div>
              <div style={S.statValue}>{brands.length}</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>LIVE PRODUCTS</div>
              <div style={S.statValue}>{products.length}</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>ORDERS</div>
              <div style={S.statValue}>{orders.length}</div>
            </div>
          </div>

          <div style={S.tabBar}>
            {TABS.map((t) => (
              <div key={t.key} onClick={() => setActiveTab(t.key)} style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}>
                {t.icon} {t.label}
              </div>
            ))}
          </div>

          {activeTab === 'account' && (
            <>
              {brands.length === 0 && (
                <div style={S.panel}><div style={S.emptyBox}>This seller owns no brands yet.</div></div>
              )}
              {brands.map((b) => (
                <div key={b.id} style={S.panel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={S.panelTitle}>{b.name}</div>
                      <div style={{ ...S.panelSub, fontFamily: 'monospace' }}>{b.brandReferenceId || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ ...S.badge, background: '#F1F5F9', color: '#475569' }}>{b.claimStatus}</span>
                      {b.marketplaceStatus && (
                        <span style={{ ...S.badge, background: ACCENT_WASH, color: ACCENT }}>{b.marketplaceStatus}</span>
                      )}
                    </div>
                  </div>
                  {kv('CATEGORY', b.category, false, true)}
                  {kv('EMAIL', b.overview?.email || '—')}
                  {kv('PHONE', b.overview?.phone || '—')}
                  {kv('ADDRESS', b.overview?.address || '—')}
                  {kv('FOLLOWERS', String(b.followers ?? 0))}
                  {kv('JOINED', b.createdAt?.slice(0, 10) || '—')}
                </div>
              ))}
            </>
          )}

          {activeTab === 'verification' && (
            <div style={S.card}>
              <div style={{ padding: '14px 16px', fontSize: 12, fontWeight: 800, borderBottom: '1px solid #F1F3F5' }}>REAL VERIFICATION RECORDS</div>
              {verifications.length === 0 ? (
                <div style={S.emptyBox}>No verification records for this seller's brands.</div>
              ) : (
                verifications.map((v) => (
                  <div key={v.id} style={{ ...S.row, padding: '12px 16px' }}>
                    <div>
                      <div>{brands.find((b) => b.id === v.entityId)?.name || v.entityId}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Submitted {v.created_at ? v.created_at.slice(0, 10) : '—'}</div>
                    </div>
                    <span style={{ ...S.badge, background: '#FEF3C7', color: '#B45309' }}>{v.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>BRAND PORTFOLIO EDITING</div>
              <div style={S.panelSub}>Cover image, story, FAQs, promo codes and storefront presentation.</div>
              <div style={S.emptyBox}>
                Not available in this admin view yet. The seller's own Brand Studio already edits this data live — no
                separate admin editor has been built here.
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div style={S.card}>
              <div style={{ padding: '14px 16px', fontSize: 12, fontWeight: 800, borderBottom: '1px solid #F1F3F5' }}>PRODUCT LISTINGS</div>
              {products.length === 0 ? (
                <div style={S.emptyBox}>No products listed under this seller's brands.</div>
              ) : (
                products.map((p) => (
                  <div key={p.id} style={{ ...S.row, padding: '12px 16px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{p.brandName} · {p.productReferenceId || p.id}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div>৳{p.price?.toLocaleString?.() ?? p.price}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{p.status}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div style={S.card}>
              <div style={{ padding: '14px 16px', fontSize: 12, fontWeight: 800, borderBottom: '1px solid #F1F3F5' }}>ALL ASSOCIATED ORDERS</div>
              {orders.length === 0 ? (
                <div style={S.emptyBox}>No orders found for this seller.</div>
              ) : (
                orders.map((o) => (
                  <div key={o.id} style={{ ...S.row, padding: '12px 16px' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace' }}>{o.orderId}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{o.createdAt?.slice(0, 10)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>৳{o.overallTotal?.toLocaleString?.() ?? o.overallTotal}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{o.status}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'earnings' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>MY EARNINGS</div>
              <div style={S.panelSub}>Real escrow-derived balance — GET /finance/summary.</div>
              {financeError || !finance ? (
                <div style={S.emptyBox}>No finance summary available for this seller yet.</div>
              ) : (
                <div style={S.statGrid}>
                  <div style={S.statCard}><div style={S.statLabel}>LIFETIME EARNINGS</div><div style={S.statValue}>৳{finance.lifetimeEarnings.toLocaleString()}</div></div>
                  <div style={S.statCard}><div style={S.statLabel}>AVAILABLE BALANCE</div><div style={S.statValue}>৳{finance.availableBalance.toLocaleString()}</div></div>
                  <div style={S.statCard}><div style={S.statLabel}>PENDING APPROVAL</div><div style={S.statValue}>৳{finance.pendingApproval.toLocaleString()}</div></div>
                  <div style={S.statCard}><div style={S.statLabel}>ESCROW HELD</div><div style={S.statValue}>৳{finance.escrowHeld.toLocaleString()}</div></div>
                  <div style={S.statCard}><div style={S.statLabel}>CHOOSIFY COMMISSION</div><div style={S.statValue}>{finance.choosifyCommissionPercent}%</div></div>
                  <div style={S.statCard}><div style={S.statLabel}>NET WITHDRAWABLE</div><div style={S.statValue}>৳{finance.netWithdrawable.toLocaleString()}</div></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'payment' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>PAYMENT INFO</div>
              <div style={S.panelSub}>Payout bank/mobile-wallet account details.</div>
              <div style={S.emptyBox}>Not available — no payout account persistence exists in the backend yet.</div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>REVIEWS &amp; SCORE</div>
              <div style={S.panelSub}>Buyer reviews and trust scoring for this seller's brands.</div>
              <div style={S.emptyBox}>Not available here yet — see Trust &amp; Analytics / Moderation Center for real review data.</div>
            </div>
          )}

          {activeTab === 'ads' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>ADS &amp; DEALS</div>
              <div style={S.panelSub}>Active campaigns and sponsored placements for this seller.</div>
              <div style={S.emptyBox}>Not available here yet — see Ads &amp; Deals Studio for this seller's real campaigns.</div>
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 860px){ .spv-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>

      {showMessagePopup && sellerId ? (
        <ProfileMessagePopup targetUserId={sellerId} targetName={displayName} onClose={() => setShowMessagePopup(false)} />
      ) : null}
    </div>
  );
}
