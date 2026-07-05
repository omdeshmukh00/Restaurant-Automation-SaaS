import React, { useState, useEffect, useCallback } from 'react';
import { type KitchenOrder as UIKitchenOrder, type OrderStatus, type OrderType } from '../store/kitchenData';
import { useKitchenSearch } from '../components/dashboard/KitchenSearchContext';
import {
  getKitchenOrders,
  acceptOrder,
  startOrder,
  readyOrder,
  rejectOrder,
} from '../api/kitchen.api';
import { connectSocket, getSocket } from '../../../lib/socket';
import { apiClient } from '../../../shared/services/apiClient';

const STATUS_TABS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'all' }, // Treat New tab as 'all' or filter on mapped state
  { label: 'Preparing', value: 'preparing' },
  { label: 'Ready', value: 'ready' },
  { label: 'Delayed', value: 'delayed' },
  { label: 'Completed', value: 'completed' },
];

const TYPE_TABS: { label: string; value: OrderType | 'all' }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Dine In', value: 'dine-in' },
  { label: 'Take Away', value: 'take-away' },
  { label: 'Delivery', value: 'delivery' },
];

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  preparing: 'bg-orange-100 text-orange-700',
  ready: 'bg-green-100 text-green-700',
  delayed: 'bg-red-100 text-red-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-slate-100 text-slate-400',
};

export default function KitchenOrdersPage() {
  const { query } = useKitchenSearch();

  const [orders, setOrders] = useState<UIKitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kitchen_orders_status_filter');
      if (stored) return stored as OrderStatus | 'all';
    }
    return 'all';
  });

  const [typeFilter, setTypeFilter] = useState<OrderType | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kitchen_orders_type_filter');
      if (stored) return stored as OrderType | 'all';
    }
    return 'all';
  });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getKitchenOrders();
      const mapped = raw.map((bo: any): UIKitchenOrder => {
        let status: OrderStatus = 'new';
        const rawStatus = String(bo.status || '').toLowerCase();
        
        if (rawStatus === 'pending') status = 'new';
        else if (rawStatus === 'preparing' || rawStatus === 'confirmed') status = 'preparing';
        else if (rawStatus === 'ready') status = 'ready';
        else if (rawStatus === 'delayed') status = 'delayed';
        else if (rawStatus === 'completed' || rawStatus === 'served') status = 'completed';
        else if (rawStatus === 'cancelled' || rawStatus === 'rejected') status = 'cancelled';

        const items = (bo.items || []).map((item: any) => ({
          name: item.name || item.menuItemId?.name || 'Dish',
          qty: item.quantity || 1,
          price: item.price || 0,
        }));

        const minutes = bo.createdAt ? Math.round((Date.now() - new Date(bo.createdAt).getTime()) / 60000) : 0;
        const timeAgo = minutes <= 0 ? 'Just now' : `${minutes} min${minutes > 1 ? 's' : ''} ago`;
        const time = bo.createdAt
          ? new Date(bo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';

        const tableNum = bo.tableNumber || bo.tableId?.tableNumber || bo.tableId;
        const tableStr = tableNum ? (String(tableNum).startsWith('Table') ? tableNum : `Table ${tableNum}`) : 'Table ?';

        return {
          id: bo._id || bo.id,
          table: tableStr,
          items,
          status,
          type: 'dine-in',
          time,
          timeAgo,
        };
      });
      setOrders(mapped);
    } catch (err) {
      console.error('Failed to fetch kitchen orders', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    if (!socket) return;

    const handleOrderUpdate = () => {
      loadOrders();
    };

    socket.on('order.created', handleOrderUpdate);
    socket.on('order.new', handleOrderUpdate);
    socket.on('order.updated', handleOrderUpdate);

    return () => {
      socket.off('order.created', handleOrderUpdate);
      socket.off('order.new', handleOrderUpdate);
      socket.off('order.updated', handleOrderUpdate);
    };
  }, [loadOrders]);

  const handleStatusFilterChange = (filter: OrderStatus | 'all') => {
    setStatusFilter(filter);
    localStorage.setItem('kitchen_orders_status_filter', filter);
  };

  const handleTypeFilterChange = (filter: OrderType | 'all') => {
    setTypeFilter(filter);
    localStorage.setItem('kitchen_orders_type_filter', filter);
  };

  const filtered = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (typeFilter !== 'all' && o.type !== typeFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return o.id.toLowerCase().includes(q) || o.table.toLowerCase().includes(q) || o.items.some(i => i.name.toLowerCase().includes(q));
    }
    return true;
  });

  const handleAction = async (id: string, newStatus: OrderStatus) => {
    try {
      if (newStatus === 'preparing') {
        await acceptOrder(id);
        await startOrder(id);
      } else if (newStatus === 'ready') {
        await readyOrder(id);
      } else if (newStatus === 'cancelled') {
        await rejectOrder(id);
      } else if (newStatus === 'completed') {
        await apiClient.patch(`/staff/orders/${id}/serve`);
      }
    } catch (err) {
      console.error('Action failed:', err);
    }
    loadOrders();
  };

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-sans">Orders Management</h2>
          <p className="text-sm text-slate-500 font-sans">Track and manage all kitchen orders</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-500 font-sans">{filtered.length} orders</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Status Tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map(({ label, value }) => (
            <button key={value} onClick={() => handleStatusFilterChange(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-colors ${statusFilter === value ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {/* Type Tabs */}
        <div className="flex gap-1 flex-wrap">
          {TYPE_TABS.map(({ label, value }) => (
            <button key={value} onClick={() => handleTypeFilterChange(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-colors ${typeFilter === value ? 'bg-blue-100 text-blue-600' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Table</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-sans">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="ml-1 text-xs font-semibold text-slate-500">Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(order => (
                  <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">#{order.id}</td>
                    <td className="px-6 py-4 text-slate-600 max-w-[200px]">
                      {order.items.map(i => `${i.qty}× ${i.name}`).join(', ')}
                    </td>
                    <td className="px-6 py-4 font-bold text-orange-600">{order.table}</td>
                    <td className="px-6 py-4 text-slate-500 capitalize">{order.type.replace('-', ' ')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_BADGE[order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{order.timeAgo}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5">
                        {order.status === 'new' && (
                          <>
                            <button onClick={() => handleAction(order.id, 'preparing')} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700">Accept</button>
                            <button onClick={() => handleAction(order.id, 'cancelled')} className="px-3 py-1 border border-red-200 text-red-500 rounded-lg text-[10px] font-bold hover:bg-red-50">Reject</button>
                          </>
                        )}
                        {order.status === 'preparing' && (
                          <button onClick={() => handleAction(order.id, 'ready')} className="px-3 py-1 bg-orange-600 text-white rounded-lg text-[10px] font-bold hover:bg-orange-700">Ready</button>
                        )}
                        {order.status === 'ready' && (
                          <button onClick={() => handleAction(order.id, 'completed')} className="px-3 py-1 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700">Pickup</button>
                        )}
                        {order.status === 'delayed' && (
                          <button onClick={() => handleAction(order.id, 'preparing')} className="px-3 py-1 border border-red-200 text-red-500 rounded-lg text-[10px] font-bold">⚡ Rush</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-sans">No orders match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
