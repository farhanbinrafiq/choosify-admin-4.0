import React, { useCallback, useEffect, useMemo, useState, CSSProperties } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ProfileModeSwitch, ShopperActivity } from '../../components/admin/profile/ShopperActivity';
import { profileReturnTarget } from '../../lib/profileReturn';
import { useAuth } from '../../contexts/AuthContext';
import { useRbac } from '../../contexts/RbacContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { Loader2, AlertTriangle, ArrowLeft, LogIn, Phone, Mail } from 'lucide-react';
import { catalogApi, type GuideManageRow } from '../../services/catalogApi';
import { authApi, type UserDetail } from '../../services/authApi';
import { operationsApi, type OpsReview, type OpsStorefrontOrder } from '../../services/operationsApi';
import { cashbookApi, type FinanceSummary } from '../../services/cashbookApi';
import type { CatalogBrand, CatalogGuide, CatalogProduct } from '../../types/catalog';
import { Avatar } from '../../components/shared/Avatar';
import { AccountEntitlementsPanel } from '../../components/admin/EntitlementAccessPanels';
import { SellerBrandHandles, canViewPublicHandles, publicProfileUrl } from '../../components/admin/PublicHandlePanels';
import { personaCoverGradient } from '../../components/admin/profile/personaTheme';
import { AccountDetailsSection } from '../../components/admin/profile/AccountDetailsEditor';
import { AdminEditHistory, AdminEditModeStrip, AdminEditUserButton, useAdminEditUser } from '../../components/admin/profile/AdminEditUser';
import { AdsDealsPanel, GuideListingsTable, OrderHistoryTable, ProductListingsTable, ReviewsPanel, SellerEarningsPanel } from '../../components/admin/profile/ProfileSections';
import { MarketplaceStatusBadge, PhotoVerificationBadge } from '../../components/admin/profile/PhotoVerificationBadge';
import { PayoutInfoPanel } from '../../components/admin/profile/PayoutInfoPanel';
import { AccountActivityPanel } from '../../components/admin/profile/AccountActivityPanel';
import { BrandPortfolioView } from '../../components/admin/profile/BrandPortfolioView';
import { VerificationCenterPanel } from '../../components/admin/profile/VerificationCenterPanel';
import { ClaimReviewSection } from '../../components/admin/claims/ClaimReviewSection';
import { ApplicationReviewSection } from '../../components/admin/claims/ApplicationReviewSection';
import { MarketplaceAccessSection } from '../../components/admin/profile/MarketplaceAccessSection';
import { ProfileMessagePopup } from '../../components/messaging/ProfileMessagePopup';
import { ProfileContactActions } from '../../components/admin/profile/ProfileContactActions';

// ============================================================================
// Seller Profile — the Super Admin 360° view at /admin/seller-profile?sellerId=.
//
// VIEW ONLY by default. Every tab is an aggregation over a canonical system:
//   Account Information → auth user detail + catalog brands + Marketplace Access (with recorded reasons)
//   Verification Center → /operations/verifications (documents, decisions, audit trail; canonical review actions)
//   Brand Portfolio     → the brand record rendered by Brand Studio's own BrandProfilePresentation
//   Product Listings    → Products & Inventory (catalog products of the seller's brands)
//   Order History       → Order Console orders (each opens /admin/orders/:orderId)
//   My Earnings         → escrow-derived /finance/summary
//   Payment Info        → not stored server-side (reported honestly)
//   Reviews & Score     → review store: reviews received on the seller's products + reviews posted
//   Ads & Deals         → Ads & Deals records owned by the seller + brand promo codes
// Edit User opens a reason-recorded edit session; edits always go through the
// canonical editors (Brand Studio / Product Studio / Ads & Deals Studio).
// ============================================================================

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

const TABS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'account', label: 'Account Information', icon: '⚙' },
  { key: 'verification', label: 'Verification Center', icon: '▤' },
  { key: 'portfolio', label: 'Brand Portfolio', icon: '♦' },
  { key: 'products', label: 'Product Listings', icon: '▦' },
  { key: 'guides', label: 'Guides', icon: '📖' },
  { key: 'orders', label: 'Order History', icon: '▤' },
  { key: 'earnings', label: 'My Earnings', icon: '৳' },
  { key: 'payment', label: 'Payment Info', icon: '💳' },
  { key: 'reviews', label: 'Reviews & Score', icon: '●' },
  { key: 'ads', label: 'Ads & Deals', icon: '⛿' },
  { key: 'features', label: 'Feature Access', icon: '⚑' },
  { key: 'activity', label: 'Activity Log', icon: '⏱' },
];

