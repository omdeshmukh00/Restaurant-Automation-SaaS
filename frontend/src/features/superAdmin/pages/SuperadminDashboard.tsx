// src/features/superAdmin/pages/SuperadminDashboard.tsx

import { useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import StatsGrid from "../components/dashboard/Statsgrid";
import RevenueChart from "../components/dashboard/RevenueChart";
import RestaurantStatusPie from "../components/dashboard/Restaurantstatuspie";
import TopRestaurantsTable from "../components/dashboard/TopRestaurantsTable";
import { Building2, RefreshCw } from "lucide-react";
import { useRestaurantRequestsStore } from "../store/RestaurantRequests";
import { useSuperAdminDashboardStore } from "../store/Superadmindashboard";
import { getSocket } from "../../../lib/socket";

interface OutletContext {
  darkMode: boolean;
}

export default function SuperAdminDashboard() {
  const { darkMode } = useOutletContext<OutletContext>();
  const [_, setSearchParams] = useSearchParams();
  
  const requests = useRestaurantRequestsStore((state) => state.requests);
  const pendingCount = requests.filter(r => r.status === 'APPLICATION_PENDING' || r.status === 'PENDING_PAYMENT').length;
  const fetchRequests = useRestaurantRequestsStore((state) => state.fetchRequests);

  const fetchOverview = useSuperAdminDashboardStore((state) => state.fetchOverview);
  
  useEffect(() => {
    fetchRequests();
    fetchOverview();

    // Socket connection is handled by SocketProvider at the app root.
    const socket = getSocket();
    if (socket) {
      socket.on('restaurant_request_created', (newReq) => {
        useRestaurantRequestsStore.setState((state) => {
          const exists = state.requests.some((r) => r.id === newReq.id);
          if (exists) return state;
          return { requests: [newReq, ...state.requests] };
        });
      });

      socket.on('restaurant_request_approved', ({ id }) => {
        useRestaurantRequestsStore.setState((state) => ({
          requests: state.requests.map((r) =>
            r.id === id ? { ...r, status: 'APPLICATION_APPROVED' } : r
          ),
        }));
      });

      socket.on('restaurant_request_rejected', ({ id, reason }) => {
        useRestaurantRequestsStore.setState((state) => ({
          requests: state.requests.map((r) =>
            r.id === id ? { ...r, status: 'REJECTED', rejectionReason: reason || r.rejectionReason } : r
          ),
        }));
      });
    }

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('restaurant_request_created');
        socket.off('restaurant_request_approved');
        socket.off('restaurant_request_rejected');
      }
    };
  }, [fetchRequests, fetchOverview]);

  const closeRequests = () => {
    setSearchParams({});
  };

  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateString = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className={`min-h-full font-sans antialiased transition-colors duration-300 ${
        darkMode ? "text-slate-50" : "text-slate-900"
      }`}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Dashboard Overview
            </h1>
            <p
              className={`mt-1 text-xs sm:text-sm font-medium ${
                darkMode ? "text-slate-400" : "text-slate-600"
              }`}
            >
              {dateString} · Last synced at {timeString}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSearchParams({ requests: "new" })}
              className={`relative self-start sm:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                darkMode
                  ? "border-orange-500/30 text-orange-300 bg-orange-500/10 hover:bg-orange-500/15"
                  : "border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100"
              }`}
            >
              <Building2 size={13} />
              New Requests
              {pendingCount > 0 && (
                <span className="ml-1 min-w-5 h-5 px-1 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                fetchRequests();
                fetchOverview();
              }}
              className={`self-start sm:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                darkMode
                  ? "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800/40"
                  : "border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── STATS ROW ───────────────────────────────────────────────── */}
        <StatsGrid darkMode={darkMode} />

        {/* ── CHARTS ROW ──────────────────────────────────────────────── */}
        {/*
          On mobile:  single column stack.
          On lg+:     revenue chart takes 2/3, pie takes 1/3.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <RevenueChart darkMode={darkMode} />
          <RestaurantStatusPie darkMode={darkMode} />
        </div>

        {/* ── TOP RESTAURANTS TABLE ────────────────────────────────────── */}
        <TopRestaurantsTable darkMode={darkMode} />

        {/* ── FOOTER NOTE ─────────────────────────────────────────────── */}
        <p
          className={`text-center text-[10px] pb-2 ${
            darkMode ? "text-slate-700" : "text-slate-300"
          }`}
        >
          Super Admin HQ · All data reflects live platform telemetry
        </p>
      </div>
    </div>
  );
}
