import React, { Suspense, lazy, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NavAttentionProvider } from './contexts/NavAttentionContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';
import { EntitlementsProvider, useEntitlements } from './contexts/EntitlementsContext';
import { AdminLayout } from './components/AdminLayout';
import { AdminWorkspaceLayout } from './components/Layout/AdminWorkspaceLayout';
import { CmsMirrorHost } from './cms-mirror/CmsMirrorHost';
import { TempRoleSwitcher } from './components/TempRoleSwitcher';
import { OrdersProvider } from './contexts/OrdersContext';
import { ReturnsProvider } from './contexts/ReturnsContext';
import { TrustProvider } from './contexts/TrustContext';
import { DisputeProvider } from './contexts/DisputeContext';
import { CouponsProvider } from './contexts/CouponsContext';
import { ReviewModerationProvider } from './contexts/ReviewModeration';
import { CashBookProvider } from './contexts/CashBookContext';
import { LogisticsProvider } from './contexts/LogisticsContext';
import { InventoryProvider } from './contexts/InventoryContext';
import { FeeChargesProvider } from './contexts/FeeChargesContext';
import { catalogApi } from './services/catalogApi';
import { getMyProfilePath } from './lib/userDisplay';
import { inspectionUniversalPath } from './lib/impersonationRouting';
import { MarketplaceAccessGate } from './components/MarketplaceAccessLock';
import { AdminPageSkeleton } from './components/common/skeletons';

const routeSuspenseFallback = <AdminPageSkeleton variant="generic" />;

