import React, { createContext, useContext, useEffect, useCallback, useRef, type PropsWithChildren } from 'react';
import { getSocket } from '../../../lib/socket';
import { useNotificationsStore } from '../store/notifications.store';
import type { NotificationItem } from '../api/admin.notifications.api';

interface AdminNotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  fetchMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminNotificationsContext = createContext<AdminNotificationsContextValue | null>(null);

export function AdminNotificationsProvider({ children }: PropsWithChildren) {
  const store = useNotificationsStore();
  const initializedRef = useRef(false);

  // Fetch initial notifications and connect socket listeners
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    store.fetchNotifications(true);
    store.fetchUnreadCount();

    const socket = getSocket();
    if (!socket) return;

    const handleNotificationNew = (payload: any) => {
      // Only add admin-staff notifications to the dropdown
      const role = payload?.recipientRole;
      const isAdminNotification = !role || role === 'RESTAURANT_ADMIN' || role === 'SERVICE_STAFF';

      if (isAdminNotification && payload?._id) {
        store.addRealtimeNotification(payload);
      }
    };

    socket.on('notification:new', handleNotificationNew);

    return () => {
      socket.off('notification:new', handleNotificationNew);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useCallback(async (id: string) => {
    await store.markAsRead(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markAllRead = useCallback(async () => {
    await store.markAllAsRead();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteNotification = useCallback(async (id: string) => {
    await store.deleteNotification(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMore = useCallback(async () => {
    await store.fetchMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    await store.fetchNotifications(true);
    await store.fetchUnreadCount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value: AdminNotificationsContextValue = {
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    loading: store.loading,
    loadingMore: store.loadingMore,
    hasMore: store.hasMore,
    markRead,
    markAllRead,
    deleteNotification,
    fetchMore,
    refresh,
  };

  return (
    <AdminNotificationsContext.Provider value={value}>
      {children}
    </AdminNotificationsContext.Provider>
  );
}

export function useAdminNotifications(): AdminNotificationsContextValue {
  const ctx = useContext(AdminNotificationsContext);
  if (!ctx) throw new Error('useAdminNotifications must be used within AdminNotificationsProvider');
  return ctx;
}
