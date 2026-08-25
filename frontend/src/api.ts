import axios from 'axios';
import type { Product, Category, UserProfile, AIReviewAnalysis, AnalyticsData, Review } from './types';

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
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Original fetchProducts restored (No Pagination)
export const fetchProducts = (categorySlug?: string, search?: string) => 
  api.get('/products/', { params: { category: categorySlug, search } }).then(res => res.data);

export const createProduct = (formData: FormData) => 
  api.post('/products/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);

export const updateProduct = (id: number, formData: FormData) => 
  api.put(`/products/${id}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);

export const deleteProduct = (id: number) => api.delete(`/products/${id}/`).then(res => res.data);

export const fetchCategories = () => api.get('/categories/').then(res => res.data);

export const createCategory = (name: string) => api.post('/categories/', { name }).then(res => res.data);

export const submitReview = (review: any) => api.post('/reviews/', review).then(res => res.data);

export const createOrder = (orderData: any) => api.post('/orders/', orderData).then(res => res.data);

export const loginUser = (credentials: { email: string; password?: string }) => 
  api.post('/auth/login/', credentials).then(res => res.data);

export const signupUser = (userData: { name: string; phone: string; email: string; password?: string }) => 
  api.post('/auth/signup/', userData).then(res => res.data);

export const logoutUser = () => api.post('/auth/logout/').then(res => res.data);

export const fetchProfile = () => api.get('/auth/profile/').then(res => res.data);

export const updateProfile = (data: FormData | any) => {
  const isFormData = data instanceof FormData;
  return api.put('/auth/profile/', data, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' }
  }).then(res => res.data);
};

export const fetchAllUsers = () => api.get('/admin/users/').then(res => res.data);

export const deleteUserAccount = (id: number) => api.delete(`/admin/users/${id}/`).then(res => res.data);

export const fetchAdminAnalytics = () => api.get('/admin/analytics/').then(res => res.data);

export const analyzeProductAI = (id: number) => api.post(`/products/${id}/analyze-ai/`).then(res => res.data);

export const sendSupportChatMessage = (history: any[], message: string, context?: string) => 
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

// Kept your requested Bulk Delete
export const bulkDeleteProducts = (productIds: number[]) => 
  api.post('/admin/products/bulk-delete/', { product_ids: productIds }).then(res => res.data);

export default api;