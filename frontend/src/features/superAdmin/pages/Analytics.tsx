// src/features/superAdmin/pages/Analytics.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";

import {
  metricsData,
  barSeries,
  distributionSeries,
  PlatformOrder,
} from "../store/Analytics";
import { exportOrdersAsCSV } from "../utils/Analyticsutils";
import { useRestaurantRequestsStore } from "../store/RestaurantRequests";
import { superAdminRestaurantRequestsApi } from "../api/superAdmin.api";

import AnalyticsHeader     from "../components/Analytics/Analyticsheader";
import AnalyticsKPICards   from "../components/Analytics/Analyticskpicards";
import AnalyticsBarChart   from "../components/Analytics/Analyticsbarchart";
import AnalyticsPieChart   from "../components/Analytics/Analyticspiechart";
import AnalyticsOrdersTable from "../components/Analytics/Analyticsorderstable";

import AnalyticsTabBar, { type AnalyticsTab } from "../components/Analytics/AnalyticsTabBar";
import ReservationQueueKPI from "../components/Analytics/ReservationQueueKPI";
import ReservationTrendChart from "../components/Analytics/ReservationTrendChart";
import PeakHoursChart from "../components/Analytics/PeakHoursChart";
import RestaurantLeaderboard from "../components/Analytics/RestaurantLeaderboard";

interface LayoutContextType {
  darkMode: boolean;
}

export default function Analytics() {
  const { darkMode } = useOutletContext<LayoutContextType>();
  const approvedRestaurants = useRestaurantRequestsStore((state) => state.restaurants);
  const fetchRequests = useRestaurantRequestsStore((state) => state.fetchRequests);

  // Tab state
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("revenue");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab]     = useState("All");

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live platform orders state
  const [platformOrders, setPlatformOrders] = useState<PlatformOrder[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(true);

  // Reservation & Queue analytics state
  const [rqData, setRqData] = useState<any>(null);
  const [rqLoading, setRqLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      const data = await superAdminRestaurantRequestsApi.getAnalyticsOrders();
      setPlatformOrders(data.orders);
      setCommissionRate(data.commissionRate);
    } catch (error) {
      console.error("Failed to fetch analytics orders", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReservationQueueData = async () => {
    setRqLoading(true);
    try {
      const data = await superAdminRestaurantRequestsApi.getReservationQueueAnalytics();
      setRqData(data);
    } catch (error) {
      console.error("Failed to fetch reservation/queue analytics", error);
    } finally {
      setRqLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRequests();
  }, [fetchRequests]);

  // Fetch reservation/queue data when tab is activated
  useEffect(() => {
    if (activeTab === "reservations" && !rqData) {
      fetchReservationQueueData();
    }
  }, [activeTab]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const analyticsMetrics = useMemo(() => {
    const revenueTodayVal = platformOrders
      .filter((o) => o.timestamp.startsWith("Today"))
      .reduce((sum, o) => sum + o.grossAmount, 0);

    return metricsData.map((metric) => {
      if (metric.label === "Total Restaurants") {
        return {
          ...metric,
          current: approvedRestaurants.length.toLocaleString(),
          shift: `${approvedRestaurants.filter(r => r.status === 'Active').length} active`,
        };
      }
      if (metric.label === "Revenue Today") {
        return {
          ...metric,
          current: `₹${revenueTodayVal.toLocaleString()}`,
          shift: `From live orders`,
        };
      }
      return metric;
    });
  }, [approvedRestaurants, platformOrders]);

  const totalVolume = useMemo(() => platformOrders.reduce(
    (acc, o) => acc + o.grossAmount,
    0,
  ), [platformOrders]);

  const totalCommission = useMemo(() => platformOrders.reduce(
    (acc, o) => acc + o.commission,
    0,
  ), [platformOrders]);

  const averageOrderValue = useMemo(() => {
    if (platformOrders.length === 0) return 0;
    return Math.round(totalVolume / platformOrders.length);
  }, [platformOrders.length, totalVolume]);

  const filteredOrders = useMemo(() => {
    return platformOrders.filter((order) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        order.restaurant.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q);
      const matchesTab =
        statusTab === "All" || order.status === statusTab;
      return matchesSearch && matchesTab;
    });
  }, [platformOrders, searchQuery, statusTab]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setIsRefreshing(true);
    try {
      await fetchOrders();
      await fetchRequests();
      if (activeTab === "reservations") {
        await fetchReservationQueueData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport  = () => exportOrdersAsCSV(filteredOrders);
  const handleOnboard = () =>
    alert("System Diagnostics: All Server Clusters Operational.");

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-300 ${
        darkMode
          ? "bg-slate-950 text-slate-100"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      <main className="w-full px-4 sm:px-6 xl:px-8 py-6 sm:py-8 max-w-[1600px] mx-auto space-y-6">

        {/* 1 ── Page header */}
        <AnalyticsHeader
          darkMode={darkMode}
          isRefreshing={isRefreshing}
          onSync={handleSync}
          onExport={handleExport}
          onOnboard={handleOnboard}
        />

        {/* 2 ── Tab bar */}
        <AnalyticsTabBar
          darkMode={darkMode}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* ── Revenue & Orders Tab ─────────────────────────────────────── */}
        {activeTab === "revenue" && (
          <>
            {/* KPI summary cards */}
            <AnalyticsKPICards
              darkMode={darkMode}
              metrics={analyticsMetrics}
              totalVolume={totalVolume}
              totalCommission={totalCommission}
              averageOrderValue={averageOrderValue}
            />

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <AnalyticsBarChart darkMode={darkMode} data={barSeries} />
              </div>
              <div className="md:col-span-1">
                <AnalyticsPieChart
                  darkMode={darkMode}
                  data={distributionSeries}
                />
              </div>
            </div>

            {/* Orders table */}
            <AnalyticsOrdersTable
              darkMode={darkMode}
              orders={filteredOrders}
              searchQuery={searchQuery}
              statusTab={statusTab}
              onSearchChange={setSearchQuery}
              onTabChange={setStatusTab}
              commissionRate={commissionRate}
            />
          </>
        )}

        {/* ── Reservation & Queue Tab ──────────────────────────────────── */}
        {activeTab === "reservations" && (
          <>
            {rqLoading && !rqData && (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                <span className={`ml-3 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Loading reservation & queue analytics…
                </span>
              </div>
            )}

            {rqData && (
              <>
                {/* KPI cards */}
                <ReservationQueueKPI darkMode={darkMode} summary={rqData.summary} />

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <ReservationTrendChart darkMode={darkMode} data={rqData.trends || []} />
                  <PeakHoursChart darkMode={darkMode} data={rqData.peakHours || []} />
                </div>

                {/* Restaurant leaderboard */}
                <RestaurantLeaderboard darkMode={darkMode} data={rqData.restaurantLeaderboard || []} />
              </>
            )}

            {!rqLoading && !rqData && (
              <div className={`text-center py-16 text-sm ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                Failed to load reservation & queue data. Click Sync to retry.
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}
