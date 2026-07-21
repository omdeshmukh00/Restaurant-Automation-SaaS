import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStaffSearch } from '../components/dashboard/StaffSearchContext';
import { useStaffDashboard } from '../hooks/useStaffDashboard';
import { tableAPI } from '../api/staff.api';

interface Table {
  id: string;
  name: string;
  section: 'Zone A' | 'Zone B' | 'Outdoor';
  capacity: number;
  guests: number;
  status: 'Available' | 'Reserved' | 'Occupied' | 'Cleaning' | 'Bill Requested' | 'Food Served';
  currentBill?: number;
}

const generateOrderId = () => `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

export default function StaffTablesPage() {
  const { query } = useStaffSearch();
  const [selectedSection, setSelectedSection] = useState<'All' | 'Zone A' | 'Zone B' | 'Outdoor'>('All');
  const { tables, setTables, orders, setOrders, refreshDashboard } = useStaffDashboard();

  // Add Table states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSection, setNewTableSection] = useState<'Zone A' | 'Zone B' | 'Outdoor'>('Zone A');
  const [newTableCapacity, setNewTableCapacity] = useState('4');

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName) return;

    const nextId = `temp-${Date.now()}`;
    const newTable = {
      id: nextId,
      name: newTableName,
      section: newTableSection,
      capacity: parseInt(newTableCapacity, 10),
      guests: 0,
      status: 'Available' as const,
      elapsed: '0 mins'
    };

    setTables([...tables, newTable]);
    setNewTableName('');
    setNewTableCapacity('4');
    setNewTableSection('Zone A');
    setShowAddModal(false);
  };

  const updateTableStatus = async (id: string, status: typeof tables[0]['status']) => {
    try {
      if (status === 'Occupied') {
        await tableAPI.occupy(id);
      } else if (status === 'Reserved') {
        await tableAPI.reserve(id);
      } else if (status === 'Available') {
        await tableAPI.updateStatus(id, 'available');
      }
    } catch (err) {
      console.error('Failed to update table status', err);
    }

    if (status === 'Occupied') {
      const tableObj = tables.find(t => t.id === id);
      if (tableObj) {
        const orderExists = orders.some(o => o.table === tableObj.name && ['Pending', 'Preparing', 'Ready', 'Served'].includes(o.status));
        if (!orderExists) {
          const newOrder = {
            id: generateOrderId(),
            table: tableObj.name,
            items: [{ name: 'No food ordered yet', qty: 1, price: 0 }],
            status: 'Pending' as const,
            time: 'Just now',
            total: 0
          };
          setOrders([newOrder, ...orders]);
        }
      }
    }

    setTables(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status,
          guests: status === 'Occupied' ? t.capacity - 1 : 0,
          currentBill: status === 'Occupied' ? 150 : undefined,
          assignedGuest: ['Available', 'Cleaning'].includes(status) ? undefined : t.assignedGuest
        };
      }
      return t;
    }));

    await refreshDashboard();
  };

  const filteredBySection = tables.filter(t => 
    selectedSection === 'All' ? true : t.section === selectedSection
  );

  const searchedTables = filteredBySection.filter(t => 
    t.name.toLowerCase().includes(query.toLowerCase()) || 
    t.status.toLowerCase().includes(query.toLowerCase())
  );

  // Status stats calculation
  const statusStats = {
    total: tables.length,
    occupied: tables.filter(t => t.status === 'Occupied').length,
    available: tables.filter(t => t.status === 'Available').length,
    reserved: tables.filter(t => t.status === 'Reserved').length,
    cleaning: tables.filter(t => t.status === 'Cleaning').length,
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">Table Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Real-time table occupancy and service status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {(['All', 'Zone A', 'Zone B', 'Outdoor'] as const).map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`text-xs font-bold py-2 px-3 rounded-lg border transition-all ${
                  selectedSection === sec
                    ? 'bg-dine-orange text-white border-dine-orange shadow-sm'
                    : 'bg-white text-slate-605 border border-slate-100 hover:bg-slate-55'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-dine-orange hover:bg-dine-orange/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all border-none outline-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Table
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Tables', count: statusStats.total, color: 'border-l-4 border-l-slate-400', valColor: 'text-slate-850 dark:text-slate-200' },
          { label: 'Occupied', count: statusStats.occupied, color: 'border-l-4 border-l-blue-500', valColor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Available', count: statusStats.available, color: 'border-l-4 border-l-green-500', valColor: 'text-green-600 dark:text-green-455' },
          { label: 'Reserved', count: statusStats.reserved, color: 'border-l-4 border-l-orange-500', valColor: 'text-dine-orange' },
          { label: 'Cleaning', count: statusStats.cleaning, color: 'border-l-4 border-l-purple-500', valColor: 'text-purple-600 dark:text-purple-400' },
        ].map((stat, idx) => (
          <div key={idx} className={`bg-white border border-slate-100 rounded-xl p-4 shadow-sm ${stat.color}`}>
            <p className="text-[10px] text-slate-400 font-bold uppercase font-sans">{stat.label}</p>
            <p className={`text-xl font-black font-sans mt-1 ${stat.valColor}`}>{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {searchedTables.length > 0 ? (
          searchedTables.map((table) => (
            <div
              key={table.id}
              className={`bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-soft transition-all flex flex-col justify-between h-56`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-base text-slate-800 dark:text-slate-100 font-sans">{table.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase font-sans bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {table.section}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`w-2 h-2 rounded-full ${
                    table.status === 'Available' ? 'bg-green-500' :
                    table.status === 'Reserved' ? 'bg-orange-500' :
                    table.status === 'Occupied' ? 'bg-blue-500' :
                    'bg-purple-500'
                  }`} />
                  <span className="text-xs font-bold text-slate-650 dark:text-slate-350 font-sans">{table.status}</span>
                </div>
                <div className="text-[11px] text-slate-450 dark:text-slate-405 mt-4 space-y-1 font-sans">
                  <p>Capacity: {table.capacity} Pax</p>
                  {(table.status === 'Occupied' || table.status === 'Food Served' || table.status === 'Bill Requested') && (
                    <>
                      {table.assignedGuest && (
                        <p className="font-extrabold text-slate-700 dark:text-slate-200">Guest: {table.assignedGuest}</p>
                      )}
                      <p>Guests: {table.guests} Pax</p>
                      <p className="font-bold text-dine-orange">Bill: ₹{table.currentBill}</p>
                    </>
                  )}
                  {table.status === 'Reserved' && (
                    <>
                      {table.assignedGuest && (
                        <p className="font-extrabold text-slate-700 dark:text-slate-200">Guest: {table.assignedGuest}</p>
                      )}
                      {table.elapsed && (
                        <p className="font-bold text-dine-orange">Slot: {table.elapsed}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t border-slate-100 pt-3 flex gap-2">
                {table.status === 'Available' && (
                  <button
                    onClick={() => void updateTableStatus(table.id, 'Occupied')}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold text-[10px] py-1.5 px-2 rounded-lg transition-all"
                  >
                    Seat Guests
                  </button>
                )}
                {table.status === 'Cleaning' && (
                  <button
                    onClick={() => void updateTableStatus(table.id, 'Available')}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold text-[10px] py-1.5 px-2 rounded-lg transition-all"
                  >
                    Available
                  </button>
                )}
                {['Occupied', 'Food Served', 'Bill Requested'].includes(table.status) && (
                  <Link
                    to="/staff/orders"
                    className="flex-1 bg-dine-orange hover:bg-dine-orange/90 text-white text-center font-bold text-[10px] py-1.5 px-2 rounded-lg transition-all flex items-center justify-center"
                  >
                    Orders
                  </Link>
                )}
                {table.status === 'Reserved' && (
                  <button
                    onClick={() => void updateTableStatus(table.id, 'Occupied')}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold text-[10px] py-1.5 px-2 rounded-lg transition-all"
                  >
                    Arrived
                  </button>
                )}
                <button
                  onClick={() => {
                    const statuses: Table['status'][] = ['Available', 'Reserved', 'Occupied', 'Food Served', 'Bill Requested', 'Cleaning'];
                    const nextIndex = (statuses.indexOf(table.status) + 1) % statuses.length;
                    void updateTableStatus(table.id, statuses[nextIndex]);
                  }}
                  className="border border-slate-100 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-all flex items-center justify-center"
                  title="Cycle Status"
                >
                  <span className="material-symbols-outlined text-[14px]">sync</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">
            No matching tables found.
          </div>
        )}
      </div>

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">Add Table</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-4 font-sans leading-relaxed">
              Create a new dining or seating table.
            </p>
            <form onSubmit={handleAddTable} className="space-y-4 font-sans text-xs">
              <div>
                <label htmlFor="table-name" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Table Name / Number</label>
                <input
                  id="table-name"
                  type="text"
                  placeholder="e.g. Table 11"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="table-capacity" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Capacity (Pax)</label>
                  <select
                    id="table-capacity"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-slate-200"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(n => (
                      <option key={n} value={n.toString()}>{n} Pax</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="table-sec" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Section</label>
                  <select
                    id="table-sec"
                    value={newTableSection}
                    onChange={(e) => setNewTableSection(e.target.value as typeof newTableSection)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-slate-200"
                  >
                    <option value="Zone A">Zone A</option>
                    <option value="Zone B">Zone B</option>
                    <option value="Outdoor">Outdoor</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-640 dark:text-slate-400 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-dine-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-all active:scale-95 cursor-pointer"
                >
                  Create Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
