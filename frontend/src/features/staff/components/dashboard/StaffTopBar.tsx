import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffSearch } from './StaffSearchContext';
import { useStaffProfile } from '../../hooks/useStaffProfile';
import { useNotifications } from '../../hooks/useNotifications';
import { useStaffDashboard } from '../../hooks/useStaffDashboard';
import { usePlatformSettingsGuard } from '../../../../shared/hooks/usePlatformSettingsGuard';

export default function StaffTopBar() {
  const { settings } = usePlatformSettingsGuard();
  const platformName = settings?.platformName || "DineEase";
  const { query, setQuery } = useStaffSearch();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { profile, updateProfile } = useStaffProfile();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [showDropdown, setShowDropdown] = useState(false);
  const { requests, tables } = useStaffDashboard();
  const navigate = useNavigate();

  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
      setDateStr(now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const pendingRequestsCount = requests.filter(r => r.status !== 'Resolved').length;

  if (mobileSearchOpen) {
    return (
      <header className="h-16 flex items-center px-4 bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0 dark:bg-sd-surface-container dark:border-sd-outline-variant/40">
        <div className="flex items-center gap-3 w-full">
          <button onClick={() => { setMobileSearchOpen(false); setQuery(''); }} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-sd-surface-variant rounded-full">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div className="flex-1 flex items-center bg-slate-50 dark:bg-sd-surface-container-low border border-slate-200 dark:border-sd-outline-variant/40 rounded-full px-4 py-2">
            <span className="material-symbols-outlined text-slate-400 mr-2 text-[18px]">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full font-sans text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-650">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0 dark:bg-sd-surface-container dark:border-sd-outline-variant/40">
      {/* Left side: Stats & Time Info */}
      <div className="hidden md:flex gap-8 lg:gap-12 items-center">
        <div>
          <p className="text-[10px] text-slate-400 font-sans mb-0.5">Time</p>
          <p className="text-lg font-bold text-dine-orange font-sans">{timeStr}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-sans mb-0.5">Date</p>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-200 font-sans">{dateStr}</p>
        </div>

        <div className="hidden xl:flex border-l border-slate-200 dark:border-sd-outline-variant/40 pl-8">
          <div>
            <p className="text-[10px] text-slate-405 mb-0.5 font-sans">Active Tables</p>
            <p className="text-lg font-bold text-dine-orange font-sans">
              {tables.filter(t => ['Occupied', 'Food Served', 'Bill Requested'].includes(t.status)).length} Active
            </p>
          </div>
        </div>
      </div>

      {/* Mobile view brand name */}
      <div className="flex md:hidden items-center gap-2">
        <button
          onClick={() => window.dispatchEvent(new Event('toggle-staff-sidebar'))}
          className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-sd-surface-variant rounded-lg mr-1 focus:outline-none flex items-center justify-center"
          title="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
        <div className="bg-dine-light-orange p-1.5 rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-dine-orange text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>restaurant</span>
        </div>
        <span className="font-bold text-sm text-slate-800 dark:text-slate-200 font-sans">{platformName}</span>
      </div>

      {/* Right side: Search button, notifications, and profile avatar */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Search Icon Button */}
        <button
          onClick={() => setMobileSearchOpen(true)}
          className="p-1.5 sm:p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-sd-surface-variant rounded-full transition-colors cursor-pointer"
          title="Search panels..."
        >
          <span className="material-symbols-outlined text-[20px] sm:text-[22px]">search</span>
        </button>

        {/* Notifications Button & Dropdown Window */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative p-1.5 sm:p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-sd-surface-variant rounded-full transition-colors cursor-pointer"
            title="Notifications"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">notifications</span>

            {/* Dynamic Flashing Badge Number */}
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-orange-500 text-white text-[9px] flex items-center justify-center rounded-full font-extrabold animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Window */}
          {showDropdown && (
            <div className="absolute top-14 right-0 w-72 sm:w-80 max-w-[calc(100vw-32px)] bg-[#1f1f23] border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 animate-fadeIn text-slate-100">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-100 font-sans tracking-wide">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {notifications.length > 0 ? (
                  notifications.map((n: any) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-xl border text-xs ${
                        n.read ? 'bg-[#27272a]/50 border-slate-800 text-slate-300' : 'bg-[#2a1e19] border-orange-500/30 text-slate-100'
                      }`}
                    >
                      <p className="font-bold">{n.title || n.message}</p>
                      {n.title && n.message && <p className="text-[11px] text-slate-400 mt-1">{n.message}</p>}
                      {!n.read && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="text-[10px] font-extrabold text-orange-400 mt-2 hover:underline cursor-pointer"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center text-slate-400 py-4">No notifications yet.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Authenticated Role Badge */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 bg-slate-100 dark:bg-sd-surface-container-low border border-slate-200 dark:border-sd-outline-variant/40 rounded-full text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 font-sans shrink-0">
          <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-dine-orange">
            shield_person
          </span>
          <span className="hidden sm:inline truncate max-w-[120px]">{profile.role || 'Floor Supervisor'}</span>
        </div>

        {/* Profile Avatar */}
        <button
          onClick={() => navigate('/staff/settings')}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-dine-orange/15 hover:bg-dine-orange/20 flex items-center justify-center text-dine-orange font-bold text-xs cursor-pointer hover:ring-2 hover:ring-dine-orange transition-all overflow-hidden focus:outline-none shrink-0"
          title="View Profile & Settings"
        >
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
          ) : (
            profile.name.split(' ').map(n => n[0]).join('').toUpperCase()
          )}
        </button>
      </div>
    </header>
  );
}
