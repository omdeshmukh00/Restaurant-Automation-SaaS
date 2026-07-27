import { create } from 'zustand';
import { superAdminRestaurantRequestsApi } from '../api/superAdmin.api';
import type { PlatformOrder } from './Analytics';

interface AnalyticsState {
  platformOrders: PlatformOrder[];
  commissionRate: number;
  loading: boolean;
  lastFetchedAt: number | null;
  fetchOrders: (force?: boolean) => Promise<void>;
}

let inFlightAnalyticsPromise: Promise<void> | null = null;

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  platformOrders: [],
  commissionRate: 10,
  loading: false,
  lastFetchedAt: null,

  fetchOrders: async (force = false) => {
    const now = Date.now();
    const lastFetched = get().lastFetchedAt;
    if (!force && get().platformOrders.length > 0 && lastFetched && now - lastFetched < 60000) {
      return;
    }
    if (inFlightAnalyticsPromise) {
      return inFlightAnalyticsPromise;
    }

    if (get().platformOrders.length === 0) {
      set({ loading: true });
    }

    inFlightAnalyticsPromise = (async () => {
      try {
        const data = await superAdminRestaurantRequestsApi.getAnalyticsOrders();
        set({
          platformOrders: data.orders || [],
          commissionRate: data.commissionRate || 10,
          lastFetchedAt: Date.now(),
        });
      } catch (err) {
        console.error('Failed to fetch analytics orders:', err);
      } finally {
        set({ loading: false });
        inFlightAnalyticsPromise = null;
      }
    })();

    return inFlightAnalyticsPromise;
  },
}));
