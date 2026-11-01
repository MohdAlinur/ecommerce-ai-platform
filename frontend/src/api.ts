import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

function getCookie(name: string): string | null {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '')) {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
    // Clear short GET cache whenever any mutation happens
    shortGetCache.clear();
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// ============================================================================
// IN-FLIGHT REQUEST DEDUPLICATOR & 2-SECOND BURST CACHE
// Prevents App.tsx + StorePage.tsx + React StrictMode from firing 4 identical
// 403KB GET /api/products/ calls simultaneously on page load.
// ============================================================================
const inFlightRequests = new Map<string, Promise<any>>();
const shortGetCache = new Map<string, { data: any; timestamp: number }>();
const BURST_TTL_MS = 2500;

function deduplicatedGet(url: string, params?: Record<string, any>): Promise<any> {
  const key = `${url}::${JSON.stringify(params || {})}`;
  const now = Date.now();

  const cached = shortGetCache.get(key);
  if (cached && now - cached.timestamp < BURST_TTL_MS) {
    return Promise.resolve(cached.data);
  }

  const existingPromise = inFlightRequests.get(key);
  if (existingPromise) {
    return existingPromise;
  }

  const reqPromise = api
    .get(url, { params })
    .then(res => {
      shortGetCache.set(key, { data: res.data, timestamp: Date.now() });
      inFlightRequests.delete(key);
      return res.data;
    })
    .catch(err => {
      inFlightRequests.delete(key);
      throw err;
    });

  inFlightRequests.set(key, reqPromise);
  return reqPromise;
}

export const fetchProducts = (categorySlug?: string, search?: string, ordering?: string) =>
  deduplicatedGet('/products/', { category: categorySlug, search, ordering });

export const fetchStoreHighlights = () =>
  deduplicatedGet('/store-highlights/');

export const fetchCategories = () =>
  deduplicatedGet('/categories/');

export const fetchProfile = () =>
  deduplicatedGet('/auth/profile/');

export const createProduct = (formData: FormData) =>
  api.post('/products/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);

export const updateProduct = (id: number, formData: FormData) =>
  api.put(`/products/${id}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);

export const patchProduct = (id: number, data: Record<string, unknown>) =>
  api.patch(`/products/${id}/`, data).then(res => res.data);

export const deleteProduct = (id: number) => api.delete(`/products/${id}/`).then(res => res.data);

export const createCategory = (name: string) => api.post('/categories/', { name }).then(res => res.data);

export const deleteCategory = (id: number) => api.delete(`/categories/${id}/`).then(res => res.data);

export const submitReview = (review: Record<string, unknown>) => api.post('/reviews/', review).then(res => res.data);

export const createOrder = (orderData: Record<string, unknown>) => api.post('/orders/', orderData).then(res => res.data);

export const cancelCustomerOrder = (orderId: number) => api.post(`/orders/${orderId}/cancel/`).then(res => res.data);

export const validateDiscountCode = (code: string, subtotal: number) =>
  api.post('/discounts/validate/', { code, subtotal }).then(res => res.data);

export const loginUser = (credentials: { email?: string; phone?: string; identifier?: string; username?: string; password?: string }) =>
  api.post('/auth/login/', credentials).then(res => res.data);

export const signupUser = (userData: { name: string; phone: string; email: string; password?: string; shipping_address?: string }) =>
  api.post('/auth/signup/', userData).then(res => res.data);

export const logoutUser = () => api.post('/auth/logout/').then(res => res.data);

export const updateProfile = (data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return api.put('/auth/profile/', data, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' }
  }).then(res => res.data);
};

export const fetchAllUsers = () => api.get('/admin/users/').then(res => res.data);

export const deleteUserAccount = (id: number) => api.delete(`/admin/users/${id}/`).then(res => res.data);

export const fetchAdminAnalytics = () => api.get('/admin/analytics/').then(res => res.data);

export const analyzeProductAI = (id: number) => api.post(`/products/${id}/analyze-ai/`).then(res => res.data);

export const sendSupportChatMessage = (history: unknown[], message: string, context?: string) =>
  api.post('/chat/support/', { history, message, product_context: context }).then(res => res.data);

export const createAdminUser = (data: { name: string; phone: string; email: string; password?: string }) =>
  api.post('/admin/users/create-admin/', data).then(res => res.data);

export const bulkImportCSV = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/admin/products/bulk-csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data);
};

export const bulkDeleteProducts = (productIds: number[]) =>
  api.post('/admin/products/bulk-delete/', { product_ids: productIds }).then(res => res.data);

export default api;