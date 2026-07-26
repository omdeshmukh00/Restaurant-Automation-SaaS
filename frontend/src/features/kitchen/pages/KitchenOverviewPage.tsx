import React, { useState, useEffect } from 'react';
export interface UIKitchenOrder {
  id: string;
  table: string;
  items: Array<{ name: string; qty: number; price?: number }>;
  status: 'new' | 'preparing' | 'ready' | 'delayed' | 'cancelled' | 'completed';
  type: string;
  time: string;
  timeAgo: string;
  progress: number;
  serviceFlags?: { isVip?: boolean; isRush?: boolean; allergyAlert?: boolean };
  delayMins?: number;
  delayHistory?: any[];
  internalNotes?: any[];
  chef?: { name: string; avatar?: string };
}
import OrderCard from '../components/dashboard/OrderCard';
import { useKitchenSearch } from '../components/dashboard/KitchenSearchContext';
import { useKitchenDashboard } from '../hooks/useKitchenDashboard';
import { acceptOrder, startOrder, readyOrder, delayOrder, rejectOrder, addInternalNote } from '../api/kitchen.api';
import { apiClient } from '../../../shared/services/apiClient';
import { POPULAR_ITEMS } from '../constants';
import MenuAvailabilityModal from '../components/MenuAvailabilityModal';
import InternalNotesModal from '../components/InternalNotesModal';
import DelayOrderModal from '../components/DelayOrderModal';

