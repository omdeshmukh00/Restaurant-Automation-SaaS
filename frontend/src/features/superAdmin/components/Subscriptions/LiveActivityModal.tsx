import { useState, useEffect, useCallback } from "react";
import {
  X, RefreshCw, LayoutGrid, ShoppingBag, Users, Clock,
  CalendarDays, Activity, ChefHat, CheckCircle2, AlertCircle,
  Loader2, TrendingUp
} from "lucide-react";
import { apiClient } from "../../../../shared/services/apiClient";

interface LiveActivityModalProps {
  restaurantId: string;
  restaurantName: string;
  darkMode: boolean;
  onClose: () => void;
}

interface LiveData {
  restaurant: {
    id: string;
    name: string;
    ownerName: string;
    status: string;
    plan: string;
    logo?: string;
  };
  tables: {
    total: number;
    occupied: number;
    available: number;
    cleaning: number;
    maintenance: number;
    breakdown: Record<string, number>;
  };
  sessions: { active: number };
  orders: {
    todayCount: number;
    todayRevenue: number;
    activeCount: number;
    recent: Array<{
      id: string;
      orderNumber: string;
      status: string;
      amount: number;
      customerName: string;
      createdAt: string;
    }>;
  };
  queue: { waiting: number };
  reservations: { todayCount: number };
}

const ORDER_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING:    { bg: "bg-amber-500/10",   text: "text-amber-500" },
  CONFIRMED:  { bg: "bg-blue-500/10",    text: "text-blue-500" },
  PREPARING:  { bg: "bg-orange-500/10",  text: "text-orange-500" },
  READY:      { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  SERVED:     { bg: "bg-teal-500/10",    text: "text-teal-500" },
  COMPLETED:  { bg: "bg-green-500/10",   text: "text-green-500" },
  CANCELLED:  { bg: "bg-red-500/10",     text: "text-red-500" },
  PAID:       { bg: "bg-emerald-500/10", text: "text-emerald-500" },
};

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatExactDateTime(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "N/A";
  
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  const time = d.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  
  return `${day} ${month} ${year}, ${time}`;
}

