import React from 'react';
import { useStaffSearch } from '../components/dashboard/StaffSearchContext';
import { useStaffDashboard } from '../hooks/useStaffDashboard';

interface ReportMetric {
  date: string;
  served: number;
  tips: number;
  rating: number; // out of 5
}

export default function StaffReportsPage() {
  const { query } = useStaffSearch();
  const { orders } = useStaffDashboard();

  const getPastDateString = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  };

  // Dynamic calculations for Today based on store's completed orders
  const completedToday = orders.filter(o => o.status === 'Completed');
  const todayServedCount = 15 + completedToday.length;
  const todayTipsAmount = 1200 + completedToday.reduce((sum, o) => sum + Math.round(o.total * 0.1), 0);
  
  const todayRatingsSum = completedToday.reduce((sum, o) => sum + (o.rating || 4.8), 0);
  const todayAvgRating = completedToday.length > 0 
    ? parseFloat(((15 * 4.8 + todayRatingsSum) / todayServedCount).toFixed(1))
    : 4.8;

  const reportData: ReportMetric[] = [
    { date: 'Today', served: todayServedCount, tips: todayTipsAmount, rating: todayAvgRating },
    { date: getPastDateString(1), served: 22, tips: 1850, rating: 4.9 },
    { date: getPastDateString(2), served: 15, tips: 1100, rating: 4.6 },
    { date: getPastDateString(3), served: 20, tips: 1600, rating: 4.7 },
    { date: getPastDateString(4), served: 25, tips: 2200, rating: 5.0 },
    { date: getPastDateString(5), served: 12, tips: 850, rating: 4.3 },
    { date: getPastDateString(6), served: 14, tips: 950, rating: 4.5 },
  ];

  const filteredData = reportData.filter(d => 
    d.date.toLowerCase().includes(query.toLowerCase())
  );

  const totalTips = reportData.reduce((acc, c) => acc + c.tips, 0);
  const totalServed = reportData.reduce((acc, c) => acc + c.served, 0);
  const avgRating = (reportData.reduce((acc, c) => acc + c.rating, 0) / reportData.length).toFixed(1);

  const handleExport = () => {
    const csvRows = [
      ['Date', 'Tables Served', 'Tips Earned (INR)', 'Average Rating'],
      ...reportData.map(d => [d.date, d.served.toString(), d.tips.toString(), d.rating.toString()])
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
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Performance tracking, orders served, and tips report.</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase font-sans">Weekly Tips Earned</p>
          <p className="text-2xl font-black text-green-600 dark:text-green-400 font-sans mt-1">₹{totalTips.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 font-sans mt-2">Avg. ₹{(totalTips / reportData.length).toFixed(0)} per shift</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase font-sans">Tables Served (7 days)</p>
          <p className="text-2xl font-black text-dine-orange font-sans mt-1">{totalServed} Tables</p>
          <p className="text-[10px] text-slate-400 font-sans mt-2">Avg. {(totalServed / reportData.length).toFixed(0)} per shift</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase font-sans">Avg. Customer Rating</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-sans mt-1">⭐️ {avgRating}</p>
          <p className="text-[10px] text-slate-400 font-sans mt-2">Target benchmark is 4.5+</p>
        </div>
      </div>

      {/* Charts & Lists Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tips Bar Chart (2/3 width) */}
        <div className="xl:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 font-sans mb-6">Daily Tips Overview</h2>
          
          <div className="flex items-end justify-between h-48 pt-6 px-4">
            {filteredData.map((d, idx) => {
              const maxTips = Math.max(...reportData.map(item => item.tips), 1);
              const heightPct = Math.round((d.tips / maxTips) * 100);
              return (
                <div key={idx} className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                  <span className="text-[9px] font-black text-green-600 dark:text-green-400 opacity-0 group-hover:opacity-100 transition-opacity font-sans shrink-0">
                    ₹{d.tips}
                  </span>
                  <div className="h-32 w-full flex items-end justify-center">
                    <div
                      className="w-8 md:w-12 bg-dine-orange/20 hover:bg-dine-orange dark:bg-dine-orange/15 dark:hover:bg-dine-orange rounded-t-lg transition-all duration-300 relative cursor-pointer"
                      style={{ height: `${heightPct}%` }}
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
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 font-sans mb-4">Detailed Metrics</h2>
          <div className="space-y-4">
            {filteredData.map((d, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs pb-3 border-b border-slate-100 last:border-b-0 last:pb-0">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-205 font-sans">{d.date}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-sans">{d.served} tables served</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-850 dark:text-slate-150 font-sans">₹{d.tips}</p>
                  <p className="text-[9px] font-bold text-blue-600 dark:text-blue-400 font-sans">★ {d.rating}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
