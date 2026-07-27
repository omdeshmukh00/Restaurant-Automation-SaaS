import React, { useState, useEffect } from 'react';
import { getKitchenLoad, getAlerts, resolveAlert, getKitchenPerformance } from '../api/kitchen.api';

interface Alert {
  _id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

interface PerformanceData {
  averagePreparationTime: number;
  ordersCompleted: number;
  delayedOrders: number;
}

export default function KitchenManagerDashboard() {
  const [loadData, setLoadData] = useState<any | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [loadRes, alertsRes, perfRes] = await Promise.all([
        getKitchenLoad(),
        getAlerts(),
        getKitchenPerformance()
      ]);
      setLoadData(loadRes as any); 
      setAlerts(alertsRes as unknown as Alert[]);
      setPerformance(perfRes as unknown as PerformanceData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleResolveAlert = async (id: string) => {
    await resolveAlert(id);
    fetchDashboardData();
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 h-full overflow-y-auto bg-slate-50/50 dark:bg-slate-950 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Kitchen Manager Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time overview of kitchen operations</p>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Kitchen Load</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white truncate max-w-[150px]">
              {loadData?.aggregate?.load || 'Normal'}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-blue-500 text-[20px]">speed</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Active Orders</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
              {loadData?.aggregate?.activeOrdersCount || 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-orange-500 text-[20px]">receipt_long</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Avg Prep Time</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
              {performance?.averagePreparationTime || 0} min
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-green-50 dark:bg-green-950/40 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-green-500 text-[20px]">timer</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Delayed Orders</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
              {performance?.delayedOrders || 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-red-500 text-[20px]">warning</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Alerts */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-between items-center">
            <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-[20px]">notifications_active</span>
              Active Alerts
            </h3>
            <span className="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
              {alerts.length} NEW
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
                No active alerts. Everything is running smoothly.
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert._id} className="p-4 sm:p-5 flex gap-3.5 sm:gap-4 items-start hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-red-500 text-[16px]">
                      {alert.type === 'VIP_ARRIVAL' ? 'star' : 'error'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">{alert.title}</h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">{alert.message}</p>
                    <button 
                      onClick={() => handleResolveAlert(alert._id)}
                      className="text-[11px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-[0.98]"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Station Load */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500 text-[20px]">analytics</span>
              Station Load
            </h3>
          </div>
          
          <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 flex-1">
            {loadData?.stations?.map((station: any) => (
              <div key={station.id} className="space-y-1.5">
                <div className="flex justify-between items-end">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate pr-2">{station.name}</h4>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">{station.activeOrders} orders</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      station.loadFactor > 0.8 ? 'bg-red-500' : station.loadFactor > 0.5 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, station.loadFactor * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {(!loadData?.stations || loadData.stations.length === 0) && (
              <div className="text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm py-8">
                No station data available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}