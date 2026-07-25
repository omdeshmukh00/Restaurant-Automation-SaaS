import { create } from 'zustand';
import { apiClient } from '../../../shared/services/apiClient';
import { LogItem, LogType } from './AuditLogs';

function formatCleanIp(ip?: string): string {
  if (!ip) return '127.0.0.1 (Localhost)';
  let clean = ip;
  if (clean.startsWith('::ffff:')) {
    clean = clean.replace('::ffff:', '');
  }
  if (clean === '::1' || clean === '127.0.0.1') {
    return '127.0.0.1 (Localhost)';
  }
  return clean;
}

function mapEntityTypeToLogType(entityType?: string, action?: string): LogType {
  const et = (entityType || '').toUpperCase();
  const act = (action || '').toLowerCase();

  if (et === 'ADMIN' || act.includes('commission') || act.includes('role') || act.includes('deleted')) {
    return 'Admin';
  }
  if (et === 'RESTAURANT' || act.includes('restaurant') || act.includes('onboarding') || act.includes('menu')) {
    return 'Restaurant';
  }
  if (et === 'SUBSCRIPTION' || act.includes('subscription') || act.includes('plan')) {
    return 'Subscription';
  }
  if (et === 'TRANSACTION' || act.includes('payment') || act.includes('fee') || act.includes('settled')) {
    return 'Transaction';
  }
  if (et === 'SYSTEM' || act.includes('maintenance') || act.includes('backup')) {
    return 'System';
  }
  return 'System';
}

function formatActorRole(role?: string): string {
  if (!role || role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'RESTAURANT_ADMIN') return 'Admin User';
  if (role === 'CUSTOMER') return 'Customer';
  if (role === 'system') return 'System Auto';
  return role;
}

interface AuditLogsState {
  logs: LogItem[];
  loading: boolean;
  lastFetchedAt: number | null;
  fetchLogs: (force?: boolean) => Promise<void>;
}

let inFlightLogsPromise: Promise<void> | null = null;

export const useAuditLogsStore = create<AuditLogsState>((set, get) => ({
  logs: [],
  loading: false,
  lastFetchedAt: null,

  fetchLogs: async (force = false) => {
    const now = Date.now();
    const lastFetched = get().lastFetchedAt;
    if (!force && get().logs.length > 0 && lastFetched && now - lastFetched < 60000) {
      return;
    }
    if (inFlightLogsPromise) {
      return inFlightLogsPromise;
    }

    if (get().logs.length === 0) {
      set({ loading: true });
    }

    inFlightLogsPromise = (async () => {
      try {
        const res = await apiClient.get('/super-admin/audit-logs');
        const rawLogs = res.data?.data?.auditLogs || res.data?.data?.logs || res.data?.auditLogs || [];

        if (Array.isArray(rawLogs)) {
          const formatted: LogItem[] = rawLogs.map((item: any) => {
            const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent';
            const type = mapEntityTypeToLogType(item.entityType, item.action);

            const restName = item.restaurantId?.name || item.metadata?.restaurantName || item.metadata?.target || 'Platform Wide';
            const custName = item.metadata?.customerName || item.metadata?.userName || item.actorId?.name || (item.actorRole === 'CUSTOMER' ? 'Customer' : undefined);
            const custPhone = item.metadata?.customerPhone || item.metadata?.userPhone || item.metadata?.userMobile || item.metadata?.mobile || item.metadata?.phone || item.actorId?.mobile || item.actorId?.phone || undefined;
            const custEmail = item.metadata?.customerEmail || item.metadata?.email || item.metadata?.userEmail || item.actorId?.email || undefined;
            const target = restName;
            const details = item.metadata?.details || item.metadata?.reason || `${item.action} recorded`;

            return {
              id: item._id || String(Math.random()),
              type,
              action: item.action || 'System Action',
              performedBy: formatActorRole(item.actorRole),
              target,
              details,
              ipAddress: formatCleanIp(item.ipAddress),
              timestamp: dateStr,
              restaurantName: restName,
              restaurantId: item.restaurantId?._id?.toString() || item.restaurantId?.toString(),
              customerName: custName,
              customerPhone: custPhone,
              customerEmail: custEmail,
              entityType: item.entityType,
              entityId: item.entityId,
              metadata: item.metadata || {},
              rawLog: item,
            };
          });
          set({ logs: formatted, lastFetchedAt: Date.now() });
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        set({ loading: false });
        inFlightLogsPromise = null;
      }
    })();

    return inFlightLogsPromise;
  },
}));