// Lazy load pages
const CashBookHub = lazy(() => import('./pages/admin/CashBookHub'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForcePasswordChangePage = lazy(() => import('./pages/ForcePasswordChangePage'));
const SellerSignupPage = lazy(() => import('./pages/SellerSignupPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
// Profile & Detail Pages
const UnifiedProfileShell = lazy(() => import('./pages/admin/profiles/UnifiedProfileShell'));
const SellerDashboardPreview = lazy(() => import('./pages/admin/previews/SellerDashboardPreview'));
const RecommendationPreview = lazy(() => import('./pages/admin/previews/RecommendationPreview'));
const Products = lazy(() => import('./pages/admin/Products'));
const FeeChargesEngine = lazy(() => import('./pages/admin/FeeChargesEngine'));
const AdsDealsStudio = lazy(() => import('./pages/admin/AdsDealsStudio'));
const AdsVisualBuilder = lazy(() => import('./pages/admin/AdsVisualBuilder'));
const BannerDirectAdsStudio = lazy(() => import('./pages/admin/BannerDirectAdsStudio'));
const FeatureAccessEntitlements = lazy(() => import('./pages/admin/FeatureAccessEntitlements'));
const CreatorsHub = lazy(() => import('./pages/admin/CreatorsHub'));
const Categories = lazy(() => import('./pages/admin/Categories'));
const Returns = lazy(() => import('./pages/admin/Returns'));
const WarrantyClaims = lazy(() => import('./pages/admin/WarrantyClaims'));
const Brands = lazy(() => import('./pages/admin/Brands'));
const Recommendations = lazy(() => import('./pages/admin/Recommendations'));
const Deals = lazy(() => import('./pages/admin/Deals'));
const Reviews = lazy(() => import('./pages/admin/Reviews'));
const CommunitySubmissions = lazy(() => import('./pages/admin/CommunitySubmissions'));
const Payouts = lazy(() => import('./pages/admin/Payouts'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Moderation = lazy(() => import('./pages/admin/Moderation'));
const Messages = lazy(() => import('./pages/admin/Messages'));
const ProductStudio = lazy(() => import('./pages/admin/ProductStudio'));
const BrandDetails = lazy(() => import('./pages/admin/BrandDetails'));
const DealsBannersStudio = lazy(() => import('./pages/admin/DealsBannersStudio'));
const BrandPostsPage = lazy(() => import('./pages/admin/BrandPosts'));
const LeadsInboxPage = lazy(() => import('./pages/admin/LeadsInbox'));
const JobPostingsPage = lazy(() => import('./pages/admin/JobPostings'));
const SellerOffersPage = lazy(() => import('./pages/admin/SellerOffers'));
const PlatformOrdersPage = lazy(() => import('./pages/admin/PlatformOrders'));
const AdsSponsorsPage = lazy(() => import('./pages/admin/AdsSponsors'));
const SponsoredPromotionsPage = lazy(() => import('./pages/admin/SponsoredPromotions'));
import OrdersOverview from './pages/admin/OrdersOverview';
const SellerCustomers = lazy(() => import('./pages/admin/SellerCustomers'));
const InvoiceView = lazy(() => import('./pages/admin/InvoiceView').then(m => ({ default: m.InvoiceView })));

// Logistics Pages
const CourierProviders = lazy(() => import('./pages/admin/Logistics/CourierProviders'));
const ShipmentConsole = lazy(() => import('./pages/admin/Logistics/ShipmentConsole'));
const TrackingCenter = lazy(() => import('./pages/admin/Logistics/TrackingCenter'));
const ShippingLabels = lazy(() => import('./pages/admin/Logistics/ShippingLabels'));
const CourierAnalytics = lazy(() => import('./pages/admin/Logistics/CourierAnalytics'));

// Trust & Safety Core Modules
const TrustCenter = lazy(() => import('./pages/admin/TrustCenter'));
const DisputeCenter = lazy(() => import('./pages/admin/DisputeCenter'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const BrandVerification = lazy(() => import('./pages/admin/BrandVerification'));
const CreatorEconomy = lazy(() => import('./pages/admin/CreatorEconomy'));
const CreatorEarnings = lazy(() => import('./pages/admin/CreatorEarnings'));
const ModerationV2 = lazy(() => import('./pages/admin/ModerationV2'));

const BrandEditStudio = lazy(() => import('./pages/admin/BrandEditStudio'));
const ProductEditStudio = lazy(() => import('./pages/admin/ProductEditStudio'));
const CreatorEditStudio = lazy(() => import('./pages/admin/CreatorEditStudio'));

const GuidesStudioList = lazy(() => import('./pages/admin/GuidesStudioList'));
const GuideEditStudio = lazy(() => import('./pages/admin/GuideEditStudio'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading, mustChangePassword } = useAuth();
  if (loading) return <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-accent font-mono text-[10px] uppercase tracking-[4px] animate-pulse">Authenticating Choosify Session...</div>;
  if (!profile) return <Navigate to="/login" />;
  if (mustChangePassword) return <Navigate to="/force-password-change" replace />;
  return <>{children}</>;
};

/**
 * If the URL is the signed-in user's own profile, send them to the canonical
 * cms-mirror self-profile path. Admin inspection of others goes to the current
 * universal cms-mirror profile — never UnifiedProfileShell (legacy).
 */
const OwnProfileRedirect: React.FC<{ role: 'seller' | 'creator' | 'consumer' }> = ({ role }) => {
  const { id } = useParams();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  if (profile?.id && id && decodeURIComponent(id) === profile.id) {
    return <Navigate to={getMyProfilePath(profile)} replace />;
  }
  const decoded = id ? decodeURIComponent(id) : '';
  if (!decoded) return <Navigate to="/admin/dashboard" replace />;
  const target = inspectionUniversalPath(role, decoded);
  if (searchParams.get('impersonate') === '1') {
    const join = target.includes('?') ? '&' : '?';
    return <Navigate to={`${target}${join}impersonate=1`} replace />;
  }
  return <Navigate to={target} replace />;
};

/** Legacy /upe/consumer|seller|creator → current universal cms-mirror inspection routes. */
const UpeInspectionRedirect: React.FC = () => {
  const { entityType, entityId } = useParams();
  const kind = String(entityType || '').toLowerCase();
  if (kind === 'consumer' || kind === 'seller' || kind === 'creator') {
    const decoded = entityId ? decodeURIComponent(entityId) : '';
    if (!decoded) return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to={inspectionUniversalPath(kind, decoded)} replace />;
  }
  return (
    <AdminLayout>
      <Suspense fallback={<div className="p-10 text-[#374151] font-mono text-[10px] uppercase tracking-[4px] opacity-60">Loading Unified Profile...</div>}>
        <UnifiedProfileShell />
      </Suspense>
    </AdminLayout>
  );
};

/**
 * Architecture Sprint A: role gate for the React Brand Studio cutover.
 * Seller, Admin, Super Admin allowed. Creator and Consumer denied — Creators
 * remain a separate identity per Blueprint (BP-004) with no Brand ownership,
 * and Consumers have no dashboard access at all. Anything unresolved/unknown
 * is denied (fail closed), mirroring RoleGuard/AdminLayout's existing pattern
 * of redirecting to /admin/dashboard rather than rendering.
 */
const BRAND_STUDIO_ALLOWED_ROLES = new Set(['seller', 'admin', 'super_admin']);
const BrandStudioRoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  if (!profile || !BRAND_STUDIO_ALLOWED_ROLES.has(profile.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
};

/** Same ownership roles as Brand Studio — Creators/Consumers denied (fail closed). */
const PRODUCT_VISUAL_BUILDER_ALLOWED_ROLES = new Set(['seller', 'admin', 'super_admin']);
const ProductVisualBuilderRoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  if (!profile || !PRODUCT_VISUAL_BUILDER_ALLOWED_ROLES.has(profile.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
};

/** Creator Visual Builder — creator self-edit + admin/super_admin. Sellers denied. */
const CREATOR_VISUAL_BUILDER_ALLOWED_ROLES = new Set(['creator', 'admin', 'super_admin']);
const CreatorVisualBuilderRoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  if (!profile || !CREATOR_VISUAL_BUILDER_ALLOWED_ROLES.has(profile.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
};

/** Ads Visual Builder — admin, seller, creator (consumers denied). */
const ADS_STUDIO_ALLOWED_ROLES = new Set(['admin', 'super_admin', 'seller', 'creator']);
const AdsStudioRoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const { isFeatureEnabled, status } = useEntitlements();
  if (!profile || !ADS_STUDIO_ALLOWED_ROLES.has(profile.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  const partner = profile.role === 'seller' || profile.role === 'creator';
  if (partner && (status === 'loading' || status === 'idle')) return null;
  if (partner && !isFeatureEnabled('adsDeals')) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
};

/** Guide Visual Builder — creator self-edit + admin/super_admin. Sellers denied. */
const GUIDE_VISUAL_BUILDER_ALLOWED_ROLES = new Set(['creator', 'admin', 'super_admin']);
const GuideVisualBuilderRoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  if (!profile || !GUIDE_VISUAL_BUILDER_ALLOWED_ROLES.has(profile.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
};

/**
 * Seller Brand Management home — count-based contract (real owned Brands only):
 *   0 → CmsMirror empty / Create First Brand
 *   1 → direct storefront-parity Brand Studio (/admin/brand-studio/:id/edit)
 *   2+ → CmsMirror management list (Admin list design language, seller-scoped)
 * Admin / Super Admin stay on CmsMirror Brand Management (unchanged).
 * Do NOT use BrandsStudioList or in-iframe CmsMirror Brand Portfolio as Seller Studio.
 */
const SellerBrandStudioHome: React.FC = () => {
  const { sellerBrands, brandsLoading, setActiveBrandId } = useAuth();
  const ownedBrandIds = useMemo(
    () =>
      Array.from(
        new Set(
          (sellerBrands || [])
            .map((r) => r.brand_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ),
    [sellerBrands],
  );

  useEffect(() => {
    if (!brandsLoading && ownedBrandIds.length === 1) {
      setActiveBrandId(ownedBrandIds[0]);
    }
  }, [brandsLoading, ownedBrandIds, setActiveBrandId]);

  if (brandsLoading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-accent font-mono text-[10px] uppercase tracking-[4px] animate-pulse">
        Loading Brand Management…
      </div>
    );
  }

  if (ownedBrandIds.length === 1) {
    return <Navigate to={`/admin/brand-studio/${encodeURIComponent(ownedBrandIds[0])}/edit`} replace />;
  }

  // 0 brands → empty/create in CmsMirror; 2+ → seller-scoped management list in CmsMirror
  return <CmsMirrorHost />;
};

const BrandStudioHomeEntry: React.FC = () => {
  const { profile } = useAuth();
  if (profile?.role === 'seller' && profile.marketplaceAccess === false) {
    return <CmsMirrorHost />;
  }
  if (profile?.role === 'seller') {
    return <SellerBrandStudioHome />;
  }
  return <CmsMirrorHost />;
};

/**
 * Creator Studio home — storefront-parity Visual Builder (not CmsMirror portfolio chrome).
 *   Creator → ensure owned catalog creator → /admin/creator-studio/:id/edit (CreatorEditStudio)
 *   Admin / Super Admin → CmsMirror Creator Management list (unchanged)
 * Creator Profile (/admin/creator-profile) stays on CmsMirror identity surface.
 */
const CreatorStudioHome: React.FC = () => {
  const { profile } = useAuth();
  const [creatorId, setCreatorId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!profile || profile.role !== 'creator') {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('choosify_auth_token');
        if (token) {
          const { creators } = await catalogApi.ensureCreatorWorkspace({
            displayName: profile.displayName || undefined,
            email: profile.email || undefined,
          });
          const owned =
            creators.find((c) => c.userId === profile.id) ||
            creators.find((c) => c.id === profile.id) ||
            creators[0];
          if (!cancelled) {
            if (owned?.id) setCreatorId(owned.id);
            else setError('No Creator profile found for this account.');
            setLoading(false);
          }
          return;
        }

        // Temp/mock sessions have no JWT — still open the storefront-parity builder.
        // CreatorEditStudio loads catalog by id when available, blank canvas otherwise.
        if (!cancelled) {
          setCreatorId(profile.id);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          // Prefer opening the Visual Builder over blocking on ensure failures.
          if (profile.id) {
            setCreatorId(profile.id);
            setError(null);
          } else {
            setError(err instanceof Error ? err.message : 'Failed to open Creator Studio');
          }
          setLoading(false);
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (!profile || profile.role !== 'creator') {
    return <CmsMirrorHost />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-accent font-mono text-[10px] uppercase tracking-[4px] animate-pulse">
        Loading Creator Studio…
      </div>
    );
  }

  if (error || !creatorId) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-text-primary text-sm px-6 text-center">
        {error || 'Creator Studio is unavailable.'}
      </div>
    );
  }

  return <Navigate to={`/admin/creator-studio/${encodeURIComponent(creatorId)}/edit`} replace />;
};

const CreatorStudioHomeEntry: React.FC = () => {
  const { profile } = useAuth();
  if (profile?.role === 'creator' && profile.marketplaceAccess === false) {
    return <CmsMirrorHost />;
  }
  if (profile?.role === 'creator') {
    return <CreatorStudioHome />;
  }
  return <CmsMirrorHost />;
};

/** Admin / seller / creator all use the CMS mirror (role filters the left nav). */
const AdminAreaEntry: React.FC = () => <CmsMirrorHost />;

const ContentStudioEntry: React.FC = () => <CmsMirrorHost />;

const ForcePasswordChangeGate: React.FC = () => {
  const { profile, loading, mustChangePassword } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to="/admin/dashboard" replace />;
  return <ForcePasswordChangePage />;
};

const RootRoute: React.FC = () => {
  const { profile, loading, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-accent font-mono text-[10px] uppercase tracking-[4px] animate-pulse">
        Authenticating Choosify Session...
      </div>
    );
  }

  if (!profile) {
    return (
      <Suspense fallback={routeSuspenseFallback}>
        <LoginPage />
      </Suspense>
    );
  }

  if (mustChangePassword) {
    return <Navigate to="/force-password-change" replace />;
  }

  return <Navigate to="/admin/dashboard" replace />;
};

const LoginRoute: React.FC = () => {
  const { profile, loading, mustChangePassword } = useAuth();
  const [searchParams] = useSearchParams();

  if (loading) return null;

  // Legacy Join Now links used /login?intent=join — send them to real signup.
  if (searchParams.get('intent') === 'join' && !profile) {
    const email = searchParams.get('email')?.trim() || '';
    const qs = new URLSearchParams();
    if (email) qs.set('email', email);
    return <Navigate to={`/signup${qs.toString() ? `?${qs}` : ''}`} replace />;
  }

  if (profile) {
    if (mustChangePassword) {
      return <Navigate to="/force-password-change" replace />;
    }
    return <Navigate to="/admin/dashboard" replace />;
  }
  return (
    <Suspense fallback={routeSuspenseFallback}>
      <LoginPage />
    </Suspense>
  );
};

const SignupRoute: React.FC = () => {
  const { profile, loading } = useAuth();

  if (loading) return null;
  // Applications do not create sessions; only redirect if already authenticated.
  if (profile) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return (
    <Suspense fallback={routeSuspenseFallback}>
      <SellerSignupPage />
    </Suspense>
  );
};

import { CMSProvider } from './contexts/CMSContext';
import { CMSDataProvider } from './contexts/CMSDataContext';
import { AdsProvider } from './contexts/AdsContext';
import { ContactInteractionProvider } from './contexts/ContactInteractionContext';
import { BrandProfilesProvider } from './contexts/BrandProfilesContext';
import { CreatorProvider } from './contexts/CreatorContext';
import { RbacProvider } from './contexts/RbacContext';
import { RoleGuard } from './components/RoleGuard';
import ErrorBoundary from './components/ErrorBoundary';

const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  React.useEffect(() => {
    document.title = "Dashboard | Choosify";
  }, []);

  return (
    <CMSProvider>
      <CMSDataProvider>
        <AdsProvider>
        <Router>
        <AuthProvider>
          <NavAttentionProvider>
          <EntitlementsProvider>
          <RbacProvider>
          <ImpersonationProvider>
          <LogisticsProvider>
          <CashBookProvider>
            <BrandProfilesProvider>
            <InventoryProvider>
          <CouponsProvider>
          <FeeChargesProvider>
          <OrdersProvider>
            <ReturnsProvider>
            <ContactInteractionProvider>
              <TrustProvider>
              <CreatorProvider>
              <ReviewModerationProvider>
              <DisputeProvider>
              {import.meta.env.DEV && <TempRoleSwitcher />}
              <ErrorBoundary>
              <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              path="/force-password-change"
              element={
                <Suspense fallback={routeSuspenseFallback}>
                  <ForcePasswordChangeGate />
                </Suspense>
              }
            />
            <Route path="/signup" element={<SignupRoute />} />
            <Route path="/products/:id" element={<Suspense fallback={routeSuspenseFallback}><ProductDetailPage /></Suspense>} />
            <Route path="/upe/:entityType/:entityId" element={<ProtectedRoute><UpeInspectionRedirect /></ProtectedRoute>} />
            
            {/*
              Entity profile routes — Admin inspection / deep links only.
              Own-profile navigations must use getMyProfilePath → cms-mirror
              (/admin/brand-profile | /admin/creator-profile | /admin/profile | /admin/consumer-profile).
              Self hits on /seller|/creator|/consumer/:id redirect to the canonical cms-mirror path.
            */}
            <Route path="/consumer/:id" element={<ProtectedRoute><OwnProfileRedirect role="consumer" /></ProtectedRoute>} />
            <Route path="/seller/:id" element={<ProtectedRoute><OwnProfileRedirect role="seller" /></ProtectedRoute>} />
            <Route path="/brand/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={routeSuspenseFallback}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/order/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={routeSuspenseFallback}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/creator/:id" element={<ProtectedRoute><OwnProfileRedirect role="creator" /></ProtectedRoute>} />
            {/*
              inspectionUniversalPath() (lib/impersonationRouting.ts) and OwnProfileRedirect
              have targeted /admin/creators/:id for Admin-viewing-another-creator since that
              helper was introduced, but no route ever matched it — every such redirect landed
              on the catch-all. Mirrors /brand/:id; UnifiedProfileShell's own typeKey derivation
              already handles the /creators/ path segment.
            */}
            <Route path="/admin/creators/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={routeSuspenseFallback}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />

            {/*
              Admin / account self-profile: CmsMirrorHost (adminProfile page) — NOT UnifiedProfileShell.
              Fall through /admin/* catch-all below; do not mount the legacy React UPE shell here.
            */}
            <Route path="/admin/account/profile" element={<Navigate to="/admin/profile" replace />} />
            <Route path="/admin/account/settings" element={<Navigate to="/admin/settings" replace />} />
            <Route path="/admin/account/security" element={<Navigate to="/admin/settings" replace />} />
            
            <Route path="/" element={<RootRoute />} />
            <Route path="/marketplace" element={<Navigate to="/login" replace />} />

            {/*
              Architecture Sprint A — surgical cutover: Brand Studio only.
              Registered BEFORE the /admin/* CMS-mirror catch-all so React
              Router's exact/static-path ranking picks these first; every
              other /admin/* path still falls through to CmsMirrorHost below.
              Rollback: delete these three routes (or comment them out) and
              /admin/brand-studio* falls straight back to CmsMirrorHost —
              no backend change required.
            */}
            <Route
              path="/admin/brand-studio"
              element={
                <ProtectedRoute>
                  <BrandStudioRoleGate>
                    <Suspense fallback={routeSuspenseFallback}>
                      <BrandStudioHomeEntry />
                    </Suspense>
                  </BrandStudioRoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/brand-studio/new"
              element={
                <ProtectedRoute>
                  <BrandStudioRoleGate>
                    <AdminWorkspaceLayout>
                      <MarketplaceAccessGate>
                        <Suspense fallback={routeSuspenseFallback}>
                          <BrandEditStudio />
                        </Suspense>
                      </MarketplaceAccessGate>
                    </AdminWorkspaceLayout>
                  </BrandStudioRoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/brand-studio/:id/edit"
              element={
                <ProtectedRoute>
                  <BrandStudioRoleGate>
                    <AdminWorkspaceLayout>
                      <MarketplaceAccessGate>
                        <Suspense fallback={routeSuspenseFallback}>
                          <BrandEditStudio />
                        </Suspense>
                      </MarketplaceAccessGate>
                    </AdminWorkspaceLayout>
                  </BrandStudioRoleGate>
                </ProtectedRoute>
              }
            />

            {/*
              Product Visual Builder — surgical cutover ONLY for single-product editor.
              /admin/products (Products & Inventory Management) stays on CmsMirrorHost.
              Rollback: remove these two routes; Edit falls back to in-iframe Product Studio.
            */}
            <Route
              path="/admin/products/new"
              element={
                <ProtectedRoute>
                  <ProductVisualBuilderRoleGate>
                    <AdminWorkspaceLayout>
                      <MarketplaceAccessGate>
                        <Suspense fallback={routeSuspenseFallback}>
                          <ProductEditStudio />
                        </Suspense>
                      </MarketplaceAccessGate>
                    </AdminWorkspaceLayout>
                  </ProductVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products/:id/edit"
              element={
                <ProtectedRoute>
                  <ProductVisualBuilderRoleGate>
                    <AdminWorkspaceLayout>
                      <MarketplaceAccessGate>
                        <Suspense fallback={routeSuspenseFallback}>
                          <ProductEditStudio />
                        </Suspense>
                      </MarketplaceAccessGate>
                    </AdminWorkspaceLayout>
                  </ProductVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/warranty-claims"
              element={
                <ProtectedRoute>
                  <AdminWorkspaceLayout>
                    <Suspense fallback={routeSuspenseFallback}>
                      <WarrantyClaims />
                    </Suspense>
                  </AdminWorkspaceLayout>
                </ProtectedRoute>
              }
            />

            {/*
              Creator Studio home:
              - Creator → storefront-parity CreatorEditStudio (via ensure + redirect)
              - Admin → CmsMirror Creator Management list
              /admin/creator-profile stays on CmsMirror (identity surface, distinct).
              Rollback: remove this home route; creator falls through to CmsMirrorHost.
            */}
            <Route
              path="/admin/creator-studio"
              element={
                <ProtectedRoute>
                  <CreatorVisualBuilderRoleGate>
                    <Suspense fallback={routeSuspenseFallback}>
                      <CreatorStudioHomeEntry />
                    </Suspense>
                  </CreatorVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />
            {/*
              Creator Visual Builder — surgical cutover ONLY for single-creator editor.
              Rollback: remove /new and /:id/edit routes.
            */}
            <Route
              path="/admin/creator-studio/new"
              element={
                <ProtectedRoute>
                  <CreatorVisualBuilderRoleGate>
                    <AdminWorkspaceLayout>
                      <MarketplaceAccessGate>
                        <Suspense fallback={routeSuspenseFallback}>
                          <CreatorEditStudio />
                        </Suspense>
                      </MarketplaceAccessGate>
                    </AdminWorkspaceLayout>
                  </CreatorVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/creator-studio/:id/edit"
              element={
                <ProtectedRoute>
                  <CreatorVisualBuilderRoleGate>
                    <AdminWorkspaceLayout>
                      <MarketplaceAccessGate>
                        <Suspense fallback={routeSuspenseFallback}>
                          <CreatorEditStudio />
                        </Suspense>
                      </MarketplaceAccessGate>
                    </AdminWorkspaceLayout>
                  </CreatorVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />

            {/*
              Guide Visual Builder — surgical cutover ONLY for single-guide editor.
              /admin/guides (Guide Management list) stays on CmsMirrorHost.
              Rollback: remove these two routes.
            */}
            <Route
              path="/admin/guides/new"
              element={
                <ProtectedRoute>
                  <GuideVisualBuilderRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <GuideEditStudio />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </GuideVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/guides/:id/edit"
              element={
                <ProtectedRoute>
                  <GuideVisualBuilderRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <GuideEditStudio />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </GuideVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />

            {/*
              Banner / Direct Ads Visual Builder — surgical cutover.
              /admin/ads-deals-studio (Ads & Deals Studio chrome) stays on CmsMirrorHost.
              Rollback: remove these routes; Create Ad falls back to cms-mirror button.
            */}
            <Route
              path="/admin/ads-studio"
              element={
                <ProtectedRoute>
                  <AdsStudioRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <BannerDirectAdsStudio />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </AdsStudioRoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ads-studio/new"
              element={
                <ProtectedRoute>
                  <AdsStudioRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <AdsVisualBuilder />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </AdsStudioRoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ads-studio/:id/edit"
              element={
                <ProtectedRoute>
                  <AdsStudioRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <AdsVisualBuilder />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </AdsStudioRoleGate>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/feature-access"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <Suspense fallback={routeSuspenseFallback}>
                      <FeatureAccessEntitlements />
                    </Suspense>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/*
              Order Hub (/admin/orders): approved CmsMirror management presentation.
              Commerce Order API remains SoT via cms-mirror hydrate + studio-profile-api.
              Do NOT host Order Hub in Orders.tsx/AdminLayout (Sprint 6 visual regression).
              Invoice + overview/platform React routes kept for deep-links; not Order Hub chrome.
            */}
            <Route
              path="/admin/orders-overview"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <OrdersOverview />
                      </Suspense>
                    </AdminLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/platform-orders"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <PlatformOrdersPage />
                      </Suspense>
                    </AdminLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/invoice/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <InvoiceView />
                      </Suspense>
                    </AdminLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route path="/admin/*" element={<ProtectedRoute><RoleGuard><AdminAreaEntry /></RoleGuard></ProtectedRoute>} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            {/* Dormant React list links → single-guide Visual Builder (management chrome untouched) */}
            <Route
              path="/dashboard/content-studio/guides/new"
              element={
                <ProtectedRoute>
                  <GuideVisualBuilderRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <GuideEditStudio />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </GuideVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/content-studio/guides/:id/edit"
              element={
                <ProtectedRoute>
                  <GuideVisualBuilderRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <GuideEditStudio />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </GuideVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />
            
            <Route path="/dashboard/content-studio/*" element={<ProtectedRoute><ContentStudioEntry /></ProtectedRoute>} />

            {/* Seller shortcuts → CMS mirror products */}
            <Route path="/products" element={<Navigate to="/admin/products" replace />} />
            
            <Route path="/seller/*" element={<Navigate to="/admin/products" replace />} />
            
            <Route
              path="*"
              element={
                <Suspense fallback={routeSuspenseFallback}>
                  <NotFoundPage />
                </Suspense>
              }
            />
          </Routes>
              </ErrorBoundary>
          </DisputeProvider>
              </ReviewModerationProvider>
              </CreatorProvider>
              </TrustProvider>
            </ContactInteractionProvider>
            </ReturnsProvider>
          </OrdersProvider>
          </FeeChargesProvider>
          </CouponsProvider>
            </InventoryProvider>
            </BrandProfilesProvider>
          </CashBookProvider>
          </LogisticsProvider>
          </ImpersonationProvider>
          </RbacProvider>
          </EntitlementsProvider>
          </NavAttentionProvider>
        </AuthProvider>
    </Router>
    </AdsProvider>
    </CMSDataProvider>
    </CMSProvider>
  );
}
