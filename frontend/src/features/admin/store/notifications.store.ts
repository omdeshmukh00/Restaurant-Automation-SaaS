import { create } from 'zustand';
import { adminNotificationsApi, type NotificationItem } from '../api/admin.notifications.api';

const PAGE_SIZE = 20;

interface NotificationsState {
  // Data
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  // Pagination
  page: number;
  hasMore: boolean;
  total: number;

  // Actions
  fetchNotifications: (reset?: boolean) => Promise<void>;
  fetchMore: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addRealtimeNotification: (notification: NotificationItem) => void;
  reset: () => void;
}

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  loadingMore: false,
  error: null,
  page: 1,
  hasMore: true,
  total: 0,
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  ...initialState,

  fetchNotifications: async (reset = true) => {
    // If resetting, start from page 1
    const page = reset ? 1 : get().page;
    set({ loading: reset, loadingMore: !reset, error: null });

    try {
      const response = await adminNotificationsApi.getNotifications({
        page,
        limit: PAGE_SIZE,
      });

      set({
        notifications: reset
          ? response.notifications
          : [...get().notifications, ...response.notifications],
        unreadCount: response.unreadCount,
        page: response.pagination.page,
        hasMore: response.pagination.hasMore,
        total: response.pagination.total,
        loading: false,
        loadingMore: false,
      });
    } catch (err: any) {
      set({
        loading: false,
        loadingMore: false,
        error: err?.message || 'Failed to fetch notifications',
      });
    }
  },

  fetchMore: async () => {
    const { hasMore, loadingMore, page } = get();
    if (!hasMore || loadingMore) return;

    set({ page: page + 1 });
    await get().fetchNotifications(false);
  },

  fetchUnreadCount: async () => {
    try {
      const count = await adminNotificationsApi.getUnreadCount();
      set({ unreadCount: count });
    } catch {
      // Silently fail for count
    }
  },

  markAsRead: async (id: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === id ? { ...n, read: true, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await adminNotificationsApi.markAsRead(id);
    } catch {
      // Revert on failure — refetch
      get().fetchNotifications(true);
    }
  },

  markAllAsRead: async () => {
    const previousUnread = get().unreadCount;

    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true, isRead: true })),
      unreadCount: 0,
    }));

    try {
      await adminNotificationsApi.markAllAsRead();
    } catch {
      // Revert
      set({ unreadCount: previousUnread });
    }
  },

  deleteNotification: async (id: string) => {
    const previous = get().notifications;
    const wasUnread = previous.find((n) => n._id === id && !n.read);

    // Optimistic removal
    set((state) => ({
      notifications: state.notifications.filter((n) => n._id !== id),
      unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
    }));

    try {
      await adminNotificationsApi.deleteNotification(id);
    } catch {
      // Revert
      set({ notifications: previous });
    }
  },

  addRealtimeNotification: (notification: NotificationItem) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  reset: () => {
    set(initialState);
  },
}));
