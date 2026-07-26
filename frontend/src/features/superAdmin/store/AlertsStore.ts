// src/features/superAdmin/store/AlertsStore.ts
import { create } from "zustand";
import { superAdminRestaurantRequestsApi } from "../api/superAdmin.api";
import { getSocket } from "../../../lib/socket";

export interface Alert {
  id: string;
  _id?: string;
  title: string;
  description: string;
  type: "critical" | "warning" | "info";
  status: "new" | "acknowledged" | "resolved";
  entity?: string;
  entityType: "restaurant" | "payment" | "system" | "user";
  timestamp: string;
  actionLabel?: string;
  actionHref?: string;
  tags?: string[];
  resolvedAt?: string;
}

interface AlertsState {
  alerts: Alert[];
  loading: boolean;
  fetchAlerts: () => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  addAlert: (alert: Alert) => void;
  setupSocketListener: () => void;
}

let inFlightAlertsPromise: Promise<void> | null = null;
let lastAlertsFetchedAt: number | null = null;

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  loading: false,

  fetchAlerts: async () => {
    const now = Date.now();
    if (lastAlertsFetchedAt && now - lastAlertsFetchedAt < 3000) {
      return;
    }
    if (inFlightAlertsPromise) {
      return inFlightAlertsPromise;
    }

    set({ loading: true });
    inFlightAlertsPromise = (async () => {
      try {
        const data = await superAdminRestaurantRequestsApi.getAlerts();
        const mapped = data.map((d: any) => ({
          id: d._id || d.id,
          title: d.title,
          description: d.description,
          type: d.type,
          status: d.status,
          entityType: d.entityType,
          tags: d.tags || [],
          timestamp: d.timestamp || d.createdAt,
          resolvedAt: d.resolvedAt,
          actionLabel: d.entityType === 'restaurant' ? 'View Details' : undefined,
          actionHref: d.entityType === 'restaurant' ? `/superadmin?restaurantId=${d.entityId}` : undefined,
        }));
        set({ alerts: mapped });
        lastAlertsFetchedAt = Date.now();
      } catch (e) {
        console.error("Failed to fetch platform alerts", e);
      } finally {
        set({ loading: false });
        inFlightAlertsPromise = null;
      }
    })();

    return inFlightAlertsPromise;
  },

  acknowledgeAlert: async (id: string) => {
    try {
      await superAdminRestaurantRequestsApi.updateAlertStatus(id, "acknowledged");
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? { ...a, status: "acknowledged" } : a)),
      }));
    } catch (e) {
      console.error("Failed to acknowledge alert", e);
    }
  },

  resolveAlert: async (id: string) => {
    try {
      await superAdminRestaurantRequestsApi.updateAlertStatus(id, "resolved");
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === id ? { ...a, status: "resolved", resolvedAt: new Date().toISOString() } : a
        ),
      }));
    } catch (e) {
      console.error("Failed to resolve alert", e);
    }
  },

  dismissAlert: async (id: string) => {
    try {
      await superAdminRestaurantRequestsApi.deleteAlert(id);
      set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id),
      }));
    } catch (e) {
      console.error("Failed to dismiss alert", e);
    }
  },

  addAlert: (alert: Alert) => {
    set((state) => {
      if (state.alerts.some((a) => a.id === alert.id)) return state;
      return { alerts: [alert, ...state.alerts] };
    });
  },

  setupSocketListener: () => {
    // Socket connection is handled by SocketProvider at the app root.
    const socket = getSocket();
    if (socket) {
      socket.off("system_alert_created");
      socket.on("system_alert_created", (newAlert: any) => {
        const mapped: Alert = {
          id: newAlert._id || newAlert.id,
          title: newAlert.title,
          description: newAlert.description,
          type: newAlert.type,
          status: newAlert.status,
          entityType: newAlert.entityType,
          tags: newAlert.tags || [],
          timestamp: newAlert.timestamp || newAlert.createdAt,
          resolvedAt: newAlert.resolvedAt,
          actionLabel: newAlert.entityType === 'restaurant' ? 'View Details' : undefined,
          actionHref: newAlert.entityType === 'restaurant' ? `/superadmin?restaurantId=${newAlert.entityId}` : undefined,
        };
        get().addAlert(mapped);
      });
    }
  },
}));
