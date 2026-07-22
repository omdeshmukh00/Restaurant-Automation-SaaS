import React, { useEffect, useState } from 'react';
import { CalendarDays, Filter, Plus, ChevronDown, X, Check } from 'lucide-react';
import { ReservationStatCards } from '../components/reservations/ReservationStatCards';
import { ReservationCalendar } from '../components/reservations/ReservationCalendar';
import { UpcomingReservationsList } from '../components/reservations/UpcomingReservationsList';
import { TableAvailabilityGrid } from '../components/reservations/TableAvailabilityGrid';
import { GuestDetailsPanel } from '../components/reservations/GuestDetailsPanel';
import { TimeSlotsOverview } from '../components/reservations/TimeSlotsOverview';
import { ReservationAnalyticsBar } from '../components/reservations/ReservationAnalyticsBar';
import { useReservationsStore, type ReservationStatus } from '../store/reservations.store';
import { useTablesStore } from "../store/tables.store";
import { reservationApi } from '../api/reservation.api';

const STATUS_OPTIONS: Array<'All' | ReservationStatus> = ['All', 'Confirmed', 'Pending', 'Cancelled', 'No Show'];

function to24Minutes(time: string): number {
  if (!time) return -1;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(time.trim());
  if (!match) {
    const parsed = new Date(`1970-01-01 ${time}`);
    return Number.isNaN(parsed.getTime()) ? -1 : parsed.getHours() * 60 + parsed.getMinutes();
  }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function applyPeriod(time24: string, period: 'AM' | 'PM'): string {
  if (!time24) return time24;
  const parts = time24.split(':').map(Number);
  let hour = parts[0];
  const minute = parts[1];
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function format12h(time24: string): string {
  if (!time24) return '';
  const [hour, minute] = time24.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

const DATE_OPTIONS: Array<{ label: string; date: string | undefined }> = [
  { label: 'All', date: undefined },
  { label: 'Today', date: new Date().toISOString().split('T')[0] },
  {
    label: 'Tomorrow',
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    })(),
  },
];

export default function ReservationsPage(): JSX.Element {
   const {
    tables,
    fetchTables,
  } = useTablesStore();

  const {
    selectedDate,
    setSelectedDate,
    filterStatus,
    setFilterStatus,
    filterTime,
    setFilterTime,
    addReservation,
    fetchReservations,
  } = useReservationsStore();

  useEffect(() => {
    fetchReservations().catch((error) => {
      console.error('Failed to load reservations:', error);
    });
    fetchTables();
  }, [fetchReservations , fetchTables]);

  const [showNewModal, setShowNewModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    date: '',
    time: '',
    guests: 2,
    tableNumber: '',
    specialRequest: '',
    occasion: '',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [slots, setSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Record<string, number>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!showNewModal || !form.date) {
      setSlots([]);
      setBookedSlots({});
      return;
    }
    let active = true;
    setSlotsLoading(true);
    reservationApi
      .getAvailability(form.date)
      .then((data: any) => {
        if (!active) return;
        setSlots(data?.slots ?? []);
        const map: Record<string, number> = {};
        (data?.bookedSlots ?? []).forEach((b: any) => {
          map[b.slot] = b.count;
        });
        setBookedSlots(map);
        setSlotsLoading(false);
      })
      .catch(() => {
        if (active) {
          setSlots([]);
          setSlotsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [showNewModal, form.date]);

  const [localFilterStatus, setLocalFilterStatus] = useState<'All' | ReservationStatus>(filterStatus);
  const [localFilterTime, setLocalFilterTime] = useState(filterTime);
  const filterPeriod: 'AM' | 'PM' = localFilterTime
    ? parseInt(localFilterTime.split(':')[0], 10) >= 12
      ? 'PM'
      : 'AM'
    : 'AM';
  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalFilterTime(applyPeriod(localFilterTime, e.target.value as 'AM' | 'PM'));
  };

  const handleFormChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  };

  const handleCreateReservation = async () => {
    if (!form.name.trim()) { setFormError('Guest name is required.'); return; }
    if (!form.phone.trim()) { setFormError('Phone number is required.'); return; }
    if (!form.date) { setFormError('Please select a date.'); return; }
    if (!form.time) { setFormError('Please select a time.'); return; }

    const initials = form.name
      .trim()
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    setFormError('');
    setSubmitting(true);
    try {
      await addReservation({
        name: form.name.trim(),
        time: form.time,
        guests: form.guests,
        tableNumber: form.tableNumber,
        status: 'Pending',
        date: form.date,
        phone: form.phone.trim(),
        email: form.email.trim(),
        specialRequest: form.specialRequest.trim() || undefined,
        occasion: form.occasion.trim() || undefined,
      });
      setFormSuccess(true);
      setTimeout(() => {
        setShowNewModal(false);
        setFormSuccess(false);
        setForm({ name: '', phone: '', email: '', date: '', time: '', guests: 2, tableNumber: '', specialRequest: '', occasion: '' });
      }, 1200);
    } catch (error) {
      setFormSuccess(false);
      setFormError(error instanceof Error ? error.message : 'Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyFilter = () => {
    setFilterStatus(localFilterStatus);
    setFilterTime(localFilterTime);
    setShowFilterModal(false);
  };

  const handleClearFilter = () => {
    setLocalFilterStatus('All');
    setLocalFilterTime('');
    setFilterStatus('All');
    setFilterTime('');
    setShowFilterModal(false);
  };

  const isFilterActive = filterStatus !== 'All' || filterTime !== '';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Reservations</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage all restaurant reservations and table bookings
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
          {/* Date Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowDateModal((v) => !v); setShowFilterModal(false); }}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
              <span className="max-w-[90px] sm:max-w-none truncate">{selectedDate}</span>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
            </button>

            {showDateModal && (
              <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 z-30 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl p-2 w-52">
                {DATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setSelectedDate(opt.label);
                      setShowDateModal(false);
                      fetchReservations(opt.date);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      selectedDate === opt.label
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-semibold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {opt.label}
                    {selectedDate === opt.label && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowFilterModal((v) => !v); setShowDateModal(false); }}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors border ${
                isFilterActive
                  ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-600'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Filter
              {isFilterActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
              )}
            </button>

            {showFilterModal && (
              <div className="absolute right-0 top-full mt-2 z-30 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl p-4 w-64">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Filter Reservations</p>
                  <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLocalFilterStatus(s)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          localFilterStatus === s
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Time (from)</p>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={localFilterTime}
                      onChange={(e) => setLocalFilterTime(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    <select
                      value={filterPeriod}
                      onChange={handlePeriodChange}
                      className="w-20 px-2 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-100"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                  {localFilterTime && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Showing from {format12h(localFilterTime)}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClearFilter}
                    className="flex-1 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyFilter}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* New Reservation */}
          <button
            type="button"
            onClick={() => { setShowNewModal(true); setShowDateModal(false); setShowFilterModal(false); }}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">New </span>Reservation
          </button>
        </div>
      </div>

      {/* Overlay to close dropdowns */}
      {(showDateModal || showFilterModal) && (
        <button
          type="button"
          aria-label="Close dropdown"
          className="fixed inset-0 z-20 cursor-default"
          onClick={() => { setShowDateModal(false); setShowFilterModal(false); }}
        />
      )}

      {/* Stats */}
      <ReservationStatCards />

      {/* Main grid — stacks on mobile, 12-col on lg */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        <div className="md:col-span-1 lg:col-span-4">
          <ReservationCalendar />
        </div>
        <div className="md:col-span-1 lg:col-span-3">
          <UpcomingReservationsList />
        </div>
        <div className="md:col-span-1 lg:col-span-3">
          <TableAvailabilityGrid />
        </div>
        <div className="md:col-span-1 lg:col-span-2">
          <GuestDetailsPanel />
        </div>
      </div>

      {/* Time Slots + Analytics */}
      <TimeSlotsOverview />
      <ReservationAnalyticsBar />

      {/* ─── New Reservation Modal ─── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 w-full h-full cursor-default"
            onClick={() => { setShowNewModal(false); setFormError(''); setFormSuccess(false); }}
          />

          <div
            className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-5 sm:p-6 w-full sm:max-w-md sm:mx-4 max-h-[92vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-reservation-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="new-reservation-title" className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                New Reservation
              </h2>
              <button
                type="button"
                onClick={() => { setShowNewModal(false); setFormError(''); setFormSuccess(false); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formSuccess ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-3">
                  <Check className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-base font-bold text-gray-900 dark:text-white">Reservation Created!</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Added to upcoming reservations.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Guest Name', field: 'name', placeholder: 'Enter full name', type: 'text' },
                  { label: 'Phone', field: 'phone', placeholder: '+91 XXXXX XXXXX', type: 'tel' },
                  { label: 'Email', field: 'email', placeholder: 'guest@email.com', type: 'email' },
                  { label: 'Date', field: 'date', placeholder: '', type: 'date' },
                  { label: 'Time', field: 'time', placeholder: '', type: 'time' },
                  { label: 'Occasion (optional)', field: 'occasion', placeholder: 'e.g. Anniversary, Birthday', type: 'text' },
                ].map(({ label, field, placeholder, type }) => {
                  const fieldId = `new-res-${field}`;
                  if (type === 'time') {
                    const period: 'AM' | 'PM' = form.time
                      ? parseInt(form.time.split(':')[0], 10) >= 12
                        ? 'PM'
                        : 'AM'
                      : 'AM';
                    return (
                      <div key={field}>
                        <label htmlFor={fieldId} className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                          {label}
                        </label>
                        <div className="flex gap-2">
                          <input
                            id={fieldId}
                            type="time"
                            placeholder={placeholder}
                            value={form.time}
                            onChange={(e) => handleFormChange('time', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 dark:focus:border-orange-600 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 transition-all"
                          />
                          <select
                            value={period}
                            onChange={(e) => handleFormChange('time', applyPeriod(form.time, e.target.value as 'AM' | 'PM'))}
                            className="w-20 px-2 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 text-gray-800 dark:text-gray-100 transition-all"
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                        {form.time && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                            Selected: {format12h(form.time)}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={field}>
                      <label htmlFor={fieldId} className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        {label}
                      </label>
                      <input
                        id={fieldId}
                        type={type}
                        placeholder={placeholder}
                        value={form[field as keyof typeof form] as string}
                        onChange={(e) => handleFormChange(field, e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 dark:focus:border-orange-600 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 transition-all"
                      />
                    </div>
                  );
                })}

                {slotsLoading ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Loading available times…</p>
                ) : slots.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Available Times</p>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot) => {
                        const booked = (bookedSlots[slot] ?? 0) > 0;
                        const selected = form.time === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={booked}
                            onClick={() => handleFormChange('time', slot)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              booked
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 line-through cursor-not-allowed'
                                : selected
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-950/40'
                            }`}
                          >
                            {format12h(slot)}{booked ? ` (${bookedSlots[slot]})` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="new-res-guests" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      Guests
                    </label>
                    <input
                      id="new-res-guests"
                      type="number"
                      min="1"
                      max="20"
                      value={form.guests}
                      onChange={(e) => handleFormChange('guests', Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-res-table" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      Table
                    </label>
                    <select
                      id="new-res-table"
                      value={form.tableNumber}
                      onChange={(e) => handleFormChange("tableNumber", e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 text-gray-800 dark:text-gray-100 transition-all"
                    >
                      <option value="">Select Table</option>
                      {tables.map((table) => (
                        <option
                            key={table.id}
                            value={table.label}
                        >
                            {table.label}
                        </option>
                    ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="new-res-special-request" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Special Request
                  </label>
                  <textarea
                    id="new-res-special-request"
                    rows={2}
                    placeholder="Any dietary requirements or special notes..."
                    value={form.specialRequest}
                    onChange={(e) => handleFormChange('specialRequest', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 resize-none transition-all"
                  />
                </div>

                {formError && (
                  <p className="text-xs text-red-500 dark:text-red-400 font-medium">{formError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowNewModal(false); setFormError(''); }}
                    className="flex-1 py-2.5 sm:py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateReservation}
                    disabled={submitting || formSuccess}
                    className="flex-1 py-2.5 sm:py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating…' : 'Create Reservation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
