import axios from 'axios';
import { env } from '../../lib/env';
import { getAccessToken, setAccessToken, clearPanelSession, getPanelFromPath, type Panel } from '../../auth/tokenStore';

function getPanelFromUrl(url: string | undefined): Panel | null {
  if (!url) return null;
  
  // Remove baseURL, protocol, domain, and API prefix if present
  const cleanPath = url
    .replace(/^(https?:\/\/[^/]+)?/, '') // remove http://host
    .replace(/^\/?api\/v\d+/, '')         // remove /api/v1 or api/v1
    .replace(/^\/?api/, '');              // remove /api or api

  if (cleanPath.startsWith('/superadmin') || cleanPath.startsWith('superadmin') || cleanPath.startsWith('/super-admin') || cleanPath.startsWith('super-admin')) return 'superadmin';
  if (cleanPath.startsWith('/admin') || cleanPath.startsWith('admin')) return 'admin';
  if (cleanPath.startsWith('/kitchen') || cleanPath.startsWith('kitchen')) return 'kitchen';
  if (cleanPath.startsWith('/staff') || cleanPath.startsWith('staff')) return 'staff';
  if (cleanPath.startsWith('/cleaning') || cleanPath.startsWith('cleaning')) return 'cleaning';
  if (cleanPath.startsWith('/customer') || cleanPath.startsWith('customer')) return 'customer';
  
  return null;
}

export function getSessionToken(): string | null {
  return localStorage.getItem('x-session-token');
}

export function setSessionToken(token: string): void {
  localStorage.setItem('x-session-token', token);
}

export function removeSessionToken(): void {
  localStorage.removeItem('x-session-token');
}

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  // Resolve the access token from the URL prefix or the current page path (tab-isolated)
  const panel = getPanelFromUrl(config.url) || getPanelFromPath(window.location.pathname);
  const token = getAccessToken(panel);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const sessionToken = getSessionToken();
  if (sessionToken) {
    config.headers['x-session-token'] = sessionToken;
  }

  return config;
});

// Interceptor Queue variables for token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle token expiration (401 with code TOKEN_EXPIRED, TOKEN_INVALID, UNAUTHORIZED)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      return Promise.reject(error);
    }

    const { status, data } = error.response;
    const errorCode = data?.error?.code;
    const url = originalRequest.url || '';

    const isAuthAction =
      url.includes('/auth/login') ||
      url.includes('/auth/verify-otp') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/verify-reset-otp') ||
      url.includes('/auth/reset-password') ||
      url.includes('/auth/request-otp') ||
      url.includes('/auth/refresh') ||
      url.includes('/logout') ||
      url.includes('/session/end');

    if (
      status === 401 && 
      (errorCode === 'SESSION_INVALID' || errorCode === 'TABLE_SESSION_EXPIRED' || errorCode === 'SESSION_IDLE_TIMEOUT')
    ) {
      localStorage.removeItem('x-session-token');
      
      // Use dynamic import to prevent circular dependency with customer.store.ts
      import('../../features/customer/store/customer.store').then(({ useCustomerStore }) => {
        useCustomerStore.getState().clearDiningSession(true);
      });

      // Only redirect to QR scanner if currently on a session-mandatory route (home, menu, checkout)
      const currentPath = window.location.pathname;
      const isSessionRoute = ['/customer/home', '/customer/menu', '/customer/cart', '/customer/checkout'].some(
        (p) => currentPath === p || currentPath.startsWith(p + '/')
      );

      if (isSessionRoute) {
        window.location.href = '/customer?scan=true&expired=true';
      }
      return Promise.reject(error);
    }

    if (
      !isAuthAction &&
      status === 401 &&
      (errorCode === 'TOKEN_EXPIRED' ||
        errorCode === 'TOKEN_INVALID' ||
        errorCode === 'UNAUTHORIZED') &&
      !originalRequest._retry
    ) {
      const panel = getPanelFromUrl(originalRequest.url) || getPanelFromPath(window.location.pathname);

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${env.apiUrl}/auth/refresh`,
          { panel },
          {
            withCredentials: true,
            timeout: 5000,
          }
        );
        const newAccessToken = refreshResponse.data.data.accessToken;

        setAccessToken(panel, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError: any) {
        processQueue(refreshError, null);
        isRefreshing = false;

        const isNetworkError = !refreshError.response || refreshError.code === 'ECONNABORTED';
        const isServerError = refreshError.response && refreshError.response.status >= 500;

        if (!isNetworkError && !isServerError) {
          clearPanelSession(panel);

          // Redirect to login page for that panel
          const loginPath = panel === 'customer' ? '/auth/customer' : `/auth/${panel}`;
          window.location.href = loginPath;
        }

        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);



