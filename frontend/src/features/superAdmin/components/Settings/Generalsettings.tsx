// src/features/superAdmin/components/Settings/GeneralSettings.tsx
import { useState, useEffect, useRef } from "react";
import { Building2, Globe, Check, RefreshCw, Moon, Sun, Minus } from "lucide-react";
import { Card, CardTitle, Field, Input, ToggleRow } from "./Settingsui";
import { apiClient } from "../../../../shared/services/apiClient";

interface GeneralSettingsProps {
  darkMode: boolean;
}

export default function GeneralSettings({ darkMode }: GeneralSettingsProps) {
  const [form, setForm] = useState({
    platformName: "HQ Terminal",
    supportEmail: "support@hqterminal.io",
    maintenanceMode: false,
    disableCustomerPanel: false,
    disableKitchenPanel: false,
    disableStaffPanel: false,
    disableCleaningPanel: false,
    disableAdminPanel: false,
    allowRegistration: true,
  });

  const [colorTheme, setColorTheme] = useState<'dark' | 'light' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('color-theme') || localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light' || saved === 'system') return saved as any;
    }
    return 'dark';
  });

  const handleThemeSelect = (newTheme: 'dark' | 'light' | 'system') => {
    setColorTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('color-theme', newTheme);
      let isDark = false;
      if (newTheme === 'dark') {
        isDark = true;
      } else if (newTheme === 'light') {
        isDark = false;
      } else if (newTheme === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new CustomEvent('sync-app-theme', { detail: { darkMode: isDark } }));
    }
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Track initial fetch so we don't trigger auto-save on initial load
  const isInitialMount = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get("/superadmin/platform-settings")
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data || res.data;
        if (data) {
          setForm({
            platformName: data.platformName || "HQ Terminal",
            supportEmail: data.supportEmail || "support@hqterminal.io",
            maintenanceMode: !!data.maintenanceMode,
            disableCustomerPanel: !!data.disableCustomerPanel,
            disableKitchenPanel: !!data.disableKitchenPanel,
            disableStaffPanel: !!data.disableStaffPanel,
            disableCleaningPanel: !!data.disableCleaningPanel,
            disableAdminPanel: !!data.disableAdminPanel,
            allowRegistration: data.enablePartnerRegistration !== undefined ? !!data.enablePartnerRegistration : true,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load platform settings:", err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
          setTimeout(() => {
            isInitialMount.current = false;
          }, 100);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const saveSettingsToDb = async (updatedForm: typeof form) => {
    setSaving(true);
    try {
      await apiClient.patch("/superadmin/platform-settings", {
        platformName: updatedForm.platformName,
        supportEmail: updatedForm.supportEmail,
        maintenanceMode: updatedForm.maintenanceMode,
        disableCustomerPanel: updatedForm.disableCustomerPanel,
        disableKitchenPanel: updatedForm.disableKitchenPanel,
        disableStaffPanel: updatedForm.disableStaffPanel,
        disableCleaningPanel: updatedForm.disableCleaningPanel,
        disableAdminPanel: updatedForm.disableAdminPanel,
        enablePartnerRegistration: updatedForm.allowRegistration,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to auto-save platform settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => {
      let updated = { ...prev, [key]: value };

      // Master maintenance mode logic: if toggled ON, turn ON all sub panel disable toggles
      if (key === "maintenanceMode" && value === true) {
        updated = {
          ...updated,
          disableCustomerPanel: true,
          disableKitchenPanel: true,
          disableStaffPanel: true,
          disableCleaningPanel: true,
          disableAdminPanel: true,
        };
      } else if (key === "maintenanceMode" && value === false) {
        updated = {
          ...updated,
          disableCustomerPanel: false,
          disableKitchenPanel: false,
          disableStaffPanel: false,
          disableCleaningPanel: false,
          disableAdminPanel: false,
        };
      }

      if (!isInitialMount.current) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveSettingsToDb(updated);
        }, 500);
      }
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
        Loading platform settings...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Auto-save status header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs">
          {saving ? (
            <span className="flex items-center gap-1.5 text-orange-400 font-semibold animate-pulse">
              <RefreshCw size={12} className="animate-spin" /> Saving changes to database...
            </span>
          ) : saved ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Check size={13} /> Saved to Database
            </span>
          ) : (
            <span className={`text-[11px] font-medium ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Changes save automatically
            </span>
          )}
        </div>
      </div>

      {/* Platform Identity */}
      <Card darkMode={darkMode}>
        <CardTitle darkMode={darkMode}>Platform Identity</CardTitle>

        <Field label="Platform Name" icon={Building2} darkMode={darkMode} hint="Shown in the browser tab, emails, and notifications.">
          <Input
            darkMode={darkMode}
            value={form.platformName}
            onChange={(e) => updateField("platformName", e.target.value)}
            placeholder="e.g. HQ Terminal"
          />
        </Field>

        <Field label="Support Email" icon={Globe} darkMode={darkMode} hint="Customers and users receive auto-generated system emails from this address.">
          <Input
            darkMode={darkMode}
            type="email"
            value={form.supportEmail}
            onChange={(e) => updateField("supportEmail", e.target.value)}
            placeholder="support@hqterminal.io"
          />
        </Field>
      </Card>

      {/* Color Theme */}
      <Card darkMode={darkMode}>
        <CardTitle darkMode={darkMode}>COLOR THEME</CardTitle>

        <div className="grid grid-cols-3 gap-3">
          {/* Dark */}
          <button
            type="button"
            onClick={() => handleThemeSelect('dark')}
            className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-xs font-bold transition-all ${
              colorTheme === 'dark'
                ? 'border-orange-500 bg-orange-500/10 text-orange-500 shadow-sm shadow-orange-500/20'
                : darkMode
                ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Moon size={18} className="mb-2" />
            Dark
          </button>

          {/* Light */}
          <button
            type="button"
            onClick={() => handleThemeSelect('light')}
            className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-xs font-bold transition-all ${
              colorTheme === 'light'
                ? 'border-orange-500 bg-orange-500/10 text-orange-500 shadow-sm shadow-orange-500/20'
                : darkMode
                ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Sun size={18} className="mb-2" />
            Light
          </button>

          {/* System */}
          <button
            type="button"
            onClick={() => handleThemeSelect('system')}
            className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-xs font-bold transition-all ${
              colorTheme === 'system'
                ? 'border-orange-500 bg-orange-500/10 text-orange-500 shadow-sm shadow-orange-500/20'
                : darkMode
                ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Minus size={18} className="mb-2" />
            System
          </button>
        </div>
      </Card>

      {/* Platform Controls */}
      <Card darkMode={darkMode}>
        <CardTitle darkMode={darkMode}>Platform Controls</CardTitle>

        <div className="space-y-4">
          <ToggleRow
            darkMode={darkMode}
            label="Maintenance Mode"
            description="Master switch. Temporarily disables access across selected platform panels and sends notice emails. Super admin panel remains accessible."
            checked={form.maintenanceMode}
            onChange={(v) => updateField("maintenanceMode", v)}
          />

          <div className="pl-4 border-l-2 border-slate-700/50 space-y-3 pt-1">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Granular Panel Disables
            </p>

            <ToggleRow
              darkMode={darkMode}
              label="Disable Customer Panel"
              description="Blocks public digital menu, QR ordering, and customer session routes."
              checked={form.disableCustomerPanel}
              onChange={(v) => updateField("disableCustomerPanel", v)}
            />

            <ToggleRow
              darkMode={darkMode}
              label="Disable Kitchen Panels"
              description="Blocks Kitchen Display System (KDS) and kitchen management screens."
              checked={form.disableKitchenPanel}
              onChange={(v) => updateField("disableKitchenPanel", v)}
            />

            <ToggleRow
              darkMode={darkMode}
              label="Disable Staff Panel"
              description="Blocks staff POS, waiter order taking, and table management panels."
              checked={form.disableStaffPanel}
              onChange={(v) => updateField("disableStaffPanel", v)}
            />

            <ToggleRow
              darkMode={darkMode}
              label="Disable Cleaning Panel"
              description="Blocks housekeeping and table cleaning status panels."
              checked={form.disableCleaningPanel}
              onChange={(v) => updateField("disableCleaningPanel", v)}
            />

            <ToggleRow
              darkMode={darkMode}
              label="Disable Admin Panel"
              description="Blocks tenant admin dashboard. Super Admin panel remains fully accessible."
              checked={form.disableAdminPanel}
              onChange={(v) => updateField("disableAdminPanel", v)}
            />
          </div>

          <div className="pt-2 border-t border-slate-800/40">
            <ToggleRow
              darkMode={darkMode}
              label="Allow New Registrations"
              description="Default is ON. When OFF, new partner registrations on /partner and Super Admin '+ Add Restaurant' are blocked."
              checked={form.allowRegistration}
              onChange={(v) => updateField("allowRegistration", v)}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}