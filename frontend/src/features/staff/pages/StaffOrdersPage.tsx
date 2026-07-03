import React, { useState } from 'react';
import { useStaffSearch } from '../components/dashboard/StaffSearchContext';
import { useStaffDashboard } from '../hooks/useStaffDashboard';
import type { Order } from '../store/staff.store';

export default function StaffOrdersPage() {
  const { query } = useStaffSearch();
  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Completed' | 'Cancelled'>('Active');
  const { orders, setOrders, tables, setTables, menuItems } = useStaffDashboard();

  // Item Add Inline Toggles
  const [activeAddingOrderId, setActiveAddingOrderId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedItemQty, setSelectedItemQty] = useState<number>(1);

  const updateOrderStatus = (id: string, newStatus: Order['status']) => {
    setOrders(orders.map(o => {
      if (o.id === id) {
        return {
          ...o,
          status: newStatus,
          rating: newStatus === 'Completed' ? parseFloat((4.2 + Math.random() * 0.8).toFixed(1)) : o.rating
        };
      }
      return o;
    }));
    
    // If order is completed, we can also clear the table's current bill if paid!
    if (newStatus === 'Completed') {
      const orderObj = orders.find(o => o.id === id);
      if (orderObj) {
        setTables(prev => prev.map(t => t.name === orderObj.table ? {
          ...t,
          status: 'Cleaning', // table becomes cleaning after dining is completed!
          currentBill: 0,
          turns: (t.turns || 0) + 1
        } : t));
      }
    }
  };

  // Filter orders by tab
  const tabFiltered = orders.filter(order => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Active') return ['Pending', 'Preparing', 'Ready', 'Served'].includes(order.status);
    if (activeTab === 'Completed') return order.status === 'Completed';
    if (activeTab === 'Cancelled') return order.status === 'Cancelled';
    return true;
  });

  // Filter orders by search query
  const searchedOrders = tabFiltered.filter(order =>
    order.id.toLowerCase().includes(query.toLowerCase()) ||
    order.table.toLowerCase().includes(query.toLowerCase()) ||
    order.items.some(item => item.name.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">Order Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track, update, and settle guest orders.</p>
        </div>
        <button
          onClick={() => {
            const tableNum = prompt("Enter Table Number (e.g. Table 6):");
            if (tableNum) {
              // Check if tableObj matches an existing table to sync active bill
              const tableObj = tables.find(t => t.name.toLowerCase() === tableNum.toLowerCase());

              const newOrder: Order = {
                id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
                table: tableObj ? tableObj.name : tableNum,
                items: [{ name: 'No food ordered yet', qty: 1, price: 0 }],
                status: 'Pending',
                time: 'Just now',
                total: 0
              };
              setOrders([newOrder, ...orders]);

              if (tableObj) {
                setTables(prev => prev.map(t => t.id === tableObj.id ? {
                  ...t,
                  status: t.status === 'Available' ? 'Occupied' : t.status,
                  currentBill: (t.currentBill || 0)
                } : t));
              }
            }
          }}
          className="bg-dine-orange hover:bg-dine-orange/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-dine-orange/10 flex items-center justify-center gap-1.5 transition-all border-none cursor-pointer outline-none"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Order
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {(['Active', 'Completed', 'Cancelled', 'All'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 font-sans text-xs font-bold transition-all relative border-b-2 ${
              activeTab === tab
                ? 'border-dine-orange text-dine-orange'
                : 'border-transparent text-slate-450 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab} Orders
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {searchedOrders.length > 0 ? (
          searchedOrders.map(order => (
            <div
              key={order.id}
              className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-soft transition-all flex flex-col justify-between"
            >
              {/* Top Row: Order ID, Table & Status */}
              <div>
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-sans">{order.table}</span>
                    <span className="text-[10px] text-slate-400 font-sans ml-2">({order.id})</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    order.status === 'Pending' ? 'bg-orange-50 text-dine-orange dark:bg-orange-950/40 dark:text-orange-400 animate-pulse' :
                    order.status === 'Preparing' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' :
                    order.status === 'Ready' ? 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400 animate-bounce' :
                    order.status === 'Served' ? 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400' :
                    order.status === 'Completed' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                    'bg-red-50 text-red-650 dark:bg-red-950/40 dark:text-red-400'
                  }`}>
                    {order.status}
                  </span>
                </div>

                {/* Mid section: Items list */}
                <div className="py-4 space-y-2.5">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">{item.qty}x</span>
                        <span className="font-medium text-slate-750 dark:text-slate-300 font-sans">{item.name}</span>
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 font-sans">₹{item.price * item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom section: Actions & Total */}
              <div className="border-t border-slate-100 pt-3 mt-2 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400 font-sans">Total Amount</span>
                  <span className="text-slate-800 dark:text-slate-150 font-sans text-sm">₹{order.total}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {/* Inline Add Item Form Dropdown */}
                  {activeAddingOrderId === order.id ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-150 dark:border-slate-700 w-full animate-fadeIn font-sans text-xs flex flex-col gap-2.5">
                      <div>
                        <label htmlFor={`dish-select-${order.id}`} className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Select Dish (In Stock)</label>
                        <select
                          id={`dish-select-${order.id}`}
                          value={selectedItemId}
                          onChange={e => setSelectedItemId(e.target.value)}
                          className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        >
                          <option value="">Select dish...</option>
                          {menuItems.filter(item => item.available).map(item => (
                            <option key={item.id} value={item.id.toString()}>{item.name} (₹{item.price})</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                          <label htmlFor={`dish-qty-${order.id}`} className="text-[9px] text-slate-400 font-bold uppercase">Qty:</label>
                          <input
                            id={`dish-qty-${order.id}`}
                            type="number"
                            min="1"
                            max="20"
                            value={selectedItemQty}
                            onChange={e => setSelectedItemQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-12 p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAddingOrderId(null);
                              setSelectedItemId('');
                              setSelectedItemQty(1);
                            }}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-300 transition-all cursor-pointer border-none"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!selectedItemId) return;
                              const selectedMenuItem = menuItems.find(i => i.id.toString() === selectedItemId);
                              if (!selectedMenuItem) return;

                              // Perform item addition logic
                              setOrders(prev => prev.map(o => {
                                if (o.id === order.id) {
                                  const cleanItems = o.items.filter(i => i.name !== 'No food ordered yet');
                                  const existsIdx = cleanItems.findIndex(i => i.name === selectedMenuItem.name);
                                  const nextItems = [...cleanItems];
                                  
                                  if (existsIdx > -1) {
                                    nextItems[existsIdx] = {
                                      ...nextItems[existsIdx],
                                      qty: nextItems[existsIdx].qty + selectedItemQty
                                    };
                                  } else {
                                    nextItems.push({
                                      name: selectedMenuItem.name,
                                      qty: selectedItemQty,
                                      price: selectedMenuItem.price
                                    });
                                  }

                                  const nextTotal = nextItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
                                  
                                  // Sync to table bill
                                  setTables(tbls => tbls.map(t => t.name === o.table ? {
                                    ...t,
                                    currentBill: nextTotal
                                  } : t));

                                  return {
                                    ...o,
                                    items: nextItems,
                                    total: nextTotal
                                  };
                                }
                                return o;
                              }));

                              // Reset
                              setActiveAddingOrderId(null);
                              setSelectedItemId('');
                              setSelectedItemQty(1);
                            }}
                            className="px-3 py-1.5 bg-dine-orange text-white font-bold rounded-lg hover:bg-orange-600 transition-all cursor-pointer border-none"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 w-full">
                      {order.status === 'Ready' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'Served')}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold text-[11px] py-2 px-3 rounded-lg shadow-sm transition-all border-none cursor-pointer"
                        >
                          Mark Served
                        </button>
                      )}
                      {order.status === 'Served' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'Completed')}
                          className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold text-[11px] py-2 px-3 rounded-lg shadow-sm transition-all border-none cursor-pointer"
                        >
                          Collect Payment
                        </button>
                      )}
                      {['Pending', 'Preparing'].includes(order.status) && (
                        <button
                          onClick={() => {
                            setActiveAddingOrderId(order.id);
                            setSelectedItemId('');
                            setSelectedItemQty(1);
                          }}
                          className="flex-1 border border-slate-200 hover:border-dine-orange text-slate-655 hover:text-dine-orange font-bold text-[10px] py-2 px-3 rounded-lg transition-all bg-white cursor-pointer"
                        >
                          + Add Item
                        </button>
                      )}
                      {order.status !== 'Completed' && order.status !== 'Cancelled' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'Cancelled')}
                          className="border border-red-200 hover:border-red-500 text-red-555 font-bold text-[10px] px-2.5 py-2 rounded-lg transition-all bg-white cursor-pointer"
                          title="Cancel Order"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1 font-sans">
                  <span>Ordered {order.time}</span>
                  <span className="flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[10px]">av_timer</span>
                    Kitchen sync active
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">
            No matching orders found.
          </div>
        )}
      </div>
    </div>
  );
}
