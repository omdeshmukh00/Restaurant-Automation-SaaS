import { useState, useEffect, useCallback, useMemo } from 'react';
import { notificationsAPI, type NotificationItem } from '../api/notifications.api';

const initialCleaningNotifications: NotificationItem[] = [
  {
    id: 1,
    title: 'Table 12 needs cleaning',
    message: 'Guest checkout completed. Cleaning task is ready for assignment.',
    time: '2 min ago',
    tone: 'urgent',
    read: false,
  },
  {
    id: 2,
    title: 'Shift change confirmed',
    message: 'Evening cleaning staff shift has been updated.',
    time: '12 min ago',
    tone: 'info',
    read: false,
  },
  {
    id: 3,
    title: 'Kitchen sanitation completed',
    message: 'Kitchen station B passed the sanitation checklist.',
    time: '25 min ago',
    tone: 'success',
    read: true,
  },
  {
    id: 4,
    title: 'Washroom inspection due',
    message: 'Main floor washroom inspection is due in 5 minutes.',
    time: '40 min ago',
    tone: 'cleaning',
    read: true,
  },
];

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialCleaningNotifications);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const tone = item.tone || 'info';
      if (typeof window !== 'undefined') {
        if (tone === 'urgent') {
          const saved = localStorage.getItem('cleanserve-settings-urgentAlerts');
          if (saved === 'false') return false;
        }
        if (tone === 'cleaning' || tone === 'success') {
          const saved = localStorage.getItem('cleanserve-settings-taskReminders');
          if (saved === 'false') return false;
        }
        if (tone === 'info') {
          const saved = localStorage.getItem('cleanserve-settings-shiftAlerts');
          if (saved === 'false') return false;
        }
      }
      return true;
    });
  }, [notifications]);

  const unreadCount = useMemo(() => filteredNotifications.filter((item) => !item.read).length, [filteredNotifications]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationsAPI.getNotifications();
      if (res.success && res.data && res.data.length > 0) {
        setNotifications(res.data);
      } else {
        setNotifications(initialCleaningNotifications);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
      setNotifications(initialCleaningNotifications);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: number) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
    void notificationsAPI.markAsRead(id);
  }, []);

  const toggleRead = useCallback(async (id: number) => {
    let targetState = false;
    setNotifications((current) =>
      current.map((item) => {
        if (item.id === id) {
          targetState = !item.read;
          return { ...item, read: targetState };
        }
        return item;
      })
    );
    if (targetState) {
      void notificationsAPI.markAsRead(id);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    void notificationsAPI.markAllAsRead();
  }, []);

  const clearRead = useCallback(() => {
    setNotifications((current) => current.filter((item) => !item.read));
  }, []);

  const addNotification = useCallback((title: string, message: string) => {
    const newNotif: NotificationItem = {
      id: Date.now(),
      title,
      message,
      time: 'Just Now',
      tone: 'urgent',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchNotifications();
    };
    loadData();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleNewRequest = (event: Event) => {
      const customEvent = event as CustomEvent; 
      const newNotif = customEvent.detail;
      setNotifications((prev) => [newNotif, ...prev]);

      const tone = newNotif.tone || 'urgent';
      if (tone === 'urgent') {
        const playAlert = localStorage.getItem('cleanserve-settings-urgentAlerts') !== 'false';
        if (playAlert) {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.12);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.15);
            gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.15);
            osc2.start(ctx.currentTime + 0.15);
            osc2.stop(ctx.currentTime + 0.32);
          } catch (e) {
            console.warn('Audio alert failed', e);
          }

          if ('vibrate' in navigator) {
            navigator.vibrate([100, 60, 100]);
          }
        }
      }
    };

    window.addEventListener('new-cleaning-request', handleNewRequest);
    return () => window.removeEventListener('new-cleaning-request', handleNewRequest);
  }, []);

  return {
    notifications: filteredNotifications,
    unreadCount,
    addNotification,
    loading,
    error,
    markAsRead,
    toggleRead,
    markAllAsRead,
    clearRead,
    refresh: fetchNotifications,
  };
}
