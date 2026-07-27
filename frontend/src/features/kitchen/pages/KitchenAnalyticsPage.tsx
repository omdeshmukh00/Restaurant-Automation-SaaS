import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../auth/AuthProvider';
import { Navigate } from 'react-router-dom';
import { apiClient } from '../../../shared/services/apiClient';

export default function KitchenAnalyticsPage() {
  const { user } = useAuth();

  const [timeRange, setTimeRange] = useState<'today' | 'yesterday' | 'weekly'>('today');
  
  const [metrics, setMetrics] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [popularItems, setPopularItems] = useState<any[]>([]);
  const [stationEfficiency, setStationEfficiency] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await apiClient.get('/kitchen/dashboard');
        const data = res.data?.metrics || res.data?.data?.metrics || res.data;
        if (data) {
          setMetrics([
            { label: 'Active Orders', value: data.activeOrders || 0, change: 0, unit: '' },
            { label: 'Avg ETA', value: data.avgEtaMinutes || 0, change: 0, unit: 'min' },
            { label: 'Ready Orders', value: data.readyOrders || 0, change: 0, unit: '' },
          ]);
        }
      } catch (err) {
        console.error('Failed to load kitchen dashboard', err);
      }
    };
    fetchDashboard();
  }, [timeRange]);

  if (user?.internal_role === 'CHEF') {
    return <Navigate to="/kitchen" replace />;
  }

  const handleTimeRangeChange = (range: 'today' | 'yesterday' | 'weekly') => {
    setTimeRange(range);
  };

  const maxHourlyOrders = chartData.length > 0 ? Math.max(...chartData.map(d => d.orders)) : 10;

  return (  
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto font-sans bg-slate-50/50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Kitchen Analytics</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Review order performance metrics, hourly peaks, and preparation speeds</p>
        </div>
        <div className="flex bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-1 shrink-0 self-start sm:self-auto shadow-sm">
          {(['today', 'yesterday', 'weekly'] as const).map(range => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                timeRange === range
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-6">
        {metrics.map((metric, idx) => {
          const isPositive = metric.change >= 0;
          const changeText = isPositive ? `+${metric.change}` : `${metric.change}`;
          const isPrepTime = metric.label.includes('Prep');
          const isGoodChange = isPrepTime ? !isPositive : isPositive;

          return (
            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{metric.label}</span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white">
                  {metric.unit === '₹' ? '₹' : ''}
                  {metric.value.toLocaleString()}
                  {metric.unit !== '₹' ? metric.unit : ''}
                </span>
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                    isGoodChange ? 'bg-green-50 dark:bg-green-950/40 text-green-600' : 'bg-red-50 dark:bg-red-950/40 text-red-600'
                  }`}
                >
                  {changeText}%
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1 block">vs. yesterday&apos;s average</span>
            </div>
          );
        })}
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Hourly Orders Trend (SVG Bar Chart) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">
                {timeRange === 'weekly' ? 'Daily Order Volume' : 'Hourly Order Volume'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {timeRange === 'weekly'
                  ? 'Daily order loads throughout the week'
                  : 'Peak times and order loads throughout the shift'}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">Live Feed</span>
          </div>

          {/* SVG Bar Chart */}
          <div className="w-full h-60 flex items-end justify-between px-2 pt-6 overflow-x-auto scrollbar-none">
            {chartData.map((d, index) => {
              const barHeight = maxHourlyOrders > 0 ? (d.orders / maxHourlyOrders) * 160 : 0;

              return (
                <div key={index} className="flex-1 min-w-[28px] flex flex-col items-center group relative h-full justify-end px-1">
                  <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {d.orders} Orders
                  </div>
                  <div
                    className="w-full max-w-[28px] bg-gradient-to-t from-orange-400 to-orange-500 rounded-t-md group-hover:from-orange-500 group-hover:to-orange-600 transition-all duration-300 relative cursor-pointer"
                    style={{ height: `${barHeight}px` }}
                  />
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-2">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Dishes (Progress bars) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">Top Prep Dishes</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Most requested menu items in kitchen</p>
          </div>
          <div className="space-y-4">
            {popularItems.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-700 dark:text-slate-200 truncate pr-2">{item.name}</span>
                  <span className="text-orange-600 font-bold shrink-0">{item.count} items</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="bg-orange-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stations Efficiency & Load */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="mb-6">
          <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">Station Preparation Efficiencies</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Order completion rate & speed score per cooking counter</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
          {stationEfficiency.map((station, idx) => (
            <div key={idx} className="border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl text-center hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors flex flex-col items-center">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block truncate w-full">{station.station} Station</span>
              <div className="my-3 flex justify-center">
                {/* SVG Radial Gauge */}
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke="#F1F5F9"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke="#EA580C"
                    strokeWidth="5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={2 * Math.PI * 26 * (1 - station.efficiency / 100)}
                  />
                </svg>
              </div>
              <span className="text-lg font-extrabold text-slate-800 dark:text-white">{station.efficiency}%</span>
              <span className="text-[9px] font-bold text-green-600 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded block mt-1">
                Optimal
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}