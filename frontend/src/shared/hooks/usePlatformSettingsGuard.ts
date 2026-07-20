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
  platformName?: string;
  supportEmail?: string;
}

export function usePlatformSettingsGuard() {
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

    // Ensure socket is connected to receive global broadcasts
    connectSocket();
    const socket = getSocket();

    const handleSettingsUpdate = (data: any) => {
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
    };

    if (socket) {
      socket.on("platform.settings.updated", handleSettingsUpdate);
    }

    // Re-check instantly when window gains focus
    const handleFocus = () => fetchSettings();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      if (socket) {
        socket.off("platform.settings.updated", handleSettingsUpdate);
      }
    };
  }, [fetchSettings]);

  return { settings, loading, refetch: fetchSettings };
}
