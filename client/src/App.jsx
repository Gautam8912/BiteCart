/**
 * Application shell + routing.
 *
 * Every route in the spec has a real page here — there are no placeholder
 * screens. Lazy-loaded so the first paint does not wait for the admin bundle.
 */
import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import MobileNav from './components/MobileNav.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import LocationSelector from './components/LocationSelector.jsx';
import Splash from './components/Splash.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { BlockSkeleton } from './components/ui/index.jsx';

import Home from './pages/Home.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import CategoryPage from './pages/CategoryPage.jsx';
import CategoriesIndex from './pages/CategoriesIndex.jsx';
import SearchPage from './pages/SearchPage.jsx';
import CartPage from './pages/CartPage.jsx';
import Checkout from './pages/Checkout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Restaurants from './pages/Restaurants.jsx';
import RestaurantDetail from './pages/RestaurantDetail.jsx';
import Notifications from './pages/Notifications.jsx';
import Help from './pages/Help.jsx';
import Support from './pages/Support.jsx';
import StaticPage from './pages/StaticPage.jsx';
import NotFound from './pages/NotFound.jsx';
import Account from './pages/Account.jsx';
import Profile from './pages/account/Profile.jsx';
import Addresses from './pages/account/Addresses.jsx';
import Coupons from './pages/account/Coupons.jsx';
import Rewards from './pages/account/Rewards.jsx';
import Security from './pages/account/Security.jsx';

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));

/** Scrolls to top on navigation, except when a hash anchor is present. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, hash]);
  return null;
}

const pageFallback = (
  <div className="container page">
    <BlockSkeleton height={40} />
    <BlockSkeleton height={220} />
    <BlockSkeleton height={140} count={2} />
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <Splash />
      <a className="fe-skip" href="#main">Skip to main content</a>
      <div className="app-shell">
        <ScrollToTop />
        <Header />
        <main id="main" className="app-main">
          <Suspense fallback={pageFallback}>
            <Routes>
              <Route path="/" element={<Home />} />

              {/* Catalogue */}
              <Route path="/categories" element={<CategoriesIndex />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/search" element={<SearchPage />} />

              {/* Food */}
              <Route path="/restaurants" element={<Restaurants />} />
              <Route path="/restaurant/:slug" element={<RestaurantDetail />} />

              {/* Cart & checkout */}
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<Checkout />} />

              {/* Auth */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Account */}
              <Route element={<ProtectedRoute><Account /></ProtectedRoute>}>
                <Route path="/account" element={<Profile />} />
                <Route path="/account/addresses" element={<Addresses />} />
                <Route path="/account/coupons" element={<Coupons />} />
                <Route path="/account/rewards" element={<Rewards />} />
                <Route path="/account/security" element={<Security />} />
              </Route>

              <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/orders/:orderNumber" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/wishlist" element={<Wishlist />} />

              {/* Support + legal */}
              <Route path="/help" element={<Help />} />
              <Route path="/faq" element={<Help initialTab="faq" />} />
              <Route path="/support" element={<Support />} />
              <Route path="/about" element={<StaticPage name="about" />} />
              <Route path="/contact" element={<Support />} />
              <Route path="/policy/privacy" element={<StaticPage name="privacy" />} />
              <Route path="/policy/terms" element={<StaticPage name="terms" />} />
              <Route path="/policy/shipping" element={<StaticPage name="shipping" />} />
              <Route path="/policy/cancellation" element={<StaticPage name="cancellation" />} />

              {/* Admin — route AND API are both guarded */}
              <Route path="/admin/*" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <MobileNav />
      </div>
      <CartDrawer />
      <LocationSelector />
    </ErrorBoundary>
  );
}
