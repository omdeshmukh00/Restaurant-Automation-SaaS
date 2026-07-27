import React, { useState, useEffect } from 'react';
import { SETTINGS_SECTIONS, type SettingsSection } from '../constants';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { getKitchenSettings, updateKitchenSettings } from '../api/kitchen.api';

export default function KitchenSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<string>('general');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState<boolean>(false);

  // General Settings State
  const [generalSettings, setGeneralSettings] = useState({
    kitchenName: 'Flavoroast Main Kitchen',
    timezone: 'IST (UTC+5:30)',
    language: 'en',
  });

  // Notifications Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    audioAlerts: true,
    visualBanners: true,
    desktopPopups: false,
    toastAlerts: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getKitchenSettings();
        if (settings.general) setGeneralSettings(settings.general);
        if (settings.notifications) setNotificationSettings(settings.notifications);
      } catch (err) {
        console.error('Failed to load kitchen settings', err);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateKitchenSettings({
        general: generalSettings,
        notifications: notificationSettings,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto font-sans">
      {/* Header */}
      <div className={`mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${mobileDetailOpen ? 'hidden md:flex' : 'flex'}`}>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-sd-on-surface">Dashboard Settings</h2>
          <p className="text-sm text-slate-500 dark:text-sd-on-surface-variant font-medium">Configure KDS screen displays, notification rules, and chef allocations</p>
        </div>
        {saveSuccess && (
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/40 text-green-700 dark:text-green-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-bounce">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Settings saved successfully!
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Sidebar */}
        <div className={`md:col-span-1 space-y-1.5 ${mobileDetailOpen ? 'hidden md:block' : 'block'}`}>
          {SETTINGS_SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                setSaveSuccess(false);
                setMobileDetailOpen(true);
              }}
              className={`w-full p-4 rounded-2xl border text-left flex items-start gap-4 transition-all ${
                activeSection === section.id
                  ? 'bg-orange-50/70 border-orange-200 text-orange-600 shadow-sm dark:bg-orange-500/10 dark:border-orange-500/40 dark:text-orange-400'
                  : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200 dark:bg-sd-surface-container dark:border-sd-outline-variant/40 dark:text-sd-on-surface-variant dark:hover:bg-sd-surface-container-high dark:hover:border-sd-outline-variant'
              }`}
            >
              <span className="text-xl mt-0.5">{section.icon}</span>
              <div>
                <h4 className={`font-bold text-sm leading-snug ${activeSection === section.id ? 'text-orange-600 dark:text-orange-400' : 'text-slate-800 dark:text-sd-on-surface'}`}>
                  {section.title}
                </h4>
                <p className="text-xs text-slate-400 dark:text-sd-on-surface-variant/80 font-medium mt-0.5 leading-snug">{section.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Content Box Form */}
        <div className={`md:col-span-2 bg-white dark:bg-sd-surface-container border border-slate-100 dark:border-sd-outline-variant/40 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between ${mobileDetailOpen ? 'flex' : 'hidden md:flex'}`}>
          <form onSubmit={handleSave} className="p-6 space-y-6">
            {/* Mobile Back Button */}
            {mobileDetailOpen && (
              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                className="md:hidden flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold text-sm mb-4 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back to Settings
              </button>
            )}

            {/* Mobile Success Alert */}
            {saveSuccess && (
              <div className="md:hidden bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/40 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 mb-4">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Settings saved successfully!
              </div>
            )}
            {/* General */}
            {activeSection === 'general' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-slate-800 dark:text-sd-on-surface border-b border-slate-50 dark:border-sd-outline-variant/40 pb-2">General Kitchen Profile</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-slate-600 dark:text-sd-on-surface-variant">
                  <div className="space-y-1.5">
                    <label htmlFor="kitchen-name-input" className="block text-slate-500 dark:text-sd-on-surface-variant">Kitchen Name</label>
                    <input
                      id="kitchen-name-input"
                      type="text"
                      value={generalSettings.kitchenName}
                      onChange={e => setGeneralSettings({ ...generalSettings, kitchenName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-sd-surface-container-low border border-slate-200 dark:border-sd-outline-variant/40 rounded-xl font-bold text-slate-700 dark:text-sd-on-surface focus:outline-orange-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="timezone-input" className="block text-slate-500 dark:text-sd-on-surface-variant">Time Zone</label>
                    <input
                      id="timezone-input"
                      type="text"
                      value={generalSettings.timezone}
                      onChange={e => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-sd-surface-container-low border border-slate-200 dark:border-sd-outline-variant/40 rounded-xl font-bold text-slate-700 dark:text-sd-on-surface focus:outline-orange-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="language-select" className="block text-slate-500 dark:text-sd-on-surface-variant">System Language</label>
                    <select
                      id="language-select"
                      value={generalSettings.language}
                      onChange={e => setGeneralSettings({ ...generalSettings, language: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-sd-surface-container-low border border-slate-200 dark:border-sd-outline-variant/40 rounded-xl font-bold text-slate-700 dark:text-sd-on-surface focus:outline-orange-500"
                    >
                      <option value="en">English (US)</option>
                      <option value="es">Español</option>
                      <option value="hi">हिन्दी</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-slate-500 dark:text-sd-on-surface-variant">Appearance Theme</span>
                    <div className="flex gap-3">
                      {(['light', 'dark', 'system'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setTheme(mode)}
                          className={`flex-1 py-2 border rounded-xl text-center capitalize transition-all font-bold ${
                            theme === mode
                              ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/40'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-sd-surface-container-low dark:text-sd-on-surface-variant dark:border-sd-outline-variant/40 dark:hover:bg-sd-surface-container'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-slate-800 dark:text-sd-on-surface border-b border-slate-50 dark:border-sd-outline-variant/40 pb-2">Sound & Alert Preferences</h3>
                <div className="space-y-3 font-semibold text-sm text-slate-700 dark:text-sd-on-surface">
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-sd-surface-container-low rounded-xl border border-slate-100 dark:border-sd-outline-variant/40">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-sd-on-surface text-xs">Audio Alerts</p>
                      <p className="text-[10px] text-slate-400 dark:text-sd-on-surface-variant font-medium">Chime when new orders arrive</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.audioAlerts}
                        onChange={e => setNotificationSettings({ ...notificationSettings, audioAlerts: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 border border-slate-300 dark:border-slate-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500 peer-checked:border-orange-500"></div>
                      <span className="sr-only">Toggle Audio Alerts</span>
                    </label>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-sd-surface-container-low rounded-xl border border-slate-100 dark:border-sd-outline-variant/40">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-sd-on-surface text-xs">Visual Banner Popups</p>
                      <p className="text-[10px] text-slate-400 dark:text-sd-on-surface-variant font-medium">Show popup alert cards for VIP orders</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.visualBanners}
                        onChange={e => setNotificationSettings({ ...notificationSettings, visualBanners: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 border border-slate-300 dark:border-slate-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500 peer-checked:border-orange-500"></div>
                      <span className="sr-only">Toggle Visual Banner Popups</span>
                    </label>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-sd-surface-container-low rounded-xl border border-slate-100 dark:border-sd-outline-variant/40">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-sd-on-surface text-xs">Toast Dismissal Alert</p>
                      <p className="text-[10px] text-slate-400 dark:text-sd-on-surface-variant font-medium">Auto dismiss alerts after 10 seconds</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.toastAlerts}
                        onChange={e => setNotificationSettings({ ...notificationSettings, toastAlerts: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 border border-slate-300 dark:border-slate-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500 peer-checked:border-orange-500"></div>
                      <span className="sr-only">Toggle Toast Dismissal Alert</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Action Footer */}
          <div className="bg-slate-50 dark:bg-sd-surface-container-low border-t border-slate-100 dark:border-sd-outline-variant/40 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setSaveSuccess(false)}
              className="px-4 py-2 border border-slate-200 dark:border-sd-outline-variant/40 hover:bg-slate-100 dark:hover:bg-sd-surface-variant text-slate-600 dark:text-sd-on-surface-variant rounded-xl text-xs font-bold transition-all"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
