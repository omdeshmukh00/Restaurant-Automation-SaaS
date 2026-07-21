// src/features/superAdmin/components/Settings/Notificationsettings.tsx
import { useState, useEffect, useRef } from "react";
import { Mail, Bell, Smartphone, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardTitle, Field, Input, ToggleRow, Divider } from "./Settingsui";
import { apiClient } from "../../../../shared/services/apiClient";

interface NotificationSettingsProps {
  darkMode: boolean;
}

export default function NotificationSettings({ darkMode }: NotificationSettingsProps) {
  const [notificationEmail, setNotificationEmail] = useState("noreplay@mail.com");
  const [emailNotifications, setEmailNotifications] = useState({
    newRestaurant: true,
    subscriptionChange: true,
    paymentFailed: true,
    alertEscalation: true,
    weeklyDigest: false,
  });

  const [pushNotifications, setPushNotifications] = useState({
    enabled: true,
    criticalAlerts: true,
    restaurantUpdates: false,
    systemHealth: true,
  });

  const [inAppPreferences, setInAppPreferences] = useState({
    sound: true,
    badge: true,
    desktopPopup: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);
  const [emailError, setEmailError] = useState("");

  const isInitialMount = useRef(true);
  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch settings from DB on mount
  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const res = await apiClient.get('/superadmin/platform-settings');
        const data = res.data?.data || res.data;
        if (data && isMounted) {
          if (data.notificationEmail || data.supportEmail) {
            setNotificationEmail(data.notificationEmail || data.supportEmail);
          }
          if (data.emailNotifications) {
            setEmailNotifications({
              newRestaurant: data.emailNotifications.newRestaurant ?? true,
              subscriptionChange: data.emailNotifications.subscriptionChange ?? true,
              paymentFailed: data.emailNotifications.paymentFailed ?? true,
              alertEscalation: data.emailNotifications.alertEscalation ?? true,
              weeklyDigest: data.emailNotifications.weeklyDigest ?? false,
            });
          }
          if (data.pushNotifications) {
            setPushNotifications({
              enabled: data.pushNotifications.enabled ?? true,
              criticalAlerts: data.pushNotifications.criticalAlerts ?? true,
              restaurantUpdates: data.pushNotifications.restaurantUpdates ?? false,
              systemHealth: data.pushNotifications.systemHealth ?? true,
            });
          }
          if (data.inAppPreferences) {
            setInAppPreferences({
              sound: data.inAppPreferences.sound ?? true,
              badge: data.inAppPreferences.badge ?? true,
              desktopPopup: data.inAppPreferences.desktopPopup ?? false,
            });
          }
        }
      } catch (err) {
        console.error('Failed to load notification settings', err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setTimeout(() => {
            isInitialMount.current = false;
          }, 100);
        }
      }
    };
    fetchSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-save helper
  const saveToDb = async (payload: any) => {
    setSaving(true);
    setSavedStatus(false);
    try {
      await apiClient.patch('/superadmin/platform-settings', payload);
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2500);
    } catch (err) {
      console.error('Failed to auto-save notification settings', err);
    } finally {
      setSaving(false);
    }
  };

  // Toggle Handlers with auto-save
  const handleEmailToggle = (key: keyof typeof emailNotifications, val: boolean) => {
    const updated = { ...emailNotifications, [key]: val };
    setEmailNotifications(updated);
    if (!isInitialMount.current) {
      saveToDb({ emailNotifications: updated });
    }
  };

  const handlePushToggle = (key: keyof typeof pushNotifications, val: boolean) => {
    const updated = { ...pushNotifications, [key]: val };
    setPushNotifications(updated);
    if (!isInitialMount.current) {
      saveToDb({ pushNotifications: updated });
    }
  };

  const handleInAppToggle = (key: keyof typeof inAppPreferences, val: boolean) => {
    const updated = { ...inAppPreferences, [key]: val };
    setInAppPreferences(updated);
    if (!isInitialMount.current) {
      saveToDb({ inAppPreferences: updated });
    }
  };

  const handleEmailChange = (val: string) => {
    setNotificationEmail(val);
    if (!val.trim()) {
      setEmailError("Notification Email is required");
      return;
    }
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (!isValid) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");

    if (emailTimeoutRef.current) clearTimeout(emailTimeoutRef.current);
    emailTimeoutRef.current = setTimeout(() => {
      if (!isInitialMount.current) {
        saveToDb({ notificationEmail: val });
      }
    }, 600);
  };

  return (
    <div className="space-y-5">
      {/* Auto-save Status Indicator Header */}
      <div className="flex items-center justify-between px-1">
        <p className={`text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
          All changes are saved automatically to the system database.
        </p>
        <div className="flex items-center gap-1.5 text-xs">
          {saving && (
            <span className="flex items-center gap-1 text-amber-500 font-medium animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              Saving to DB...
            </span>
          )}
          {savedStatus && (
            <span className="flex items-center gap-1 text-emerald-500 font-medium animate-fadeIn">
              <CheckCircle2 size={13} />
              Auto-saved
            </span>
          )}
        </div>
      </div>

      {/* Email Notifications */}
      <Card darkMode={darkMode}>
        <CardTitle darkMode={darkMode}>Email Notifications</CardTitle>

        <Field label="Notification Email *" icon={Mail} darkMode={darkMode} hint="All system emails and critical platform alerts will be sent to this address.">
          <Input
            darkMode={darkMode}
            type="email"
            required
            value={notificationEmail}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="admin@example.com"
          />
          {emailError && (
            <p className="mt-1 text-[11px] font-medium text-red-500 flex items-center gap-1">
              {emailError}
            </p>
          )}
        </Field>

        <Divider darkMode={darkMode} />

        <div className="space-y-4">
          <ToggleRow
            darkMode={darkMode}
            label="New Restaurant Onboarded"
            description="Notify when a restaurant successfully completes onboarding."
            checked={emailNotifications.newRestaurant}
            onChange={(v) => handleEmailToggle("newRestaurant", v)}
          />
          <ToggleRow
            darkMode={darkMode}
            label="Subscription Changes"
            description="Plan upgrades, downgrades, and cancellations."
            checked={emailNotifications.subscriptionChange}
            onChange={(v) => handleEmailToggle("subscriptionChange", v)}
          />
          <ToggleRow
            darkMode={darkMode}
            label="Payment Failures"
            description="Alert when a restaurant's payment fails or is disputed."
            checked={emailNotifications.paymentFailed}
            onChange={(v) => handleEmailToggle("paymentFailed", v)}
          />
          <ToggleRow
            darkMode={darkMode}
            label="Alert Escalations"
            description="System-generated critical alerts escalated to admin."
            checked={emailNotifications.alertEscalation}
            onChange={(v) => handleEmailToggle("alertEscalation", v)}
          />
          <ToggleRow
            darkMode={darkMode}
            label="Weekly Digest"
            description="A summary of platform activity every Monday at 9 AM."
            checked={emailNotifications.weeklyDigest}
            onChange={(v) => handleEmailToggle("weeklyDigest", v)}
          />
        </div>
      </Card>

      {/* Push Notifications */}
      <Card darkMode={darkMode}>
        <div className="flex items-center justify-between">
          <CardTitle darkMode={darkMode}>Push Notifications</CardTitle>
          <div className="flex items-center gap-2">
            <Smartphone size={13} className="text-orange-400" />
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Browser / Mobile
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <ToggleRow
            darkMode={darkMode}
            label="Enable Push Notifications"
            description="Master toggle for all browser and mobile push alerts."
            checked={pushNotifications.enabled}
            onChange={(v) => handlePushToggle("enabled", v)}
          />
          <ToggleRow
            darkMode={darkMode}
            label="Critical System Alerts"
            description="Downtime, security breaches, or critical failures."
            checked={pushNotifications.criticalAlerts}
            onChange={(v) => handlePushToggle("criticalAlerts", v)}
            disabled={!pushNotifications.enabled}
          />
          <ToggleRow
            darkMode={darkMode}
            label="Restaurant Status Updates"
            description="When restaurants go live, pause, or get suspended."
            checked={pushNotifications.restaurantUpdates}
            onChange={(v) => handlePushToggle("restaurantUpdates", v)}
            disabled={!pushNotifications.enabled}
          />
          <ToggleRow
            darkMode={darkMode}
            label="System Health Checks"
            description="Periodic platform health status notifications."
            checked={pushNotifications.systemHealth}
            onChange={(v) => handlePushToggle("systemHealth", v)}
            disabled={!pushNotifications.enabled}
          />
        </div>
      </Card>

      {/* In-App Preferences */}
      <Card darkMode={darkMode}>
        <div className="flex items-center justify-between">
          <CardTitle darkMode={darkMode}>In-App Preferences</CardTitle>
          <Bell size={14} className="text-orange-400" />
        </div>

        <div className="space-y-4">
          <ToggleRow
            darkMode={darkMode}
            label="Sound Alerts"
            description="Play a sound when a new notification arrives."
            checked={inAppPreferences.sound}
            onChange={(v) => handleInAppToggle("sound", v)}
          />
          <ToggleRow
            darkMode={darkMode}
            label="Badge Counter"
            description="Show unread count on the notification bell icon."
            checked={inAppPreferences.badge}
            onChange={(v) => handleInAppToggle("badge", v)}
          />
          <ToggleRow
            darkMode={darkMode}
            label="Desktop Pop-ups"
            description="Show a pop-up in the bottom-right corner on new events."
            checked={inAppPreferences.desktopPopup}
            onChange={(v) => handleInAppToggle("desktopPopup", v)}
          />
        </div>
      </Card>
    </div>
  );
}