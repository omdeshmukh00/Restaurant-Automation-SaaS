import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useCustomerStore } from '../store/customer.store';
import { apiClient } from '../../../shared/services/apiClient';

type Reservation = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  guestName: string;
  partySize: number;
  date: string;
  time: string;
  status: string;
  occasion: string;
  seating: string;
  notes: string;
};

// Restaurant serving window: 11:00 AM to 10:30 PM, in 30-minute increments.
const SERVICE_START_HOUR = 11;
const SERVICE_END_HOUR = 22;
const SLOT_INTERVAL_MINUTES = 30;

// A few slots are flagged as "limited" so the UI can hint at lower availability.
const LIMITED_SLOTS = new Set(['01:00 PM', '07:30 PM', '08:00 PM', '09:00 PM']);

function formatSlotTime(hour24: number, minute: number): string {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minStr = minute.toString().padStart(2, '0');
  return `${hour12.toString().padStart(2, '0')}:${minStr} ${period}`;
}

function buildTimeSlots(): { time: string; status: 'available' | 'limited' }[] {
  const slots: { time: string; status: 'available' | 'limited' }[] = [];
  for (let h = SERVICE_START_HOUR; h <= SERVICE_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_INTERVAL_MINUTES) {
      if (h === SERVICE_END_HOUR && m > 30) break;
      const time = formatSlotTime(h, m);
      slots.push({ time, status: LIMITED_SLOTS.has(time) ? 'limited' : 'available' });
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

function isSlotInPast(dateStr: string, slotTime: string): boolean {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slotTime.trim());
  if (!match) return false;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  const [y, mo, d] = dateStr.split('-').map(Number);
  if (!y || !mo || !d) return false;

  const slotDate = new Date(y, mo - 1, d, hour, minute, 0, 0);
  return slotDate.getTime() <= Date.now();
}

const getTodayStr = () => new Date().toISOString().split('T')[0];

const getTomorrowStr = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

const parseTimeTo24h = (time12h: string): string => {
  const [time, modifier] = time12h.split(' ');
  const [hoursStr, minutes] = time.split(':');
  let hours = hoursStr;

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

  const [hoursStr, minutes] = time24h.split(':');
  let hours = parseInt(hoursStr, 10);
  if (isNaN(hours)) return '07:00 PM';

  const modifier = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${modifier}`;
};

const formatDateReadable = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export default function CustomerReservationPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const routeState = (location.state as { restaurantId?: string; restaurantName?: string } | null) ?? null;
  const navRestaurantId = routeState?.restaurantId || searchParams.get('restaurantId') || '';
  const navRestaurantName = routeState?.restaurantName || '';

  const { diningSession, addNotification } = useCustomerStore();
  const formRef = useRef<HTMLFormElement>(null);

  const [todayStr] = useState(getTodayStr);
  const [tomorrowStr] = useState(getTomorrowStr);
  const firstValidSlot = TIME_SLOTS.find((slot) => !isSlotInPast(todayStr, slot.time))?.time ?? TIME_SLOTS[0].time;

  const [restaurantsList, setRestaurantsList] = useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(navRestaurantId);
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  const [guests, setGuests] = useState('2 Guests');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(firstValidSlot);
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

  const ensureValidTime = (dateStr: string, currentTime: string) => {
    if (!isSlotInPast(dateStr, currentTime)) return;
    const valid = TIME_SLOTS.find((slot) => !isSlotInPast(dateStr, slot.time))?.time ?? TIME_SLOTS[0].time;
    setTime(valid);
  };

  const fetchRestaurants = async () => {
    try {
      const response = await apiClient.get('/public/landing/data');
      if ((response.data?.success || response.data?.status === 'success') && response.data?.data?.restaurants) {
        const list = response.data.data.restaurants;
        setRestaurantsList(list);

        const targetId =
          navRestaurantId ||
          selectedRestaurantId ||
          diningSession?.restaurantId ||
          (list.length > 0 ? String(list[0]._id || list[0].id) : '');

        if (targetId) {
          setSelectedRestaurantId(String(targetId));
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
        const mapped: Reservation[] = response.data.data.reservations.map((reservation: any) => ({
          id: String(reservation._id || reservation.id || ''),
          restaurantId: String(reservation.restaurantId?._id || reservation.restaurantId || ''),
          restaurantName: reservation.restaurantId?.name || navRestaurantName || 'Restaurant',
          guestName: reservation.customerName || '',
          partySize: Number(reservation.guests) || 1,
          date: reservation.date || '',
          time: formatTimeTo12h(reservation.slot || ''),
          status: reservation.status || 'PENDING',
          occasion: reservation.occasion || '',
          seating: reservation.preferredArea || 'Any Preference',
          notes: reservation.notes || '',
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
    void fetchRestaurants();
    void fetchReservations();
  }, [diningSession?.restaurantId, navRestaurantId]);

  const resetForm = () => {
    setModifyingId(null);
    setGuests('2 Guests');
    setDate(todayStr);
    setTime(firstValidSlot);
    setArea('Any Preference');
    setSpecialRequest('');
    setDateTab('today');
  };

  const handleDateTabChange = (tab: 'today' | 'tomorrow' | 'custom') => {
    setDateTab(tab);
    let nextDate = date;

    if (tab === 'today') {
      nextDate = todayStr;
      setDate(todayStr);
    } else if (tab === 'tomorrow') {
      nextDate = tomorrowStr;
      setDate(tomorrowStr);
    }

    ensureValidTime(nextDate, time);
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

    ensureValidTime(newDate, time);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const guestCount = parseInt(guests, 10) || 2;
    const backendSlot = parseTimeTo24h(time);

    try {
      if (modifyingId) {
        const response = await apiClient.patch(`/users/me/reservations/${modifyingId}`, {
          guests: guestCount,
          date,
          slot: backendSlot,
          notes: specialRequest,
          occasion: area,
          preferredArea: area,
        });

        if (response.data?.success || response.data?.status === 'success') {
          await fetchReservations();
          addNotification(
            'Reservation Updated! 📅',
            `Your reservation has been modified to ${guestCount} guests on ${formatDateReadable(date)} at ${time}.`,
            'info',
            '/customer/reservations',
          );
          showToast('Reservation updated successfully!', 'success');
          resetForm();
        }
        return;
      }

      if (!selectedRestaurantId) {
        showToast('Please select a restaurant first.', 'error');
        return;
      }

      const response = await apiClient.post('/users/me/reservations', {
        restaurantId: selectedRestaurantId,
        guests: guestCount,
        date,
        slot: backendSlot,
        notes: specialRequest,
        occasion: area,
        preferredArea: area,
      });

      if (response.data?.success || response.data?.status === 'success') {
        await fetchReservations();
        addNotification(
          'Reservation Confirmed! 📅',
          `Your table reservation for ${guestCount} guests on ${formatDateReadable(date)} at ${time} is confirmed.`,
          'info',
          '/customer/reservations',
        );
        showToast('Table reserved successfully!', 'success');
        resetForm();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Action failed. Please try again.', 'error');
    }
  };

  const handleModify = (reservation: Reservation) => {
    setModifyingId(reservation.id);
    setSelectedRestaurantId(reservation.restaurantId);
    setGuests(`${reservation.partySize} Guests`);
    setDate(reservation.date);
    setTime(reservation.time);
    setArea(reservation.seating || 'Any Preference');
    setSpecialRequest(reservation.notes || '');

    if (reservation.date === todayStr) {
      setDateTab('today');
    } else if (reservation.date === tomorrowStr) {
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
        await fetchReservations();
        addNotification(
          'Reservation Cancelled 📅',
          'Your table reservation has been cancelled.',
          'info',
          '/customer/reservations',
        );
        showToast('Reservation cancelled', 'info');

        if (modifyingId === id) {
          resetForm();
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast('Failed to cancel reservation', 'error');
    }
  };

  const filteredRestaurants = restaurantsList.filter((restaurant) => {
    if (!modalSearchQuery) return true;
    const query = modalSearchQuery.toLowerCase();
    return (
      restaurant.name?.toLowerCase().includes(query) ||
      restaurant.city?.toLowerCase().includes(query) ||
      restaurant.address?.toLowerCase().includes(query) ||
      restaurant.cuisine?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto h-full sd-custom-scrollbar relative">
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3.5 rounded-xl border shadow-xl animate-fade-in transition-all font-sans text-sm ${
          toastMessage.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : toastMessage.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
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
        <div className="lg:col-span-8 space-y-6">
          <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-orange-500/5 text-left">
            <h3 className="text-base font-bold text-slate-800 mb-5 font-sans">
              {modifyingId ? 'Modify Your Booking' : 'Book Your Table'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="restaurant-select" className="text-xs font-bold text-slate-700 font-sans">
                    Restaurant
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsSelectModalOpen(true)}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer font-sans"
                  >
                    <span className="material-symbols-outlined text-[14px]">search</span>
                    <span>Browse &amp; Search All</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px] pointer-events-none">
                    storefront
                  </span>
                  <select
                    id="restaurant-select"
                    className="w-full h-12 pl-10 pr-24 bg-white text-slate-800 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 appearance-none text-sm font-sans shadow-sm cursor-pointer"
                    value={selectedRestaurantId}
                    onChange={(e) => setSelectedRestaurantId(e.target.value)}
                    disabled={!!modifyingId}
                  >
                    {restaurantsList.length === 0 ? (
                      <option value="">Loading restaurants...</option>
                    ) : (
                      restaurantsList.map((restaurant) => (
                        <option key={restaurant._id || restaurant.id} value={restaurant._id || restaurant.id}>
                          {restaurant.name} ({restaurant.city || restaurant.address || 'Mumbai'})
                        </option>
                      ))
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsSelectModalOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer font-sans"
                  >
                    <span>Search</span>
                    <span className="material-symbols-outlined text-[16px]">search</span>
                  </button>
                </div>
              </div>

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
                    {TIME_SLOTS.map(({ time: slotTime }) => {
                      const past = isSlotInPast(date, slotTime);
                      return (
                        <option key={slotTime} value={slotTime} disabled={past}>
                          {slotTime}{past ? ' (Unavailable)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-slate-400 text-[18px]">expand_more</span>
                </div>
              </div>

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
                      resetForm();
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
                const isPast = isSlotInPast(date, slotTime);

                return (
                  <button
                    key={slotTime}
                    type="button"
                    disabled={isPast}
                    onClick={() => !isPast && setTime(slotTime)}
                    className={`p-4 rounded-xl flex flex-col items-center gap-1 transition-all ${
                      isPast
                        ? 'border border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'border-2 border-orange-500 bg-orange-50/30 shadow-md'
                          : 'border border-slate-200 bg-white hover:border-orange-500 text-slate-800'
                    }`}
                  >
                    <span className={`text-sm font-bold font-sans ${isSelected ? 'text-orange-600' : 'text-slate-800'}`}>{slotTime}</span>
                    <span className={`text-[10px] uppercase font-bold font-sans ${
                      isPast ? 'text-slate-400' : isLimited ? 'text-orange-600' : 'text-emerald-600'
                    }`}>
                      {isPast ? 'Unavailable' : isLimited ? 'Limited' : 'Available'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-6 text-left">
          <section className="bg-white dark:bg-sd-surface rounded-2xl p-5 border border-slate-100 dark:border-sd-surface-variant shadow-lg shadow-orange-500/5">
            <h3 className="text-base font-bold text-slate-800 dark:text-sd-on-surface mb-4 font-sans">Why Reserve with Us?</h3>
            <div className="space-y-3">
              {[
                { icon: 'verified_user', label: 'Guaranteed Seating', desc: 'Your table will be reserved and ready for you.', color: 'bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400' },
                { icon: 'alarm', label: 'No Waiting', desc: 'Skip the wait and enjoy your time.', color: 'bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400' },
                { icon: 'card_giftcard', label: 'Special Occasions', desc: 'Celebrate your special moments with us.', color: 'bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400' },
                { icon: 'star', label: 'Best Experience', desc: 'Enjoy personalized service for a memorable dining.', color: 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' },
              ].map(({ icon, label, desc, color }) => (
                <div key={label} className="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-sd-surface-container-low border border-transparent hover:border-slate-100 dark:hover:border-sd-surface-variant rounded-xl transition-colors cursor-pointer group">
                  <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center shrink-0`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-sd-on-surface font-sans">{label}</h4>
                    <p className="text-xs text-slate-500 dark:text-sd-on-surface-variant font-sans mt-0.5">{desc}</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 dark:text-sd-on-surface-variant/70 text-[18px] self-center group-hover:translate-x-1 transition-transform">chevron_right</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-sd-surface rounded-2xl border border-slate-100 dark:border-sd-surface-variant shadow-lg shadow-orange-500/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 dark:border-sd-surface-variant flex justify-between items-center bg-slate-50/50 dark:bg-sd-surface-container-low">
              <h3 className="text-base font-bold text-slate-800 dark:text-sd-on-surface font-sans">Your Reservations</h3>
              <span className="text-xs font-bold text-orange-600 dark:text-sd-primary font-sans bg-orange-50 dark:bg-sd-primary-container/20 px-2 py-0.5 rounded-full">
                {reservations.length}
              </span>
            </div>
            <div className="px-5 pb-5 pt-4">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400 dark:text-sd-on-surface-variant font-sans">
                  <span className="animate-pulse">Loading reservations...</span>
                </div>
              ) : reservations.length > 0 ? (
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1 sd-custom-scrollbar">
                  {reservations.map((reservation) => (
                    <div key={reservation.id} className="border border-slate-100 dark:border-sd-surface-variant rounded-2xl overflow-hidden bg-white dark:bg-sd-surface-container shadow-sm">
                      <div className="h-24 bg-gradient-to-br from-orange-100 via-orange-50 to-orange-100/10 dark:from-orange-950/40 dark:via-orange-900/20 dark:to-orange-950/10 flex items-center justify-center relative">
                        <span className="material-symbols-outlined text-4xl text-orange-500/20">restaurant</span>
                        <div className="absolute top-2 left-3 bg-black/60 text-[9px] font-bold text-white px-2 py-0.5 rounded">
                          {reservation.restaurantName}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-xs text-slate-800 dark:text-sd-on-surface font-sans">{formatDateReadable(reservation.date)}</h4>
                            <div className="flex gap-3 mt-1.5">
                              <div className="flex items-center gap-1 text-slate-500 dark:text-sd-on-surface-variant text-[10px] font-sans">
                                <span className="material-symbols-outlined text-[12px] text-slate-400 dark:text-sd-on-surface-variant/70">schedule</span> {reservation.time}
                              </div>
                              <div className="flex items-center gap-1 text-slate-500 dark:text-sd-on-surface-variant text-[10px] font-sans">
                                <span className="material-symbols-outlined text-[12px] text-slate-400 dark:text-sd-on-surface-variant/70">group</span> {reservation.partySize} Guests
                              </div>
                            </div>
                            {reservation.seating && reservation.seating !== 'Any Preference' && (
                              <div className="mt-1 text-[10px] text-orange-600 dark:text-sd-primary font-semibold font-sans">
                                Preference: {reservation.seating}
                              </div>
                            )}
                            {reservation.notes && (
                              <p className="mt-1.5 text-[10px] text-slate-400 dark:text-sd-on-surface-variant/70 italic font-sans max-w-[170px] truncate" title={reservation.notes}>
                                &ldquo;{reservation.notes}&rdquo;
                              </p>
                            )}
                          </div>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase font-sans ${
                            reservation.status === 'CONFIRMED' || reservation.status === 'Confirmed'
                              ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                              : reservation.status === 'CANCELLED' || reservation.status === 'Cancelled'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300'
                          }`}>{reservation.status}</span>
                        </div>
                        {reservation.status !== 'CANCELLED' && reservation.status !== 'Cancelled' && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleModify(reservation)}
                              className="flex-1 py-1.5 border border-slate-200 dark:border-sd-surface-variant rounded-lg text-[10px] font-bold text-slate-700 dark:text-sd-on-surface hover:bg-slate-50 dark:hover:bg-sd-surface-container-low transition-colors font-sans"
                            >
                              Modify
                            </button>
                            <button
                              onClick={() => handleCancel(reservation.id)}
                              className="flex-1 py-1.5 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-bold hover:bg-red-50/50 dark:hover:bg-red-950/30 transition-colors font-sans"
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
                <div className="border border-dashed border-slate-200 dark:border-sd-surface-variant rounded-2xl p-6 text-center text-slate-400 dark:text-sd-on-surface-variant font-sans">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-30 text-slate-300 dark:text-sd-on-surface-variant/40">calendar_today</span>
                  <p className="text-xs font-semibold text-slate-600 dark:text-sd-on-surface">No upcoming reservations</p>
                  <p className="text-[10px] mt-0.5 text-slate-400 dark:text-sd-on-surface-variant">Use the form to book your table</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-sans">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-[#121214] border border-gray-200 dark:border-neutral-800 shadow-2xl overflow-hidden text-gray-900 dark:text-gray-100">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 font-sans">
                  <span className="material-symbols-outlined text-orange-500">storefront</span>
                  Select Restaurant
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Browse and search available restaurants to reserve your table.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSelectModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-[#18181b] border-b border-gray-100 dark:border-neutral-800">
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-gray-400 material-symbols-outlined text-[20px] pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="Search restaurant by name, city, address, or cuisine..."
                  className="w-full h-11 pl-11 pr-16 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-neutral-700 focus:border-orange-500 focus:outline-none text-xs sm:text-sm font-sans"
                />
                {modalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setModalSearchQuery('')}
                    className="absolute right-3.5 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 sd-custom-scrollbar">
              {filteredRestaurants.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs font-semibold">
                  No restaurants found matching &ldquo;{modalSearchQuery}&rdquo;
                </div>
              ) : (
                filteredRestaurants.map((restaurant, idx) => {
                  const restaurantId = String(restaurant._id || restaurant.id);
                  const isSelected = String(selectedRestaurantId) === restaurantId;
                  const imgIndex = (idx % 4) + 1;
                  const bgImg = restaurant.coverImage || restaurant.image || `/images/landing/restaurant-${imgIndex}.png`;

                  return (
                    <div
                      key={restaurantId}
                      className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/10 ring-1 ring-orange-500/30'
                          : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] hover:border-orange-500/30'
                      }`}
                    >
                      <img
                        src={bgImg}
                        alt={restaurant.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 bg-neutral-800"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate font-sans">
                            {restaurant.name}
                          </h4>
                          {restaurant.rating && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold flex items-center gap-0.5">
                              ⭐ {restaurant.rating}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {restaurant.cuisine || 'Multi-Cuisine'} • {restaurant.address || restaurant.city || 'Mumbai'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRestaurantId(restaurantId);
                          setIsSelectModalOpen(false);
                          showToast(`Selected ${restaurant.name}`, 'info');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-500/20'
                        }`}
                      >
                        {isSelected ? '✓ Selected' : 'Select'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