export default function LiveActivityModal({ restaurantId, restaurantName, darkMode, onClose }: LiveActivityModalProps) {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await apiClient.get(`/superadmin/restaurants/${restaurantId}/live-activity`);
      setData(res.data.data);
      setError(null);
      setLastRefreshed(new Date());
      setSecondsAgo(0);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to load activity data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Seconds-ago ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefreshed.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastRefreshed]);

  const bg = darkMode ? "bg-slate-950" : "bg-white";
  const border = darkMode ? "border-slate-800" : "border-slate-200";
  const textPrimary = darkMode ? "text-slate-100" : "text-slate-800";
  const textSecondary = darkMode ? "text-slate-400" : "text-slate-500";
  const textMuted = darkMode ? "text-slate-500" : "text-slate-400";
  const cardBg = darkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-100";

  // Table bar percentages
  const tableBar = data ? {
    occupied: data.tables.total > 0 ? (data.tables.occupied / data.tables.total) * 100 : 0,
    available: data.tables.total > 0 ? (data.tables.available / data.tables.total) * 100 : 0,
    cleaning: data.tables.total > 0 ? (data.tables.cleaning / data.tables.total) * 100 : 0,
    maintenance: data.tables.total > 0 ? (data.tables.maintenance / data.tables.total) * 100 : 0,
  } : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm bg-black/60 outline-none"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      role="button"
      tabIndex={0}
      aria-label="Close modal backdrop"
    >
      <div
        className={`w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl border shadow-2xl transition-all ${bg} ${border} ${textPrimary}`}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className={`w-10 h-1 rounded-full ${darkMode ? "bg-slate-700" : "bg-slate-300"}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shrink-0">
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold tracking-tight truncate">{restaurantName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-bold ${textMuted}`}>LIVE ACTIVITY</span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${secondsAgo < 10 ? "text-emerald-500" : secondsAgo < 30 ? "text-amber-500" : "text-red-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${secondsAgo < 10 ? "bg-emerald-500 animate-pulse" : secondsAgo < 30 ? "bg-amber-400" : "bg-red-400"}`} />
                  {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"} ${refreshing ? "animate-spin" : ""}`}
              title="Refresh now"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
              <span className={`text-xs font-medium ${textMuted}`}>Loading live activity...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm font-bold text-red-400">{error}</p>
              <button
                onClick={() => { setLoading(true); setError(null); fetchData(); }}
                className="mt-2 px-4 py-2 text-xs font-bold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              {/* Restaurant Status Header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  data.restaurant.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500" :
                  data.restaurant.status === "SUSPENDED" ? "bg-red-500/10 text-red-400" :
                  "bg-amber-500/10 text-amber-500"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    data.restaurant.status === "ACTIVE" ? "bg-emerald-500 animate-pulse" :
                    data.restaurant.status === "SUSPENDED" ? "bg-red-400" : "bg-amber-400"
                  }`} />
                  {data.restaurant.status}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${darkMode ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
                  {data.restaurant.plan}
                </span>
                <span className={`text-[11px] ${textSecondary}`}>
                  Owner: <span className={`font-bold ${textPrimary}`}>{data.restaurant.ownerName}</span>
                </span>
              </div>

              {/* Stat Cards — 2x2 on mobile, 4 on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Tables */}
                <div className={`rounded-xl border p-3 ${cardBg}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <LayoutGrid size={13} className="text-blue-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Tables</span>
                  </div>
                  <p className="text-xl font-black tracking-tight">
                    {data.tables.occupied}<span className={`text-sm font-bold ${textMuted}`}>/{data.tables.total}</span>
                  </p>
                  <p className={`text-[10px] font-semibold ${textSecondary} mt-0.5`}>occupied</p>
                </div>

                {/* Orders Today */}
                <div className={`rounded-xl border p-3 ${cardBg}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShoppingBag size={13} className="text-orange-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Orders</span>
                  </div>
                  <p className="text-xl font-black tracking-tight">{data.orders.todayCount}</p>
                  <p className={`text-[10px] font-semibold text-emerald-500 mt-0.5`}>
                    ₹{data.orders.todayRevenue.toLocaleString('en-IN')}
                  </p>
                </div>

                {/* Active Sessions */}
                <div className={`rounded-xl border p-3 ${cardBg}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users size={13} className="text-violet-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Sessions</span>
                  </div>
                  <p className="text-xl font-black tracking-tight">{data.sessions.active}</p>
                  <p className={`text-[10px] font-semibold ${textSecondary} mt-0.5`}>active now</p>
                </div>

                {/* Queue */}
                <div className={`rounded-xl border p-3 ${cardBg}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock size={13} className="text-amber-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Queue</span>
                  </div>
                  <p className="text-xl font-black tracking-tight">{data.queue.waiting}</p>
                  <p className={`text-[10px] font-semibold ${textSecondary} mt-0.5`}>waiting</p>
                </div>
              </div>

              {/* Table Breakdown Bar */}
              {data.tables.total > 0 && tableBar && (
                <div className={`rounded-xl border p-3.5 ${cardBg}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-2.5 ${textMuted}`}>Table Occupancy</p>
                  <div className="h-3 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                    {tableBar.occupied > 0 && (
                      <div className="bg-orange-500 transition-all duration-500" style={{ width: `${tableBar.occupied}%` }} title={`Occupied: ${data.tables.occupied}`} />
                    )}
                    {tableBar.available > 0 && (
                      <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${tableBar.available}%` }} title={`Available: ${data.tables.available}`} />
                    )}
                    {tableBar.cleaning > 0 && (
                      <div className="bg-amber-400 transition-all duration-500" style={{ width: `${tableBar.cleaning}%` }} title={`Cleaning: ${data.tables.cleaning}`} />
                    )}
                    {tableBar.maintenance > 0 && (
                      <div className="bg-slate-400 transition-all duration-500" style={{ width: `${tableBar.maintenance}%` }} title={`Maintenance: ${data.tables.maintenance}`} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold">
                      <span className="w-2 h-2 rounded-sm bg-orange-500" /> Occupied ({data.tables.occupied})
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold">
                      <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Available ({data.tables.available})
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold">
                      <span className="w-2 h-2 rounded-sm bg-amber-400" /> Cleaning ({data.tables.cleaning})
                    </span>
                    {data.tables.maintenance > 0 && (
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold">
                        <span className="w-2 h-2 rounded-sm bg-slate-400" /> Maintenance ({data.tables.maintenance})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Summary Row */}
              <div className={`flex flex-wrap items-center gap-3 text-[11px] font-semibold ${textSecondary}`}>
                <span className="flex items-center gap-1.5">
                  <ChefHat size={12} className="text-orange-500" />
                  {data.orders.activeCount} orders in progress
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={12} className="text-blue-500" />
                  {data.reservations.todayCount} reservations today
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-emerald-500" />
                  ₹{data.orders.todayRevenue.toLocaleString('en-IN')} revenue today
                </span>
              </div>

              {/* Recent Orders */}
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-2.5 ${textMuted}`}>All Orders</p>
                {data.orders.recent.length === 0 ? (
                  <div className={`text-center py-6 rounded-xl border ${cardBg}`}>
                    <ShoppingBag size={20} className={`mx-auto mb-1.5 ${textMuted}`} />
                    <p className={`text-xs font-medium ${textSecondary}`}>No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {data.orders.recent.map((order) => {
                      const style = ORDER_STATUS_STYLES[order.status] || { bg: "bg-slate-500/10", text: "text-slate-400" };
                      return (
                        <div
                          key={order.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${cardBg}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-extrabold ${textPrimary}`}>#{order.orderNumber}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                                {order.status}
                              </span>
                            </div>
                            <p className={`text-[10px] font-medium mt-0.5 ${textSecondary}`}>
                              {order.customerName} &middot; {formatExactDateTime(order.createdAt)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-xs font-extrabold ${textPrimary}`}>₹{order.amount?.toLocaleString('en-IN') || '0'}</p>
                            <p className={`text-[10px] ${textMuted}`} title={formatExactDateTime(order.createdAt)}>{timeAgo(order.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className={`flex gap-3 px-5 py-4 border-t ${border}`}>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 h-10 text-xs font-bold rounded-xl border transition-colors ${
              darkMode ? "border-slate-800 hover:bg-slate-900 text-slate-300" : "border-slate-200 hover:bg-slate-50 text-slate-600"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
