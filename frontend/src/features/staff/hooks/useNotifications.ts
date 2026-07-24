import { useState, useEffect, useCallback, useMemo } from 'react';
import { notificationsAPI, type NotificationItem } from '../api/notifications.api';

// Module-level global state variables
let globalNotifications: NotificationItem[] = [];
let globalLoading = false;
let globalError: string | null = null;
let hasFetchedInitially = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

export function useNotifications() {
  const [state, setState] = useState({
    notifications: globalNotifications,
    loading: globalLoading,
    error: globalError,
  });

  useEffect(() => {
    const handler = () => {
      setState({
        notifications: globalNotifications,
        loading: globalLoading,
        error: globalError,
      });
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const unreadCount = useMemo(() => state.notifications.filter((item) => !item.read).length, [state.notifications]);

  const fetchNotifications = useCallback(async () => {
    globalLoading = true;
    globalError = null;
    notifyListeners();
    try {
      const res = await notificationsAPI.getNotifications();
      if (res.success && Array.isArray(res.data)) {
        globalNotifications = res.data;
      } else {
        globalNotifications = [];
      }
    } catch (err) {
      globalError = err instanceof Error ? err.message : 'Failed to fetch notifications';
      globalNotifications = [];
    } finally {
      globalLoading = false;
      hasFetchedInitially = true;
      notifyListeners();
    }
  }, []);

  const markAsRead = useCallback(async (id: number | string) => {
    globalNotifications = globalNotifications.map((item) => (item.id === id ? { ...item, read: true } : item));
    notifyListeners();
    void notificationsAPI.markAsRead(id);
  }, []);

  const toggleRead = useCallback(async (id: number | string) => {
    let targetState = false;
    globalNotifications = globalNotifications.map((item) => {
      if (item.id === id) {
        targetState = !item.read;
        return { ...item, read: targetState };
      }
      return item;
    });
    notifyListeners();
    if (targetState) {
      void notificationsAPI.markAsRead(id);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    globalNotifications = globalNotifications.map((item) => ({ ...item, read: true }));
    notifyListeners();
    void notificationsAPI.markAllAsRead();
  }, []);

  const clearRead = useCallback(() => {
    globalNotifications = globalNotifications.filter((item) => !item.read);
    notifyListeners();
  }, []);

  useEffect(() => {
    if (!hasFetchedInitially && !globalLoading) {
      void fetchNotifications();
    }
  }, [fetchNotifications]);

  return {
    notifications: state.notifications,
    unreadCount,
    loading: state.loading,
    error: state.error,
    markAsRead,
    toggleRead,
    markAllAsRead,
    clearRead,
    refresh: fetchNotifications,
  };
}
