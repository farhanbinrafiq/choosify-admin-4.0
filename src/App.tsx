import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './components/AdminLayout';
import { OrdersProvider } from './contexts/OrdersContext';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
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
const OrdersOverview = lazy(() => import('./pages/admin/OrdersOverview'));
const SellerCustomers = lazy(() => import('./pages/admin/SellerCustomers'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-app-bg flex items-center justify-center text-white font-mono text-[10px] uppercase tracking-[4px] animate-pulse">Authenticating Choosify Session...</div>;
  if (!profile) return <Navigate to="/login" />;
  return <>{children}</>;
};

import { ThemeProvider } from './contexts/ThemeContext';
import { CMSProvider } from './contexts/CMSContext';
import { AdsProvider } from './contexts/AdsContext';

export default function App() {
  return (
    <CMSProvider>
      <AdsProvider>
      <ThemeProvider>
      <Router>
        <AuthProvider>
          <OrdersProvider>
            <Routes>
          <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
          <Route path="/" element={<Suspense fallback={null}><Home /></Suspense>} />
          
          <Route path="/admin/*" element={<ProtectedRoute><AdminLayout><Suspense fallback={<div className="p-10 text-white font-mono text-[10px] uppercase tracking-[4px] opacity-40">Loading Platform Interface...</div>}><Routes>
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
            <Route path="brands" element={<Brands />} />
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
          </Routes></Suspense></AdminLayout></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </OrdersProvider>
      </AuthProvider>
    </Router>
    </ThemeProvider>
    </AdsProvider>
    </CMSProvider>
  );
}
