import { apiClient } from '../../../shared/services/apiClient';

export interface NotificationItem {
  _id: string;
  restaurantId: string;
  recipientRole: string;
  title: string;
  message: string;
  type: string;
  module: string;
  category: string;
  priority: string;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  read: boolean;
  isRead: boolean;
  readAt?: string | null;
  readBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export const adminNotificationsApi = {
  getNotifications: async (params?: {
    page?: number;
    limit?: number;
    module?: string;
    type?: string;
    isRead?: boolean;
    recipientRole?: string;
  }): Promise<NotificationsResponse> => {
    const response = await apiClient.get('/notifications', { params });
    return response.data.data;
  },

  getUnreadCount: async (params?: { recipientRole?: string }): Promise<number> => {
    const response = await apiClient.get('/notifications/unread-count', { params });
    return response.data.data.unreadCount;
  },

  markAsRead: async (id: string): Promise<NotificationItem> => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data.data.notification;
  },

  markAllAsRead: async (params?: { recipientRole?: string }): Promise<number> => {
    const response = await apiClient.patch('/notifications/read-all', null, { params });
    return response.data.data.updatedCount;
  },

  deleteNotification: async (id: string): Promise<void> => {
    await apiClient.delete(`/notifications/${id}`);
  },
};
