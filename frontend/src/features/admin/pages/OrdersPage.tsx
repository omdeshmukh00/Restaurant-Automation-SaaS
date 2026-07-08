import React, { useEffect } from 'react';
import { useOrdersStore } from '../store/orders.store';
import {
  OrdersHeader,
  OrdersStatCards,
  OrdersTabBar,
  OrdersTable,
  OrdersPagination,
} from '../components/orders';

export default function OrdersPage() {
  const {
    orders, activeTab, searchQuery,
    currentPage, perPage, sortBy,
    paymentFilter, minAmount, maxAmount,
    fetchOrders,
    dateFilter,
  } = useOrdersStore();

  useEffect(() => {
    fetchOrders().catch((error) => {
      console.error('Failed to load admin orders:', error);
    });
  }, [fetchOrders, activeTab, searchQuery, currentPage, perPage, sortBy, paymentFilter, minAmount, maxAmount, dateFilter]);

  const filterByDate = (order: typeof orders[number]) => {
    if (dateFilter === 'all') return true;

    const orderDate = new Date(order.date + 'T00:00:00');
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let start: Date;
    let end: Date | null = null;

    switch (dateFilter) {
      case 'today':
        start = startOfToday;
        end = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'yesterday':
        start = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        end = startOfToday;
        break;
      case 'last7':
        start = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
        end = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'last30':
        start = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);
        end = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        break;
      default:
        return true;
    }

    if (end) {
      return orderDate >= start && orderDate < end;
    }

    return orderDate >= start;
  };

  const byTab     = orders.filter((o) => activeTab === 'All' || o.status === activeTab);
  const byDate    = byTab.filter(filterByDate);
  const bySearch  = byDate.filter((o) => {
    const q = searchQuery.toLowerCase();
    return !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.table.toLowerCase().includes(q);
  });
  const byPayment = bySearch.filter((o) => paymentFilter === 'All' || o.payment === paymentFilter);
  const byAmount  = byPayment.filter((o) => {
    const min = minAmount !== '' ? Number(minAmount) : null;
    const max = maxAmount !== '' ? Number(maxAmount) : null;
    if (min !== null && o.amountRaw < min) return false;
    if (max !== null && o.amountRaw > max) return false;
    return true;
  });
  const sorted    = sortBy === 'time' ? [...byAmount].sort((a, b) => a.timeRaw - b.timeRaw) : byAmount;
  const paginated = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-4 sm:space-y-5">
      <OrdersHeader />
      <OrdersStatCards />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
        <OrdersTabBar />
        <OrdersTable orders={paginated} />
        <OrdersPagination totalFiltered={sorted.length} />
      </div>
    </div>
  );
}