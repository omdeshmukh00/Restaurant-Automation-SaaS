import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../services/apiClient";
import { connectSocket, getSocket } from "../../lib/socket";

export interface PlatformSettingsData {
  maintenanceMode: boolean;
  disableCustomerPanel: boolean;
  disableKitchenPanel: boolean;
  disableStaffPanel: boolean;
  disableCleaningPanel: boolean;
  disableAdminPanel: boolean;
  enablePartnerRegistration: boolean;
  applicationFeeEnabled?: boolean;
  applicationFeeAmount?: number;
  currency?: string;
  refundPolicy?: string;
  platformName?: string;
  supportEmail?: string;
}

// Global cached state & subscriber store to eliminate repeated background requests
let globalSettings: PlatformSettingsData | null = null;
let globalLoading = true;
let isFetching = false;
let lastFetchTime = 0;
const listeners = new Set<(settings: PlatformSettingsData | null) => void>();
let socketConnected = false;

function updateGlobalSettings(data: any) {
  if (!data) return;
  globalSettings = {
    maintenanceMode: !!data.maintenanceMode,
    disableCustomerPanel: !!data.disableCustomerPanel,
    disableKitchenPanel: !!data.disableKitchenPanel,
    disableStaffPanel: !!data.disableStaffPanel,
    disableCleaningPanel: !!data.disableCleaningPanel,
    disableAdminPanel: !!data.disableAdminPanel,
    enablePartnerRegistration:
      data.enablePartnerRegistration !== undefined
        ? !!data.enablePartnerRegistration
        : true,
    applicationFeeEnabled: !!data.applicationFeeEnabled,
    applicationFeeAmount: data.applicationFeeAmount !== undefined ? Number(data.applicationFeeAmount) : 0,
    currency: data.currency || 'INR',
    refundPolicy: data.refundPolicy || 'refundable',
    platformName: data.platformName,
    supportEmail: data.supportEmail,
  };
  globalLoading = false;
  listeners.forEach((listener) => listener(globalSettings));
}

async function fetchGlobalSettings(force = false) {
  const now = Date.now();
  if (isFetching || (!force && now - lastFetchTime < 10000 && globalSettings !== null)) {
    return;
  }

  isFetching = true;
  try {
    const res = await apiClient.get("/public/platform-settings");
    const data = res.data?.data || res.data;
    if (data) {
      updateGlobalSettings(data);
      lastFetchTime = Date.now();
    }
  } catch (err) {
    console.error("Failed to fetch public platform settings guard:", err);
  } finally {
    isFetching = false;
  }
}

function setupGlobalSocket() {
  if (socketConnected) return;
  connectSocket();
  const socket = getSocket();
  if (socket) {
    socket.on("platform.settings.updated", updateGlobalSettings);
    socketConnected = true;
  }
}

export function usePlatformSettingsGuard() {
  const [settings, setSettings] = useState<PlatformSettingsData | null>(globalSettings);
  const [loading, setLoading] = useState(globalLoading);

  useEffect(() => {
    const listener = (newSettings: PlatformSettingsData | null) => {
      setSettings(newSettings);
      setLoading(false);
    };

    listeners.add(listener);
    setupGlobalSocket();

    if (globalSettings) {
      setSettings(globalSettings);
      setLoading(false);
    } else {
      fetchGlobalSettings();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refetch = useCallback(() => {
    fetchGlobalSettings(true);
  }, []);

  return { settings, loading, refetch };
}
