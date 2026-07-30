import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, CalendarDays,
  Users, Package, UserCog, BarChart3, Settings,
  LayoutGrid, X, Sparkles, Tag, LifeBuoy,
} from 'lucide-react';
import { usePlatformSettingsGuard } from '../../../shared/hooks/usePlatformSettingsGuard';
import { useSettingsStore } from '../store/settings.store';

const navItems = [
  { label: 'Dashboard',           icon: LayoutDashboard, to: '/admin' },
  { label: 'Orders',              icon: ShoppingBag,     to: '/admin/orders' },
  { label: 'Menu Management',     icon: UtensilsCrossed, to: '/admin/menu' },
  { label: 'Reservations',        icon: CalendarDays,    to: '/admin/reservations' },
  { label: 'Customers',           icon: Users,           to: '/admin/customers' },
  { label: 'Offers',              icon: Tag,             to: '/admin/offers' },
  { label: 'Inventory',           icon: Package,         to: '/admin/inventory' },
  { label: 'Staff Management',    icon: UserCog,         to: '/admin/staff' },
  { label: 'Reports & Analytics', icon: BarChart3,       to: '/admin/reports' },
  { label: 'Table Management',    icon: LayoutGrid,      to: '/admin/tables' },
  { label: 'Raise Ticket',        icon: LifeBuoy,        to: '/admin/tickets' },
  { label: 'Settings',            icon: Settings,        to: '/admin/settings' },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}

export function AdminSidebar({ collapsed, onToggle, onItemClick }: AdminSidebarProps): JSX.Element {
  const { settings } = usePlatformSettingsGuard();
  const platformName = settings?.platformName || "RestoHub";
  const location = useLocation();
  const navigate = useNavigate();
  const { billing, fetchSettings } = useSettingsStore();

  const pathnameRef = useRef(location.pathname);

  // Fetch settings & billing plan on mount if not loaded
  useEffect(() => {
    if (!billing?.plan) {
      fetchSettings();
    }
  }, [billing?.plan, fetchSettings]);

  // Close mobile drawer on route change
  useEffect(() => {
    if (pathnameRef.current === location.pathname) return;
    pathnameRef.current = location.pathname;
    onItemClick?.();
  }, [location.pathname, onItemClick]);

  // Close mobile drawer on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onItemClick?.();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onItemClick]);

  const rawPlan = billing?.plan?.trim() || '';
  const isFreePlan = !rawPlan || rawPlan.toLowerCase() === 'free';
  const formattedPlan = rawPlan
    ? rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1).toLowerCase()
    : 'Free';

  return (
    <aside
      className={`
        fixed left-0 top-0 z-50 flex flex-col bg-white dark:bg-gray-900
        border-r border-gray-100 dark:border-gray-800
        transition-all duration-300 h-screen
        ${collapsed ? 'w-[72px]' : 'w-64 shadow-xl lg:shadow-none'}
      `}
    >
      {/* Header */}
      <div className={`flex ${collapsed ? 'flex-col items-center gap-3 px-2' : 'items-center justify-between px-4'} py-4 border-b border-gray-100 dark:border-gray-800 shrink-0`}>
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => {
            navigate('/admin');
            onItemClick?.();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/admin')}
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-md">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          {!collapsed && <span className="font-extrabold text-lg text-orange-500 tracking-tight">{platformName}</span>}
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all hidden lg:flex items-center justify-center cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="material-symbols-outlined text-[20px]">{collapsed ? 'menu_open' : 'menu'}</span>
        </button>
      </div>

      {/* Mobile close button (visible only when expanded on mobile) */}
      {!collapsed && (
        <button
          onClick={onToggle}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors lg:hidden"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, to }) => {
          const isActive = to === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-500 dark:text-orange-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Subscription Status Card — visible when sidebar is expanded */}
      {!collapsed && (
        <div className="px-3 pb-4 shrink-0">
          <div
            onClick={() => {
              navigate('/admin/settings');
              setTimeout(() => useSettingsStore.getState().setActiveSection('billing'), 100);
              onItemClick?.();
            }}
            className="p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200/60 dark:border-orange-800/40 shadow-sm cursor-pointer hover:border-orange-300 dark:hover:border-orange-700/60 hover:shadow-md transition-all group"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate('/admin/settings');
                setTimeout(() => useSettingsStore.getState().setActiveSection('billing'), 100);
                onItemClick?.();
              }
            }}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  Current Plan: {formattedPlan}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  {isFreePlan
                    ? 'Unlock unlimited tables, staff, orders & more.'
                    : `Active ${formattedPlan} subscription for your restaurant.`}
                </p>
                {isFreePlan && (
                  <div className="mt-2.5 px-4 py-1.5 rounded-full bg-orange-500 group-hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-sm shadow-orange-500/20 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Upgrade Plan</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
}
