import React, { useState, useEffect, useRef } from 'react';
import { useCustomerStore } from '../store/customer.store';
import { apiClient } from '../../../shared/services/apiClient';

interface Reservation {
  id: string;
  restaurantId: string;
  restaurantName?: string;
  name: string;
  avatar: string;
  avatarColor: string;
  time: string;
  guests: number;
  tableId?: number | string;
  status: string;
  date: string;
  specialRequest?: string;
  phone: string;
  email: string;
  occasion?: string;
}

const TIME_SLOTS = [
  { time: '06:00 PM', status: 'available' },
  { time: '06:30 PM', status: 'available' },
  { time: '07:00 PM', status: 'available' },
  { time: '07:30 PM', status: 'available' },
  { time: '08:00 PM', status: 'available' },
  { time: '08:30 PM', status: 'limited' },
  { time: '09:00 PM', status: 'limited' },
  { time: '09:30 PM', status: 'available' },
];

const getTodayStr = () => new Date().toISOString().split('T')[0];
const getTomorrowStr = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

const parseTimeTo24h = (time12h: string): string => {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') {
    hours = '00';
  }
  if (modifier === 'PM') {
    hours = String(parseInt(hours, 10) + 12);
  }
  return `${hours.padStart(2, '0')}:${minutes}`;
};

