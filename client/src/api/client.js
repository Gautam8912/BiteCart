/**
 * Tiny fetch wrapper. Every request is same-origin (/api/...) so the session
 * cookie is first-party in both dev (Vite proxy) and production.
 *
 * Errors are normalised into an Error with `status`, `code` and `details` so
 * pages can show a real reason instead of a generic failure.
 */

class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, { body, signal, retry = 1 } = {}) {
  const options = {
    method,
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    signal,
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let lastError;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const res = await fetch(path, options);
      let payload = null;
      const text = await res.text();
      if (text) {
        try { payload = JSON.parse(text); } catch { payload = { error: text }; }
      }
      if (!res.ok) {
        throw new ApiError(payload?.error || `Request failed (${res.status})`, {
          status: res.status, code: payload?.code, details: payload?.details,
        });
      }
      return payload;
    } catch (err) {
      lastError = err;
      // Only retry idempotent GETs on network failure, never on a 4xx/5xx answer.
      const retryable = method === 'GET' && err instanceof ApiError === false && err.name === 'TypeError';
      if (!retryable || attempt === retry) break;
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

const buildQuery = (params) => {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) v.forEach((item) => usp.append(k, item));
    else usp.append(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
};

export const api = {
  get: (path, params, opts) => request('GET', path + buildQuery(params), opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, body, opts) => request('DELETE', path, { ...opts, body }),
};

export { ApiError };

/* ------------------------------- endpoints ------------------------------- */
export const Endpoints = {
  config: () => api.get('/api/config'),
  health: () => api.get('/api/health'),

  categories: () => api.get('/api/categories'),
  products: (params, opts) => api.get('/api/products', params, opts),
  productSections: (opts) => api.get('/api/products/sections', null, opts),
  product: (slug, opts) => api.get(`/api/products/${encodeURIComponent(slug)}`, null, opts),
  facets: (params) => api.get('/api/products/facets', params),
  search: (params, opts) => api.get('/api/search', params, opts),
  suggest: (q, opts) => api.get('/api/search/suggest', { q }, opts),
  restaurants: (params, opts) => api.get('/api/restaurants', params, opts),
  restaurant: (slug, opts) => api.get(`/api/restaurants/${encodeURIComponent(slug)}`, null, opts),
  cities: (opts) => api.get('/api/location/cities', null, opts),
  locationSearch: (q) => api.get('/api/location/search', { q }),
  serviceability: (pincode) => api.get('/api/location/check', { pincode }),

  register: (body) => api.post('/api/auth/register', body),
  login: (body) => api.post('/api/auth/login', body),
  logout: () => api.post('/api/auth/logout', {}),
  me: () => api.get('/api/auth/me'),
  google: () => api.post('/api/auth/google', {}),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/api/auth/reset-password', { token, password }),
  updateProfile: (body) => api.patch('/api/auth/profile', body),
  changePassword: (body) => api.post('/api/auth/change-password', body),

  cart: (coupon) => api.get('/api/cart', coupon ? { coupon } : null),
  cartSummary: () => api.get('/api/cart/summary'),
  cartAdd: (itemId, quantity = 1, options = []) => api.post('/api/cart/items', { itemId, quantity, options }),
  cartSetQty: (itemId, quantity, options = []) => api.patch('/api/cart/items', { itemId, quantity, options }),
  cartRemove: (itemId, options = []) => api.delete('/api/cart/items', { itemId, options }),
  cartSave: (itemId, options = []) => api.post('/api/cart/items/save', { itemId, options }),
  cartUnsave: (itemId, options = []) => api.post('/api/cart/items/unsave', { itemId, options }),
  cartClear: () => api.delete('/api/cart'),
  cartMerge: (guestSessionId) => api.post('/api/cart/merge', { guestSessionId }),

  checkoutPreview: (body) => api.post('/api/checkout/preview', body),
  checkoutMethods: () => api.get('/api/checkout/methods'),
  placeOrder: (body) => api.post('/api/checkout', body),
  orders: () => api.get('/api/checkout'),
  order: (n) => api.get(`/api/checkout/${encodeURIComponent(n)}`),
  cancelOrder: (n) => api.post(`/api/checkout/${encodeURIComponent(n)}/cancel`, {}),
  reorder: (n) => api.post(`/api/checkout/${encodeURIComponent(n)}/reorder`, {}),

  addresses: () => api.get('/api/account/addresses'),
  addAddress: (body) => api.post('/api/account/addresses', body),
  updateAddress: (id, body) => api.put(`/api/account/addresses/${id}`, body),
  deleteAddress: (id) => api.delete(`/api/account/addresses/${id}`),
  setDefaultAddress: (id) => api.post(`/api/account/addresses/${id}/default`, {}),
  wishlist: () => api.get('/api/account/wishlist'),
  wishlistAdd: (productId) => api.post('/api/account/wishlist', { productId }),
  wishlistRemove: (productId) => api.delete(`/api/account/wishlist/${productId}`),
  coupons: () => api.get('/api/account/coupons'),
  paymentMethods: () => api.get('/api/account/payment-methods'),
  addPaymentMethod: (body) => api.post('/api/account/payment-methods', body),
  deletePaymentMethod: (id) => api.delete(`/api/account/payment-methods/${id}`),
  loyalty: () => api.get('/api/account/loyalty'),
  notifications: () => api.get('/api/notifications'),
  markRead: (id) => api.post(`/api/notifications/${id}/read`, {}),
  markAllRead: () => api.post('/api/notifications/read-all', {}),
  clearNotifications: () => api.delete('/api/notifications'),
  tickets: () => api.get('/api/support/tickets'),
  createTicket: (body) => api.post('/api/support/tickets', body),

  admin: {
    stats: () => api.get('/api/admin/stats'),
    products: (q) => api.get('/api/admin/products', { q }),
    createProduct: (body) => api.post('/api/admin/products', body),
    updateProduct: (id, body) => api.put(`/api/admin/products/${id}`, body),
    setStock: (id, stock) => api.post(`/api/admin/products/${id}/stock`, { stock }),
    deactivateProduct: (id) => api.delete(`/api/admin/products/${id}`),
    categories: () => api.get('/api/admin/categories'),
    updateCategory: (id, body) => api.put(`/api/admin/categories/${id}`, body),
    createCategory: (body) => api.post('/api/admin/categories', body),
    restaurants: () => api.get('/api/admin/restaurants'),
    updateRestaurant: (id, body) => api.put(`/api/admin/restaurants/${id}`, body),
    addMenuItem: (id, body) => api.post(`/api/admin/restaurants/${id}/menu`, body),
    updateMenuItem: (id, body) => api.put(`/api/admin/menu/${id}`, body),
    orders: (params) => api.get('/api/admin/orders', params),
    setOrderStatus: (n, status, note) => api.put(`/api/admin/orders/${encodeURIComponent(n)}/status`, { status, note }),
    coupons: () => api.get('/api/admin/coupons'),
    createCoupon: (body) => api.post('/api/admin/coupons', body),
    updateCoupon: (id, body) => api.put(`/api/admin/coupons/${id}`, body),
    settings: () => api.get('/api/admin/settings'),
    updateSettings: (body) => api.put('/api/admin/settings', body),
    cities: () => api.get('/api/admin/cities'),
    updateCity: (id, body) => api.put(`/api/admin/cities/${id}`, body),
    users: (q) => api.get('/api/admin/users', { q }),
    setUserRole: (id, role) => api.put(`/api/admin/users/${id}/role`, { role }),
    tickets: (status) => api.get('/api/admin/tickets', { status }),
    updateTicket: (id, status) => api.put(`/api/admin/tickets/${id}`, { status }),
    auditLog: () => api.get('/api/admin/audit-log'),
  },
};
