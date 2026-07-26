import React, { useState, useEffect } from 'react';
import { type UIKitchenOrder } from './KitchenOverviewPage';

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delayed' | 'cancelled' | 'completed';
export type OrderType = 'dine-in' | 'take-away' | 'delivery';
import { useKitchenSearch } from '../components/dashboard/KitchenSearchContext';
import OrderCard from '../components/dashboard/OrderCard';
import InternalNotesModal from '../components/InternalNotesModal';
import DelayOrderModal from '../components/DelayOrderModal';
import {
  acceptOrder,
  startOrder,
  readyOrder,
  rejectOrder,
  delayOrder,
  addInternalNote,
} from '../api/kitchen.api';
import { useKitchenDashboard } from '../hooks/useKitchenDashboard';

const STATUS_TABS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Ready', value: 'ready' },
  { label: 'Delayed', value: 'delayed' },
  { label: 'Completed', value: 'completed' },
];

const TYPE_TABS: { label: string; value: OrderType | 'all' }[] = [
  { label: 'Dine In', value: 'dine-in' },
];

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  preparing: 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
  ready: 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800',
  delayed: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800',
  completed: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  cancelled: 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700/60',
};

export default function KitchenOrdersPage() {
  const { query } = useKitchenSearch();

  const { ordersById, orderIds, refreshDashboard, executeOptimisticOrderUpdate } = useKitchenDashboard();

  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kitchen_orders_view_mode');
      if (stored === 'card' || stored === 'list') return stored;
    }
    return 'list';
  });

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
      if (stored === 'dine-in') return 'dine-in';
    }
    return 'dine-in';
  });

  const [notesOrderId, setNotesOrderId] = useState<string | null>(null);
  const [delayModalOrderId, setDelayModalOrderId] = useState<string | null>(null);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const orders = React.useMemo(() => {
    const rawOrders = orderIds.map(id => ordersById[id]).filter(Boolean);
    return rawOrders.map((bo: any): UIKitchenOrder => {
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

      const minutes = bo.createdAt ? Math.round((now - new Date(bo.createdAt).getTime()) / 60000) : 0;
      const timeAgo = minutes <= 0 ? 'Just now' : `${minutes} min${minutes > 1 ? 's' : ''} ago`;
      const time = bo.createdAt
        ? new Date(bo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

      const tableNum = bo.tableNumber || bo.tableId?.tableNumber || bo.tableId;
      const rawTableStr = tableNum ? String(tableNum).trim() : '';
      const tableStr = rawTableStr
        ? (rawTableStr.toLowerCase().startsWith('table') ? rawTableStr : `Table ${rawTableStr}`)
        : 'Table ?';

      return {
        id: bo._id || bo.id,
        table: tableStr,
        items,
        status,
        type: 'dine-in',
        time,
        timeAgo,
        progress: status === 'preparing' ? 50 : 0,
      };
    });
  }, [orderIds, ordersById, now]);

  const handleViewModeChange = (mode: 'list' | 'card') => {
    setViewMode(mode);
    localStorage.setItem('kitchen_orders_view_mode', mode);
  };

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
    if (newStatus === 'preparing') {
      await executeOptimisticOrderUpdate(id, { status: 'PREPARING' }, async () => {
        await acceptOrder(id, 15);
        return startOrder(id);
      });
      return;
    }
    if (newStatus === 'ready') {
      await executeOptimisticOrderUpdate(id, { status: 'READY' }, () => readyOrder(id));
    } else if (newStatus === 'cancelled') {
      await executeOptimisticOrderUpdate(id, { status: 'REJECTED' }, () => rejectOrder(id));
    }
  };

  const handleNotesSave = async (content: string) => {
    if (!notesOrderId) return;
    const id = notesOrderId;
    setNotesOrderId(null);
    await executeOptimisticOrderUpdate(id, { notes: content }, () => addInternalNote(id, content));
  };

  const handleDelayConfirm = async (delayMinutes: number, reason: string) => {
    if (!delayModalOrderId) return;
    const id = delayModalOrderId;
    setDelayModalOrderId(null);
    await executeOptimisticOrderUpdate(id, { status: 'DELAYED' }, () => delayOrder(id, delayMinutes, reason));
  };

  const selectedNotesOrder = notesOrderId ? orders.find(o => o.id === notesOrderId) : null;
  const selectedDelayOrder = delayModalOrderId ? orders.find(o => o.id === delayModalOrderId) : null;

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto pb-32 lg:pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-sans">Orders Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-sans">Track and manage all kitchen orders</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-sans">{filtered.length} orders</span>

          {/* List vs Card View Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Table List View"
            >
              <span className="material-symbols-outlined text-[16px]">view_list</span>
              <span>List</span>
            </button>
            <button
              onClick={() => handleViewModeChange('card')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'card'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Grid Cards View"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Status Tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleStatusFilterChange(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-colors ${
                statusFilter === value
                  ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Type Tabs */}
        <div className="flex gap-1 flex-wrap">
          {TYPE_TABS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleTypeFilterChange(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-colors ${
                typeFilter === value
                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'card' ? (
        /* Cards Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-24">
          {filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              stretch={true}
              onAccept={(id) => handleAction(id, 'preparing')}
              onReject={(id) => handleAction(id, 'cancelled')}
              onMarkReady={(id) => handleAction(id, 'ready')}
              onDelay={(id) => setDelayModalOrderId(id)}
              onRush={(id) => handleAction(id, 'preparing')}
              onAddNote={(id) => setNotesOrderId(id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500 font-sans">
              No orders match your filters
            </div>
          )}
        </div>
      ) : (
        /* Table List View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mb-24">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Table</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-sans">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="ml-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Loading orders...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(order => (
                    <tr key={order.id} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 font-mono text-xs break-all">
                        {/^[0-9a-fA-F]{24}$/.test(order.id) ? `#${order.id.slice(-6).toUpperCase()}` : order.id}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-[220px]">
                        {order.items.map(i => `${i.qty}× ${i.name}`).join(', ')}
                      </td>
                      <td className="px-6 py-4 font-bold text-orange-600 dark:text-orange-400">{order.table}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 capitalize">{order.type.replace('-', ' ')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_BADGE[order.status]}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 dark:text-slate-500 text-xs">{order.timeAgo}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1.5 items-center">
                          {order.status === 'new' && (
                            <>
                              <button onClick={() => handleAction(order.id, 'preparing')} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95">Accept</button>
                              <button onClick={() => handleAction(order.id, 'cancelled')} className="px-3 py-1 border border-red-200 dark:border-red-900/50 text-red-500 dark:text-red-400 rounded-lg text-[10px] font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition-all active:scale-95">Reject</button>
                            </>
                          )}
                          {order.status === 'preparing' && (
                            <button onClick={() => handleAction(order.id, 'ready')} className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95">Ready</button>
                          )}
                          {order.status === 'ready' && (
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider font-sans">Waiting for Staff</span>
                          )}
                          {order.status === 'delayed' && (
                            <button onClick={() => handleAction(order.id, 'preparing')} className="px-3 py-1 border border-red-200 dark:border-red-900/50 text-red-500 dark:text-red-400 rounded-lg text-[10px] font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition-all active:scale-95">⚡ Rush</button>
                          )}
                          <button onClick={() => setNotesOrderId(order.id)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-1" title="Internal Notes">
                            <span className="material-symbols-outlined text-[16px]">edit_note</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {orders.length > 0 && filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-sans">No orders match your filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Internal Notes Modal */}
      {notesOrderId && (
        <InternalNotesModal
          isOpen={!!notesOrderId}
          onClose={() => setNotesOrderId(null)}
          orderId={notesOrderId}
          onSave={handleNotesSave}
        />
      )}

      {/* Delay Order Modal */}
      {delayModalOrderId && (
        <DelayOrderModal
          isOpen={!!delayModalOrderId}
          onClose={() => setDelayModalOrderId(null)}
          orderId={delayModalOrderId}
          onConfirm={handleDelayConfirm}
        />
      )}
    </div>
  );
}