export default function KitchenOverviewPage() {
  const { query } = useKitchenSearch();

  const { ordersById, orderIds, refreshDashboard, executeOptimisticOrderUpdate } = useKitchenDashboard();
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
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
      let status: UIKitchenOrder['status'] = 'new';
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

  // Load and save active tab state
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kitchen_overview_active_tab');
      if (stored) return stored;
    }
    return 'NEW ORDERS';
  });

  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    localStorage.setItem('kitchen_overview_active_tab', tabName);
  };

  const toggleColumnExpand = (columnTitle: string) => {
    setExpandedColumns(prev => ({ ...prev, [columnTitle]: !prev[columnTitle] }));
  };

  const filterByQuery = (o: UIKitchenOrder) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return o.id.toLowerCase().includes(q) || o.table.toLowerCase().includes(q) || o.items.some(i => i.name.toLowerCase().includes(q));
  };

  const newOrders = orders.filter(o => o.status === 'new' && filterByQuery(o));
  const preparing = orders.filter(o => o.status === 'preparing' && filterByQuery(o));
  const ready = orders.filter(o => o.status === 'ready' && filterByQuery(o));
  const delayed = orders.filter(o => o.status === 'delayed' && filterByQuery(o));

  const handleAccept = async (id: string) => {
    await executeOptimisticOrderUpdate(id, { status: 'PREPARING' }, async () => {
      await acceptOrder(id, 15);
      return startOrder(id);
    });
  };

  const handleReject = async (id: string) => {
    await executeOptimisticOrderUpdate(id, { status: 'REJECTED' }, () => rejectOrder(id));
  };
  const handleMarkReady = async (id: string) => {
    await executeOptimisticOrderUpdate(id, { status: 'READY' }, () => readyOrder(id));
  };
  const handleDelayClick = (id: string) => { setDelayModalOrderId(id); };

  const handleDelayConfirm = async (delayMinutes: number, reason: string) => {
    if (!delayModalOrderId) return;
    const id = delayModalOrderId;
    setDelayModalOrderId(null);
    await executeOptimisticOrderUpdate(id, { status: 'DELAYED' }, () => delayOrder(id, delayMinutes, reason));
  };

  const handleRush = async (id: string) => {
    await executeOptimisticOrderUpdate(id, { status: 'PREPARING' }, () => startOrder(id));
  };
  const handleRefreshFeed = () => refreshDashboard();
  const handleAddNote = (id: string) => { setNotesOrderId(id); };

  const handleNotesSave = async (content: string) => {
    if (!notesOrderId) return;
    const id = notesOrderId;
    setNotesOrderId(null);
    await executeOptimisticOrderUpdate(id, { notes: content }, () => addInternalNote(id, content));
  };

  const columns = [
    { title: 'NEW ORDERS', icon: 'assignment', count: newOrders.length, color: 'blue', items: newOrders },
    { title: 'PREPARING', icon: 'menu_book', count: preparing.length, color: 'orange', items: preparing },
    { title: 'READY', icon: 'check_circle', count: ready.length, color: 'green', items: ready },
    { title: 'DELAYED', icon: 'schedule', count: delayed.length, color: 'red', items: delayed },
  ];

  const mobileTabs = [
    { title: 'CONTROLS', icon: 'tune', color: 'slate' },
    { title: 'NEW ORDERS', icon: 'assignment', color: 'blue' },
    { title: 'PREPARING', icon: 'menu_book', color: 'orange' },
    { title: 'READY', icon: 'check_circle', color: 'green' },
    { title: 'DELAYED', icon: 'schedule', color: 'red' },
  ];

  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', iconBg: 'bg-blue-100' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', iconBg: 'bg-orange-100' },
    green: { bg: 'bg-green-100', text: 'text-green-600', iconBg: 'bg-green-100' },
    red: { bg: 'bg-red-100', text: 'text-red-600', iconBg: 'bg-red-100' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600', iconBg: 'bg-slate-100' },
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-8 overflow-y-auto lg:overflow-hidden h-full">
      {/* Mobile/Tablet Column Selector Tabs */}
      <div className="flex lg:hidden overflow-x-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-1.5 shrink-0 gap-1.5 mb-2 scrollbar-none">
        {mobileTabs.map(({ title, icon, color }) => {
          const c = colorMap[color];
          const isActive = activeTab === title;
          const column = columns.find(col => col.title === title);
          const count = column ? column.count : null;

          return (
            <button
              key={title}
              onClick={() => handleTabChange(title)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? `${c.bg} ${c.text} shadow-sm`
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{icon}</span>
              <span>{title.split(' ')[0]}</span>
              {count !== null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/50 dark:bg-black/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {String(count).padStart(2, '0')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Order Columns Grid */}
      <div className={`flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 overflow-hidden ${activeTab === 'CONTROLS' ? 'hidden lg:grid' : 'grid'}`}>
        {columns.map(({ title, icon, count, color, items }) => {
          const c = colorMap[color];
          const isTabActive = activeTab === title;
          return (
            <div key={title} className={`flex-col gap-4 min-h-0 ${isTabActive ? 'flex' : 'hidden lg:flex'}`}>
              {/* Column Header */}
              <div className="flex items-center justify-between px-1 shrink-0">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 ${c.iconBg} rounded ${c.text}`}>
                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                  </div>
                  <h3 className={`font-bold ${c.text} text-sm tracking-wide font-sans`}>{title}</h3>
                </div>
                <span className={`${c.text} font-bold text-sm font-sans`}>{String(count).padStart(2, '0')}</span>
              </div>
              {/* Cards */}
              <div className="space-y-4 overflow-y-auto pr-1 flex-1" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                {(expandedColumns[title] ? items : items.slice(0, 3)).map(order => (
                  <OrderCard key={order.id} order={order} onAccept={handleAccept} onReject={handleReject} onMarkReady={handleMarkReady} onDelay={handleDelayClick} onPickup={() => {}} onRush={handleRush} onAddNote={handleAddNote} />
                ))}
                {items.length > 3 && (
                  <button onClick={() => toggleColumnExpand(title)} className={`w-full text-center py-2 ${c.text} font-bold text-xs font-sans bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors`}>
                    {expandedColumns[title] ? 'Show Less' : `+ ${items.length - 3} More Orders`}
                  </button>
                )}
                {items.length === 0 && (
                  <div className="text-center text-slate-400 dark:text-slate-500 text-xs font-sans py-8">No orders</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right Sidebar / Controls Section */}
      <div
        className={`w-full lg:w-72 xl:w-80 shrink-0 ${
          activeTab === 'CONTROLS' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
        } overflow-y-auto max-h-[calc(100vh-210px)] lg:max-h-[calc(100vh-140px)] pb-16 lg:pb-0`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 pb-6 lg:pb-0">
          {/* Quick Chef Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-red-500 text-sm">⚡</span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white font-sans">Quick Chef Controls</h3>
            </div>
            <div className="space-y-3">
              <button onClick={() => setIsMenuModalOpen(true)} className="w-full py-3 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-100/80 dark:border-red-900/50 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/60 font-sans transition-colors active:scale-[0.98]">
                <span className="material-symbols-outlined text-[18px]">restaurant_menu</span>
                Menu Availability
              </button>
              <button onClick={handleRefreshFeed} className="w-full py-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 font-sans transition-colors active:scale-[0.98]">
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Refresh Feed
              </button>
            </div>
          </div>

          {/* Kitchen Pressure Gauge */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center">
            <div className="w-full flex items-center gap-2 mb-6">
              <span className="text-orange-500 text-sm">🔥</span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white font-sans">Kitchen Pressure</h3>
            </div>
            <div className="relative w-44 h-44 mb-6">
              <svg className="w-full h-full" viewBox="0 0 180 180">
                <circle cx="90" cy="90" r="70" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="12" strokeLinecap="round" transform="rotate(-90 90 90)" />
                <circle cx="90" cy="90" r="70" fill="none" stroke="#F97316" strokeWidth="12" strokeLinecap="round" transform="rotate(-90 90 90)" strokeDasharray="439.8" strokeDashoffset="96.7" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-slate-800 dark:text-white font-sans">78%</span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mt-1 font-sans">Medium Load</span>
              </div>
            </div>
            <div className="w-full grid grid-cols-2 gap-y-3 gap-x-4">
              {[
                { color: 'bg-green-500', label: 'Low', range: '0-40%' },
                { color: 'bg-orange-400', label: 'Medium', range: '41-80%' },
                { color: 'bg-red-500', label: 'High', range: '81-100%' },
                { color: 'bg-red-900', label: 'Critical', range: '100%+' },
              ].map(({ color, label, range }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium font-sans">{label}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 ml-auto font-sans">{range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Popular Items */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-slate-800 text-[16px]">trending_up</span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 font-sans">Popular Items Today</h3>
            </div>
            <div className="space-y-4">
              {POPULAR_ITEMS.map(({ name, count, pct }) => (
                <div key={name} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-700 font-sans">
                    <span>{name}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full">
                    <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-5 text-blue-600 font-bold text-xs hover:underline font-sans">View All Items</button>
          </div>
        </div>
      </div>


      <InternalNotesModal
        isOpen={!!notesOrderId}
        onClose={() => setNotesOrderId(null)}
        onSave={handleNotesSave}
        orderId={notesOrderId || ''}
      />

      <DelayOrderModal
        isOpen={!!delayModalOrderId}
        onClose={() => setDelayModalOrderId(null)}
        onConfirm={handleDelayConfirm}
        orderId={delayModalOrderId || ''}
      />

      <MenuAvailabilityModal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
      />
    </div>
  );
}
