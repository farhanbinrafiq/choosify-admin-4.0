import React, { Suspense, lazy, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NavAttentionProvider } from './contexts/NavAttentionContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';
import { EntitlementsProvider, useEntitlements } from './contexts/EntitlementsContext';
import { AdminLayout } from './components/AdminLayout';
import { AdminWorkspaceLayout } from './components/Layout/AdminWorkspaceLayout';
import { CmsMirrorHost } from './cms-mirror/CmsMirrorHost';
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
import { AdminFeatureNotAvailable } from './components/AdminFeatureNotAvailable';

const routeSuspenseFallback = <AdminPageSkeleton variant="generic" />;

// Lazy load pages
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const CMS = lazy(() => import('./pages/admin/CMS'));
const Consumers = lazy(() => import('./pages/admin/Consumers'));
const CashBookHub = lazy(() => import('./pages/admin/CashBookHub'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForcePasswordChangePage = lazy(() => import('./pages/ForcePasswordChangePage'));
const SellerSignupPage = lazy(() => import('./pages/SellerSignupPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
// Profile & Detail Pages
const UnifiedProfileShell = lazy(() => import('./pages/admin/profiles/UnifiedProfileShell'));
const ConsumerProfileView = lazy(() => import('./pages/admin/profiles/ConsumerProfileView'));
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
const MessagesInbox = lazy(() => import('./pages/admin/MessagesInbox'));
const PartnerSupportInbox = lazy(() =>
  import('./components/messaging/PartnerSupportInbox').then((m) => ({ default: m.PartnerSupportInbox })),
);
const ProductStudio = lazy(() => import('./pages/admin/ProductStudio'));
const BrandDetails = lazy(() => import('./pages/admin/BrandDetails'));
const DealsBannersStudio = lazy(() => import('./pages/admin/DealsBannersStudio'));
const BrandPostsPage = lazy(() => import('./pages/admin/BrandPosts'));
const LeadsInboxPage = lazy(() => import('./pages/admin/LeadsInbox'));
const JobPostingsPage = lazy(() => import('./pages/admin/JobPostings'));
const SellerOffersPage = lazy(() => import('./pages/admin/SellerOffers'));
const PlatformOrdersPage = lazy(() => import('./pages/admin/PlatformOrders'));
const OrderDetailsPage = lazy(() => import('./pages/admin/OrderDetails'));
const SellerConversations = lazy(() => import('./pages/admin/SellerConversations'));
const AdsSponsorsPage = lazy(() => import('./pages/admin/AdsSponsors'));
const SponsoredPromotionsPage = lazy(() => import('./pages/admin/SponsoredPromotions'));
import OrdersOverview from './pages/admin/OrdersOverview';
const SellerMyCustomers = lazy(() => import('./pages/admin/SellerMyCustomers'));
const InvoiceView = lazy(() => import('./pages/admin/InvoiceView').then(m => ({ default: m.InvoiceView })));
const OperationsInvoiceView = lazy(() => import('./pages/admin/OperationsInvoiceView').then(m => ({ default: m.OperationsInvoiceView })));

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
const ProductStorefrontPreview = lazy(() => import('./pages/admin/ProductStorefrontPreview'));
const CreatorEditStudio = lazy(() => import('./pages/admin/CreatorEditStudio'));

const GuideManagementList = lazy(() => import('./pages/admin/GuideManagementList'));
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

/**
 * Guide Studio — creator (own guides) + seller (guides published by a brand they
 * own) + CMS staff (moderator/admin/super_admin/marketing_manager). The server's
 * `requireGuideStudioWrite` / `GET /catalog/guides/manage` remain the real
 * authority: a partner only ever sees and edits guides they own.
 */
const GUIDE_STUDIO_ALLOWED_ROLES = new Set([
  'creator',
  'seller',
  'verified_seller',
  'moderator',
  'admin',
  'super_admin',
  'marketing_manager',
]);
const GuideVisualBuilderRoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading } = useAuth();
  // Never decide (and never fire a replace-redirect) while auth is still
  // settling — a transient null/wrong-role snapshot must not permanently bounce
  // a direct URL entry / refresh to the dashboard.
  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-accent font-mono text-[10px] uppercase tracking-[4px] animate-pulse">
        Authenticating Choosify Session...
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  if (!GUIDE_STUDIO_ALLOWED_ROLES.has(profile.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
};

/** Choosify Support inbox (/admin/messages) — Choosify staff only. */
const SUPPORT_STAFF_ROLES = new Set(['super_admin', 'admin', 'moderator', 'support_agent']);
const MessagesInboxRoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  const role = String(profile.role);
  if (SUPPORT_STAFF_ROLES.has(role)) return <>{children}</>;
  // Partners' own support inbox lives at /admin/support; everyone else → dashboard.
  if (role === 'seller' || role === 'verified_seller') {
    return <Navigate to="/admin/conversations?tab=support" replace />;
  }
  if (role === 'creator') return <Navigate to="/admin/support" replace />;
  return <Navigate to="/admin/dashboard" replace />;
};

/** Partner "Choosify Support" inbox (/admin/support) — creator + seller (+ staff preview). */
const PARTNER_SUPPORT_ROLES = new Set([
  'creator',
  'seller',
  'verified_seller',
  'super_admin',
  'admin',
  'moderator',
  'support_agent',
]);
const PartnerSupportRoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  if (!PARTNER_SUPPORT_ROLES.has(profile.role)) {
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

/**
 * Products & Inventory list (/admin/products).
 * Seller → migrated React surface (AdminWorkspaceLayout chrome), backed by the
 *   canonical catalog API with server-side ownership scoping.
 * Admin / Super Admin / everyone else → unchanged CmsMirrorHost catalog
 *   management (richer admin catalog tooling not yet ported).
 * Rollback: delete this component + its route; /admin/products falls straight
 * back through the /admin/* catch-all to CmsMirrorHost, no backend change.
 */
const ProductsListEntry: React.FC = () => {
  const { profile } = useAuth();
  if (profile?.role === 'seller') {
    return (
      <AdminWorkspaceLayout>
        <MarketplaceAccessGate>
          <Suspense fallback={routeSuspenseFallback}>
            <Products />
          </Suspense>
        </MarketplaceAccessGate>
      </AdminWorkspaceLayout>
    );
  }
  return <CmsMirrorHost />;
};

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

  const requestedEmail = searchParams.get('email')?.trim().toLowerCase();
  // An explicit ?email= that doesn't match the currently-authenticated
  // session means someone is trying to sign in as a DIFFERENT account --
  // most commonly right after submitting a seller/creator application,
  // redirected here with their brand-new account's email. If an unrelated
  // session is still active on that browser/device (an admin testing the
  // flow, a shared machine, a stale tab), this used to silently bounce
  // straight to that unrelated session's own dashboard instead of ever
  // showing the login form -- the new account never got a chance to
  // actually authenticate. Mirrors sessionAlreadySatisfiesSignup below.
  const sessionMatchesRequest = !requestedEmail || profile?.email?.trim().toLowerCase() === requestedEmail;

  if (profile && sessionMatchesRequest) {
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

/** Does an already-authenticated session's own role satisfy this specific signup link's intent? */
function sessionAlreadySatisfiesSignup(role: string | undefined, requestedType: string): boolean {
  const r = String(role || '').toLowerCase();
  if (requestedType === 'creator') return r === 'creator';
  return r === 'seller' || r === 'verified_seller';
}

const SignupRoute: React.FC = () => {
  const { profile, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedType = (searchParams.get('type') || 'seller').trim().toLowerCase();

  if (loading) return null;
  // Applications do not create sessions; only redirect when the already-
  // authenticated session's own role actually matches what this link is
  // for. An unrelated existing session -- an admin/staff account clicking
  // "Join as Seller", or a seller clicking "Join as Creator" -- must still
  // see the real signup form instead of being silently dropped into
  // whatever dashboard they already happen to have open.
  if (profile && sessionAlreadySatisfiesSignup(profile.role, requestedType)) {
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
              CORRECTION (post-sprint regression fix): a prior fix here registered a bare
              /admin/creators/:id route pointing at the legacy UnifiedProfileShell, reasoning
              that inspectionUniversalPath()/OwnProfileRedirect targeted it and "no route ever
              matched it." That was incomplete -- /admin/* below already catches it and hands
              it to CmsMirrorHost, whose parseMirrorDeepLink() posts a 'cms-mirror-select-creator'
              message into the modern CMS-mirror iframe (public/cms-mirror/app.html) for exactly
              this path. The added route was MORE specific than the /admin/* wildcard, so it won
              routing priority and silently shadowed that working modern-experience handoff for
              every caller of the general path (impersonation, search, notifications), not just
              onboarding. Removed here so /admin/creators/:id (general) falls back through to
              /admin/* -> CmsMirrorHost as originally intended.

              The narrower path below is deliberately kept: the CMS-mirror prototype has status
              LABELS for Marketplace Access but no Grant/Suspend/Reinstate controls wired to any
              button (verified: zero matches for those action strings across every file in
              public/cms-mirror/). Until that's built there, this is the only place the feature
              built this sprint actually works, so the onboarding "Grant Marketplace Access"
              link targets this specific sub-path rather than the general one.
            */}
            <Route path="/admin/creators/:id/marketplace-access" element={<ProtectedRoute><AdminLayout><Suspense fallback={routeSuspenseFallback}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />

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
              Product Visual Builder — single-product editor (create + edit).
              The /admin/products LIST is now migrated for sellers too (see
              ProductsListEntry); admin/staff catalog management still uses
              CmsMirrorHost. Registered BEFORE the /admin/* catch-all.
              Rollback: remove the /admin/products route + ProductsListEntry;
              the list falls back to CmsMirrorHost with no backend change.
            */}
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute>
                  <ProductVisualBuilderRoleGate>
                    <ProductsListEntry />
                  </ProductVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />
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
            {/* Read-only storefront-parity preview (live catalog data) — not the
                public storefront itself; renders the shared ProductDetailPresentation. */}
            <Route
              path="/admin/products/:id/preview"
              element={
                <ProtectedRoute>
                  <ProductVisualBuilderRoleGate>
                    <Suspense fallback={routeSuspenseFallback}>
                      <ProductStorefrontPreview />
                    </Suspense>
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
              Guide Management + single-guide editor.
              The list now uses the real canonical, ownership-scoped management
              API (GET /catalog/guides/manage) — no CmsMirror iframe, no
              localStorage authority. The storefront-parity Guide Studio is a
              later pass; /admin/guides/:id/edit keeps the transitional editor.
              Rollback: remove these three routes.
            */}
            <Route
              path="/admin/guides"
              element={
                <ProtectedRoute>
                  <GuideVisualBuilderRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <GuideManagementList />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </GuideVisualBuilderRoleGate>
                </ProtectedRoute>
              }
            />
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
              Order Hub — canonical shared React surface (Option B, Sprint 14).
              Both Admin (/admin/orders) and Seller (/admin/platform-orders) now
              render the SAME role-aware React <PlatformOrdersPage>, backed by the
              canonical Operations order engine (server/operationsRouter.ts). This
              retires the legacy CmsMirror-hosted "Orders Hub" iframe screen: the
              CMS-mirror sidebar's "Orders Hub" link (page key `orders` →
              /admin/orders) now lands here instead of the iframe.
              RoleGuard keeps /admin/orders admin-only (seller's key is
              `platformOrders`) and /admin/platform-orders open to both.
              Rollback: remove the /admin/orders route below; it falls back to
              CmsMirrorHost via the /admin/* catch-all.
              Invoice + overview React routes unchanged.

              Hybrid detail UX (Sprint 14 correction): the Order Hub card opens a
              concise Quick View <Modal>; "Manage" / the Order ID / "Open Full
              Details" navigate to the full <OrderDetailsPage> at
              /admin/orders/:orderId (staff) or /admin/platform-orders/:orderId
              (seller). Authorization is NOT route-dependent — OrderDetailsPage
              reads via the canonical Operations API and the server 403s a caller
              who does not own the order, whichever path was used. resolveAdmin-
              PageKey maps both detail paths back to the Order Hub nav key so the
              sidebar item stays active; browser Back returns to the Hub.
            */}
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <PlatformOrdersPage />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders/:orderId"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <OrderDetailsPage />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
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
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <PlatformOrdersPage />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/platform-orders/:orderId"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <OrderDetailsPage />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/*
              Seller / Creator "My Customers" (/admin/customers, page key
              `sellerCustomers`) — canonical React customer directory
              (Option B/D, Sprint 14). Backed by the EXISTING canonical route
              GET /catalog/workspace/{seller,creator}/customers
              (server/catalogRouter.ts → listMyCustomersForOwner): a
              server-owner-scoped projection of the partner's own Operations
              orders + accepted/paid bookings. NOT the global Consumer DB
              (/admin/consumers → <Consumers/>), NOT the retired
              SellerCustomers.tsx prototype. RoleGuard exposes `sellerCustomers`
              to seller / verified_seller / creator (and admin — who sees an
              empty own-identity scope).
              Rollback: remove this route; the path falls back to CmsMirrorHost.
            */}
            <Route
              path="/admin/customers"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <SellerMyCustomers />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/*
              Seller Inbox — Customers (System B /operations/platform-messages,
              unchanged behaviour) + Choosify Support tab (canonical System A).
            */}
            <Route
              path="/admin/conversations"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <SellerConversations />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/*
              Choosify Support inbox for staff (canonical System A). Replaces the
              CmsMirror mock at /admin/messages — registered ahead of /admin/*.
            */}
            <Route
              path="/admin/messages"
              element={
                <ProtectedRoute>
                  <MessagesInboxRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <MessagesInbox />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </MessagesInboxRoleGate>
                </ProtectedRoute>
              }
            />
            {/* Partner (Creator / Seller) own Choosify Support inbox — System A support-only. */}
            <Route
              path="/admin/support"
              element={
                <ProtectedRoute>
                  <PartnerSupportRoleGate>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <PartnerSupportInbox />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </PartnerSupportRoleGate>
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
            {/* Real Operations-backed invoice -- the route above (InvoiceView)
                reads from Commerce, which has no bearing on real orders. */}
            <Route
              path="/admin/invoice/op/:orderId/:sellerId"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <OperationsInvoiceView />
                      </Suspense>
                    </AdminLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/*
              Sprint 11 remediation: these screens previously fell through to
              /admin/* -> CmsMirrorHost (a static prototype iframe with almost no
              real backend calls). Real, working React components + real backend
              endpoints already existed for each but were never routed. Registered
              here, before the /admin/* catch-all, per the same surgical-cutover
              pattern as Products/Brands/Creators/Guides above.
              Rollback: remove these four routes; each path falls back to CmsMirrorHost.
            */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <Dashboard />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reviews"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <Reviews />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/coupons"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <Coupons />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/fee-charges"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <FeeChargesEngine />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/*
              Sprint 11 remediation, tier 2: same pattern as the tier-1 block
              above. Real components + real backend endpoints existed but were
              never routed. Registered before the /admin/* catch-all.
              Rollback: remove these eight routes; each path falls back to CmsMirrorHost.
            */}
            <Route
              path="/admin/deals"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <Deals />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <Categories />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/website-cms"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <CMS />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/*
              Cashbook (Sprint 15). ONE React hub. `/admin/cashbook` is the
              primary hub (seller books grid / admin brand→seller oversight,
              `?view=reports` and `?seller=` as query state). `/admin/cashbook/
              :bookId` is that book's ledger (`?owner=` set for staff read-only
              oversight). Both explicit routes sit AHEAD of the `/admin/*`
              CmsMirror catch-all so a selected book never falls through to the
              legacy mock. Back / All Books → `/admin/cashbook` (no hash nav).
            */}
            <Route
              path="/admin/cashbook"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <CashBookHub />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cashbook/:bookId"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <CashBookHub />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/payouts"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <Payouts />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/returns"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <Returns />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/brand-verification"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <BrandVerification />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/consumers"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <Consumers />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            {/*
              Canonical consumer profile route.

              route before:  (no explicit route) -> /admin/* catch-all -> CmsMirrorHost,
                whose cms-mirror-select-customer deep link resolves the target ONLY
                against the prototype's mock Component.USERS array, so a real registered
                buyer never matched and the iframe dead-ended on the mock "Consumer
                Management" list (the duplicate layer). inspectionUniversalPath('consumer')
                has always pointed here.
              route after:   /admin/consumers/:id -> ConsumerProfileView
              component: ConsumerProfileView -- a consumer-specific presentation extracted
                so the shared UnifiedProfileShell (Seller/Creator/Brand/Order/Admin) is
                untouched. It reproduces the approved standalone #isCustomerDetail design
                and reads the real GET /auth/users/:id (identity, CF-ID, role, lifecycle);
                every prototype section with no production data source keeps its approved
                shape but renders an honest empty/disabled state -- no mock values.
              visual generation: unreachable-Gen-2-mock -> approved #isCustomerDetail.
                No Gen-1 legacy screen, no new route path.
              preserved: same ProtectedRoute > RoleGuard > AdminWorkspaceLayout wrappers
                as the /admin/consumers list route (admin/super_admin gate + the approved
                light shell chrome -- NOT the legacy AdminLayout the brand/order mounts
                use, so the sidebar stays consistent list -> profile -> back);
                "Login As User" + ?impersonate=1 auto-open via the existing
                ImpersonationContext.
            */}
            <Route
              path="/admin/consumers/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <ConsumerProfileView />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/*
              Sprint 11 remediation, tier 3: these screens have no real backend
              behind their core actions at all (confirmed by direct investigation,
              not assumed) -- building one would be new feature work, out of this
              sprint's scope. Rather than leave them silently rendering the
              CmsMirrorHost mock (seeded data, buttons with no effect), each is
              routed to an explicit "not yet available" state, with a pointer to
              the real screen that covers the closest real capability where one
              exists. Rollback: remove these nine routes; each path falls back
              to CmsMirrorHost.
            */}
            <Route
              path="/admin/moderation"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <AdminFeatureNotAvailable
                        title="Moderation Center"
                        description="General content-flagging and moderation-queue tooling is not yet built. Partner application review and review moderation are both real and live today."
                        alternatives={[
                          { label: 'Review Partner Applications', to: '/admin/feature-access' },
                          { label: 'Moderate Reviews', to: '/admin/reviews' },
                        ]}
                      />
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/disputes"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <AdminFeatureNotAvailable
                        title="Disputes"
                        description="A dedicated dispute case-management system (evidence, resolution workflow) is not yet built. Returns can be flagged as disputed today from the Returns & Refunds screen."
                        alternatives={[{ label: 'Go to Returns & Refunds', to: '/admin/returns' }]}
                      />
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/trust-center"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <AdminFeatureNotAvailable
                        title="Trust & Analytics"
                        description="Automated fraud detection and trust scoring are not yet live. Brand/Creator verification review and review moderation are both real, currently-enforced actions."
                        alternatives={[
                          { label: 'Go to Verification Center', to: '/admin/brand-verification' },
                          { label: 'Moderate Reviews', to: '/admin/reviews' },
                        ]}
                      />
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/creator-hub"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <AdminFeatureNotAvailable
                        title="Creator Economy"
                        description="Campaign management and brand-partnership tooling for creators is not yet built. Creator profile editing and cashbook/payout data are both real today."
                        alternatives={[
                          { label: 'Go to Creator Studio', to: '/admin/creator-studio' },
                          { label: 'Go to Cashbook Hub', to: '/admin/cashbook' },
                        ]}
                      />
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/admins"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <AdminFeatureNotAvailable
                        title="Admin Management"
                        description="Role and permission editing has a real backend endpoint but no frontend has been built for it yet."
                      />
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/promotions"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <AdminFeatureNotAvailable
                        title="Subscription Plans"
                        description="Seller/creator subscription plans and billing are not yet built."
                      />
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/monetization"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <AdminFeatureNotAvailable
                        title="Monetization Center"
                        description="Platform monetization tooling is not yet built."
                      />
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <AdminFeatureNotAvailable
                        title="Audit Logs"
                        description="Admin actions are already recorded server-side, but there is no queryable log store or read API yet to display them here."
                      />
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <AdminFeatureNotAvailable
                        title="Settings"
                        description="Platform-wide settings management is not yet built. Your own account profile can be edited from the profile menu."
                        alternatives={[{ label: 'Go to My Profile', to: '/admin/profile' }]}
                      />
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/*
              Sprint 11 remediation: Logistics module. ShipmentConsole,
              TrackingCenter, and CourierAnalytics were rewired to the real
              /operations/shipments backend (webhook-driven, real courier
              status). CourierProviders and ShippingLabels have no real
              backend (no courier credentials configured anywhere, label
              generation was fully fabricated) and render the explicit
              "not yet available" state instead.
              Rollback: remove these five routes; each path falls back to CmsMirrorHost.
            */}
            <Route
              path="/admin/logistics/couriers"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <CourierProviders />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logistics/shipments"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <ShipmentConsole />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logistics/tracking"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <TrackingCenter />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logistics/labels"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <ShippingLabels />
                      </Suspense>
                    </AdminWorkspaceLayout>
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logistics/analytics"
              element={
                <ProtectedRoute>
                  <RoleGuard>
                    <AdminWorkspaceLayout>
                      <Suspense fallback={routeSuspenseFallback}>
                        <CourierAnalytics />
                      </Suspense>
                    </AdminWorkspaceLayout>
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
