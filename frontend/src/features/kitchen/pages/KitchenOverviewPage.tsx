import React, { useState, useEffect } from 'react';

// Types
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

// Components & Contexts
import OrderCard from '../components/dashboard/OrderCard';
import { useKitchenSearch } from '../components/dashboard/KitchenSearchContext';
import { useKitchenDashboard } from '../hooks/useKitchenDashboard';
import { 
  acceptOrder, 
  startOrder, 
  readyOrder, 
  delayOrder, 
  rejectOrder, 
  addInternalNote 
} from '../api/kitchen.api';
import { apiClient } from '../../../shared/services/apiClient';
import { POPULAR_ITEMS } from '../constants';
import MenuAvailabilityModal from '../components/MenuAvailabilityModal';
import InternalNotesModal from '../components/InternalNotesModal';
import DelayOrderModal from '../components/DelayOrderModal';

export default function KitchenOverviewPage() {
  const { query } = useKitchenSearch();
  const { ordersById, orderIds, refreshDashboard, executeOptimisticOrderUpdate } = useKitchenDashboard();

  // Modals state
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [notesOrderId, setNotesOrderId] = useState<string | null>(null);
  const [delayModalOrderId, setDelayModalOrderId] = useState<string | null>(null);

  // Mobile drawer state for widgets
  const [isWidgetsOpen, setIsWidgetsOpen] = useState(false);

  const [now, setNow] = useState(() => Date.now());

  // Timer effect to update "time ago" dynamically
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Format and memoize orders
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

  // Active tab state & expansion
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kitchen_overview_active_tab');
      if (stored && stored !== 'CONTROLS') return stored;
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

  // Order Handlers
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

  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/50' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-950/50', text: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-100 dark:bg-orange-900/50' },
    green: { bg: 'bg-green-50 dark:bg-green-950/50', text: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-100 dark:bg-green-900/50' },
    red: { bg: 'bg-red-50 dark:bg-red-950/50', text: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-900/50' },
    slate: { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', iconBg: 'bg-slate-100 dark:bg-slate-800' },
  };

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6 p-3 sm:p-6 lg:p-8 overflow-y-auto h-full bg-slate-50/50 dark:bg-slate-950">
      
      {/* Top Navigation Bar: Status Buttons + Mobile Widget Toggle */}
      <div className="flex flex-col xl:flex-row gap-3 shrink-0 items-stretch xl:items-center justify-between">
        
        {/* Status Tab Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 flex-1">
          {columns.map(({ title, icon, count, color }) => {
            const c = colorMap[color];
            const isActive = activeTab === title;

            return (
              <button
                key={title}
                onClick={() => handleTabChange(title)}
                className={`flex items-center justify-between p-2.5 sm:p-3.5 bg-white dark:bg-slate-900 border rounded-2xl transition-all shadow-xs text-left active:scale-[0.98] ${
                  isActive 
                    ? 'border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-500' 
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className={`p-1.5 sm:p-2 rounded-xl ${c.iconBg} ${c.text} flex items-center justify-center shrink-0`}>
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">{icon}</span>
                  </div>
                  <span className={`font-bold text-[11px] sm:text-xs uppercase tracking-wider ${c.text} font-sans truncate`}>
                    {title}
                  </span>
                </div>
                <span className={`text-[11px] sm:text-xs font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg ${c.bg} ${c.text} font-sans shrink-0 ml-1`}>
                  {String(count).padStart(2, '0')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile/Tablet Widget Toggle Button */}
        <button 
          onClick={() => setIsWidgetsOpen(true)}
          className="xl:hidden flex items-center justify-center gap-2 py-3 px-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-200 shadow-xs active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px] text-orange-500">tune</span>
          <span>Kitchen Widgets & Controls</span>
        </button>
      </div>

      {/* Main Content Layout: Active Column + Responsive Widget Bar */}
      <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-0 overflow-hidden">
        
        {/* Active Column Content */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 sm:p-5 shadow-sm">
          {columns.map(column => {
            if (column.title !== activeTab) return null;
            const c = colorMap[column.color];
            const items = column.items;

            return (
              <div key={column.title} className="flex flex-col h-full min-h-0">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className={`p-1.5 sm:p-2 ${c.iconBg} rounded-xl ${c.text} shrink-0`}>
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">{column.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className={`font-black ${c.text} text-xs sm:text-sm tracking-wide font-sans truncate`}>{column.title}</h3>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium font-sans hidden sm:block">Showing active queue items</p>
                    </div>
                  </div>
                  <span className={`${c.text} font-black text-xs sm:text-sm px-2.5 sm:px-3 py-1 rounded-xl ${c.bg} font-sans shrink-0`}>
                    {String(column.count).padStart(2, '0')} Orders
                  </span>
                </div>

                {/* Cards Container */}
                <div className="space-y-3 sm:space-y-4 overflow-y-auto pr-1 sm:pr-2 flex-1 scrollbar-thin">
                  {(expandedColumns[column.title] ? items : items.slice(0, 5)).map(order => (
                    <OrderCard 
                      key={order.id} 
                      order={order} 
                      onAccept={handleAccept} 
                      onReject={handleReject} 
                      onMarkReady={handleMarkReady} 
                      onDelay={handleDelayClick} 
                      onPickup={() => {}} 
                      onRush={handleRush} 
                      onAddNote={handleAddNote} 
                    />
                  ))}

                  {items.length > 5 && (
                    <button 
                      onClick={() => toggleColumnExpand(column.title)} 
                      className={`w-full text-center py-2.5 sm:py-3 ${c.text} font-bold text-xs font-sans bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 rounded-xl transition-all`}
                    >
                      {expandedColumns[column.title] ? 'Show Less' : `+ ${items.length - 5} More Orders`}
                    </button>
                  )}

                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-slate-400 dark:text-slate-500 text-xs font-sans h-64">
                      <span className="material-symbols-outlined text-[32px] sm:text-[36px] mb-2 opacity-40">inbox</span>
                      No orders found in {column.title.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Right-Side Widget Bar */}
        <div className="hidden xl:flex w-80 shrink-0 flex-col gap-5 overflow-y-auto scrollbar-none pb-4">
          <WidgetContent 
            setIsMenuModalOpen={setIsMenuModalOpen} 
            handleRefreshFeed={handleRefreshFeed} 
          />
        </div>

      </div>

      {/* Mobile/Tablet Slide-over Widget Drawer */}
      {isWidgetsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs xl:hidden animate-fade-in">
          <div className="w-full max-w-sm h-full bg-white dark:bg-slate-900 p-5 overflow-y-auto shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-white font-sans">Kitchen Widgets</h3>
              <button 
                onClick={() => setIsWidgetsOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            
            <div className="flex-1 space-y-5 overflow-y-auto pb-6">
              <WidgetContent 
                setIsMenuModalOpen={setIsMenuModalOpen} 
                handleRefreshFeed={handleRefreshFeed} 
              />
            </div>
          </div>
        </div>
      )}
       
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

// Reusable Widget Content Component to keep code DRY across Desktop & Mobile Drawer
function WidgetContent({ 
  setIsMenuModalOpen, 
  handleRefreshFeed 
}: { 
  setIsMenuModalOpen: (open: boolean) => void; 
  handleRefreshFeed: () => void; 
}) {
  return (
    <>
      {/* Quick Chef Controls Widget */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-3.5">
          <span className="material-symbols-outlined text-red-500 text-[16px]">bolt</span>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white font-sans">Quick Chef Controls</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button 
            onClick={() => setIsMenuModalOpen(true)} 
            className="py-2.5 px-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-red-100 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[15px]">restaurant_menu</span>
            Menu
          </button>
          <button 
            onClick={handleRefreshFeed} 
            className="py-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Kitchen Pressure Gauge Widget */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center">
        <div className="w-full flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-orange-500 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white font-sans">Kitchen Pressure</h3>
        </div>
        
        <div className="relative w-32 h-32 my-1">
          <svg className="w-full h-full" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="70" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="12" strokeLinecap="round" transform="rotate(-90 90 90)" />
            <circle cx="90" cy="90" r="70" fill="none" stroke="#F97316" strokeWidth="12" strokeLinecap="round" transform="rotate(-90 90 90)" strokeDasharray="439.8" strokeDashoffset="96.7" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-800 dark:text-white font-sans">78%</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-sans">Medium Load</span>
          </div>
        </div>

        <div className="w-full grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {[
            { color: 'bg-green-500', label: 'Low', range: '0-40%' },
            { color: 'bg-orange-400', label: 'Medium', range: '41-80%' },
            { color: 'bg-red-500', label: 'High', range: '81-100%' },
            { color: 'bg-red-900', label: 'Critical', range: '100%+' },
          ].map(({ color, label, range }) => (
            <div key={label} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg">
              <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium font-sans">{label}</span>
              <span className="text-[9px] text-slate-400 ml-auto font-sans">{range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Popular Items Widget */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-3.5">
          <span className="material-symbols-outlined text-slate-800 dark:text-slate-200 text-[16px]">trending_up</span>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white font-sans">Popular Items Today</h3>
        </div>
        <div className="space-y-3">
          {POPULAR_ITEMS.slice(0, 4).map(({ name, count, pct }) => (
            <div key={name} className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-200 font-sans">
                <span className="truncate pr-2">{name}</span>
                <span className="text-slate-400 font-medium shrink-0">{count}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}