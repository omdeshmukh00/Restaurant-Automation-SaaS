import React, { useEffect, useState } from 'react';
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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-sans text-slate-800">Kitchen Manager Dashboard</h1>
          <p className="text-sm text-slate-500 font-sans mt-1">Real-time overview of kitchen operations</p>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 font-sans uppercase mb-1">Kitchen Load</p>
            <p className="text-2xl font-bold font-sans text-slate-800">
              {loadData?.aggregate?.load || 'Normal'}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-500">speed</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 font-sans uppercase mb-1">Active Orders</p>
            <p className="text-2xl font-bold font-sans text-slate-800">
              {loadData?.aggregate?.activeOrdersCount || 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-orange-500">receipt_long</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 font-sans uppercase mb-1">Avg Prep Time</p>
            <p className="text-2xl font-bold font-sans text-slate-800">
              {performance?.averagePreparationTime || 0} min
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-green-500">timer</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 font-sans uppercase mb-1">Delayed Orders</p>
            <p className="text-2xl font-bold font-sans text-slate-800">
              {performance?.delayedOrders || 0}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500">warning</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Alerts */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 font-sans flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-[20px]">notifications_active</span>
              Active Alerts
            </h3>
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {alerts.length} NEW
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-sans text-sm">
                No active alerts. Everything is running smoothly.
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert._id} className="p-4 flex gap-4 items-start hover:bg-slate-50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-1">
                    <span className="material-symbols-outlined text-red-500 text-[16px]">
                      {alert.type === 'VIP_ARRIVAL' ? 'star' : 'error'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-slate-800 font-sans">{alert.title}</h4>
                      <span className="text-[10px] text-slate-400 font-sans">
                        {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-sans mb-3">{alert.message}</p>
                    <button 
                      onClick={() => handleResolveAlert(alert._id)}
                      className="text-[11px] font-bold text-slate-500 border border-slate-200 px-3 py-1 rounded-md hover:bg-slate-100 transition-colors"
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 font-sans flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500 text-[20px]">analytics</span>
              Station Load
            </h3>
          </div>
          <div className="p-5 space-y-5">
            {loadData?.stations?.map((station: any) => (
              <div key={station.id}>
                <div className="flex justify-between items-end mb-2">
                  <h4 className="text-sm font-bold text-slate-700 font-sans">{station.name}</h4>
                  <span className="text-xs text-slate-500 font-sans font-medium">{station.activeOrders} orders</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
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
              <div className="text-center text-slate-500 font-sans text-sm py-4">
                No station data available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
