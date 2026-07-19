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

export function usePlatformSettingsGuard(pollIntervalMs: number = 3000) {
  const [settings, setSettings] = useState<PlatformSettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiClient.get("/public/platform-settings");
      const data = res.data?.data || res.data;
      if (data) {
        setSettings({
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
        });
      }
    } catch (err) {
      console.error("Failed to fetch public platform settings guard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // 3-second real-time polling to detect Maintenance Mode or Panel Disable changes live
    const interval = setInterval(fetchSettings, pollIntervalMs);

    // Re-check instantly when window gains focus
    const handleFocus = () => fetchSettings();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchSettings, pollIntervalMs]);

  return { settings, loading, refetch: fetchSettings };
}
