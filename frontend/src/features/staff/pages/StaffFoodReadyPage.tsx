import React from 'react';
import { Link } from 'react-router-dom';
import { useStaffSearch } from '../components/dashboard/StaffSearchContext';
import { useStaffDashboard } from '../hooks/useStaffDashboard';

export default function StaffFoodReadyPage() {
  const { query } = useStaffSearch();
  const { readyItems: items, setReadyItems: setItems, refreshDashboard } = useStaffDashboard();

  const markServed = async (id: any) => {
    try {
      const { ordersAPI } = await import('../api/staff.api');
      await ordersAPI.serveOrder(id);
      setItems(prev => prev.filter(item => item.id !== id));
      await refreshDashboard();
    } catch (err) {
      console.error('Failed to mark order served', err);
    }
  };

  const markAllServed = async () => {
    try {
      const { ordersAPI } = await import('../api/staff.api');
      await Promise.all(items.map(item => ordersAPI.serveOrder(item.id as any)));
      setItems([]);
      await refreshDashboard();
    } catch (err) {
      console.error('Failed to mark all served', err);
    }
  };

  const filteredItems = items.filter(item =>
    item.item.toLowerCase().includes(query.toLowerCase()) ||
    item.table.toLowerCase().includes(query.toLowerCase()) ||
    item.station.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">Food Ready Panel</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Collect completed orders from the kitchen and serve guests.</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={markAllServed}
            className="border border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 font-bold text-xs py-2 px-4 rounded-xl transition-all"
          >
            Mark All Picked Up
          </button>
        )}
      </div>

      {/* Delayed items warning banner */}
      {filteredItems.some(i => i.elapsedSec >= 300) && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border-2 border-red-500 rounded-2xl flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-red-600 text-2xl">warning</span>
            <div>
              <p className="font-extrabold text-sm text-red-700 dark:text-red-300 font-sans">
                ⚠️ URGENT: Food Pickup Delayed (&gt;5 mins)
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 font-sans mt-0.5">
                Ready food is sitting uncollected on the pass counter. Collect immediately to ensure hot serving.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredItems.length > 0 ? (
          filteredItems.map(item => {
            const isDelayed = item.elapsedSec >= 300;
            return (
              <div
                key={item.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-soft transition-all flex flex-col justify-between ${
                  isDelayed
                    ? 'border-red-500 border-l-4 dark:hover:border-red-900/40 bg-red-50/20'
                    : item.elapsedSec >= 240
                      ? 'border-l-4 border-l-orange-500'
                      : 'border-l-4 border-l-green-500 border-slate-100'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 font-sans">{item.table}</h2>
                      <span className="inline-flex text-[9px] uppercase tracking-wider font-extrabold text-slate-400 font-sans mt-0.5">
                        {item.station}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isDelayed
                        ? 'bg-red-600 text-white animate-bounce'
                        : item.elapsedSec >= 240
                          ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                          : 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400'
                    }`}>
                      {isDelayed ? '⚠️ PICKUP DELAYED (>5 mins)' : `Ready: ${item.readySince}`}
                    </span>
                  </div>

                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 font-sans">{item.item}</span>
                    <span className="text-xs font-black bg-white dark:bg-slate-800 text-dine-orange border border-slate-200 rounded-lg px-2.5 py-1">
                      Qty: {item.qty}
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => markServed(item.id)}
                    className={`flex-1 font-bold text-xs py-2 px-3 rounded-lg shadow-md transition-all ${
                      isDelayed
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
                        : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/10'
                    }`}
                  >
                    Served to Guest
                  </button>
                  <Link
                    to="/staff/orders"
                    className="border border-slate-100 hover:border-dine-orange text-slate-600 dark:text-slate-350 hover:text-dine-orange font-bold text-xs px-3 py-2 rounded-lg transition-all flex items-center justify-center"
                    title="View Order Details"
                  >
                    Details
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center bg-white border border-slate-100 rounded-2xl p-8 shadow-sm">
            <span className="material-symbols-outlined text-[40px] text-slate-300">check_circle</span>
            <p className="text-sm font-bold text-slate-500 mt-2 font-sans">All food ready is served!</p>
            <p className="text-xs text-slate-400 font-sans mt-0.5">Kitchen is currently preparing active orders.</p>
          </div>
        )}
      </div>
    </div>
  );
}
