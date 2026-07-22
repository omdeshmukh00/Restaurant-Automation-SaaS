import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Sun, Moon, LogOut, User, Settings, X, Menu, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useAdminSearch } from '../context/Adminsearchcontext';
import { NotificationBell } from './NotificationBell';

import { useOrdersStore }    from '../store/orders.store';
import { useCustomersStore } from '../store/customers.store';
import { useInventoryStore } from '../store/inventory.store';
import { useMenuStore }      from '../store/menu.store';
import { useStaffStore }     from '../store/staff.store';
import { useTablesStore }    from '../store/tables.store';

function useSyncSearchToStore(query: string, pathname: string) {
  const setOrders      = useOrdersStore((s) => s.setSearchQuery);
  const setCustomers   = useCustomersStore((s) => s.setSearchQuery);
  const setInventory   = useInventoryStore((s) => s.setSearchQuery);
  const setMenu        = useMenuStore((s) => s.setSearchQuery);
  const setStaff       = useStaffStore((s) => s.setSearchQuery);
  const setTableFilter = useTablesStore((s) => s.setFilter);

  useEffect(() => {
    if (pathname.includes('/admin/orders'))    { setOrders(query);                  return; }
    if (pathname.includes('/admin/customers')) { setCustomers(query);               return; }
    if (pathname.includes('/admin/inventory')) { setInventory(query);               return; }
    if (pathname.includes('/admin/menu'))      { setMenu(query);                    return; }
    if (pathname.includes('/admin/staff'))     { setStaff(query);                   return; }
    if (pathname.includes('/admin/tables'))    { setTableFilter({ search: query }); return; }
  }, [query, pathname, setOrders, setCustomers, setInventory, setMenu, setStaff, setTableFilter]);
}

interface AdminTopbarProps {
  onMenuToggle?: () => void;
}

export function AdminTopbar({ onMenuToggle }: AdminTopbarProps): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut }      = useAuth();
  const navigate               = useNavigate();
  const { pathname }           = useLocation();
  const { searchQuery, setSearchQuery } = useAdminSearch();

  const [userMenuOpen, setUserMenuOpen]         = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchPathname, setSearchPathname]     = useState(pathname);

  const resolvedMobileSearchOpen = mobileSearchOpen && searchPathname === pathname;

  const userMenuRef    = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const pathnameRef    = useRef(pathname);

  useEffect(() => {
    if (resolvedMobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [resolvedMobileSearchOpen]);

  useSyncSearchToStore(searchQuery, pathname);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    setSearchQuery('');
  }, [pathname, setSearchQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSignOut() { signOut(); navigate('/'); }

  function getPlaceholder(): string {
    if (pathname.includes('/admin/orders'))       return 'Search orders, customers, tables…';
    if (pathname.includes('/admin/customers'))    return 'Search by name, email or phone…';
    if (pathname.includes('/admin/inventory'))    return 'Search ingredients, beverages…';
    if (pathname.includes('/admin/menu'))         return 'Search menu items…';
    if (pathname.includes('/admin/staff'))        return 'Search staff by name or role…';
    if (pathname.includes('/admin/reservations')) return 'Search reservations…';
    if (pathname.includes('/admin/tables'))       return 'Search tables…';
    return 'Search orders, customers, tables…';
  }

  const displayName = user?.name ?? 'Admin';
  const avatarSeed  = displayName.replace(/\s+/g, '');

  const searchInput = (inputRef?: React.RefObject<HTMLInputElement>) => (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={getPlaceholder()}
        className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 dark:focus:border-orange-600 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 text-gray-800 dark:text-gray-100"
      />
      {searchQuery && (
        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-3 sm:px-6 sticky top-0 z-20 transition-colors duration-200">

      {/* ── Hamburger ── */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex-shrink-0 w-9 h-9 mr-2 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Mobile expanded search ── */}
      {resolvedMobileSearchOpen && (
        <div className="flex flex-1 items-center gap-2">
          {searchInput(mobileInputRef)}
          <button
            onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Desktop search ── */}
      {!resolvedMobileSearchOpen && (
        <div className="hidden sm:flex flex-1 max-w-md">
          {searchInput()}
        </div>
      )}

      {/* ── Right-side icons ── */}
      {!resolvedMobileSearchOpen && (
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-shrink-0">

          {/* Mobile search trigger */}
          <button
            onClick={() => { setMobileSearchOpen(true); setSearchPathname(pathname); }}
            className="sm:hidden w-9 h-9 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Search"
          >
            <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark'
              ? <Sun  className="w-4 h-4 text-amber-400" />
              : <Moon className="w-4 h-4 text-gray-500" />
            }
          </button>

          {/* Notification bell — uses fully isolated NotificationBell component */}
          <NotificationBell />

          {/* User dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => { setUserMenuOpen(!userMenuOpen); }}
              className="flex items-center gap-2 sm:gap-2.5 pl-1 pr-2 sm:pr-3 py-1 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`}
                alt={displayName}
                className="w-8 h-8 rounded-full bg-orange-100 object-cover flex-shrink-0"
              />
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">{displayName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Admin</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform hidden sm:block ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-11 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                <button
                  onClick={() => { navigate('/admin/settings'); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <User className="w-4 h-4 text-gray-400" /> My Profile
                </button>
                <button
                  onClick={() => { navigate('/admin/settings'); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-400" /> Settings
                </button>
                <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>

        </div>
      )}
    </header>
  );
}
