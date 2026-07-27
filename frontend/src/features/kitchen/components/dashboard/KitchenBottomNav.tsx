import React from 'react';
import { NavLink } from 'react-router-dom';
import { useKitchenStore } from '../../store/kitchen.store';

const NAV = [
  { to: '/kitchen/overview', icon: 'grid_view', label: 'Overview', end: true },
  { to: '/kitchen/orders', icon: 'shopping_bag', label: 'Orders', showBadge: true },
  { to: '/kitchen/batch-cooking', icon: 'inventory_2', label: 'Batch Cooking' },
  { to: '/kitchen/stations', icon: 'soup_kitchen', label: 'Stations' },
  { to: '/kitchen/settings', icon: 'settings', label: 'Settings' },
];

export default function KitchenBottomNav() {
  const orderIds = useKitchenStore(state => state.orderIds);
  const ordersById = useKitchenStore(state => state.ordersById);
  const activeOrdersCount = orderIds.filter(id => {
    const status = ordersById[id]?.status as string;
    return status === 'PLACED' || status === 'PREPARING' || status === 'DELAYED' || status === 'new' || status === 'preparing' || status === 'delayed';
  }).length || orderIds.length;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 w-full flex justify-around items-center h-16 px-1 pb-[env(safe-area-inset-bottom)] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-xl z-40">
      {NAV.map(({ to, icon, label, end, showBadge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1 transition-all ${
              isActive
                ? 'text-orange-600 dark:text-orange-400 font-bold'
                : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative flex items-center justify-center w-12 h-7 rounded-full transition-colors">
                {isActive && (
                  <div className="absolute inset-0 bg-orange-50 dark:bg-orange-950/60 rounded-full" />
                )}
                <span
                  className="material-symbols-outlined text-[22px] relative z-10"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {icon}
                </span>
                {showBadge && activeOrdersCount > 0 && (
                  <span className="absolute -top-1 right-0 z-20 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                    {activeOrdersCount > 99 ? '99+' : activeOrdersCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold font-sans tracking-tight whitespace-nowrap">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
