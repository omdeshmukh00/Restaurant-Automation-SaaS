import React, { useState, useRef, useEffect } from 'react';
import { useCustomerStore } from '../store/customer.store';
import {
  createCustomerReservation,
  getCustomerReservations,
  updateCustomerReservation,
  cancelCustomerReservation,
  type CustomerReservationResponse,
} from '../api/customer.api';

type LocalReservation = {
  id: string;
  guestName: string;
  email: string;
  phone: string;
  partySize: number;
  date: string;
  time: string;
  status: string;
  occasion: string;
  seating: string;
  notes: string;
};

function mapCustomerReservation(r: CustomerReservationResponse): LocalReservation {
  const id = (r._id || r.id || '') as string;
  return {
    id,
    guestName: r.customerName || '',
    email: '',
    phone: r.mobile || '',
    partySize: r.guests || 1,
    date: r.date || '',
    time: r.slot || '',
    status: r.status || 'PENDING',
    occasion: r.occasion || '',
    seating: r.preferredArea || 'Any Preference',
    notes: r.notes || '',
  };
}

// Restaurant serving window: 11:00 AM to 10:30 PM, in 30-minute increments.
// Covers morning, afternoon and evening reservations.
const SERVICE_START_HOUR = 11; // 11:00 AM
const SERVICE_END_HOUR = 22; // 10:00 PM (last slot starts at 10:30 PM)
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
      if (h === SERVICE_END_HOUR && m > 30) break; // cap last slot at 10:30 PM
      const time = formatSlotTime(h, m);
      slots.push({ time, status: LIMITED_SLOTS.has(time) ? 'limited' : 'available' });
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

// Returns true when a slot on the selected date is already in the past.
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

