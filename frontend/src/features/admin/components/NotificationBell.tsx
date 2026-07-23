import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, X, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminNotifications } from '../context/Adminnotificationscontext';
import type { NotificationItem } from '../api/admin.notifications.api';

// ── Module icons map ────────────────────────────────────────────────
const MODULE_ICONS: Record<string, string> = {
  ORDERS: '🛒',
  KITCHEN: '👨‍🍳',
  RESERVATIONS: '📅',
  PAYMENTS: '💳',
  STAFF: '👤',
  INVENTORY: '📦',
  CLEANING: '🧹',
  MENU: '📋',
  RESTAURANT_SETTINGS: '⚙️',
  SUBSCRIPTION: '🌟',
  SETTLEMENT: '💰',
  SYSTEM: '🔔',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  NORMAL: 'bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400',
  HIGH: 'bg-orange-50 dark:bg-orange-950/30 text-orange-500 dark:text-orange-400',
  URGENT: 'bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400',
};

function getModuleIcon(module?: string, type?: string): string {
  if (module && MODULE_ICONS[module]) return MODULE_ICONS[module];
  return MODULE_ICONS.SYSTEM;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export function NotificationBell(): JSX.Element {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    markRead,
    markAllRead,
    deleteNotification,
    fetchMore,
  } = useAdminNotifications();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore || loadingMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      fetchMore();
    }
  }, [hasMore, loadingMore, fetchMore]);

  // Navigate on click
  const handleNotificationClick = useCallback(
    async (n: NotificationItem) => {
      if (!n.read) {
        await markRead(n._id);
      }
      // Navigate if actionUrl exists
      if (n.actionUrl) {
        navigate(n.actionUrl);
        setOpen(false);
      }
    },
    [markRead, navigate]
  );

  // Delete with loading state
  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleting(id);
      await deleteNotification(id);
      setDeleting(null);
    },
    [deleteNotification]
  );

  // Mark all read
  const handleMarkAllRead = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await markAllRead();
    },
    [markAllRead]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative w-9 h-9 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-orange-500 text-white text-[10px] font-bold rounded-full leading-none shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute right-0 top-11 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-500 px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                <span className="text-xs text-gray-400">Loading notifications…</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No notifications</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <>
                {notifications.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group relative ${
                      !n.read ? 'bg-orange-50/40 dark:bg-orange-950/15' : ''
                    }`}
                  >
                    {/* Icon */}
                    <span className="text-lg flex-shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800">
                      {getModuleIcon(n.module, n.type)}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1.5">
                        <p
                          className={`text-sm leading-snug flex-1 min-w-0 ${
                            !n.read
                              ? 'font-semibold text-gray-800 dark:text-gray-100'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {truncate(n.title, 50)}
                        </p>
                        {/* Priority dot */}
                        {n.priority === 'HIGH' || n.priority === 'URGENT' ? (
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                              n.priority === 'URGENT' ? 'bg-red-500' : 'bg-orange-500'
                            }`}
                          />
                        ) : !n.read ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />
                        ) : null}
                      </div>
                      {n.message && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2">
                          {truncate(n.message, 80)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                        {n.module && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">
                            {n.module}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete button (visible on hover) */}
                    <button
                      onClick={(e) => handleDelete(e, n._id)}
                      disabled={deleting === n._id}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                      aria-label="Delete notification"
                    >
                      {deleting === n._id ? (
                        <Loader2 className="w-3 h-3 text-red-500 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
                      )}
                    </button>
                  </button>
                ))}

                {/* Loading more */}
                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                  </div>
                )}

                {/* End of list */}
                {!hasMore && notifications.length > 0 && (
                  <div className="py-3 text-center text-[10px] text-gray-400 dark:text-gray-600">
                    All notifications loaded
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
