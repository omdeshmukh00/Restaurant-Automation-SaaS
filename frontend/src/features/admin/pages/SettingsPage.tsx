import React from 'react';
import { useSettingsStore } from '../store/settings.store';
import {
  SettingsSidebar,
  ProfileCard,
  RestaurantInfoCard,
  BillingCard,
  TeamCard,
  NotificationsCard,
  ThemeSelectorCard,
} from '../components/settings/Index';

function SettingsContent(): JSX.Element {
  const { activeSection } = useSettingsStore();

  switch (activeSection) {
    case 'profile':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <ProfileCard />
          <RestaurantInfoCard />
          <BillingCard />
          <TeamCard />
          <NotificationsCard />
        </div>
      );
    case 'restaurant':
      return (
        <div className="w-full max-w-2xl">
          <RestaurantInfoCard />
        </div>
      );
    case 'billing':
      return (
        <div className="w-full max-w-2xl">
          <BillingCard />
        </div>
      );
    case 'team':
      return (
        <div className="w-full max-w-2xl">
          <TeamCard />
        </div>
      );
    case 'notifications':
      return (
        <div className="w-full max-w-2xl">
          <NotificationsCard />
        </div>
      );
    case 'system':
      return <ThemeSelectorCard />;
    default:
      return <div />;
  }
}

export default function SettingsPage(): JSX.Element {
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Manage your restaurant settings and preferences
        </p>
      </div>

      {/* Layout */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
        <SettingsSidebar />

        {/* Content */}
        <div className="flex-1 min-w-0 w-full">
          <SettingsContent />
        </div>
      </div>
    </div>
  );
}
