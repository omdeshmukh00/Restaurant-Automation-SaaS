import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../services/apiClient";

export interface PlatformSettingsData {
  maintenanceMode: boolean;
  disableCustomerPanel: boolean;
  disableKitchenPanel: boolean;
  disableStaffPanel: boolean;
  disableCleaningPanel: boolean;
  disableAdminPanel: boolean;
  enablePartnerRegistration: boolean;
  platformName?: string;
  supportEmail?: string;
}

// Global shared state & subscriber store to eliminate duplicate network requests across components
let globalSettings: PlatformSettingsData | null = null;
let globalLoading = true;
let isFetching = false;
let lastFetchTime = 0;
const listeners = new Set<(settings: PlatformSettingsData | null) => void>();
let pollTimer: any = null;

async function fetchGlobalSettings() {
  const now = Date.now();
  // Throttle: don't re-fetch if a fetch is in-flight or occurred < 3 seconds ago
  if (isFetching || (now - lastFetchTime < 3000 && globalSettings !== null)) {
    return;
  }

  isFetching = true;
  try {
    const res = await apiClient.get("/public/platform-settings");
    const data = res.data?.data || res.data;
    if (data) {
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
        platformName: data.platformName,
        supportEmail: data.supportEmail,
      };
      lastFetchTime = Date.now();
      globalLoading = false;

      // Broadcast to all active component subscribers
      listeners.forEach((listener) => listener(globalSettings));
    }
  } catch (err) {
    console.error("Failed to fetch public platform settings guard:", err);
  } finally {
    isFetching = false;
  }
}

function startGlobalPolling() {
  if (!pollTimer) {
    fetchGlobalSettings();
    // 10-second interval for lightweight background polling
    pollTimer = setInterval(fetchGlobalSettings, 10000);
  }
}

function stopGlobalPollingIfNoListeners() {
  if (listeners.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
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
    startGlobalPolling();

    if (globalSettings) {
      setSettings(globalSettings);
      setLoading(false);
    }

    return () => {
      listeners.delete(listener);
      stopGlobalPollingIfNoListeners();
    };
  }, []);

  const refetch = useCallback(() => {
    lastFetchTime = 0; // force immediate fetch
    fetchGlobalSettings();
  }, []);

  return { settings, loading, refetch };
}
