// src/features/superAdmin/pages/Analytics.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";

import {
  metricsData,
  barSeries,
  distributionSeries,
  PlatformOrder,
} from "../store/Analytics";
import { exportOrdersAsCSV, exportOrdersAsPDF } from "../utils/Analyticsutils";
import { useRestaurantRequestsStore } from "../store/RestaurantRequests";
import { superAdminRestaurantRequestsApi } from "../api/superAdmin.api";
import { useSuperAdminDashboardStore } from "../store/Superadmindashboard";

import AnalyticsHeader     from "../components/Analytics/Analyticsheader";
import AnalyticsKPICards   from "../components/Analytics/Analyticskpicards";
import AnalyticsBarChart   from "../components/Analytics/Analyticsbarchart";
import AnalyticsPieChart   from "../components/Analytics/Analyticspiechart";
import AnalyticsOrdersTable from "../components/Analytics/Analyticsorderstable";
import RevenueChart        from "../components/dashboard/RevenueChart";
import RestaurantStatusPie from "../components/dashboard/Restaurantstatuspie";

import AnalyticsTabBar, { type AnalyticsTab } from "../components/Analytics/AnalyticsTabBar";
import ReservationQueueKPI from "../components/Analytics/ReservationQueueKPI";
import ReservationTrendChart from "../components/Analytics/ReservationTrendChart";
import PeakHoursChart from "../components/Analytics/PeakHoursChart";
import RestaurantLeaderboard from "../components/Analytics/RestaurantLeaderboard";

interface LayoutContextType {
  darkMode: boolean;
}

import { useAnalyticsStore } from "../store/AnalyticsStore";

export default function Analytics() {
  const { darkMode } = useOutletContext<LayoutContextType>();
  const approvedRestaurants = useRestaurantRequestsStore((state) => state.restaurants);
  const fetchRequests = useRestaurantRequestsStore((state) => state.fetchRequests);
  const fetchOverview = useSuperAdminDashboardStore((state) => state.fetchOverview);

  // Tab state
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("revenue");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab]     = useState("All");

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live platform orders store state
  const platformOrders = useAnalyticsStore((state) => state.platformOrders);
  const commissionRate = useAnalyticsStore((state) => state.commissionRate);
  const isLoading = useAnalyticsStore((state) => state.loading);
  const fetchOrders = useAnalyticsStore((state) => state.fetchOrders);

  // Reservation & Queue analytics state
  const [rqData, setRqData] = useState<any>(null);
  const [rqLoading, setRqLoading] = useState(false);

  // Dynamic charts and feature adoption state
  const [dynamicBarSeries, setDynamicBarSeries] = useState<any[]>(barSeries);
  const [dynamicDistributionSeries, setDynamicDistributionSeries] = useState<any[]>(distributionSeries);
  const [featureAdoption, setFeatureAdoption] = useState<any>({
    reservations: 65,
    queues: 48,
    discounts: 52,
    analytics: 35,
    automation: 22,
  });

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

  const fetchChartsData = async () => {
    try {
      const result = await superAdminRestaurantRequestsApi.getAnalyticsCharts();
      if (result) {
        if (result.barSeries && result.barSeries.length > 0) {
          setDynamicBarSeries(result.barSeries);
        }
        if (result.distributionSeries && result.distributionSeries.length > 0) {
          setDynamicDistributionSeries(result.distributionSeries);
        }
        if (result.featureAdoption) {
          setFeatureAdoption(result.featureAdoption);
        }
      }
    } catch (error) {
      console.error("Failed to fetch analytics charts data", error);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRequests();
    fetchChartsData();
    fetchOverview();
  }, [fetchOrders, fetchRequests, fetchOverview]);

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
      await fetchChartsData();
      await fetchOverview();
      if (activeTab === "reservations") {
        await fetchReservationQueueData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCSV = () => exportOrdersAsCSV(filteredOrders);
  const handleExportPDF = () => exportOrdersAsPDF(filteredOrders);
  const handleOnboard   = () =>
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
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* 1 ── Page header */}
        <AnalyticsHeader
          darkMode={darkMode}
          isRefreshing={isRefreshing}
          onSync={handleSync}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
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

            {/* Feature Adoption Card */}
            <div
              className={`rounded-2xl p-6 border transition-all duration-300 ${
                darkMode
                  ? "bg-slate-900/40 border-slate-800/80 text-slate-100 shadow-xl shadow-black/20"
                  : "bg-white border-slate-200/80 text-slate-800 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    darkMode ? "bg-orange-500/10 text-orange-400" : "bg-orange-50 text-orange-600"
                  }`}
                >
                  <span className="text-sm font-bold">⚡</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Feature Adoption Analytics</h3>
                  <p className={`text-[10px] font-semibold mt-0.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                    Active onboarded tenants utilizing core premium capabilities
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 mt-6">
                {[
                  { label: "Reservations Engine", value: featureAdoption.reservations, color: "bg-gradient-to-r from-blue-600 to-blue-400", shadow: "shadow-blue-500/10" },
                  { label: "Waitlist & Queue", value: featureAdoption.queues, color: "bg-gradient-to-r from-orange-600 to-orange-400", shadow: "shadow-orange-500/10" },
                  { label: "Dynamic Discount Engine", value: featureAdoption.discounts, color: "bg-gradient-to-r from-purple-600 to-purple-400", shadow: "shadow-purple-500/10" },
                  { label: "Advanced Analytics Suite", value: featureAdoption.analytics, color: "bg-gradient-to-r from-emerald-600 to-emerald-400", shadow: "shadow-emerald-500/10" },
                  { label: "Smart Automation Rules", value: featureAdoption.automation, color: "bg-gradient-to-r from-pink-600 to-pink-400", shadow: "shadow-pink-500/10" },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className={darkMode ? "text-slate-400" : "text-slate-500"}>{item.label}</span>
                      <span className={darkMode ? "text-slate-300" : "text-slate-700"}>{item.value}%</span>
                    </div>
                    <div className={`h-2.5 rounded-full w-full overflow-hidden ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.color} ${item.shadow}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <AnalyticsBarChart darkMode={darkMode} data={dynamicBarSeries} />
              </div>
              <div className="md:col-span-1">
                <AnalyticsPieChart
                  darkMode={darkMode}
                  data={dynamicDistributionSeries}
                />
              </div>
            </div>

        {/* Dashboard Trend Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <RevenueChart darkMode={darkMode} />
          </div>
          <div className="lg:col-span-1">
            <RestaurantStatusPie darkMode={darkMode} />
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
