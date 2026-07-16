import React, { createContext, useContext, useState, useEffect, type PropsWithChildren } from 'react';
import { getSocket } from '../../../lib/socket';

export interface AdminNotification {
  id: string;
  message: string;
  time: string;
  icon: string;
  read: boolean;
}

interface AdminNotificationsContextValue {
  notifications: AdminNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (n: Omit<AdminNotification, 'id' | 'read'>) => void;
}

const AdminNotificationsContext = createContext<AdminNotificationsContextValue | null>(null);

const INITIAL_NOTIFICATIONS: AdminNotification[] = [
  { id: '1', message: 'New order #1042 received from Table 5', time: '2 min ago', icon: '🛒', read: false },
  { id: '2', message: 'Low stock alert: Tomatoes below threshold', time: '15 min ago', icon: '⚠️', read: false },
  { id: '3', message: 'Reservation confirmed for 7 guests at 8 PM', time: '1 hr ago', icon: '📅', read: false },
  { id: '4', message: 'Staff member Rahul checked in', time: '2 hr ago', icon: '👤', read: true },
  { id: '5', message: "Daily revenue target ₹50,000 achieved!", time: '3 hr ago', icon: '🎯', read: true },
];

function iconForType(type?: string): string {
  switch (type) {
    case 'LOW_STOCK_ALERT':
    case 'INVENTORY_ALERT':
      return '⚠️';
    case 'ORDER_PLACED':
    case 'ORDER_NEW':
      return '🛒';
    case 'RESERVATION':
      return '📅';
    case 'STAFF':
      return '👤';
    default:
      return '🔔';
  }
}

export function AdminNotificationsProvider({ children }: PropsWithChildren) {
  const [notifications, setNotifications] = useState<AdminNotification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function addNotification(n: Omit<AdminNotification, 'id' | 'read'>) {
    setNotifications((prev) => [
      { ...n, id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, read: false },
      ...prev,
    ]);
  }

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handle = (n: Omit<AdminNotification, 'id' | 'read'>) => addNotification(n);

    const onNotificationNew = (payload: any) => {
      handle({
        message: payload?.title ? `${payload.title}${payload.message ? ` — ${payload.message}` : ''}` : (payload?.message ?? 'New notification'),
        time: 'just now',
        icon: iconForType(payload?.type),
      });
    };

    const onOrderCreated = (payload: any) => {
      handle({
        message: `New order received${payload?.orderId ? ` (#${payload.orderId})` : ''}`,
        time: 'just now',
        icon: '🛒',
      });
    };

    const onStaffRequest = (_payload: any) => {
      handle({
        message: 'New staff assistance request',
        time: 'just now',
        icon: '👤',
      });
    };

    socket.on('notification:new', onNotificationNew);
    socket.on('order.created', onOrderCreated);
    socket.on('staff:request-new', onStaffRequest);

    return () => {
      socket.off('notification:new', onNotificationNew);
      socket.off('order.created', onOrderCreated);
      socket.off('staff:request-new', onStaffRequest);
    };
  }, []);

  return (
    <AdminNotificationsContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, addNotification }}>
      {children}
    </AdminNotificationsContext.Provider>
  );
}

export function useAdminNotifications(): AdminNotificationsContextValue {
  const ctx = useContext(AdminNotificationsContext);
  if (!ctx) throw new Error('useAdminNotifications must be used within AdminNotificationsProvider');
  return ctx;
}