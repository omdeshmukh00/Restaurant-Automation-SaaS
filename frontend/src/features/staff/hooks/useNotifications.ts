import { useState, useEffect, useCallback, useMemo } from 'react';
import { notificationsAPI, type NotificationItem } from '../api/notifications.api';

const initialStaffNotifications: NotificationItem[] = [
  {
    id: 1,
    title: 'Table T03 order ready',
    message: 'Order for Table T03 (Paneer Butter Masala) is ready in the kitchen.',
    time: '2 min ago',
    tone: 'urgent',
    read: false,
  },
  {
    id: 2,
    title: 'New customer request',
    message: 'Table T05 has requested extra cutlery.',
    time: '5 min ago',
    tone: 'cleaning',
    read: false,
  },
  {
    id: 3,
    title: 'Staff attendance summary',
    message: '32 active staff members are checked in for today\'s shift.',
    time: '15 min ago',
    tone: 'info',
    read: true,
  },
  {
    id: 4,
    title: 'Table status updated',
    message: 'Table T02 is now marked as served.',
    time: '30 min ago',
    tone: 'success',
    read: true,
  },
];

// Module-level global state variables
let globalNotifications: NotificationItem[] = [...initialStaffNotifications];
let globalLoading = false;
let globalError: string | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(l => l());
}

export function useNotifications() {
  const [state, setState] = useState({
    notifications: globalNotifications,
    loading: globalLoading,
    error: globalError
  });

  useEffect(() => {
    const handler = () => {
      setState({
        notifications: globalNotifications,
        loading: globalLoading,
        error: globalError
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
      if (res.success && res.data && res.data.length > 0) {
        globalNotifications = res.data;
      } else {
        globalNotifications = [...initialStaffNotifications];
      }
    } catch (err) {
      globalError = err instanceof Error ? err.message : 'Failed to fetch notifications';
      globalNotifications = [...initialStaffNotifications];
    } finally {
      globalLoading = false;
      notifyListeners();
    }
  }, []);

  const markAsRead = useCallback(async (id: number) => {
    globalNotifications = globalNotifications.map((item) => (item.id === id ? { ...item, read: true } : item));
    notifyListeners();
    void notificationsAPI.markAsRead(id);
  }, []);

  const toggleRead = useCallback(async (id: number) => {
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
    // Only fetch on mount if empty or default values are unchanged
    if (globalNotifications.length === initialStaffNotifications.length && globalNotifications[0].id === 1 && !globalLoading) {
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
