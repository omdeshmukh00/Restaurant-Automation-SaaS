import React, { useState, useEffect } from 'react';
import { useStaffSearch } from '../components/dashboard/StaffSearchContext';
import { useStaffDashboard } from '../hooks/useStaffDashboard';
import { reportsAPI, type ReportMetricItem } from '../api/staff.api';

interface ReportMetric {
  date: string;
  served: number;
  billingAmount: number;
  tips: number;
  rating: number; // out of 5
}

export default function StaffReportsPage() {
  const { query } = useStaffSearch();
  const { orders } = useStaffDashboard();
  const [reportMetrics, setReportMetrics] = useState<ReportMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await reportsAPI.getReports();
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setReportMetrics(res.data.map(m => ({
            date: m.date,
            served: m.served,
            billingAmount: m.billingAmount || 0,
            tips: m.tips,
            rating: m.rating,
          })));
        } else {
          // Fallback generate date labels for 7 days based on current store orders
          const getPastDateString = (daysAgo: number) => {
            if (daysAgo === 0) return 'Today';
            const d = new Date();
            d.setDate(d.getDate() - daysAgo);
            return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
          };

          const completedOrders = orders.filter(o => o.status === 'Completed' || o.status === 'Served');
          const todayServed = completedOrders.length;
          const todayBilling = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
          const todayTips = completedOrders.reduce((sum, o) => sum + Math.round((o.total || 0) * 0.1), 0);

          const generated: ReportMetric[] = Array.from({ length: 7 }, (_, i) => ({
            date: getPastDateString(i),
            served: i === 0 ? todayServed : 0,
            billingAmount: i === 0 ? todayBilling : 0,
            tips: i === 0 ? todayTips : 0,
            rating: 5.0,
          }));
          setReportMetrics(generated);
        }
      } catch (err) {
        console.error('Failed to load shift reports', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchReports();
  }, [orders]);

  const reportData = reportMetrics;

  const filteredData = reportData.filter(d => 
    d.date.toLowerCase().includes(query.toLowerCase())
  );

  const totalBilling = reportData.reduce((acc, c) => acc + c.billingAmount, 0);
  const totalTips = reportData.reduce((acc, c) => acc + c.tips, 0);
  const totalServed = reportData.reduce((acc, c) => acc + c.served, 0);
  const avgRating = (reportData.reduce((acc, c) => acc + c.rating, 0) / (reportData.length || 1)).toFixed(1);

  const handleExport = () => {
    const csvRows = [
      ['Date', 'Tables Served', 'Total Billing (INR)', 'Tips Earned (INR)', 'Average Rating'],
      ...reportData.map(d => [d.date, d.served.toString(), d.billingAmount.toString(), d.tips.toString(), d.rating.toString()])
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DineEase_Shift_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">Shift Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Daily billing analytics, performance tracking, tables served, and tips report.</p>
        </div>
        <button
          onClick={handleExport}
          className="bg-dine-orange hover:bg-dine-orange/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 border-none cursor-pointer outline-none"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-sd-surface-container border border-slate-100 dark:border-sd-outline-variant/40 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase font-sans">Total Billing (7 Days)</p>
          <p className="text-2xl font-black text-dine-orange font-sans mt-1">₹{totalBilling.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 font-sans mt-2">Avg. ₹{(totalBilling / (reportData.length || 1)).toFixed(0)} per day</p>
        </div>
        <div className="bg-white dark:bg-sd-surface-container border border-slate-100 dark:border-sd-outline-variant/40 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase font-sans">Weekly Tips Earned</p>
          <p className="text-2xl font-black text-green-600 dark:text-green-400 font-sans mt-1">₹{totalTips.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 font-sans mt-2">Avg. ₹{(totalTips / (reportData.length || 1)).toFixed(0)} per shift</p>
        </div>
        <div className="bg-white dark:bg-sd-surface-container border border-slate-100 dark:border-sd-outline-variant/40 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase font-sans">Tables Served (7 days)</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-sans mt-1">{totalServed} Tables</p>
          <p className="text-[10px] text-slate-400 font-sans mt-2">Avg. {(totalServed / (reportData.length || 1)).toFixed(0)} per shift</p>
        </div>
        <div className="bg-white dark:bg-sd-surface-container border border-slate-100 dark:border-sd-outline-variant/40 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase font-sans">Avg. Customer Rating</p>
          <p className="text-2xl font-black text-amber-500 font-sans mt-1">⭐️ {avgRating}</p>
          <p className="text-[10px] text-slate-400 font-sans mt-2">Target benchmark is 4.5+</p>
        </div>
      </div>

      {/* Charts & Lists Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Daily Billing & Tips Bar Chart (2/3 width) */}
        <div className="xl:col-span-2 bg-white dark:bg-sd-surface-container border border-slate-100 dark:border-sd-outline-variant/40 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 font-sans">Daily Billing & Tips Overview</h2>
            <div className="flex items-center gap-4 text-xs font-sans">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-dine-orange inline-block" /> Billing Amount
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Tips
              </span>
            </div>
          </div>
          
          <div className="flex items-end justify-between h-48 pt-6 px-4">
            {filteredData.map((d, idx) => {
              const maxBilling = Math.max(...reportData.map(item => item.billingAmount), 1);
              const heightPct = Math.round((d.billingAmount / maxBilling) * 100);
              return (
                <div key={idx} className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                  <span className="text-[9px] font-black text-dine-orange opacity-0 group-hover:opacity-100 transition-opacity font-sans shrink-0">
                    ₹{d.billingAmount}
                  </span>
                  <div className="h-32 w-full flex items-end justify-center">
                    <div
                      className="w-8 md:w-12 bg-dine-orange/20 hover:bg-dine-orange dark:bg-dine-orange/25 dark:hover:bg-dine-orange rounded-t-lg transition-all duration-300 relative cursor-pointer"
                      style={{ height: `${Math.max(8, heightPct)}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10" />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-450 dark:text-slate-450 font-bold font-sans shrink-0">
                    {d.date.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Shift Logs (1/3 width) */}
        <div className="bg-white dark:bg-sd-surface-container border border-slate-100 dark:border-sd-outline-variant/40 rounded-2xl p-6 shadow-sm">
          <h2 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 font-sans mb-4">Daily Billing Breakdown</h2>
          <div className="space-y-4">
            {filteredData.map((d, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs pb-3 border-b border-slate-100 dark:border-sd-outline-variant/30 last:border-b-0 last:pb-0">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 font-sans">{d.date}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-sans">{d.served} tables served</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-dine-orange font-sans">₹{d.billingAmount.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-green-600 dark:text-green-400 font-sans">+₹{d.tips} tips · ★ {d.rating}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
