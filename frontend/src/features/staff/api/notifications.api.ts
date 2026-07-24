import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '../../../shared/services/apiClient';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type NotificationTone = 'urgent' | 'success' | 'info' | 'cleaning';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  time: string;
  tone: NotificationTone;
  read: boolean;
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const config: AxiosRequestConfig = {
      url: endpoint,
      method: (options.method as AxiosRequestConfig['method']) || 'GET',
      headers: options.headers ? (options.headers as AxiosRequestConfig['headers']) : undefined,
      data: options.body ? JSON.parse(options.body as string) : undefined,
    };

    const response = await apiClient.request<{ success: boolean; data: T; error?: string }>(config);
    const payload = response.data;
    if (!payload.success) {
      return { success: false, error: payload.error ?? 'Unknown error' };
    }
    return { success: true, data: payload.data };
  } catch (err) {
    const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
    const unknownErr = err as unknown;
    let errorStr = 'Unknown error';
    if (isObj(unknownErr)) {
      const resp = unknownErr['response'];
      if (isObj(resp)) {
        const data = resp['data'];
        if (isObj(data)) {
          const e = data['error'];
          if (typeof e === 'string') errorStr = e;
          else if (isObj(e) && typeof e['message'] === 'string') errorStr = e['message'] as string;
        }
      }
      if (typeof unknownErr['message'] === 'string') {
        errorStr = unknownErr['message'] as string;
      }
    }
    console.error(`[Staff Notifications API] ${endpoint}:`, errorStr);
    return { success: false, error: String(errorStr) };
  }
}

export const notificationsAPI = {
  getNotifications: async (): Promise<ApiResponse<NotificationItem[]>> => {
    const res = await fetchAPI<any>('/notifications');
    const rawList = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.notifications)
      ? res.data.notifications
      : [];

    const formatted: NotificationItem[] = rawList.map((item: any, idx: number) => {
      const typeUpper = String(item.type || item.module || '').toUpperCase();
      const tone: NotificationTone =
        typeUpper.includes('READY') || typeUpper.includes('URGENT')
          ? 'urgent'
          : typeUpper.includes('REQUEST') || typeUpper.includes('CLEANING')
          ? 'cleaning'
          : typeUpper.includes('SERVED') || typeUpper.includes('SUCCESS') || typeUpper.includes('COMPLETED')
          ? 'success'
          : 'info';

      return {
        id: item._id || item.id || idx + 1,
        title: item.title || item.type || 'Notification',
        message: item.message || item.text || 'Notification update',
        time: item.createdAt
          ? new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
          : 'Just now',
        tone,
        read: Boolean(item.read || item.isRead),
      };
    });

    return {
      success: res.success,
      data: formatted,
      error: res.error,
    };
  },

  markAsRead: async (id: number | string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllAsRead: async (): Promise<ApiResponse<void>> => {
    return fetchAPI<void>('/notifications/read-all', { method: 'PATCH' });
  },
};
