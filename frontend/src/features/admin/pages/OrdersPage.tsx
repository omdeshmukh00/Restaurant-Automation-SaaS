import React, { useEffect } from 'react';
import { useOrdersStore, deriveOrderStats, getFilteredOrders } from '../store/orders.store';
import {
  OrdersHeader,
  OrdersStatCards,
  OrdersTabBar,
  OrdersTable,
  OrdersPagination,
} from '../components/orders';

const DATE_LABELS: Record<string, string> = {
  all: 'All',
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  custom: 'Custom',
};

export default function OrdersPage() {
  const {
    allOrders, activeTab, searchQuery,
    currentPage, perPage, sortBy,
    paymentFilter, minAmount, maxAmount,
    fetchOrders,
    dateFilter,
  } = useOrdersStore();

  // Fetch the full list once on mount. All filters (date, payment, search,
  // amount, status tab) are applied client-side, so toggling them does not
  // require a refetch — the store also refreshes after create/delete.
  useEffect(() => {
    fetchOrders().catch((error) => {
      console.error('Failed to load admin orders:', error);
    });
  }, [fetchOrders]);

  // Single filtered scope (date + payment + search + amount), excluding the
  // status tab — reused by the stat cards and the table view below.
  const statsScope = getFilteredOrders(allOrders, {
    dateFilter, paymentFilter, searchQuery, minAmount, maxAmount,
  });

  const stats = deriveOrderStats(statsScope);

  const scopeParts: string[] = [];
  if (dateFilter !== 'all') scopeParts.push(DATE_LABELS[dateFilter] ?? dateFilter);
  if (paymentFilter !== 'All') scopeParts.push(paymentFilter);
  if (searchQuery) scopeParts.push(`"${searchQuery}"`);
  const scopeNote = scopeParts.length ? scopeParts.join(' · ') : 'All orders';

  // Table view additionally narrows by the active status tab.
  const byTab     = statsScope.filter((o) => activeTab === 'All' || o.status === activeTab);
  const sorted    = sortBy === 'time' ? [...byTab].sort((a, b) => b.timeRaw - a.timeRaw) : byTab;
  const paginated = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-4 sm:space-y-5">
      <OrdersHeader />
      <OrdersStatCards stats={stats} scopeNote={scopeNote} />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
        <OrdersTabBar />
        <OrdersTable orders={paginated} />
        <OrdersPagination totalFiltered={sorted.length} />
      </div>
    </div>
  );
}
