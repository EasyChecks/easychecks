import axios from 'axios';

// ใช้ /api-local ซึ่ง Next.js จะ proxy ไปที่ backend container
// ทำให้ทำงานได้ทั้ง local dev และ production โดยไม่ต้องเปลี่ยน NEXT_PUBLIC_API_URL
const isLocalDev = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const baseURL = isLocalDev
  ? '/api-local'  // ผ่าน Next.js proxy → http://backend:3001/api
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api');

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh');
    if (error.response?.status === 401 && !isAuthRequest) {
      // Unauthorized - clear token and redirect to login
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('authUser');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
