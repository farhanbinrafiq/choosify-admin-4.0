import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './components/AdminLayout';
import { OrdersProvider } from './contexts/OrdersContext';
import { ReturnsProvider } from './contexts/ReturnsContext';
import { TrustProvider } from './contexts/TrustContext';
import { DisputeProvider } from './contexts/DisputeContext';
import { CouponsProvider } from './contexts/CouponsContext';
import { ReviewModerationProvider } from './contexts/ReviewModeration';
import { CashBookProvider } from './contexts/CashBookContext';
import { LogisticsProvider } from './contexts/LogisticsContext';
import { InventoryProvider } from './contexts/InventoryContext';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const CashBookHub = lazy(() => import('./pages/admin/CashBookHub'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
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
const Categories = lazy(() => import('./pages/admin/Categories'));
const Returns = lazy(() => import('./pages/admin/Returns'));
const Inventory = lazy(() => import('./pages/admin/Inventory'));
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
const CMSPage = lazy(() => import('./pages/admin/CMS'));
const WebsiteCMSStudio = lazy(() => import('./pages/admin/WebsiteCMSStudio'));
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

import { CMSProvider } from './contexts/CMSContext';
import { CMSDataProvider } from './contexts/CMSDataContext';
import { AdsProvider } from './contexts/AdsContext';
import { ContactInteractionProvider } from './contexts/ContactInteractionContext';
import { BrandProfilesProvider } from './contexts/BrandProfilesContext';
import { CreatorProvider } from './contexts/CreatorContext';

export default function App() {
  return (
    <CMSProvider>
      <CMSDataProvider>
        <AdsProvider>
        <Router>
        <AuthProvider>
          <LogisticsProvider>
          <CashBookProvider>
            <BrandProfilesProvider>
            <InventoryProvider>
          <CouponsProvider>
          <OrdersProvider>
            <ReturnsProvider>
            <ContactInteractionProvider>
              <TrustProvider>
              <CreatorProvider>
              <ReviewModerationProvider>
              <DisputeProvider>
              <Routes>
            <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
            <Route path="/products/:id" element={<Suspense fallback={null}><ProductDetailPage /></Suspense>} />
            <Route path="/upe/:entityType/:entityId" element={<ProtectedRoute><AdminLayout><Suspense fallback={<div className="p-10 text-[#374151] font-mono text-[10px] uppercase tracking-[4px] opacity-60">Loading Unified Profile...</div>}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            
            {/* Unified root-level profile routes */}
            <Route path="/consumer/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/seller/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/brand/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/order/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            <Route path="/creator/:id" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><UnifiedProfileShell /></Suspense></AdminLayout></ProtectedRoute>} />
            
            <Route path="/" element={<Suspense fallback={null}><Home /></Suspense>} />
            
            <Route path="/admin/*" element={<ProtectedRoute><AdminLayout><Suspense fallback={<div className="p-10 text-[#374151] font-mono text-[10px] uppercase tracking-[4px] opacity-60">Loading Platform Interface...</div>}><Routes>
              <Route path="upe/:entityType/:entityId" element={<UnifiedProfileShell />} />
              
              {/* Nested admin aliases for unified profiles */}
              <Route path="consumer/:id" element={<UnifiedProfileShell />} />
              <Route path="seller/:id" element={<UnifiedProfileShell />} />
              <Route path="brand/:id" element={<UnifiedProfileShell />} />
              <Route path="order/:id" element={<UnifiedProfileShell />} />
              <Route path="creator/:id" element={<UnifiedProfileShell />} />

              <Route path="dashboard" element={<DashboardRouter />} />
              <Route path="cms" element={<CMSPage />} />
              <Route path="cms-studio" element={<WebsiteCMSStudio />} />
              <Route path="ads-sponsors" element={<AdsSponsorsPage />} />
              <Route path="promotions" element={<SponsoredPromotionsPage />} />
              <Route path="consumers" element={<Consumers />} />
              <Route path="consumers/:id" element={<UnifiedProfileShell />} />
              <Route path="admins" element={<ViewModeWrapper mode="admins" />} />
              <Route path="admins/:id" element={<AdminProfile />} />
              <Route path="sellers" element={<Sellers />} />
              <Route path="sellers/pending/:id" element={<SellerReview />} />
              <Route path="sellers/:id" element={<UnifiedProfileShell />} />
              <Route path="sellers/:id/dashboard" element={<SellerDashboardPreview />} />
              <Route path="creators" element={<ViewModeWrapper mode="creators" />} />
              <Route path="creators/:id" element={<UnifiedProfileShell />} />
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductStudio mode="create" />} />
              <Route path="products/:id" element={<ProductStudio mode="edit" />} />
              <Route path="products/:id/edit" element={<ProductStudio mode="edit" />} />
              <Route path="categories" element={<Categories />} />
              <Route path="returns" element={<Returns />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="brands" element={<Navigate to="/admin/sellers" replace />} />
              <Route path="brands/:id" element={<UnifiedProfileShell />} />
              <Route path="recommendations" element={<Recommendations />} />
              <Route path="recommendations/:id" element={<RecommendationPreview />} />
              <Route path="deals" element={<Deals />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="community-submissions" element={<CommunitySubmissions />} />
              <Route path="payouts" element={<Payouts />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="messages" element={<Messages />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="moderation" element={<Moderation />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders-overview" element={<OrdersOverview />} />
              <Route path="customers" element={<SellerCustomers />} />
              <Route path="invoice/:id" element={<InvoiceView />} />
              <Route path="brand-profiles" element={<Sellers />} />
              <Route path="ownership-claims" element={<Sellers />} />
              <Route path="cashbook" element={<CashBookHub />} />
              <Route path="cashbook/:bookId" element={<CashBookHub />} />
              <Route path="cashbook/reports" element={<CashBookHub />} />
              
              {/* Logistics Management Routes */}
              <Route path="logistics/couriers" element={<CourierProviders />} />
              <Route path="logistics/shipments" element={<ShipmentConsole />} />
              <Route path="logistics/tracking" element={<TrackingCenter />} />
              <Route path="logistics/labels" element={<ShippingLabels />} />
              <Route path="logistics/analytics" element={<CourierAnalytics />} />
              <Route path="website-cms" element={<WebsiteCMSStudio />} />
              
              {/* Trust & Safety Core Modular Paths */}
              <Route path="trust-center" element={<TrustCenter />} />
              <Route path="brand-verification" element={<BrandVerification />} />
              <Route path="creator-hub" element={<CreatorEconomy />} />
              <Route path="creator-earnings" element={<CreatorEarnings />} />
              <Route path="moderation-v2" element={<ModerationV2 />} />
              <Route path="disputes" element={<DisputeCenter />} />
              <Route path="coupons" element={<Coupons />} />
            </Routes></Suspense></AdminLayout></ProtectedRoute>} />
            
            {/* Direct match for requested /dashboard/content-studio routes */}
            <Route path="/dashboard/content-studio/*" element={<ProtectedRoute><AdminLayout><Suspense fallback={<div className="p-10 text-[#374151] font-mono text-[10px] uppercase tracking-[4px] opacity-60">Loading Visual Content Studio...</div>}><Routes>
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductStudio mode="create" />} />
              <Route path="products/:id" element={<ProductStudio mode="edit" />} />
              <Route path="products/:id/edit" element={<ProductStudio mode="edit" />} />
              <Route path="brands" element={<BrandsStudioList />} />
              <Route path="brands/new" element={<BrandEditStudio />} />
              <Route path="brands/:id/edit" element={<BrandEditStudio />} />
              <Route path="guides" element={<GuidesStudioList />} />
              <Route path="guides/new" element={<GuideEditStudio />} />
              <Route path="guides/:id/edit" element={<GuideEditStudio />} />
            </Routes></Suspense></AdminLayout></ProtectedRoute>} />

            {/* Direct support for requested /seller products and root product listings */}
            <Route path="/products" element={<ProtectedRoute><AdminLayout><Suspense fallback={null}><Products /></Suspense></AdminLayout></ProtectedRoute>} />
            
            <Route path="/seller/*" element={<ProtectedRoute><AdminLayout><Suspense fallback={<div className="p-10 text-[#374151] font-mono text-[10px] uppercase tracking-[4px] opacity-60">Loading Seller Interface...</div>}><Routes>
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductStudio mode="create" />} />
              <Route path="products/:id" element={<ProductStudio mode="edit" />} />
              <Route path="products/:id/edit" element={<ProductStudio mode="edit" />} />
            </Routes></Suspense></AdminLayout></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
              </DisputeProvider>
              </ReviewModerationProvider>
              </CreatorProvider>
              </TrustProvider>
            </ContactInteractionProvider>
            </ReturnsProvider>
          </OrdersProvider>
          </CouponsProvider>
          </InventoryProvider>
          </BrandProfilesProvider>
          </CashBookProvider>
          </LogisticsProvider>
      </AuthProvider>
    </Router>
    </AdsProvider>
    </CMSDataProvider>
    </CMSProvider>
  );
}
