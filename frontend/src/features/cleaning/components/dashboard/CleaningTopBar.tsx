import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCleaningSearch } from './CleaningSearchContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useCleaning } from '../../hooks/usecleaning';

interface CleaningTopBarProps {
  onToggleSidebar?: () => void;
}

export default function CleaningTopBar({ onToggleSidebar }: CleaningTopBarProps) {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useCleaningSearch();
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { profile } = useCleaning();

  const getInitials = (name?: string) => {
    if (!name) return 'RS';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(profile?.name || 'Ramesh Sharma');

  return (
    <header className="h-[72px] flex items-center justify-between px-4 lg:px-8 bg-[#18181b] dark:bg-[#121214] border-b border-slate-800/80 sticky top-0 z-30 shrink-0 text-slate-100">
      {/* Left side: Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-300 hover:text-white hover:bg-[#27272a] rounded-xl transition-colors cursor-pointer"
          title="Toggle Navigation Menu"
          aria-label="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
      </div>

      {/* Right side: Search, Notifications, Role Badge, Avatar */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        {/* Search Toggle / Input */}
        <div className="relative flex items-center">
          {showSearchInput ? (
            <div className="flex items-center bg-[#27272a] border border-slate-700/80 rounded-full px-3 py-1 text-xs animate-fadeIn">
              <span className="material-symbols-outlined text-slate-400 text-[18px] mr-1.5">search</span>
              <input
                autoFocus
                className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-xs text-slate-100 placeholder-slate-400 w-28 sm:w-48 font-sans"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                onClick={() => {
                  setShowSearchInput(false);
                  setSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-200 ml-1 cursor-pointer"
                aria-label="Close search"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearchInput(true)}
              className="p-2 text-slate-300 hover:text-white hover:bg-[#27272a] rounded-full transition-colors cursor-pointer"
              title="Search"
              aria-label="Search"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
          )}
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative p-2 text-slate-300 hover:text-white hover:bg-[#27272a] rounded-full transition-colors cursor-pointer"
            title="Notifications"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>

            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white text-[9px] flex items-center justify-center rounded-full font-extrabold animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showDropdown && (
            <div className="absolute top-14 right-0 w-72 sm:w-80 bg-[#1f1f23] border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 animate-fadeIn">
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
                      <p className="font-bold">{n.title}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{n.message}</p>
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

        {/* Role Pill Badge */}
        <div className="flex items-center bg-[#1f1f23] hover:bg-[#27272a] transition-colors rounded-full border border-slate-700/60 px-2.5 sm:px-4 py-1 sm:py-1.5 gap-1.5 sm:gap-2 shadow-sm cursor-default select-none shrink-0">
          <span className="material-symbols-outlined text-[#ff5522] text-[16px] sm:text-[19px] leading-none">
            verified_user
          </span>
          <span className="text-[11px] sm:text-[13px] font-bold text-slate-100 font-sans tracking-tight leading-none max-w-[85px] sm:max-w-[130px] truncate">
            {profile?.role || 'Cleaning Staff'}
          </span>
        </div>

        {/* Initials Avatar Circle */}
        <button
          onClick={() => navigate('/cleaning/profile')}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#2e1914] border border-[#4a241b] flex items-center justify-center text-[#ff5522] font-extrabold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
          title={`Profile: ${profile?.name || 'Staff'}`}
          aria-label="View Profile"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