export default function CustomerReservationPage() {
  const { profile, addNotification } = useCustomerStore();
  const [reservations, setReservations] = useState<LocalReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [todayStr] = useState(getTodayStr);
  const [tomorrowStr] = useState(getTomorrowStr);

  const firstValidSlot = TIME_SLOTS.find((s) => !isSlotInPast(todayStr, s.time))?.time ?? TIME_SLOTS[0].time;

  const [guests, setGuests] = useState('2 Guests');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(firstValidSlot);
  const [area, setArea] = useState('Any Preference');
  const [specialRequest, setSpecialRequest] = useState('');
  const [phone, setPhone] = useState(profile.phone || '');
  const [dateTab, setDateTab] = useState<'today' | 'tomorrow' | 'custom'>('today');

  // Track modification state
  const [modifyingId, setModifyingId] = useState<string | null>(null);

  // Toast notifications state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load the customer's own reservations from the backend on mount.
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingReservations(true);
      try {
        const list = await getCustomerReservations();
        if (active) setReservations(list.map(mapCustomerReservation));
      } catch (err) {
        console.error('Failed to load customer reservations', err);
      } finally {
        if (active) setLoadingReservations(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const refreshReservations = async () => {
    try {
      const list = await getCustomerReservations();
      setReservations(list.map(mapCustomerReservation));
    } catch (err) {
      console.error('Failed to refresh customer reservations', err);
    }
  };

  // Reservations for the current customer (already scoped server-side).
  const customerReservations = reservations;

  const ensureValidTime = (dateStr: string, currentTime: string) => {
    if (!isSlotInPast(dateStr, currentTime)) return;
    const valid = TIME_SLOTS.find((s) => !isSlotInPast(dateStr, s.time))?.time ?? TIME_SLOTS[0].time;
    setTime(valid);
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

    const guestCount = parseInt(guests) || 2;

    try {
      if (modifyingId) {
        await updateCustomerReservation(modifyingId, {
          guests: guestCount,
          date,
          slot: time,
          occasion: area,
          notes: specialRequest,
          preferredArea: area,
        });
        await refreshReservations();
        addNotification(
          'Reservation Updated! 📅',
          `Your reservation has been modified to ${guestCount} guests on ${formatDateReadable(date)} at ${time}.`,
          'info',
          '/customer/reservations'
        );
        showToast('Reservation updated successfully!', 'success');
        setModifyingId(null);
      } else {
        await createCustomerReservation({
          customerName: profile.name,
          mobile: phone,
          guests: guestCount,
          date,
          slot: time,
          occasion: area,
          notes: specialRequest,
          preferredArea: area,
          status: 'CONFIRMED',
        });
        await refreshReservations();
        addNotification(
          'Reservation Confirmed! 📅',
          `Your table reservation for ${guestCount} guests on ${formatDateReadable(date)} at ${time} is confirmed.`,
          'info',
          '/customer/reservations'
        );
        showToast('Table reserved successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to save reservation', err);
      showToast('Could not save reservation. Please try again.', 'error');
      return;
    }

    // Reset inputs
    setGuests('2 Guests');
    setDate(todayStr);
    setTime('07:00 PM');
    setArea('Any Preference');
    setSpecialRequest('');
    setPhone(profile.phone || '');
    setDateTab('today');
  };

  const handleModify = (res: LocalReservation) => {
    setModifyingId(res.id);
    setGuests(`${res.partySize} Guests`);
    setDate(res.date);
    setTime(res.time);
    setArea(res.seating || 'Any Preference');
    setSpecialRequest(res.notes || '');
    setPhone(res.phone || profile.phone || '');

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
      await cancelCustomerReservation(id);
      await refreshReservations();
      addNotification(
        'Reservation Cancelled 📅',
        `Your table reservation has been cancelled.`,
        'info',
        '/customer/reservations'
      );
      showToast('Reservation cancelled', 'info');
    } catch (err) {
      console.error('Failed to cancel reservation', err);
      showToast('Could not cancel reservation. Please try again.', 'error');
      return;
    }
    if (modifyingId === id) {
      setModifyingId(null);
      setGuests('2 Guests');
      setDate(todayStr);
      setTime('07:00 PM');
      setArea('Any Preference');
      setSpecialRequest('');
      setDateTab('today');
    }
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

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-sd-on-surface font-sans">Table Reservation</h2>
        <p className="text-sm text-sd-on-surface-variant font-sans">Reserve your table and enjoy a great dining experience.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Booking Form */}
          <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-sd-surface-variant sd-food-card-shadow">
            <h3 className="text-base font-bold text-sd-on-surface mb-5 font-sans">
              {modifyingId ? 'Modify Your Booking' : 'Book Your Table'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Guests */}
              <div className="space-y-1.5">
                <label htmlFor="guests-select" className="text-xs font-semibold text-sd-on-surface-variant font-sans">Number of Guests</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sd-outline text-[20px]">group</span>
                  <select
                    id="guests-select"
                    className="w-full h-12 pl-10 pr-4 bg-sd-surface rounded-xl border border-sd-surface-variant focus:border-sd-primary-container focus:ring-1 focus:ring-sd-primary-container appearance-none text-sm font-sans"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                  >
                    <option>2 Guests</option>
                    <option>4 Guests</option>
                    <option>6 Guests</option>
                    <option>8 Guests</option>
                    <option>10 Guests</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-sd-outline text-[18px]">expand_more</span>
                </div>
              </div>
              {/* Phone */}
              <div className="space-y-1.5">
                <label htmlFor="phone-input" className="text-xs font-semibold text-sd-on-surface-variant font-sans">Phone Number</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sd-outline text-[20px] pointer-events-none">call</span>
                  <input
                    id="phone-input"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    required
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full h-12 pl-10 pr-4 bg-sd-surface rounded-xl border border-sd-surface-variant focus:border-sd-primary-container focus:ring-1 focus:ring-sd-primary-container text-sm font-sans"
                  />
                </div>
              </div>
              {/* Date */}
              <div className="space-y-1.5">
                <label htmlFor="date-input" className="text-xs font-semibold text-sd-on-surface-variant font-sans">Date</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sd-outline text-[20px] pointer-events-none">calendar_today</span>
                  <input
                    id="date-input"
                    type="date"
                    min={todayStr}
                    value={date}
                    onChange={(e) => handleDateInputChange(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 bg-sd-surface rounded-xl border border-sd-surface-variant focus:border-sd-primary-container focus:ring-1 focus:ring-sd-primary-container text-sm font-sans cursor-pointer"
                  />
                </div>
              </div>
              {/* Time */}
              <div className="space-y-1.5">
                <label htmlFor="time-select" className="text-xs font-semibold text-sd-on-surface-variant font-sans">Time</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sd-outline text-[20px]">schedule</span>
                  <select
                    id="time-select"
                    className="w-full h-12 pl-10 pr-4 bg-sd-surface rounded-xl border border-sd-surface-variant focus:border-sd-primary-container focus:ring-1 focus:ring-sd-primary-container appearance-none text-sm font-sans"
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
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-sd-outline text-[18px]">expand_more</span>
                </div>
              </div>
              {/* Area */}
              <div className="space-y-1.5">
                <label htmlFor="area-select" className="text-xs font-semibold text-sd-on-surface-variant font-sans">Area Preference <span className="text-sd-outline font-normal">(Optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sd-outline text-[20px]">chair</span>
                  <select
                    id="area-select"
                    className="w-full h-12 pl-10 pr-4 bg-sd-surface rounded-xl border border-sd-surface-variant focus:border-sd-primary-container focus:ring-1 focus:ring-sd-primary-container appearance-none text-sm font-sans"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  >
                    <option>Any Preference</option>
                    <option>Indoor</option>
                    <option>Outdoor / Terrace</option>
                    <option>Private Room</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-sd-outline text-[18px]">expand_more</span>
                </div>
              </div>
              {/* Special Request */}
              <div className="md:col-span-2 space-y-1.5">
                <label htmlFor="special-request-textarea" className="text-xs font-semibold text-sd-on-surface-variant font-sans">Special Request <span className="text-sd-outline font-normal">(Optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-4 material-symbols-outlined text-sd-outline text-[20px]">edit_note</span>
                  <textarea
                    id="special-request-textarea"
                    className="w-full min-h-[100px] pt-4 pl-10 pr-4 bg-sd-surface rounded-xl border border-sd-surface-variant focus:border-sd-primary-container focus:ring-1 focus:ring-sd-primary-container resize-none text-sm font-sans"
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
                    className="px-4 py-2 border border-sd-outline text-sd-on-surface-variant rounded-xl text-xs font-bold hover:bg-sd-surface-variant/30 transition-all font-sans"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="bg-sd-primary-container text-white px-10 py-3 rounded-xl font-bold text-sm shadow-lg shadow-sd-primary-container/20 hover:scale-[1.02] active:scale-95 transition-all font-sans"
              >
                {modifyingId ? 'Update Reservation' : 'Confirm Reservation'}
              </button>
            </div>
          </form>

          {/* Time Slots */}
          <section className="bg-white rounded-2xl p-6 border border-sd-surface-variant sd-food-card-shadow">
            <div className="flex justify-between items-end mb-5">
              <div>
                <h3 className="text-base font-bold text-sd-on-surface font-sans">Available Time Slots</h3>
                <p className="text-xs text-sd-on-surface-variant font-sans mt-0.5">{formatDateReadable(date)}</p>
              </div>
              <div className="flex bg-sd-surface rounded-lg p-1 border border-sd-surface-variant">
                {(['today', 'tomorrow', 'custom'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleDateTabChange(tab)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize font-sans transition-all ${
                      dateTab === tab ? 'bg-white shadow-sm text-sd-primary' : 'text-sd-on-surface-variant hover:bg-sd-surface-variant'
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
                        ? 'border border-sd-surface-variant opacity-40 cursor-not-allowed'
                        : isSelected
                        ? 'border-2 border-sd-primary-container bg-sd-primary-container/5 shadow-md'
                        : 'border border-sd-surface-variant hover:border-sd-primary'
                    }`}
                  >
                    <span className={`text-sm font-bold font-sans ${isSelected ? 'text-sd-primary' : ''}`}>{slotTime}</span>
                    <span className={`text-[10px] uppercase font-bold font-sans ${
                      isPast ? 'text-sd-outline' : isLimited ? 'text-sd-primary' : 'text-sd-secondary'
                    }`}>
                      {isPast ? 'Unavailable' : isLimited ? 'Limited' : 'Available'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Benefits */}
          <section className="bg-white rounded-2xl p-5 border border-sd-surface-variant sd-food-card-shadow">
            <h3 className="text-base font-bold text-sd-on-surface mb-4 font-sans">Why Reserve with Us?</h3>
            <div className="space-y-3">
              {[
                { icon: 'verified_user', label: 'Guaranteed Seating', desc: 'Your table will be reserved and ready for you.', color: 'bg-green-100 text-green-600' },
                { icon: 'alarm', label: 'No Waiting', desc: 'Skip the wait and enjoy your time.', color: 'bg-orange-100 text-orange-600' },
                { icon: 'card_giftcard', label: 'Special Occasions', desc: 'Celebrate your special moments with us.', color: 'bg-purple-100 text-purple-600' },
                { icon: 'star', label: 'Best Experience', desc: 'Enjoy personalized service for a memorable dining.', color: 'bg-blue-100 text-blue-600' },
              ].map(({ icon, label, desc, color }) => (
                <div key={label} className="flex items-start gap-3 p-3 hover:bg-sd-surface-container-low rounded-xl transition-colors cursor-pointer group">
                  <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center shrink-0`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold font-sans">{label}</h4>
                    <p className="text-xs text-sd-on-surface-variant font-sans">{desc}</p>
                  </div>
                  <span className="material-symbols-outlined text-sd-outline text-[18px] self-center group-hover:translate-x-1 transition-transform">chevron_right</span>
                </div>
              ))}
            </div>
          </section>

          {/* Existing Reservations list */}
          <section className="bg-white rounded-2xl border border-sd-surface-variant sd-food-card-shadow overflow-hidden">
            <div className="px-5 py-3 flex justify-between items-center">
              <h3 className="text-base font-bold text-sd-on-surface font-sans">Your Reservations</h3>
              <span className="text-xs font-bold text-sd-primary cursor-pointer font-sans">
                ({customerReservations.length})
              </span>
            </div>
            <div className="px-5 pb-5">
              {loadingReservations ? (
                <div className="border border-dashed border-sd-surface-variant rounded-2xl p-6 text-center text-sd-on-surface-variant/60 font-sans">
                  <p className="text-xs font-semibold">Loading reservations…</p>
                </div>
              ) : customerReservations.length > 0 ? (
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1 sd-custom-scrollbar">
                  {customerReservations.map((res) => (
                    <div key={res.id} className="border border-sd-surface-variant rounded-2xl overflow-hidden">
                      <div className="h-24 bg-gradient-to-br from-sd-primary-fixed via-sd-primary-fixed-dim to-sd-primary-container/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-sd-primary/30">restaurant</span>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-xs font-sans">{formatDateReadable(res.date)}</h4>
                            <div className="flex gap-3 mt-1">
                              <div className="flex items-center gap-1 text-sd-on-surface-variant text-[10px] font-sans">
                                <span className="material-symbols-outlined text-[12px]">schedule</span> {res.time}
                              </div>
                              <div className="flex items-center gap-1 text-sd-on-surface-variant text-[10px] font-sans">
                                <span className="material-symbols-outlined text-[12px]">group</span> {res.partySize} Guests
                              </div>
                            </div>
                            {res.seating && res.seating !== 'Any Preference' && (
                              <div className="mt-1 text-[10px] text-sd-primary font-semibold font-sans">
                                Preference: {res.seating}
                              </div>
                            )}
                            {res.notes && (
                              <p className="mt-1.5 text-[10px] text-sd-on-surface-variant italic font-sans max-w-[170px] truncate" title={res.notes}>
                                &ldquo;{res.notes}&rdquo;
                              </p>
                            )}
                          </div>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase font-sans ${
                            res.status === 'CONFIRMED' || res.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                            res.status === 'CANCELLED' || res.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>{res.status}</span>
                        </div>
                        {res.status !== 'Cancelled' && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleModify(res)}
                              className="flex-1 py-1.5 border border-sd-surface-variant rounded-lg text-[10px] font-bold hover:bg-sd-surface-container transition-colors font-sans"
                            >
                              Modify
                            </button>
                            <button
                              onClick={() => handleCancel(res.id)}
                              className="flex-1 py-1.5 border border-sd-error/20 text-sd-error rounded-lg text-[10px] font-bold hover:bg-sd-error/5 transition-colors font-sans"
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
                <div className="border border-dashed border-sd-surface-variant rounded-2xl p-6 text-center text-sd-on-surface-variant/60 font-sans">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-30">calendar_today</span>
                  <p className="text-xs font-semibold">No upcoming reservations</p>
                  <p className="text-[10px] mt-0.5">Use the form to book your table</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
