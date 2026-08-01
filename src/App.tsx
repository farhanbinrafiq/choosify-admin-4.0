import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './components/AdminLayout';
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

// Lazy load pages
const CashBookHub = lazy(() => import('./pages/admin/CashBookHub'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SellerSignupPage = lazy(() => import('./pages/SellerSignupPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const DashboardRouter = lazy(() => import('./pages/dashboards/DashboardRouter'));
const Consumers = lazy(() => import('./pages/admin/Consumers'));

// Profile & Detail Pages
const AdminProfile = lazy(() => import('./pages/admin/profiles/AdminProfile'));
const UnifiedProfileShell = lazy(() => import('./pages/admin/profiles/UnifiedProfileShell'));
const SellerDashboardPreview = lazy(() => import('./pages/admin/previews/SellerDashboardPreview'));
const RecommendationPreview = lazy(() => import('./pages/admin/previews/RecommendationPreview'));
const Sellers = lazy(() => import('./pages/admin/Sellers'));
const Products = lazy(() => import('./pages/admin/Products'));
const FeeChargesEngine = lazy(() => import('./pages/admin/FeeChargesEngine'));
const AdsDealsStudio = lazy(() => import('./pages/admin/AdsDealsStudio'));
const CreatorsHub = lazy(() => import('./pages/admin/CreatorsHub'));
const Categories = lazy(() => import('./pages/admin/Categories'));
const Returns = lazy(() => import('./pages/admin/Returns'));
const Brands = lazy(() => import('./pages/admin/Brands'));
const Recommendations = lazy(() => import('./pages/admin/Recommendations'));
const Deals = lazy(() => import('./pages/admin/Deals'));
const Reviews = lazy(() => import('./pages/admin/Reviews'));
const CommunitySubmissions = lazy(() => import('./pages/admin/CommunitySubmissions'));
const Payouts = lazy(() => import('./pages/admin/Payouts'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const NotificationsPage = lazy(() => import('./pages/admin/Notifications'));
const SettingsPage = lazy(() => import('./pages/admin/Settings'));
const Moderation = lazy(() => import('./pages/admin/Moderation'));
const Messages = lazy(() => import('./pages/admin/Messages'));
const ProductStudio = lazy(() => import('./pages/admin/ProductStudio'));
const BrandDetails = lazy(() => import('./pages/admin/BrandDetails'));
const SellerReview = lazy(() => import('./pages/admin/SellerReview'));
const WebsiteCMSStudio = lazy(() => import('./pages/admin/WebsiteCMSStudio'));
const DealsBannersStudio = lazy(() => import('./pages/admin/DealsBannersStudio'));
const BrandPostsPage = lazy(() => import('./pages/admin/BrandPosts'));
const LeadsInboxPage = lazy(() => import('./pages/admin/LeadsInbox'));
const JobPostingsPage = lazy(() => import('./pages/admin/JobPostings'));
const SellerOffersPage = lazy(() => import('./pages/admin/SellerOffers'));
const PlatformOrdersPage = lazy(() => import('./pages/admin/PlatformOrders'));
const AdsSponsorsPage = lazy(() => import('./pages/admin/AdsSponsors'));
const SponsoredPromotionsPage = lazy(() => import('./pages/admin/SponsoredPromotions'));
const Orders = lazy(() => import('./pages/admin/Orders'));
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

const BrandsStudioList = lazy(() => import('./pages/admin/BrandsStudioList'));
const BrandEditStudio = lazy(() => import('./pages/admin/BrandEditStudio'));

const GuidesStudioList = lazy(() => import('./pages/admin/GuidesStudioList'));
const GuideEditStudio = lazy(() => import('./pages/admin/GuideEditStudio'));

const ViewModeWrapper: React.FC<{ mode: 'consumers' | 'creators' | 'admins' }> = ({ mode }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  React.useEffect(() => {
    if (searchParams.get('viewMode') !== mode) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('viewMode', mode);
      setSearchParams(newParams, { replace: true });
    }
  }, [mode, searchParams, setSearchParams]);

  return <Consumers />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-accent font-mono text-[10px] uppercase tracking-[4px] animate-pulse">Authenticating Choosify Session...</div>;
  if (!profile) return <Navigate to="/login" />;
  return <>{children}</>;
};

/** Admin / seller / creator all use the CMS mirror (role filters the left nav). */
const AdminAreaEntry: React.FC = () => <CmsMirrorHost />;

const ContentStudioEntry: React.FC = () => <CmsMirrorHost />;

const RootRoute: React.FC = () => {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-accent font-mono text-[10px] uppercase tracking-[4px] animate-pulse">
        Authenticating Choosify Session...
      </div>
    );
  }

  if (!profile) {
    return (
      <Suspense fallback={null}>
        <LoginPage />
      </Suspense>
    );
  }

  return <Navigate to="/admin/dashboard" replace />;
};

const LoginRoute: React.FC = () => {
  const { profile, loading } = useAuth();
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
    return <Navigate to="/admin/dashboard" replace />;
  }
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
};

const SignupRoute: React.FC = () => {
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (profile?.role === 'seller') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (profile) {
    return <Navigate to="/" replace />;
  }
  return (
    <Suspense fallback={null}>
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
          <RbacProvider>
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
              <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/signup" element={<SignupRoute />} />
            <Route path="/products/:id" element={<Suspense fallback={null}><ProductDetailPage /></Suspense>} />
            <Route path="/upe/:entityType/:entityId" element={<ProtectedRoute><AdminLayout><Suspense fallback={<div className="p-10 text-[#374151] font-mono text-[10px] uppercase tracking-[4px] opacity-60">Loading Unified Profile...</div>}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            
            {/* Unified root-level profile routes */}
            <Route path="/consumer/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/seller/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/brand/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/order/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/creator/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            
            <Route path="/" element={<RootRoute />} />
            <Route path="/marketplace" element={<Navigate to="/login" replace />} />
            
            {/* Full CMS mirror for all roles (left nav filtered by role) */}
            <Route path="/admin/*" element={<ProtectedRoute><RoleGuard><AdminAreaEntry /></RoleGuard></ProtectedRoute>} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            
            <Route path="/dashboard/content-studio/*" element={<ProtectedRoute><ContentStudioEntry /></ProtectedRoute>} />

            {/* Seller shortcuts → CMS mirror products */}
            <Route path="/products" element={<Navigate to="/admin/products" replace />} />
            
            <Route path="/seller/*" element={<Navigate to="/admin/products" replace />} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
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
          </RbacProvider>
        </AuthProvider>
    </Router>
    </AdsProvider>
    </CMSDataProvider>
    </CMSProvider>
  );
}
