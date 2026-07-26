import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';

const MOBILE_NAV_ITEMS = [
  { to: '/cleaning', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/cleaning/requests', icon: 'notification_important', label: 'Requests' },
  { to: '/cleaning/tasks', icon: 'assignment', label: 'Tasks' },
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

export default function CleaningBottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-sd-surface-container border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-40 px-2 pb-safe shadow-lg">
      {MOBILE_NAV_ITEMS.map(({ to, icon, label, end }) => {
        const translatedLabel = t(getTranslationKey(label));
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 font-sans text-[10px] font-bold ${
                isActive
                  ? 'text-cleanserve-primary dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined text-[22px] mb-0.5"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {icon}
                </span>
                <span>{translatedLabel}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
