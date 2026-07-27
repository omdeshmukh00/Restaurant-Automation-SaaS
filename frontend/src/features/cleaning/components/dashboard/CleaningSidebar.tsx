import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCleaning } from '../../hooks/usecleaning';
import { getCleaningRolePermissions } from '../../utils/cleaningRoleAccess';
import { usePlatformSettingsGuard } from '../../../../shared/hooks/usePlatformSettingsGuard';
import { useTranslation } from '../../hooks/useTranslation';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/cleaning', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/cleaning/requests', icon: 'notification_important', label: 'Requests' },
  { to: '/cleaning/tasks', icon: 'assignment', label: 'Tasks' },
  { to: '/cleaning/monitor', icon: 'supervised_user_circle', label: 'Monitor Staff' },
  { to: '/cleaning/profile', icon: 'person', label: 'Profile' },
];

const getTranslationKey = (label: string): any => {
  switch (label) {
    case 'Dashboard': return 'dashboard';
    case 'Tables': return 'tables';
    case 'Requests': return 'requests';
    case 'Tasks': return 'tasks';
    case 'Monitor Staff': return 'staff';
    case 'Profile': return 'profile';
    case 'Settings': return 'settings';
    default: return 'dashboard';
  }
};

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}

export default function CleaningSidebar({ collapsed, onToggle, onItemClick }: Props) {
  const { settings } = usePlatformSettingsGuard();
  const platformName = settings?.platformName || "CleanServe";
  const { profile } = useCleaning();
  const { t } = useTranslation();
  const allowedPaths = getCleaningRolePermissions(profile.role);
  const filteredNavItems = NAV_ITEMS.filter(({ to }) => allowedPaths.includes(to));

  return (
    <aside
      className={`flex flex-col h-screen fixed left-0 top-0 bg-white dark:bg-sd-surface-container border-r border-slate-200 dark:border-slate-800 z-50 transition-all duration-300 ${
        collapsed ? '-translate-x-full lg:translate-x-0 w-64 lg:w-[72px]' : 'translate-x-0 w-64 shadow-xl lg:shadow-none'
      }`}
    >
      {/* Header */}
      <div className={`flex ${collapsed ? 'flex-col items-center gap-3 px-2' : 'items-center justify-between px-5'} py-5 border-b border-slate-100 dark:border-slate-800 shrink-0`}>
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl shrink-0 text-white shadow-sm shadow-orange-500/20">
            <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>cleaning_services</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-base text-orange-500 dark:text-white leading-tight font-sans">{platformName}</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase font-sans">Staff Panel</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <span className="material-symbols-outlined text-[20px]">{collapsed ? 'menu_open' : 'menu'}</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-grow space-y-1 px-3 py-4 overflow-y-auto sd-no-scrollbar">
        {filteredNavItems.map(({ to, icon, label, badge, end }) => {
          const translatedLabel = t(getTranslationKey(label));
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onItemClick}
              className={({ isActive }) =>
                `flex items-center transition-all duration-200 font-sans text-sm font-semibold group ${
                  isActive
                    ? 'bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-white'
                    : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                } ${
                  collapsed
                    ? 'w-10 h-10 justify-center p-0 rounded-full mx-auto'
                    : 'justify-between px-4 py-2.5 rounded-xl'
                }`
              }
              title={collapsed ? translatedLabel : undefined}
            >
              {({ isActive }) => (
                <>
                  <div className={collapsed ? 'flex items-center justify-center' : 'flex items-center gap-3'}>
                    <span
                      className={`material-symbols-outlined text-[20px] ${isActive ? 'text-orange-500 dark:text-white' : ''}`}
                      style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {icon}
                    </span>
                    <span className={isActive ? 'text-orange-500 dark:text-white' : ''}>{!collapsed && translatedLabel}</span>
                  </div>
                  {!collapsed && badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold transition-all ${
                      isActive
                        ? 'bg-orange-500 text-white'
                        : 'bg-error text-on-error'
                    }`}>{badge}</span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

    </aside>
  );
}