const LIVE = new Set(['live', 'active', 'published']);

export default function SellerProfile() {
  const [searchParams] = useSearchParams();
  const sellerId = searchParams.get('sellerId') || '';
  /** Back to the exact management tab/list this profile was opened from. */
  const backTo = profileReturnTarget(useLocation().state, 'seller');
  /** Opened from the Ownership Claims queue: review this account's claim on top of its full profile. */
  const claimId = searchParams.get('claimId') || '';
  /** Opened from the Requests tab: review this account's Seller/Creator application on top of its full profile. */
  const applicationId = searchParams.get('applicationId') || '';
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = useRbac();
  const { state: impersonation, openLoginAsConfirm } = useImpersonation();
  const [showMessagePopup, setShowMessagePopup] = useState(false);
  const initialTab = searchParams.get('tab') === 'handle' ? 'account' : searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => (initialTab && TABS.some((t) => t.key === initialTab) ? initialTab : 'account'));
  // Business (seller/creator) vs Shopping (this same account as a storefront shopper).
  const [mode, setMode] = useState<'business' | 'shopping'>(() => (searchParams.get('mode') === 'shopping' ? 'shopping' : 'business'));
  const shownTab = mode === 'business' ? activeTab : '';
  const showHandles = canViewPublicHandles(profile?.role);
  const visibleTabs = TABS;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [guides, setGuides] = useState<GuideManageRow[]>([]);
  const [guideViews, setGuideViews] = useState<Map<string, string | number | undefined>>(new Map());
  const [orders, setOrders] = useState<OpsStorefrontOrder[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [financeError, setFinanceError] = useState(false);
  const [received, setReceived] = useState<OpsReview[]>([]);
  const [posted, setPosted] = useState<OpsReview[]>([]);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  // quiet: refresh in place (no full-page skeleton), e.g. after an inline field save.
  const load = useCallback(async (quiet = false) => {
    if (!sellerId) {
      setError('No sellerId in the URL.');
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [allBrands, detail] = await Promise.all([catalogApi.listBrands(), authApi.getUserDetail(sellerId).catch(() => null)]);
      const ownedBrands = allBrands.filter((b) => b.sellerId === sellerId);
      setBrands(ownedBrands);
      setUser(detail);
      const [productsByBrand, sellerOrders] = await Promise.all([
        Promise.all(ownedBrands.map((b) => catalogApi.listProducts({ brandId: b.id }))),
        operationsApi.listOrders({ sellerId }),
      ]);
      setProducts(productsByBrand.flat());
      setOrders(sellerOrders);
      // Guides the seller's brands published (Guide Studio, publisherType "brand").
      const brandIds = new Set(ownedBrands.map((b) => b.id));
      const [manage, publicGuides] = await Promise.all([
        catalogApi.manageGuides({ status: 'all' }).then((r) => r.data || []).catch(() => [] as GuideManageRow[]),
        catalogApi.listGuides().catch(() => [] as CatalogGuide[]),
      ]);
      setGuides(manage.filter((g) => g.publisherType === 'brand' && g.publisherBrandId && brandIds.has(g.publisherBrandId)));
      setGuideViews(new Map(publicGuides.map((g) => [g.id, (g as { views?: string | number }).views])));
      try {
        const [r, p] = await Promise.all([operationsApi.listReviews({ sellerId }), operationsApi.listReviews({ userId: sellerId })]);
        setReceived(r);
        setPosted(p);
        setReviewsError(null);
      } catch (e) {
        setReviewsError(e instanceof Error ? e.message : 'Could not load reviews.');
      }
      try {
        setFinance(await cashbookApi.getFinanceSummary(sellerId));
        setFinanceError(false);
      } catch {
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
  const email = user?.email || '';
  const phone = user?.phone || primaryBrand?.overview?.phone || '';
  const cfId = user?.choosifyUserId || '—';
  const verifiedCount = useMemo(() => brands.filter((b) => b.verifiedStatus).length, [brands]);
  const liveProducts = useMemo(() => products.filter((p) => LIVE.has(String(p.status || '').toLowerCase())).length, [products]);
  const isSelf = Boolean(profile?.id && sellerId && profile.id === sellerId);
  const showLoginAsUser = can('impersonate') && !impersonation.active && !isSelf && Boolean(sellerId);
  const edit = useAdminEditUser({ targetUserId: sellerId, targetRole: 'seller', targetLabel: displayName });

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

  const ratedReceived = received.filter((r) => Number(r.rating) > 0);
  const reviewScore = ratedReceived.length ? Math.round((ratedReceived.reduce((sum, r) => sum + Number(r.rating), 0) / ratedReceived.length / 5) * 100) : null;
  const S: Record<string, CSSProperties> = useMemo(() => ({
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 },
    h1: { fontSize: 15, fontWeight: 800, color: '#111827' },
    sub: { fontSize: '11.5px', color: '#9CA3AF', fontWeight: 600, marginTop: 2 },
    hBtn: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: '11.5px', fontWeight: 800, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    grid: { display: 'grid', gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)', gap: 16, alignItems: 'start' },
    card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, overflow: 'hidden' },
    cover: { height: 80, background: personaCoverGradient('seller'), display: 'flex', alignItems: 'center', justifyContent: 'center' },
    coverLabel: { fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', color: '#fff' },
    avatar: { width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginTop: -42, marginBottom: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
    pName: { fontSize: '13.5px', fontWeight: 800 },
    kv: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 },
    kLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.02em' },
    kValue: { fontSize: '11.5px', fontWeight: 700, marginTop: 2, color: '#111827', overflowWrap: 'anywhere' },
    kRow: { borderTop: '1px solid #F1F3F5', paddingTop: 8 },
    contact: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
    contactLink: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#2563EB', textDecoration: 'none', overflowWrap: 'anywhere' },
    panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, padding: 16 },
    panelTitle: { fontSize: '12.5px', fontWeight: 800, marginBottom: 2 },
    panelSub: { fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, marginBottom: 12 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, padding: 14 },
    statLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF' },
    statValue: { fontSize: 18, fontWeight: 800, color: '#111827', marginTop: 6 },
    tabBar: { display: 'flex', gap: 16, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 14, padding: '0 16px', overflowX: 'auto' },
    tab: { padding: '12px 4px', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '2px solid transparent', color: '#6B7280', background: 'transparent', borderTop: 0, borderLeft: 0, borderRight: 0 },
    tabActive: { color: ACCENT, borderBottom: `2px solid ${ACCENT}` },
    emptyBox: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '24px 0' },
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
          <div style={S.sub}>Read-only 360° view of this seller across Choosify</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }} data-testid="profile-header-actions">
          {showLoginAsUser && (
            <button onClick={requestLoginAs} style={{ ...S.hBtn, borderColor: ACCENT, color: ACCENT, background: ACCENT_WASH }}>
              <LogIn size={13} /> Login As User
            </button>
          )}
          <AdminEditUserButton state={edit} />
          <button onClick={() => navigate(backTo.href)} style={S.hBtn} data-testid="profile-back">
            <ArrowLeft size={13} /> {backTo.label}
          </button>
        </div>
      </div>

      <AdminEditModeStrip state={edit} />
      {claimId ? <ClaimReviewSection claimId={claimId} onDecided={() => void load()} /> : null}
      {applicationId ? <ApplicationReviewSection applicationId={applicationId} onDecided={() => void load()} /> : null}

      <div style={S.grid} className="spv-grid">
        {/* Identity card — information only; actions live in the header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card} data-testid="profile-identity">
            <div style={S.cover}><span style={S.coverLabel}>SELLER</span></div>
            <div style={{ padding: 16, position: 'relative' }}>
              <Avatar src={user?.avatarUrl || primaryBrand?.logo || null} name={displayName} size={56} style={S.avatar} />
              <div style={S.pName}>{displayName}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <PhotoVerificationBadge entityType="brand" entityIds={brands.map((b) => b.id)} currentAvatarUrl={user?.avatarUrl} />
                <MarketplaceStatusBadge active={brands.some((b) => b.marketplaceAccess && !['suspended', 'restricted', 'revoked'].includes(String(b.marketplaceStatus || '')))} status={brands[0]?.marketplaceStatus} />
              </div>
              <ProfileContactActions targetUserId={sellerId} targetName={displayName} email={email} phone={phone} phoneTitle={user?.phoneSource === 'partner_application' ? 'From the partner application' : undefined} />
              <div style={S.kv}>
                {kv('ROLE', 'Seller', false, true)}
                {kv('CHOOSIFY USER ID', cfId, true)}
                {kv('ACCOUNT STATUS', user?.profileStatusPrimary || user?.profileStatus || '—')}
                {kv('OWNED BRANDS', brands.length ? brands.map((b) => b.name).join(', ') : '—')}
                {kv('VERIFIED BRANDS', `${verifiedCount} / ${brands.length}`)}
                {kv('PRIMARY CATEGORY', primaryBrand?.category || '—')}
                {kv('WEBSITE', primaryBrand?.website || '—')}
                {kv('JOINED', user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—')}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={S.statGrid}>
            <div style={S.statCard}><div style={S.statLabel}>OWNED BRANDS</div><div style={S.statValue}>{brands.length}</div></div>
            <div style={S.statCard}><div style={S.statLabel}>LIVE PRODUCTS</div><div style={S.statValue}>{liveProducts} <span style={{ fontSize: 11, color: '#9CA3AF' }}>/ {products.length}</span></div></div>
            <div style={S.statCard}><div style={S.statLabel}>ORDERS</div><div style={S.statValue}>{orders.length}</div></div>
            <div style={S.statCard}><div style={S.statLabel}>LIFETIME EARNINGS</div><div style={S.statValue}>{finance ? `৳${Math.round(finance.lifetimeEarnings).toLocaleString('en-US')}` : '—'}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{finance ? `Available ৳${Math.round(finance.availableBalance).toLocaleString('en-US')}` : 'Not available'}</div></div>
            <div style={S.statCard}><div style={S.statLabel}>REVIEW SCORE</div><div style={S.statValue}>{reviewScore !== null ? `${reviewScore}/100` : '—'}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{reviewScore !== null ? 'Average rating ÷ 5' : 'No ratings yet'}</div></div>
            <div style={S.statCard}><div style={S.statLabel}>REVIEWS RECEIVED</div><div style={S.statValue}>{received.length}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{received.filter((r) => Number(r.rating) >= 4).length} positive · {received.filter((r) => Number(r.rating) > 0 && Number(r.rating) < 2.5).length} negative</div></div>
          </div>

          <ProfileModeSwitch mode={mode} onChange={setMode} businessLabel="Seller" />
          {mode === 'shopping' && sellerId ? <ShopperActivity userId={sellerId} /> : null}
          {mode === 'business' && (
          <div style={S.tabBar} role="tablist">
            {visibleTabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key} data-tab={t.key} onClick={() => setActiveTab(t.key)} style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          )}

          {shownTab === 'account' && (
            <>
              {edit.editing && sellerId ? (
                <AccountDetailsSection
                  userId={sellerId}
                  canOverrideNameLock={['super_admin', 'admin'].includes(String(profile?.role || ''))}
                  onSaved={() => void load(true)}
                  panelStyle={S.panel}
                  titleStyle={S.panelTitle}
                />
              ) : null}
              <div style={S.panel} data-testid="account-lifecycle">
                <div style={S.panelTitle}>ACCOUNT</div>
                <div style={S.panelSub}>Seller account lifecycle from the auth service.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
                  {kv('PARTNER APPLICATION', user?.partnerApplicationStatus || '—', false, true)}
                  {kv('IDENTITY VERIFIED', user ? (user.identityVerified ? 'Yes' : 'No') : '—', false, true)}
                  {kv('ACCOUNT MARKETPLACE ACCESS', user ? (user.marketplaceAccess ? 'On' : 'Off') : '—', false, true)}
                  {kv('RESUBMISSION REQUESTED', user ? (user.resubmissionRequested ? 'Yes' : 'No') : '—', false, true)}
                </div>
              </div>
              {brands.length === 0 && <div style={S.panel}><div style={S.emptyBox}>This seller owns no brands yet.</div></div>}
              {brands.map((b) => (
                <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={S.panel}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <div style={S.panelTitle}>{b.name}</div>
                        <div style={{ ...S.panelSub, fontFamily: 'monospace' }}>{b.brandReferenceId || b.id}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ ...S.badge, background: '#F1F5F9', color: '#475569' }}>{b.claimStatus}</span>
                        {b.marketplaceStatus && <span style={{ ...S.badge, background: ACCENT_WASH, color: ACCENT }}>{b.marketplaceStatus}</span>}
                      </div>
                    </div>
                    {kv('CATEGORY', b.category, false, true)}
                    {kv('EMAIL', b.overview?.email || '—')}
                    {kv('PHONE', b.overview?.phone || '—')}
                    {kv('ADDRESS', b.overview?.address || '—')}
                    {kv('FOLLOWERS', String(b.followers ?? 0))}
                    {kv('CREATED', b.createdAt?.slice(0, 10) || '—')}
                    {kv('PUBLIC HANDLE', (b as { publicHandle?: string | null }).publicHandle ? `@${(b as { publicHandle?: string | null }).publicHandle}` : 'None')}
                    {kv(
                      'PUBLIC PROFILE',
                      <a
                        href={publicProfileUrl('brand', { handle: (b as { publicHandle?: string | null }).publicHandle, slug: b.slug, id: b.id })}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'none', overflowWrap: 'anywhere' as const }}
                      >
                        {publicProfileUrl('brand', { handle: (b as { publicHandle?: string | null }).publicHandle, slug: b.slug, id: b.id })}
                      </a>,
                    )}
                  </div>
                  <MarketplaceAccessSection
                    entityType="brand"
                    brand={b}
                    onChanged={(u) => setBrands((list) => list.map((x) => (x.id === (u as CatalogBrand).id ? (u as CatalogBrand) : x)))}
                  />
                </div>
              ))}
              {/* Public Handle (brand @handles: history + staff override) lives with the account details. */}
              {/* Handle management (history + staff override) only while editing, or when opened from a handle request. */}
              {showHandles && brands.length && (edit.editing || searchParams.get('tab') === 'handle') ? (
                <SellerBrandHandles brands={brands} initialBrandId={searchParams.get('brandId')} />
              ) : null}
              <AdminEditHistory state={edit} />
            </>
          )}

          {shownTab === 'verification' && (
            <VerificationCenterPanel
              entityType="brand"
              entities={brands.map((b) => ({ id: b.id, name: b.name }))}
              emptyHint="The seller submits documents from their own Seller Profile → Verification Center."
              onRequestDocuments={() => setShowMessagePopup(true)}
            />
          )}

          {shownTab === 'portfolio' && <BrandPortfolioView brands={brands} products={products} editing={edit.editing} />}

          {shownTab === 'products' && <ProductListingsTable products={products} editing={edit.editing} />}

          {shownTab === 'guides' && <GuideListingsTable guides={guides} views={guideViews} ownerLabel="this seller’s brands" />}

          {shownTab === 'orders' && <OrderHistoryTable orders={orders} sellerId={sellerId} perspective="seller" />}

          {shownTab === 'earnings' && <SellerEarningsPanel finance={finance} unavailable={financeError} />}

          {shownTab === 'payment' && <PayoutInfoPanel userId={sellerId} ownerLabel="seller" />}

          {shownTab === 'reviews' && (
            <>
              <ReviewsPanel direction="received" reviews={received} error={reviewsError} emptyText="No buyer reviews on this seller’s products yet." />
              <ReviewsPanel direction="posted" reviews={posted} error={reviewsError} emptyText="This account has not posted any reviews." />
            </>
          )}

          {shownTab === 'ads' && <AdsDealsPanel ownerUserId={sellerId} brands={brands} editing={edit.editing} />}

          {shownTab === 'activity' && <AccountActivityPanel userId={sellerId} ownerLabel="this seller account" />}

          {shownTab === 'features' && (
            <AccountEntitlementsPanel
              userId={sellerId}
              canMutate={false}
              manageHref={`/admin/feature-access?view=accounts&userId=${encodeURIComponent(sellerId)}`}
              auditHref={`/admin/feature-access?view=audit&userId=${encodeURIComponent(sellerId)}`}
            />
          )}
        </div>
      </div>

      <style>{`@media (max-width: 860px){ .spv-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>

      {edit.dialog}
      {showMessagePopup && sellerId ? (
        <ProfileMessagePopup targetUserId={sellerId} targetName={displayName} onClose={() => setShowMessagePopup(false)} />
      ) : null}
    </div>
  );
}
