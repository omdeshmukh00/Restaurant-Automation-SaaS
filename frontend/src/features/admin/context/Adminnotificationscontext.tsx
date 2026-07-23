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

    // Additional real-time events for the admin notification bar
    const onOrderCreated = (payload: any) => {
      store.addRealtimeNotification({
        _id: `order-${Date.now()}`,
        title: 'New Order',
        message: `New order received${payload?.orderId ? ` (#${payload.orderId})` : ''}`,
        type: 'ORDER_NEW',
        read: false,
        createdAt: new Date().toISOString(),
        restaurantId: '',
        recipientRole: 'RESTAURANT_ADMIN',
        module: 'orders',
        category: 'SYSTEM' as any,
        entityId: '',
        actionUrl: '',
        expiresAt: '',
      } as NotificationItem);
    };

    const onStaffRequest = (_payload: any) => {
      store.addRealtimeNotification({
        _id: `staff-${Date.now()}`,
        title: 'Staff Request',
        message: 'New staff assistance request',
        type: 'STAFF_REQUEST',
        read: false,
        createdAt: new Date().toISOString(),
        restaurantId: '',
        recipientRole: 'RESTAURANT_ADMIN',
        module: 'staff',
        category: 'SYSTEM' as any,
        entityId: '',
        actionUrl: '',
        expiresAt: '',
      } as NotificationItem);
    };

    const onStaffTicket = (payload: any) => {
      store.addRealtimeNotification({
        _id: `ticket-${Date.now()}`,
        title: 'Escalation Ticket',
        message: `Escalation Ticket: ${payload?.subject || payload?.notes || 'Staff issue escalated'}`,
        type: 'TICKET',
        read: false,
        createdAt: new Date().toISOString(),
        restaurantId: '',
        recipientRole: 'RESTAURANT_ADMIN',
        module: 'staff',
        category: 'SYSTEM' as any,
        entityId: '',
        actionUrl: '',
        expiresAt: '',
      } as NotificationItem);
    };

    const onBillRequested = (payload: any) => {
      store.addRealtimeNotification({
        _id: `bill-${Date.now()}`,
        title: 'Bill Requested',
        message: `Bill Requested for Table ${payload?.tableNumber || ''}`,
        type: 'BILL_REQUESTED',
        read: false,
        createdAt: new Date().toISOString(),
        restaurantId: '',
        recipientRole: 'RESTAURANT_ADMIN',
        module: 'billing',
        category: 'SYSTEM' as any,
        entityId: '',
        actionUrl: '',
        expiresAt: '',
      } as NotificationItem);
    };

    socket.on('order.created', onOrderCreated);
    socket.on('staff:request-new', onStaffRequest);
    socket.on('staff.ticket.created', onStaffTicket);
    socket.on('bill.requested', onBillRequested);

    return () => {
      socket.off('notification:new', handleNotificationNew);
      socket.off('order.created', onOrderCreated);
      socket.off('staff:request-new', onStaffRequest);
      socket.off('staff.ticket.created', onStaffTicket);
      socket.off('bill.requested', onBillRequested);
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