const formatTimeTo12h = (time24h: string): string => {
  if (!time24h) return '07:00 PM';
  if (time24h.includes('AM') || time24h.includes('PM')) {
    return time24h;
  }
  let [hoursStr, minutes] = time24h.split(':');
  let hours = parseInt(hoursStr, 10);
  if (isNaN(hours)) return '07:00 PM';
  const modifier = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${modifier}`;
};

const formatDateReadable = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function CustomerReservationPage() {
  const { profile, diningSession, addNotification } = useCustomerStore();
  const formRef = useRef<HTMLFormElement>(null);

  const [todayStr] = useState(getTodayStr);
  const [tomorrowStr] = useState(getTomorrowStr);

  const [restaurantsList, setRestaurantsList] = useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');

  const [guests, setGuests] = useState('2 Guests');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('07:00 PM');
  const [area, setArea] = useState('Any Preference');
  const [specialRequest, setSpecialRequest] = useState('');
  const [dateTab, setDateTab] = useState<'today' | 'tomorrow' | 'custom'>('today');

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [modifyingId, setModifyingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchRestaurants = async () => {
    try {
      const response = await apiClient.get('/public/landing/data');
      if ((response.data?.success || response.data?.status === 'success') && response.data?.data?.restaurants) {
        setRestaurantsList(response.data.data.restaurants);
        if (diningSession?.restaurantId) {
          setSelectedRestaurantId(diningSession.restaurantId);
        } else if (response.data.data.restaurants.length > 0) {
          setSelectedRestaurantId(response.data.data.restaurants[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch restaurants list', err);
    }
  };

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/users/me/reservations');
      if ((response.data?.success || response.data?.status === 'success') && response.data?.data?.reservations) {
        const mapped: Reservation[] = response.data.data.reservations.map((res: any) => ({
          id: res._id,
          restaurantId: res.restaurantId?._id || res.restaurantId,
          restaurantName: res.restaurantId?.name || 'Amber Table',
          name: res.customerName,
          avatar: res.customerName.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
          avatarColor: 'bg-orange-500',
          time: formatTimeTo12h(res.slot),
          guests: res.guests,
          tableId: res.tableId,
          status: res.status,
          date: res.date,
          specialRequest: res.notes,
          phone: res.mobile,
          email: res.customerEmail || '',
          occasion: res.notes ? 'Custom' : 'Any Preference'
        }));
        setReservations(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch customer reservations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
    fetchReservations();
  }, [diningSession]);

  const handleDateTabChange = (tab: 'today' | 'tomorrow' | 'custom') => {
    setDateTab(tab);
    if (tab === 'today') {
      setDate(todayStr);
    } else if (tab === 'tomorrow') {
      setDate(tomorrowStr);
    }
  };

  const handleDateInputChange = (newDate: string) => {
    setDate(newDate);
    if (newDate === todayStr) {
      setDateTab('today');
    } else if (newDate === tomorrowStr) {
      setDateTab('tomorrow');
    } else {
      setDateTab('custom');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const guestCount = parseInt(guests) || 2;
    const backendSlot = parseTimeTo24h(time);

    try {
      if (modifyingId) {
        const response = await apiClient.patch(`/users/me/reservations/${modifyingId}`, {
          guests: guestCount,
          date,
          slot: backendSlot,
          notes: specialRequest,
        });

        if (response.data?.success || response.data?.status === 'success') {
          addNotification(
            'Reservation Updated! 📅',
            `Your reservation has been modified to ${guestCount} guests on ${formatDateReadable(date)} at ${time}.`,
            'info',
            '/customer/reservations'
          );
          showToast('Reservation updated successfully!', 'success');
          setModifyingId(null);
          fetchReservations();
        }
      } else {
        const response = await apiClient.post('/users/me/reservations', {
          restaurantId: selectedRestaurantId,
          guests: guestCount,
          date,
          slot: backendSlot,
          notes: specialRequest,
        });

        if (response.data?.success || response.data?.status === 'success') {
          addNotification(
            'Reservation Confirmed! 📅',
            `Your table reservation for ${guestCount} guests on ${formatDateReadable(date)} at ${time} is confirmed.`,
            'info',
            '/customer/reservations'
          );
          showToast('Table reserved successfully!', 'success');
          fetchReservations();
        }
      }

      // Reset inputs
      setGuests('2 Guests');
      setDate(todayStr);
      setTime('07:00 PM');
      setArea('Any Preference');
      setSpecialRequest('');
      setDateTab('today');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Action failed. Please try again.', 'error');
    }
  };

  const handleModify = (res: Reservation) => {
    setModifyingId(res.id);
    setSelectedRestaurantId(res.restaurantId);
    setGuests(`${res.guests} Guests`);
    setDate(res.date);
    setTime(res.time);
    setSpecialRequest(res.specialRequest || '');

    if (res.date === todayStr) {
      setDateTab('today');
    } else if (res.date === tomorrowStr) {
      setDateTab('tomorrow');
    } else {
      setDateTab('custom');
    }

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    showToast('Loaded reservation details', 'info');
  };

  const handleCancel = async (id: string) => {
    try {
      const response = await apiClient.patch(`/users/me/reservations/${id}`, {
        status: 'CANCELLED',
      });
      if (response.data?.success || response.data?.status === 'success') {
        addNotification(
          'Reservation Cancelled 📅',
          `Your table reservation has been cancelled.`,
          'info',
          '/customer/reservations'
        );
        showToast('Reservation cancelled', 'info');
        fetchReservations();
        
        if (modifyingId === id) {
          setModifyingId(null);
          setGuests('2 Guests');
          setDate(todayStr);
          setTime('07:00 PM');
          setArea('Any Preference');
          setSpecialRequest('');
          setDateTab('today');
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast('Failed to cancel reservation', 'error');
    }
  };

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto h-full sd-custom-scrollbar relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3.5 rounded-xl border shadow-xl animate-fade-in transition-all font-sans text-sm ${
          toastMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          toastMessage.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {toastMessage.type === 'success' ? 'check_circle' : toastMessage.type === 'error' ? 'error' : 'info'}
          </span>
          <span className="font-bold">{toastMessage.text}</span>
        </div>
      )}

      <div className="mb-6 text-left">
        <h2 className="text-2xl font-bold text-slate-800 font-sans">Table Reservation</h2>
        <p className="text-sm text-slate-600 font-sans mt-1">Reserve your table and enjoy a great dining experience.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Booking Form */}
          <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-orange-500/5 text-left">
            <h3 className="text-base font-bold text-slate-800 mb-5 font-sans">
              {modifyingId ? 'Modify Your Booking' : 'Book Your Table'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Restaurant Dropdown Selector */}
              <div className="space-y-1.5 md:col-span-2">
                <label htmlFor="restaurant-select" className="text-xs font-bold text-slate-700 font-sans">Restaurant</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px]">storefront</span>
                  <select
                    id="restaurant-select"
                    className="w-full h-12 pl-10 pr-4 bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 appearance-none text-sm font-sans shadow-sm"
                    value={selectedRestaurantId}
                    onChange={(e) => setSelectedRestaurantId(e.target.value)}
                    disabled={!!diningSession || !!modifyingId}
                  >
                    {restaurantsList.map((r) => (
                      <option key={r._id || r.id} value={r._id || r.id}>
                        {r.name} ({r.city || 'Mumbai'})
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-slate-400 text-[18px]">expand_more</span>
                </div>
              </div>

              {/* Guests */}
              <div className="space-y-1.5">
                <label htmlFor="guests-select" className="text-xs font-bold text-slate-700 font-sans">Number of Guests</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px]">group</span>
                  <select
                    id="guests-select"
                    className="w-full h-12 pl-10 pr-4 bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 appearance-none text-sm font-sans shadow-sm"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                  >
                    <option>1 Guests</option>
                    <option>2 Guests</option>
                    <option>3 Guests</option>
                    <option>4 Guests</option>
                    <option>6 Guests</option>
                    <option>8 Guests</option>
                    <option>10 Guests</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-slate-400 text-[18px]">expand_more</span>
                </div>
              </div>
              
              {/* Date */}
              <div className="space-y-1.5">
                <label htmlFor="date-input" className="text-xs font-bold text-slate-700 font-sans">Date</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px] pointer-events-none">calendar_today</span>
                  <input
                    id="date-input"
                    type="date"
                    min={todayStr}
                    value={date}
                    onChange={(e) => handleDateInputChange(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm font-sans cursor-pointer shadow-sm"
                  />
                </div>
              </div>

              {/* Time */}
              <div className="space-y-1.5">
                <label htmlFor="time-select" className="text-xs font-bold text-slate-700 font-sans">Time</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px]">schedule</span>
                  <select
                    id="time-select"
                    className="w-full h-12 pl-10 pr-4 bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 appearance-none text-sm font-sans shadow-sm"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  >
                    {TIME_SLOTS.map((t) => (
                      <option key={t.time}>{t.time}</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-slate-400 text-[18px]">expand_more</span>
                </div>
              </div>

              {/* Area */}
              <div className="space-y-1.5">
                <label htmlFor="area-select" className="text-xs font-bold text-slate-700 font-sans">Area Preference <span className="text-slate-400 font-normal">(Optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px]">chair</span>
                  <select
                    id="area-select"
                    className="w-full h-12 pl-10 pr-4 bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 appearance-none text-sm font-sans shadow-sm"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  >
                    <option>Any Preference</option>
                    <option>Indoor</option>
                    <option>Outdoor / Terrace</option>
                    <option>Private Room</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-slate-400 text-[18px]">expand_more</span>
                </div>
              </div>

              {/* Special Request */}
              <div className="md:col-span-2 space-y-1.5">
                <label htmlFor="special-request-textarea" className="text-xs font-bold text-slate-700 font-sans">Special Request <span className="text-slate-400 font-normal">(Optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-4 material-symbols-outlined text-slate-400 text-[20px]">edit_note</span>
                  <textarea
                    id="special-request-textarea"
                    className="w-full min-h-[100px] pt-4 pl-10 pr-4 bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none text-sm font-sans shadow-sm"
                    placeholder="E.g. Birthday celebration, High chair, Window seat"
                    value={specialRequest}
                    onChange={(e) => setSpecialRequest(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-5 flex justify-between items-center">
              <div>
                {modifyingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setModifyingId(null);
                      setGuests('2 Guests');
                      setDate(todayStr);
                      setTime('07:00 PM');
                      setArea('Any Preference');
                      setSpecialRequest('');
                      setDateTab('today');
                      showToast('Cancelled modifications', 'info');
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all font-sans"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-[#FF6B1A] to-[#E65A0A] text-white px-10 py-3 rounded-xl font-bold text-sm shadow-md shadow-orange-500/20 hover:opacity-90 active:scale-95 transition-all font-sans"
              >
                {modifyingId ? 'Update Reservation' : 'Confirm Reservation'}
              </button>
            </div>
          </form>

          {/* Time Slots */}
          <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-orange-500/5 text-left">
            <div className="flex justify-between items-end mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-800 font-sans">Available Time Slots</h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">{formatDateReadable(date)}</p>
              </div>
              <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                {(['today', 'tomorrow', 'custom'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleDateTabChange(tab)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize font-sans transition-all ${
                      dateTab === tab ? 'bg-white shadow-sm text-orange-600' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TIME_SLOTS.map(({ time: slotTime, status }) => {
                const isSelected = time === slotTime;
                const isLimited = status === 'limited';
                return (
                  <button
                    key={slotTime}
                    type="button"
                    onClick={() => setTime(slotTime)}
                    className={`p-4 rounded-xl flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'border-2 border-orange-500 bg-orange-50/30 shadow-md'
                        : 'border border-slate-200 bg-white hover:border-orange-500 text-slate-800'
                    }`}
                  >
                    <span className={`text-sm font-bold font-sans ${isSelected ? 'text-orange-600' : 'text-slate-800'}`}>{slotTime}</span>
                    <span className={`text-[10px] uppercase font-bold font-sans ${isLimited ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {isLimited ? 'Limited' : 'Available'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6 text-left">
          {/* Benefits */}
          <section className="bg-white rounded-2xl p-5 border border-slate-100 shadow-lg shadow-orange-500/5">
            <h3 className="text-base font-bold text-slate-800 mb-4 font-sans">Why Reserve with Us?</h3>
            <div className="space-y-3">
              {[
                { icon: 'verified_user', label: 'Guaranteed Seating', desc: 'Your table will be reserved and ready for you.', color: 'bg-green-100 text-green-600' },
                { icon: 'alarm', label: 'No Waiting', desc: 'Skip the wait and enjoy your time.', color: 'bg-orange-100 text-orange-600' },
                { icon: 'card_giftcard', label: 'Special Occasions', desc: 'Celebrate your special moments with us.', color: 'bg-purple-100 text-purple-600' },
                { icon: 'star', label: 'Best Experience', desc: 'Enjoy personalized service for a memorable dining.', color: 'bg-blue-100 text-blue-600' },
              ].map(({ icon, label, desc, color }) => (
                <div key={label} className="flex items-start gap-3 p-3 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-xl transition-colors cursor-pointer group">
                  <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center shrink-0`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800 font-sans">{label}</h4>
                    <p className="text-xs text-slate-500 font-sans mt-0.5">{desc}</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-[18px] self-center group-hover:translate-x-1 transition-transform">chevron_right</span>
                </div>
              ))}
            </div>
          </section>

          {/* Existing Reservations list */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-orange-500/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-800 font-sans">Your Reservations</h3>
              <span className="text-xs font-bold text-orange-600 font-sans bg-orange-50 px-2 py-0.5 rounded-full">
                {reservations.length}
              </span>
            </div>
            <div className="px-5 pb-5 pt-4">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400 font-sans">
                  <span className="animate-pulse">Loading reservations...</span>
                </div>
              ) : reservations.length > 0 ? (
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1 sd-custom-scrollbar">
                  {reservations.map((res) => (
                    <div key={res.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <div className="h-24 bg-gradient-to-br from-orange-100 via-orange-50 to-orange-100/10 flex items-center justify-center relative">
                        <span className="material-symbols-outlined text-4xl text-orange-500/20">restaurant</span>
                        <div className="absolute top-2 left-3 bg-black/60 text-[9px] font-bold text-white px-2 py-0.5 rounded">
                          {res.restaurantName}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-xs text-slate-800 font-sans">{formatDateReadable(res.date)}</h4>
                            <div className="flex gap-3 mt-1.5">
                              <div className="flex items-center gap-1 text-slate-500 text-[10px] font-sans">
                                <span className="material-symbols-outlined text-[12px] text-slate-400">schedule</span> {res.time}
                              </div>
                              <div className="flex items-center gap-1 text-slate-500 text-[10px] font-sans">
                                <span className="material-symbols-outlined text-[12px] text-slate-400">group</span> {res.guests} Guests
                              </div>
                            </div>
                            {res.specialRequest && (
                              <p className="mt-1.5 text-[10px] text-slate-400 italic font-sans max-w-[170px] truncate" title={res.specialRequest}>
                                &ldquo;{res.specialRequest}&rdquo;
                              </p>
                            )}
                          </div>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase font-sans ${
                            res.status === 'CONFIRMED' || res.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                            res.status === 'CANCELLED' || res.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>{res.status}</span>
                        </div>
                        {res.status !== 'CANCELLED' && res.status !== 'Cancelled' && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleModify(res)}
                              className="flex-1 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition-colors font-sans"
                            >
                              Modify
                            </button>
                            <button
                              onClick={() => handleCancel(res.id)}
                              className="flex-1 py-1.5 border border-red-100 text-red-600 rounded-lg text-[10px] font-bold hover:bg-red-50/50 transition-colors font-sans"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 font-sans">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-30 text-slate-300">calendar_today</span>
                  <p className="text-xs font-semibold text-slate-600">No upcoming reservations</p>
                  <p className="text-[10px] mt-0.5 text-slate-400">Use the form to book your table</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

