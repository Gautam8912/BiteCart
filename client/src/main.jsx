import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './styles/app.css';
import App from './App.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { LocationProvider } from './context/LocationContext.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { RecentlyViewedProvider } from './context/RecentlyViewedContext.jsx';

// Provider order matters: Toast is outermost (everyone can notify), Auth before
// Cart/Wishlist (they scope by user), Location before App (boot needs the city).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LocationProvider>
            <AppProvider>
              <CartProvider>
                <WishlistProvider>
                  <RecentlyViewedProvider>
                    <App />
                  </RecentlyViewedProvider>
                </WishlistProvider>
              </CartProvider>
            </AppProvider>
          </LocationProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
