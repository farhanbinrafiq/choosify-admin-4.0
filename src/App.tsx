import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './components/AdminLayout';
import { OrdersProvider } from './contexts/OrdersContext';
import { TrustProvider } from './contexts/TrustContext';
import { CashBookProvider } from './contexts/CashBookContext';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const CashBookHub = lazy(() => import('./pages/admin/CashBookHub'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const DashboardRouter = lazy(() => import('./pages/dashboards/DashboardRouter'));
const Consumers = lazy(() => import('./pages/admin/Consumers'));

// Profile & Detail Pages
const ConsumerProfile = lazy(() => import('./pages/admin/profiles/ConsumerProfile'));
const SellerProfile = lazy(() => import('./pages/admin/profiles/SellerProfile'));
const CreatorProfile = lazy(() => import('./pages/admin/profiles/CreatorProfile'));
const AdminProfile = lazy(() => import('./pages/admin/profiles/AdminProfile'));
const SellerDashboardPreview = lazy(() => import('./pages/admin/previews/SellerDashboardPreview'));
const RecommendationPreview = lazy(() => import('./pages/admin/previews/RecommendationPreview'));
const Sellers = lazy(() => import('./pages/admin/Sellers'));
const Products = lazy(() => import('./pages/admin/Products'));
const Brands = lazy(() => import('./pages/admin/Brands'));
const Recommendations = lazy(() => import('./pages/admin/Recommendations'));
const Deals = lazy(() => import('./pages/admin/Deals'));
const Reviews = lazy(() => import('./pages/admin/Reviews'));
const Payouts = lazy(() => import('./pages/admin/Payouts'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Notifications = lazy(() => import('./pages/admin/Notifications'));
const Moderation = lazy(() => import('./pages/admin/Moderation'));
const Messages = lazy(() => import('./pages/admin/Messages'));
const ProductEdit = lazy(() => import('./pages/admin/ProductEdit'));
const BrandDetails = lazy(() => import('./pages/admin/BrandDetails'));
const SellerReview = lazy(() => import('./pages/admin/SellerReview'));
const CMSPage = lazy(() => import('./pages/admin/CMS'));
const AdsSponsorsPage = lazy(() => import('./pages/admin/AdsSponsors'));
const SponsoredPromotionsPage = lazy(() => import('./pages/admin/SponsoredPromotions'));
const Orders = lazy(() => import('./pages/admin/Orders'));
import OrdersOverview from './pages/admin/OrdersOverview';
const SellerCustomers = lazy(() => import('./pages/admin/SellerCustomers'));
const InvoiceView = lazy(() => import('./pages/admin/InvoiceView').then(m => ({ default: m.InvoiceView })));

// Trust & Safety Core Modules
const TrustCenter = lazy(() => import('./pages/admin/TrustCenter'));
const BrandVerification = lazy(() => import('./pages/admin/BrandVerification'));
const CreatorEconomy = lazy(() => import('./pages/admin/CreatorEconomy'));
const ModerationV2 = lazy(() => import('./pages/admin/ModerationV2'));

const BrandsStudioList = lazy(() => import('./pages/admin/BrandsStudioList'));
const BrandEditStudio = lazy(() => import('./pages/admin/BrandEditStudio'));

const GuidesStudioList = lazy(() => import('./pages/admin/GuidesStudioList'));
const GuideEditStudio = lazy(() => import('./pages/admin/GuideEditStudio'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-accent font-mono text-[10px] uppercase tracking-[4px] animate-pulse">Authenticating Choosify Session...</div>;
  if (!profile) return <Navigate to="/login" />;
  return <>{children}</>;
};

import { CMSProvider } from './contexts/CMSContext';
import { AdsProvider } from './contexts/AdsContext';
import { ContactInteractionProvider } from './contexts/ContactInteractionContext';
import { BrandProfilesProvider } from './contexts/BrandProfilesContext';

export default function App() {
  return (
    <CMSProvider>
      <AdsProvider>
      <Router>
        <AuthProvider>
          <CashBookProvider>
            <BrandProfilesProvider>
          <OrdersProvider>
            <ContactInteractionProvider>
              <TrustProvider>
              <Routes>
            <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
            <Route path="/products/:id" element={<Suspense fallback={null}><ProductDetailPage /></Suspense>} />
            <Route path="/" element={<Suspense fallback={null}><Home /></Suspense>} />
            
            <Route path="/admin/*" element={<ProtectedRoute><AdminLayout><Suspense fallback={<div className="p-10 text-[#374151] font-mono text-[10px] uppercase tracking-[4px] opacity-60">Loading Platform Interface...</div>}><Routes>
              <Route path="dashboard" element={<DashboardRouter />} />
              <Route path="cms" element={<CMSPage />} />
              <Route path="ads-sponsors" element={<AdsSponsorsPage />} />
              <Route path="promotions" element={<SponsoredPromotionsPage />} />
              <Route path="consumers" element={<Consumers />} />
              <Route path="consumers/:id" element={<ConsumerProfile />} />
              <Route path="admins" element={<Consumers />} />
              <Route path="admins/:id" element={<AdminProfile />} />
              <Route path="sellers" element={<Sellers />} />
              <Route path="sellers/pending/:id" element={<SellerReview />} />
              <Route path="sellers/:id" element={<SellerProfile />} />
              <Route path="sellers/:id/dashboard" element={<SellerDashboardPreview />} />
              <Route path="creators" element={<Consumers />} />
              <Route path="creators/:id" element={<CreatorProfile />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:id" element={<ProductEdit />} />
              <Route path="products/:id/edit" element={<ProductEdit />} />
              <Route path="brands" element={<Navigate to="/admin/sellers" replace />} />
              <Route path="brands/:id" element={<BrandDetails />} />
              <Route path="recommendations" element={<Recommendations />} />
              <Route path="recommendations/:id" element={<RecommendationPreview />} />
              <Route path="deals" element={<Deals />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="payouts" element={<Payouts />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="messages" element={<Messages />} />
              <Route path="notifications" element={<Notifications />} />
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
              
              {/* Trust & Safety Core Modular Paths */}
              <Route path="trust-center" element={<TrustCenter />} />
              <Route path="brand-verification" element={<BrandVerification />} />
              <Route path="creator-hub" element={<CreatorEconomy />} />
              <Route path="moderation-v2" element={<ModerationV2 />} />
            </Routes></Suspense></AdminLayout></ProtectedRoute>} />
            
            {/* Direct match for requested /dashboard/content-studio routes */}
            <Route path="/dashboard/content-studio/*" element={<ProtectedRoute><AdminLayout><Suspense fallback={<div className="p-10 text-[#374151] font-mono text-[10px] uppercase tracking-[4px] opacity-60">Loading Visual Content Studio...</div>}><Routes>
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductEdit />} />
              <Route path="products/:id/edit" element={<ProductEdit />} />
              <Route path="brands" element={<BrandsStudioList />} />
              <Route path="brands/new" element={<BrandEditStudio />} />
              <Route path="brands/:id/edit" element={<BrandEditStudio />} />
              <Route path="guides" element={<GuidesStudioList />} />
              <Route path="guides/new" element={<GuideEditStudio />} />
              <Route path="guides/:id/edit" element={<GuideEditStudio />} />
            </Routes></Suspense></AdminLayout></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
              </TrustProvider>
            </ContactInteractionProvider>
          </OrdersProvider>
          </BrandProfilesProvider>
          </CashBookProvider>
      </AuthProvider>
    </Router>
    </AdsProvider>
    </CMSProvider>
  );
}
