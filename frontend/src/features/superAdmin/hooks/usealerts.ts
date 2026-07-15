// hooks/useAlerts.ts
import { useState, useMemo, useCallback, useEffect } from 'react';
import { AlertStatus, FilterType, SortOrder } from '../components/Alerts/index';
import { useRestaurantRequestsStore } from '../store/RestaurantRequests';
import { useAlertsStore, type Alert } from '../store/AlertsStore';

export function useAlerts() {
  const alerts = useAlertsStore((state) => state.alerts);
  const loading = useAlertsStore((state) => state.loading);
  const fetchAlerts = useAlertsStore((state) => state.fetchAlerts);
  const acknowledgeAlert = useAlertsStore((state) => state.acknowledgeAlert);
  const resolveAlert = useAlertsStore((state) => state.resolveAlert);
  const dismissAlert = useAlertsStore((state) => state.dismissAlert);
  const setupSocketListener = useAlertsStore((state) => state.setupSocketListener);

  const requests = useRestaurantRequestsStore((state) => state.requests);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [baseTime] = useState(() => Date.now());

  const [dismissedRequestIds, setDismissedRequestIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("superadmin_dismissed_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("superadmin_dismissed_notifications", JSON.stringify(dismissedRequestIds));
    } catch (e) {
      console.error(e);
    }
  }, [dismissedRequestIds]);

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem("superadmin_dismissed_notifications");
        if (saved) {
          setDismissedRequestIds(JSON.parse(saved));
        }
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    fetchAlerts();
    setupSocketListener();
  }, [fetchAlerts, setupSocketListener]);

  const linkedAlerts = useMemo<Alert[]>(() => {
    const existingEntities = new Set(
      alerts.map((alert) => alert.title?.toLowerCase()).filter(Boolean)
    );

    const requestAlerts = requests
      .map<Alert>((request, index) => ({
        id: `request-${request.id}`,
        title: 'New Restaurant Signup',
        description: `${request.name} requested ${request.plan} onboarding. Review this request from the Super Admin dashboard.`,
        type: 'info',
        status: request.status === 'APPLICATION_PENDING' || request.status === 'PENDING_PAYMENT' ? 'new' : 'resolved',
        entity: request.name,
        entityType: 'restaurant',
        timestamp: request.requestedAt || new Date(baseTime - index * 60_000).toISOString(),
        actionLabel: 'Review Request',
        actionHref: '/superadmin?requests=new',
        tags: ['onboarding', 'new-request'],
      }));

    const all = [...requestAlerts, ...alerts];
    return all.filter((alert) => {
      const normalizedId = alert.id.replace('request-', '').replace('req-', '').replace('alert-', '');
      const hasReqDismiss = dismissedRequestIds.includes(`req-${normalizedId}`) || dismissedRequestIds.includes(`request-${normalizedId}`);
      const hasAlertDismiss = dismissedRequestIds.includes(`alert-${normalizedId}`) || dismissedRequestIds.includes(alert.id);
      return !hasReqDismiss && !hasAlertDismiss;
    });
  }, [alerts, requests, baseTime, dismissedRequestIds]);

  const stats = useMemo(() => ({
    total: linkedAlerts.length,
    new: linkedAlerts.filter(a => a.status === 'new').length,
    critical: linkedAlerts.filter(a => a.type === 'critical').length,
    warning: linkedAlerts.filter(a => a.type === 'warning').length,
    info: linkedAlerts.filter(a => a.type === 'info').length,
    resolved: linkedAlerts.filter(a => a.status === 'resolved').length,
  }), [linkedAlerts]);

  const filteredAlerts = useMemo(() => {
    let result = [...linkedAlerts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.entity?.toLowerCase().includes(q) ||
        a.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    if (activeFilter !== 'all') {
      if (activeFilter === 'new') result = result.filter(a => a.status === 'new');
      else if (activeFilter === 'critical' || activeFilter === 'warning' || activeFilter === 'info')
        result = result.filter(a => a.type === activeFilter);
      else if (activeFilter === 'acknowledged' || activeFilter === 'resolved')
        result = result.filter(a => a.status === activeFilter);
    }

    result.sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (sortOrder === 'oldest') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      const severity = { critical: 3, warning: 2, info: 1 };
      return (severity[b.type] ?? 0) - (severity[a.type] ?? 0);
    });

    return result;
  }, [linkedAlerts, activeFilter, sortOrder, searchQuery]);

  const handleDismissAlert = useCallback(async (id: string) => {
    if (id.startsWith('request-') || id.startsWith('req-')) {
      setDismissedRequestIds(prev => {
        const next = [...prev, id];
        return next;
      });
      try {
        const saved = localStorage.getItem("superadmin_dismissed_notifications");
        const dismissed = saved ? JSON.parse(saved) : [];
        if (!dismissed.includes(id)) {
          dismissed.push(id);
          localStorage.setItem("superadmin_dismissed_notifications", JSON.stringify(dismissed));
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      await dismissAlert(id);
    }
  }, [dismissAlert]);

  const dismissAll = useCallback(async () => {
    const toDismiss = filteredAlerts.filter(a => !a.id.startsWith('request-'));
    for (const a of toDismiss) {
      await dismissAlert(a.id);
    }
    const requestIds = filteredAlerts.filter(a => a.id.startsWith('request-')).map(a => a.id);
    if (requestIds.length > 0) {
      setDismissedRequestIds(prev => {
        const next = [...prev, ...requestIds];
        return next;
      });
      try {
        const saved = localStorage.getItem("superadmin_dismissed_notifications");
        const dismissed = saved ? JSON.parse(saved) : [];
        const nextDismissed = [...new Set([...dismissed, ...requestIds])];
        localStorage.setItem("superadmin_dismissed_notifications", JSON.stringify(nextDismissed));
      } catch (e) {
        console.error(e);
      }
    }
  }, [filteredAlerts, dismissAlert]);

  const markAllRead = useCallback(async () => {
    const toRead = filteredAlerts.filter(a => a.status === 'new' && !a.id.startsWith('request-'));
    for (const a of toRead) {
      await acknowledgeAlert(a.id);
    }
  }, [filteredAlerts, acknowledgeAlert]);

  return {
    alerts: linkedAlerts,
    filteredAlerts,
    stats,
    activeFilter,
    setActiveFilter,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    dismissAlert: handleDismissAlert,
    acknowledgeAlert,
    resolveAlert,
    markAllRead,
    dismissAll,
    loading,
  };
}
