import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrdersStore, formatTimeAgo } from '../../store/orders.store';
import { useDashboardStore } from '../../store/dashboard.store';

export function RecentOrdersTable(): JSX.Element {
  const navigate = useNavigate();
  const { setSortBy, setActiveTab, setCurrentPage } = useOrdersStore();
  const orders = useDashboardStore((s) => s.recentOrders);

  function handleViewAll() {
    setActiveTab('All');
    setSortBy('time');
    setCurrentPage(1);
    navigate('/admin/orders');
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 transition-colors duration-200">
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-50 dark:border-gray-800">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">Recent Orders</h3>
        <button
          onClick={handleViewAll}
          className="flex items-center gap-1 text-xs font-semibold text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="border-b border-gray-50 dark:border-gray-800">
              <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 sm:px-5 py-3 uppercase tracking-wide">Order</th>
              <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 sm:px-5 py-3 uppercase tracking-wide">Table</th>
              <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 sm:px-5 py-3 uppercase tracking-wide hidden lg:table-cell">Items</th>
              <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 sm:px-5 py-3 uppercase tracking-wide">Total</th>
              <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 sm:px-5 py-3 uppercase tracking-wide">Status</th>
              <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 sm:px-5 py-3 uppercase tracking-wide hidden sm:table-cell">Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                onClick={handleViewAll}
                className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer last:border-b-0"
              >
                <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{order.id}</td>
                <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{order.table}</td>
                <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 dark:text-gray-500 hidden lg:table-cell max-w-[180px] truncate">{order.items}</td>
                <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{order.total}</td>
                <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${order.statusColor}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 sm:px-5 py-3.5 text-xs text-gray-400 dark:text-gray-500 hidden sm:table-cell whitespace-nowrap">
                  {order.timeRaw ? formatTimeAgo(order.timeRaw) : order.time}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}