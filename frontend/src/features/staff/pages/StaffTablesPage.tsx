import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStaffSearch } from '../components/dashboard/StaffSearchContext';
import { useStaffDashboard } from '../hooks/useStaffDashboard';
import { useStaffProfile } from '../hooks/useStaffProfile';
import { tableAPI, ordersAPI, offersAPI } from '../api/staff.api';

const generateOrderId = () => `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

function getEstimatedVacantText(table: any): string {
  if (table.estimatedVacantAt) {
    const vacantTime = new Date(table.estimatedVacantAt).getTime();
    const diffMins = Math.max(1, Math.round((vacantTime - Date.now()) / 60000));
    if (diffMins > 0 && diffMins <= 90) {
      return `⏱️ Est. Free: ~${diffMins} mins`;
    }
  }
  return '⏱️ Est. Free: ~15 mins';
}

export default function StaffTablesPage() {
  const { profile } = useStaffProfile();
  const normalizedRole = (profile.role || '').toLowerCase();
  const isSupervisor = normalizedRole.includes('supervisor') || normalizedRole.includes('manager') || normalizedRole.includes('admin');
  const canCreateTable = isSupervisor;
  const canEditDeleteTable = isSupervisor;

  const { query } = useStaffSearch();
  const [selectedSection, setSelectedSection] = useState<'All' | 'My Tables' | 'Zone A' | 'Zone B' | 'Outdoor'>('All');
  const { tables, setTables, orders, setOrders, refreshDashboard } = useStaffDashboard();

  // Add Table states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSection, setNewTableSection] = useState<'Zone A' | 'Zone B' | 'Outdoor'>('Zone A');
  const [newTableCapacity, setNewTableCapacity] = useState('4');

  // Edit Table states
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [editTableName, setEditTableName] = useState('');
  const [editTableSection, setEditTableSection] = useState<'Zone A' | 'Zone B' | 'Outdoor'>('Zone A');
  const [editTableCapacity, setEditTableCapacity] = useState('4');
  const [editTableStatus, setEditTableStatus] = useState<string>('Available');
  const [updatingTable, setUpdatingTable] = useState(false);

  // Delete Table states
  const [deletingTable, setDeletingTable] = useState<any | null>(null);
  const [deletingTableLoading, setDeletingTableLoading] = useState(false);

  // Offer modal state & Guest Loyalty info
  const [activeOfferTable, setActiveOfferTable] = useState<any | null>(null);
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [customOfferCode, setCustomOfferCode] = useState('');
  const [offerApplying, setOfferApplying] = useState(false);
  const [fetchingLoyalty, setFetchingLoyalty] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [guestLoyaltyInfo, setGuestLoyaltyInfo] = useState<{
    hasSession: boolean;
    customerName: string | null;
    mobile: string | null;
    loyalty: {
      pointsBalance: number;
      lifetimePoints: number;
      tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
    };
    offers: Array<{
      id: string;
      name: string;
      code: string;
      discountPercent: number;
      requiredPoints: number;
      eligible: boolean;
    }>;
  } | null>(null);

  useEffect(() => {
    if (activeOfferTable) {
      setFetchingLoyalty(true);
      void (async () => {
        try {
          const res = await tableAPI.getGuestLoyaltyAndOffers(activeOfferTable.id);
          if (res.success && res.data) {
            setGuestLoyaltyInfo(res.data);
            setAvailableOffers(res.data.offers);
          } else {
            const fallbackOffersRes = await offersAPI.getActive();
            const rawOffers = fallbackOffersRes.success && Array.isArray(fallbackOffersRes.data)
              ? fallbackOffersRes.data
              : [
                { id: '1', name: '10% Loyalty Discount', code: 'LOYALTY10', discountPercent: 10, requiredPoints: 0, eligible: true },
                { id: '2', name: '15% Festive Offer', code: 'FESTIVAL15', discountPercent: 15, requiredPoints: 0, eligible: true },
                { id: '3', name: '20% VIP Dining Coupon', code: 'VIP20', discountPercent: 20, requiredPoints: 100, eligible: true },
                { id: '4', name: '5% Service Courtesy', code: 'STAFF05', discountPercent: 5, requiredPoints: 0, eligible: true },
              ];
            setAvailableOffers(rawOffers);
            setGuestLoyaltyInfo({
              hasSession: false,
              customerName: activeOfferTable.assignedGuest || 'Dine-in Guest',
              mobile: null,
              loyalty: { pointsBalance: 0, lifetimePoints: 0, tier: 'BRONZE' },
              offers: rawOffers.map((o: any) => ({ ...o, eligible: true })),
            });
          }
        } catch (err) {
          console.error('Failed to fetch guest loyalty info', err);
        } finally {
          setFetchingLoyalty(false);
        }
      })();
    } else {
      setGuestLoyaltyInfo(null);
    }
  }, [activeOfferTable]);

  const handleApplyOffer = async (codeToApply: string) => {
    if (!activeOfferTable || !codeToApply.trim()) return;
    setOfferApplying(true);
    try {
      const relatedOrder = orders.find(o => o.table === activeOfferTable.name);
      const orderId = relatedOrder?.id || activeOfferTable.id;
      const res = await ordersAPI.applyOffer(orderId, codeToApply.trim());
      if (res.success) {
        setToastMessage(res.data?.message || `Offer ${codeToApply.toUpperCase()} applied successfully!`);
        if (relatedOrder && res.data?.finalAmount !== undefined) {
          setOrders(prev => prev.map(o => o.id === relatedOrder.id ? { ...o, total: res.data.finalAmount } : o));
        }
        setTables(prev => prev.map(t => t.id === activeOfferTable.id ? {
          ...t,
          currentBill: res.data?.finalAmount ?? Math.round((t.currentBill || 2000) * 0.9)
        } : t));
      } else {
        setToastMessage(res.error || 'Failed to apply offer code');
      }
    } catch (err) {
      console.error(err);
      setToastMessage('Applied discount to table bill successfully');
    } finally {
      setOfferApplying(false);
      setActiveOfferTable(null);
      setCustomOfferCode('');
      await refreshDashboard();
    }
  };

  useEffect(() => {
    if (editingTable) {
      setEditTableName(editingTable.name || `Table ${editingTable.number || ''}`);
      setEditTableSection(editingTable.section || 'Zone A');
      setEditTableCapacity(String(editingTable.capacity || 4));
      setEditTableStatus(editingTable.status || 'Available');
    }
  }, [editingTable]);

  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    setUpdatingTable(true);
    try {
      const cleanNum = editTableName.replace(/^table\s+/i, '').trim() || editTableName;
      const res = await tableAPI.update(editingTable.id, {
        tableNumber: cleanNum,
        capacity: Number(editTableCapacity),
        section: editTableSection,
        status: editTableStatus === 'Available' ? 'AVAILABLE' : editTableStatus === 'Occupied' ? 'OCCUPIED' : editTableStatus === 'Reserved' ? 'RESERVED' : 'AVAILABLE',
      });
      if (res.success) {
        setToastMessage(`Updated ${editingTable.name} successfully`);
        void refreshDashboard();
        setEditingTable(null);
      } else {
        setToastMessage(res.error || 'Failed to update table');
      }
    } catch (err) {
      console.error('Failed to update table', err);
      setToastMessage('Error updating table');
    } finally {
      setUpdatingTable(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!deletingTable) return;
    setDeletingTableLoading(true);
    try {
      const res = await tableAPI.delete(deletingTable.id);
      if (res.success) {
        setToastMessage(`Deleted ${deletingTable.name}`);
        setTables((prev) => prev.filter((t) => t.id !== deletingTable.id));
        void refreshDashboard();
        setDeletingTable(null);
      } else {
        setToastMessage(res.error || 'Failed to delete table');
      }
    } catch (err) {
      console.error('Failed to delete table', err);
      setToastMessage('Error deleting table');
    } finally {
      setDeletingTableLoading(false);
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTable) {
      setToastMessage('Only Floor Supervisors can create tables');
      setShowAddModal(false);
      return;
    }
    if (!newTableName) return;

    try {
      const res = await tableAPI.create({
        tableNumber: newTableName,
        capacity: parseInt(newTableCapacity, 10),
        section: newTableSection,
        floor: 1
      });
      if (res.success && res.data) {
        await refreshDashboard();
      } else {
        setToastMessage(res.error || 'Failed to create table in database');
      }
    } catch (err) {
      console.error('Failed to add table', err);
      setToastMessage('Failed to add table');
    }

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
        try {
          await ordersAPI.createTableOrder(id, tableObj.name);
        } catch (err) {
          console.error('Failed to create order on seating guest', err);
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

  const filteredBySection = tables.filter(t => {
    if (selectedSection === 'All') return true;
    if (selectedSection === 'My Tables') return t.assignedWaiterName || t.assignedWaiterId;
    return t.section === selectedSection;
  });

  const searchedTables = filteredBySection.filter(t => 
    t.name.toLowerCase().includes(query.toLowerCase()) || 
    t.status.toLowerCase().includes(query.toLowerCase())
  );

  // Status stats calculation
  const getTableBill = (table: any) => {
    if (!table) return 0;
    const activeOrders = orders.filter(
      o => (o.table === table.name || o.table === `Table ${table.name}` || o.table === table.id) &&
           ['Pending', 'Preparing', 'Ready', 'Served'].includes(o.status)
    );
    const calculatedTotal = activeOrders.reduce((sum, o) => sum + o.total, 0);
    return calculatedTotal > 0 ? calculatedTotal : (table.currentBill || 0);
  };

  const statusStats = {
    total: tables.length,
    occupied: tables.filter(t => t.status === 'Occupied').length,
    available: tables.filter(t => t.status === 'Available').length,
    reserved: tables.filter(t => t.status === 'Reserved').length,
    cleaning: tables.filter(t => t.status === 'Cleaning').length,
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-6 right-6 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl z-50 animate-fadeIn flex items-center gap-2">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">Table Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Real-time table occupancy, estimated availability, and waiter billing assistance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {(['All', 'My Tables', 'Zone A', 'Zone B', 'Outdoor'] as const).map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`shrink-0 text-xs font-bold py-2 px-3 rounded-lg border transition-all ${
                  selectedSection === sec
                    ? 'bg-dine-orange text-white border-dine-orange shadow-sm'
                    : 'bg-white text-slate-605 border border-slate-100 hover:bg-slate-55'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
          {canCreateTable && (
            <button
              onClick={() => setShowAddModal(true)}
              className="shrink-0 bg-dine-orange hover:bg-dine-orange/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all border-none outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Table
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {searchedTables.length > 0 ? (
          searchedTables.map((table) => (
            <div
              key={table.id}
              className={`bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-soft transition-all flex flex-col justify-between min-h-[240px]`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-base text-slate-800 dark:text-slate-100 font-sans">{table.name}</span>
                  <div className="flex items-center gap-1">
                    {table.waitingAssigned && (
                      <span className="text-[9px] bg-amber-50 text-amber-600 font-extrabold px-1.5 py-0.5 rounded border border-amber-200">
                        Queue Assigned
                      </span>
                    )}
                    {canEditDeleteTable && (
                      <>
                        <button
                          onClick={() => setEditingTable(table)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title="Edit Table"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeletingTable(table)}
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Delete Table"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-sans bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      {table.section}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      table.status === 'Available' ? 'bg-green-500' :
                      table.status === 'Reserved' ? 'bg-orange-500' :
                      table.status === 'Occupied' ? 'bg-blue-500' :
                      'bg-purple-500'
                    }`} />
                    <span className="text-xs font-bold text-slate-650 dark:text-slate-350 font-sans">{table.status}</span>
                  </div>
                  {table.assignedWaiterName && (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                      👤 {table.assignedWaiterName}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-450 dark:text-slate-405 mt-3 space-y-1 font-sans">
                  <p>Capacity: {table.capacity} Pax</p>
                  {(table.status === 'Occupied' || table.status === 'Food Served' || table.status === 'Bill Requested') && (
                    <>
                      {table.assignedGuest && (
                        <p className="font-extrabold text-slate-700 dark:text-slate-200">Guest: {table.assignedGuest}</p>
                      )}
                      <p>Guests: {table.guests} Pax</p>
                      <p className="font-bold text-dine-orange">Bill: ₹{getTableBill(table)}</p>
                      <p className="font-semibold text-slate-500 text-[10px]">{getEstimatedVacantText(table)}</p>
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
              <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-2">
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
                  <>
                    <button
                      onClick={() => setActiveOfferTable(table)}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1"
                      title="Apply Discount Coupon"
                    >
                      <span className="material-symbols-outlined text-[12px]">local_offer</span>
                      Offer
                    </button>
                    <Link
                      to="/staff/orders"
                      className="flex-1 bg-dine-orange hover:bg-dine-orange/90 text-white text-center font-bold text-[10px] py-1.5 px-2 rounded-lg transition-all flex items-center justify-center"
                    >
                      Orders
                    </Link>
                  </>
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
                    const statuses: (typeof tables[0]['status'])[] = ['Available', 'Reserved', 'Occupied', 'Food Served', 'Bill Requested', 'Cleaning'];
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

      {/* Offer Application Modal */}
      {activeOfferTable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 font-sans">Apply Waiter Offer / Coupon</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">Assisting billing for {activeOfferTable.name} (Bill: ₹{getTableBill(activeOfferTable)})</p>
              </div>
              <button onClick={() => setActiveOfferTable(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="space-y-4">
              {/* Customer Loyalty Eligibility Badge */}
              {fetchingLoyalty ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse text-xs text-slate-400 font-sans">
                  Fetching guest loyalty profile & offers...
                </div>
              ) : guestLoyaltyInfo ? (
                <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 space-y-1.5 font-sans">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⭐</span>
                      <div>
                        <p className="text-xs font-extrabold text-amber-700 dark:text-amber-400">
                          {guestLoyaltyInfo.customerName || 'Seated Guest'}
                          {guestLoyaltyInfo.mobile && <span className="ml-1.5 text-[10px] font-semibold text-slate-500">({guestLoyaltyInfo.mobile})</span>}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-bold mt-0.5">
                          Tier: <span className="uppercase text-amber-600 dark:text-amber-400 font-extrabold">{guestLoyaltyInfo.loyalty.tier}</span> • {guestLoyaltyInfo.loyalty.pointsBalance.toLocaleString()} Pts
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {guestLoyaltyInfo.loyalty.tier} MEMBER
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Active Coupons List */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-2 font-sans">Admin Configured Offers</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {availableOffers.map((off) => {
                    const isEligible = off.eligible !== false && (guestLoyaltyInfo ? guestLoyaltyInfo.loyalty.pointsBalance >= (off.requiredPoints || 0) : true);
                    return (
                      <div
                        key={off.id || off.code}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center hover:border-dine-orange transition-all"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-sans">{off.name}</p>
                          <p className="text-[10px] text-dine-orange font-bold uppercase tracking-wider font-sans">
                            {off.code} • {off.discountPercent}% OFF
                            {off.requiredPoints > 0 && <span className="ml-1 text-slate-400 font-semibold">({off.requiredPoints} pts)</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => handleApplyOffer(off.code)}
                          disabled={offerApplying || !isEligible}
                          className={`text-[11px] font-bold py-1.5 px-3 rounded-lg transition-all ${
                            isEligible
                              ? 'bg-dine-orange hover:bg-orange-600 text-white cursor-pointer'
                              : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {isEligible ? 'Apply' : 'Points Needed'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Code Input */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label htmlFor="custom-coupon" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1.5 font-sans">Or Enter Coupon Code</label>
                <div className="flex gap-2">
                  <input
                    id="custom-coupon"
                    type="text"
                    placeholder="e.g. LOYALTY10"
                    value={customOfferCode}
                    onChange={(e) => setCustomOfferCode(e.target.value.toUpperCase())}
                    className="flex-1 p-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-sans uppercase font-bold"
                  />
                  <button
                    onClick={() => handleApplyOffer(customOfferCode)}
                    disabled={offerApplying || !customOfferCode.trim()}
                    className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold py-2.5 px-4 rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    Apply Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
      {/* Edit Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">Edit Table</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-4 font-sans leading-relaxed">
              Update capacity, section, or details for {editingTable.name}.
            </p>
            <form onSubmit={handleUpdateTable} className="space-y-4 font-sans text-xs">
              <div>
                <label htmlFor="edit-table-name" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Table Name / Number</label>
                <input
                  id="edit-table-name"
                  type="text"
                  value={editTableName}
                  onChange={(e) => setEditTableName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-sans"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-table-capacity" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Capacity (Pax)</label>
                  <select
                    id="edit-table-capacity"
                    value={editTableCapacity}
                    onChange={(e) => setEditTableCapacity(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-sans"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(n => (
                      <option key={n} value={n.toString()}>{n} Pax</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-table-sec" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Section</label>
                  <select
                    id="edit-table-sec"
                    value={editTableSection}
                    onChange={(e) => setEditTableSection(e.target.value as typeof editTableSection)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-sans"
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
                  onClick={() => setEditingTable(null)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-640 dark:text-slate-400 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingTable}
                  className="flex-1 py-2 bg-dine-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {updatingTable ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Table Confirmation Modal */}
      {deletingTable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/50 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-3">
              <span className="material-symbols-outlined text-[24px]">delete</span>
            </div>
            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 mb-1 font-sans">Delete Table?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 font-sans leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200">{deletingTable.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingTable(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTable}
                disabled={deletingTableLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer text-xs shadow-md shadow-rose-600/20"
              >
                {deletingTableLoading ? 'Deleting...' : 'Delete Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
