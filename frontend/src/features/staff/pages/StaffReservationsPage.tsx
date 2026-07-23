import React, { useState, useEffect } from 'react';
import { useStaffSearch } from '../components/dashboard/StaffSearchContext';
import { useStaffDashboard } from '../hooks/useStaffDashboard';
import { reservationsAPI, tableAPI } from '../api/staff.api';

interface Reservation {
  id: string;
  name: string;
  pax: number;
  time: string;
  phone: string;
  status: 'Confirmed' | 'Seated' | 'Cancelled';
  type: 'Reservation' | 'Walk-in';
  queueNo?: number;
  assignedTable?: string;
}

const generateReservationId = () => `res-${Math.floor(Math.random() * 100000)}`;
const generateOrderId = () => `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
const generateAlertId = () => `alert-${Date.now()}`;

export default function StaffReservationsPage() {
  const { query } = useStaffSearch();
  const { tables, setTables, setAlerts, reservations, setReservations, orders, setOrders, refreshDashboard } = useStaffDashboard();

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Form states for adding entry
  const [entryType, setEntryType] = useState<'Walk-in' | 'Reservation'>('Walk-in');
  const [guestName, setGuestName] = useState('');
  const [guestPax, setGuestPax] = useState('2');
  const [guestPhone, setGuestPhone] = useState('');
  const [bookingTime, setBookingTime] = useState('07:00 PM - 09:00 PM');
  const [showAddForm, setShowAddForm] = useState(false);

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !guestPhone) return;

    const pax = parseInt(guestPax, 10);
    const slot = bookingTime.includes(' - ') ? bookingTime.split(' - ')[0] : bookingTime;
    const normalizedSlot = slot.replace(/\s+/g, '').toUpperCase();
    const payload = {
      customerName: guestName,
      customerEmail: '',
      mobile: guestPhone,
      guests: pax,
      date: new Date().toISOString().slice(0, 10),
      slot: normalizedSlot.includes('PM') || normalizedSlot.includes('AM')
        ? normalizedSlot.replace(/PM|AM/g, '').replace(':', '')
        : slot,
      notes: entryType === 'Walk-in' ? 'Walk-in guest added from staff panel' : 'Reservation added from staff panel',
    };

    try {
      if (entryType === 'Walk-in') {
        const nextQueueNo = reservations.filter(r => r.type === 'Walk-in' && r.status === 'Confirmed').length + 1;
        const newWalkin: Reservation = {
          id: generateReservationId(),
          name: guestName,
          pax,
          time: 'Just added',
          phone: guestPhone,
          status: 'Confirmed',
          type: 'Walk-in',
          queueNo: nextQueueNo
        };
        await reservationsAPI.createReservation(payload);
        setReservations([...reservations, newWalkin]);
        setToast({ message: `Registered Walk-in: ${guestName} (Queue #${nextQueueNo})`, type: 'success' });
      } else {
        const tableToReserve = tables.find(t => t.status === 'Available' && t.capacity >= pax);

        if (tableToReserve) {
          setTables(prev => prev.map(t => t.id === tableToReserve.id ? {
            ...t,
            status: 'Reserved',
            guests: pax,
            assignedGuest: guestName,
            elapsed: bookingTime
          } : t));

          await reservationsAPI.createReservation({
            ...payload,
            tableNumber: tableToReserve.name,
          });

          const newReservation: Reservation = {
            id: generateReservationId(),
            name: guestName,
            pax,
            time: bookingTime,
            phone: guestPhone,
            status: 'Confirmed',
            type: 'Reservation',
            assignedTable: tableToReserve.name
          };
          setReservations([...reservations, newReservation]);
          setToast({ message: `Reserved Table ${tableToReserve.name} for ${guestName} during ${bookingTime}!`, type: 'success' });
        } else {
          await reservationsAPI.createReservation(payload);
          const newReservation: Reservation = {
            id: generateReservationId(),
            name: guestName,
            pax,
            time: bookingTime,
            phone: guestPhone,
            status: 'Confirmed',
            type: 'Reservation'
          };
          setReservations([...reservations, newReservation]);
          setToast({ message: `Reservation Registered: No available table of size ${pax} Pax for ${bookingTime}`, type: 'error' });
        }
      }

      await refreshDashboard();
    } catch (error) {
      console.error('Failed to create reservation', error);
      setToast({ message: 'Unable to sync reservation with the backend right now.', type: 'error' });
    }

    setGuestName('');
    setGuestPhone('');
    setBookingTime('07:00 PM - 09:00 PM');
    setShowAddForm(false);
  };

  const updateStatus = (id: string, status: Reservation['status']) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const seatGuest = async (id: string, pax: number) => {
    const guest = reservations.find(r => r.id === id);
    if (!guest) return;

    const tableToSeat = tables.find(t => t.status === 'Available' && t.capacity >= pax);

    if (tableToSeat) {
      try {
        await reservationsAPI.checkIn(id);
        await tableAPI.occupy(tableToSeat.id);
      } catch (err) {
        console.error('Failed to sync guest seating with backend', err);
      }

      // Seated on empty table successfully
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'Seated' } : r));
      setTables(prev => prev.map(t => t.id === tableToSeat.id ? { ...t, status: 'Occupied', guests: pax, currentBill: 0, assignedGuest: guest.name } : t));

      // Automatically create a new order in order list as well!
      const newOrder = {
        id: generateOrderId(),
        table: tableToSeat.name,
        items: [{ name: 'No food ordered yet', qty: 1, price: 0 }],
        status: 'Pending' as const,
        time: 'Just now',
        total: 0
      };
      setOrders([newOrder, ...orders]);

      // Append success alert to central store alerts
      const newAlert = {
        id: generateAlertId(),
        message: `Guest Seated: ${guest.name} (${pax} Pax) has been seated at ${tableToSeat.name}.`,
        type: 'Reassigned' as const,
        severity: 'Info' as const,
        time: 'Just now'
      };
      setAlerts(prev => [newAlert, ...prev]);
      setToast({ message: `Seated ${guest.name} successfully at ${tableToSeat.name}!`, type: 'success' });
    } else {
      // Seating failed, do not change guest status, guest name stays in waitlist!
      const newAlert = {
        id: generateAlertId(),
        message: `Seating Failed: No available table of size ${pax} Pax for ${guest.name}.`,
        type: 'Delayed' as const,
        severity: 'Warning' as const,
        time: 'Just now'
      };
      setAlerts(prev => [newAlert, ...prev]);
      setToast({ message: `Seating Failed: No available table of size ${pax} Pax for ${guest.name}.`, type: 'error' });
    }
  };

  const notifyCustomer = async (id: string, name: string, phone: string) => {
    try {
      const { queueAPI } = await import('../api/staff.api');
      await queueAPI.notifyCustomer(id);
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'Notified' } : r));
      setToast({ message: `🔔 Table-ready SMS sent to ${name} (${phone})!`, type: 'success' });
    } catch (err) {
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'Notified' } : r));
      setToast({ message: `🔔 Table-ready SMS sent to ${name} (${phone})!`, type: 'success' });
    }
  };

  const filtered = reservations.filter(r => 
    (r.status === 'Confirmed' || r.status === 'Notified') && (
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      r.phone.includes(query) ||
      r.type.toLowerCase().includes(query.toLowerCase())
    )
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">Reservations & Walk-in Queue</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage table bookings and queue waitlist.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-dine-orange hover:bg-dine-orange/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">{showAddForm ? 'close' : 'add'}</span>
          {showAddForm ? 'Cancel Form' : 'Register Walk-in / Reservation'}
        </button>
      </div>

      {/* Guest Form Modal/Card */}
      {showAddForm && (
        <form onSubmit={addEntry} className="bg-white border border-slate-150 p-6 rounded-2xl shadow-soft space-y-4 max-w-xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h2 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 font-sans">Add Guest Entry</h2>
            
            {/* Entry Type Selector Segmented Controls */}
            <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setEntryType('Walk-in')}
                className={`text-[10px] font-bold py-1 px-3 rounded-lg transition-all ${
                  entryType === 'Walk-in' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-655'
                }`}
              >
                Walk-in
              </button>
              <button
                type="button"
                onClick={() => setEntryType('Reservation')}
                className={`text-[10px] font-bold py-1 px-3 rounded-lg transition-all ${
                  entryType === 'Reservation' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-655'
                }`}
              >
                Reservation
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="guest-name" className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-sans">Guest Name</label>
              <input
                id="guest-name"
                type="text"
                required
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="Name"
                className="w-full text-xs font-sans p-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="guest-pax" className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-sans">Number of Guests</label>
              <select
                id="guest-pax"
                value={guestPax}
                onChange={e => setGuestPax(e.target.value)}
                className="w-full text-xs font-sans p-2 border border-slate-200 rounded-xl bg-transparent"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n.toString()}>{n} Pax</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="guest-phone" className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-sans">Phone Number</label>
              <input
                id="guest-phone"
                type="tel"
                required
                value={guestPhone}
                onChange={e => setGuestPhone(e.target.value)}
                placeholder="+91..."
                className="w-full text-xs font-sans p-2 border border-slate-200 rounded-xl"
              />
            </div>
            {entryType === 'Reservation' ? (
              <div>
                <label htmlFor="booking-time" className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-sans">Booking Slot</label>
                <select
                  id="booking-time"
                  value={bookingTime}
                  onChange={e => setBookingTime(e.target.value)}
                  className="w-full text-xs font-sans p-2 border border-slate-200 rounded-xl bg-transparent"
                >
                  <option value="06:00 PM - 08:00 PM">06:00 PM - 08:00 PM</option>
                  <option value="07:00 PM - 09:00 PM">07:00 PM - 09:00 PM</option>
                  <option value="08:00 PM - 10:00 PM">08:00 PM - 10:00 PM</option>
                  <option value="09:00 PM - 11:00 PM">09:00 PM - 11:00 PM</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-sans">Queue Status</label>
                <div className="w-full text-xs font-sans p-2 border border-slate-100 rounded-xl bg-slate-50 text-slate-450 select-none">
                  Auto Queue Assigned
                </div>
              </div>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-dine-orange hover:bg-dine-orange/95 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md transition-all"
          >
            {entryType === 'Walk-in' ? 'Register Guest & Add to Queue' : 'Register Booking Reservation'}
          </button>
        </form>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waitlist Queue (1/3) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-105">
            <span className="material-symbols-outlined text-dine-orange">groups</span>
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 font-sans">Walk-in Waitlist</h2>
          </div>

          <div className="mt-4 space-y-4 flex-1">
            {filtered.filter(r => r.type === 'Walk-in').length > 0 ? (
              filtered.filter(r => r.type === 'Walk-in').map(q => (
                <div
                  key={q.id}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-dine-orange text-white font-black text-xs flex items-center justify-center font-sans">
                        {q.queueNo}
                      </span>
                      <span className="font-extrabold text-xs text-slate-850 dark:text-slate-200 font-sans">{q.name}</span>
                      {q.status === 'Notified' && (
                        <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                          Notified 🔔
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans mt-1">Pax: {q.pax} • Wait: {q.time} • Phone: {q.phone}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => notifyCustomer(q.id, q.name, q.phone)}
                      className={`font-bold text-[10px] py-1.5 px-2.5 rounded-lg transition-all flex items-center gap-1 ${
                        q.status === 'Notified'
                          ? 'bg-purple-600 text-white'
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                      title="Send Table-Ready SMS/Push Notification"
                    >
                      <span className="material-symbols-outlined text-[13px]">notifications_active</span>
                      {q.status === 'Notified' ? 'Re-notify' : 'Notify'}
                    </button>
                    <button
                      onClick={() => seatGuest(q.id, q.pax)}
                      className="bg-green-500 hover:bg-green-655 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition-all"
                    >
                      Seat
                    </button>
                    <button
                      onClick={() => updateStatus(q.id, 'Cancelled')}
                      className="border border-slate-100 text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-all"
                      title="Remove"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-450 text-center py-8">Waitlist is currently empty.</p>
            )}
          </div>
        </div>

        {/* Reservations (2/3) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <span className="material-symbols-outlined text-dine-orange">book_online</span>
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-200 font-sans">Today&apos;s Bookings</h2>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-450 uppercase font-bold tracking-wider">
                  <th className="py-3">Guest</th>
                  <th className="py-3">Pax</th>
                  <th className="py-3">Booking Time</th>
                  <th className="py-3">Contact</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-55">
                {filtered.filter(r => r.type === 'Reservation').length > 0 ? (
                  filtered.filter(r => r.type === 'Reservation').map(res => (
                    <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200 text-xs font-sans">{res.name}</td>
                      <td className="py-3.5 text-slate-500 dark:text-slate-400 text-xs font-sans">{res.pax} Pax</td>
                      <td className="py-3.5 font-semibold text-slate-700 dark:text-slate-350 text-xs font-sans">{res.time}</td>
                      <td className="py-3.5 text-slate-450 dark:text-slate-400 text-xs font-sans">{res.phone}</td>
                      <td className="py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => seatGuest(res.id, res.pax)}
                            className="bg-dine-orange hover:bg-dine-orange/95 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition-all"
                          >
                            Seat Guest
                          </button>
                          <button
                            onClick={() => updateStatus(res.id, 'Cancelled')}
                            className="border border-slate-100 text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-all"
                            title="Cancel Booking"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                      No matching reservations.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-white font-bold font-sans text-xs flex items-center gap-2 animate-fadeIn z-55 ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'
        }`}>
          <span className="material-symbols-outlined text-[16px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
