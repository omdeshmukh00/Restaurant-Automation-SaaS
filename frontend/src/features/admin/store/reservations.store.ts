import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { reservationApi } from '../api/reservation.api';
import { useTablesStore } from './tables.store';

// ── Types ──────────────────────────────────────────────────────────────────

export type ReservationStatus =
  | 'Confirmed'
  | 'Pending'
  | 'Cancelled'
  | 'Checked In'
  | 'Completed'
  | 'No Show';
export type TableStatus = 'Available' | 'Occupied' | 'Reserved';
export type TimeSlotBusyness = 'Available' | 'Busy' | 'Very Busy';

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
];

function getAvatarColor(name: string) {
  const index = name
    .split(' ')
    .map((part) => part.charCodeAt(0) || 0)
    .reduce((sum, code) => sum + code, 0);
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase())
    .slice(0, 2)
    .join('');
}

function normalizeReservationStatus(status: string): ReservationStatus {
  const normalized = status
    .toString()
    .replace(/_/g, ' ')
    .toLowerCase();

  if (normalized.includes('confirmed')) return 'Confirmed';
  if (normalized.includes('pending')) return 'Pending';
  if (normalized.includes('cancelled')) return 'Cancelled';
  if (normalized.includes('checked in')) return 'Checked In';
  if (normalized.includes('completed')) return 'Completed';
  if (normalized.includes('no show')) return 'No Show';
  return 'Pending';
}

function parseIsoDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
}

function formatTimeLabel(time: string): string {
  const trimmed = time.trim();
  const twentyFourHour = /^\d{1,2}:\d{2}$/;
  const ampm = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i;

  if (twentyFourHour.test(trimmed)) {
    const [hour, minute] = trimmed.split(':').map(Number);
    const date = new Date(1970, 0, 1, hour, minute);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const match = ampm.exec(trimmed);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    const date = new Date(1970, 0, 1, hour, minute);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const parsed = new Date(`1970-01-01 ${trimmed}`);
  return Number.isNaN(parsed.getTime()) ? time : parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function sortTimeString(time: string): number {
  const parsed = new Date(`1970-01-01 ${time}`);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();

  const match = /^(.+?)\s*([AP]M)$/i.exec(time);
  if (!match) return 0;

  const [_full, rawTime, period] = match;
  const [hour, minute] = rawTime.split(':').map(Number);
  let hour24 = hour;
  if (period.toUpperCase() === 'PM' && hour24 < 12) hour24 += 12;
  if (period.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
  return new Date(1970, 0, 1, hour24, minute).getTime();
}

function parseDateTimeStamp(date: string, time: string): number {
  const dateParts = date.split('-').map(Number);
  if (dateParts.length === 3) {
    const [year, month, day] = dateParts;
    const timeMatch = /^\s*(\d{1,2}):(\d{2})(?:\s*([AP]M))?\s*$/i.exec(time);
    if (timeMatch) {
      let hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);
      const period = timeMatch[3]?.toUpperCase();
      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      return new Date(year, month - 1, day, hour, minute).getTime();
    }
    const parsed = new Date(`${date}T${time}`);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  const parsed = new Date(`${date} ${time}`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getTimeSlotBusyness(count: number): TimeSlotBusyness {
  if (count === 0) return 'Available';
  if (count <= 2) return 'Busy';
  return 'Very Busy';
}

const INITIAL_TIME_SLOTS: TimeSlot[] = [
  { time: '11:00 AM', busyness: 'Available', tableCount: 0 },
  { time: '01:00 PM', busyness: 'Available', tableCount: 0 },
  { time: '07:00 PM', busyness: 'Available', tableCount: 0 },
  { time: '09:00 PM', busyness: 'Available', tableCount: 0 },
];

function deriveAnalytics(reservations: Reservation[], refIso: string, tableCount: number): ReservationAnalytics {
  const todayReservations = reservations.filter((reservation) => parseIsoDate(reservation.date) === refIso && reservation.status !== 'Cancelled');
  const total = reservations.length;
  const noShowCount = reservations.filter((reservation) => reservation.status === 'No Show').length;
  const totalGuests = reservations.reduce((sum, reservation) => sum + reservation.guests, 0);

  const peakTimeMap = todayReservations.reduce<Record<string, number>>((acc, reservation) => {
    const label = formatTimeLabel(reservation.time);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const peakTime = Object.entries(peakTimeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([time]) => time)[0] || 'No data';

  const occupancyRate = `${Math.round((todayReservations.length / Math.max(1, tableCount)) * 100)}%`;

  return {
    noShowRate: total ? `${Math.round((noShowCount / total) * 100)}%` : '0%',
    noShowChange: noShowCount > 0 ? `↑ ${Math.round((noShowCount / Math.max(total, 1)) * 100)}% vs last month` : '↓ 0.6% vs last month',
    avgPartySize: total ? (totalGuests / total).toFixed(1) : '0.0',
    avgPartySizeChange: '↑ 0.3 vs last month',
    tableTurnover: todayReservations.length ? (Math.max(1, todayReservations.length / 2)).toFixed(1) : '0.0',
    tableTurnoverChange: '↑ 0.5 vs last month',
    peakTime,
    occupancyRate,
    occupancyChange: '↑ 8% vs last month',
  };
}

function deriveTimeSlots(reservations: Reservation[], refIso: string): TimeSlot[] {
  const todayReservations = reservations.filter((reservation) => parseIsoDate(reservation.date) === refIso && reservation.status !== 'Cancelled');

  if (todayReservations.length === 0) {
    return INITIAL_TIME_SLOTS;
  }

  const counts = todayReservations.reduce<Record<string, number>>((acc, reservation) => {
    const label = formatTimeLabel(reservation.time);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([time, tableCount]) => ({ time, tableCount, busyness: getTimeSlotBusyness(tableCount) }))
    .sort((a, b) => sortTimeString(a.time) - sortTimeString(b.time))
    .slice(0, 4);
}

function deriveTableSlots(tables: TableSlot[], reservations: Reservation[]): TableSlot[] {
  const todayIso = new Date().toISOString().split('T')[0];
  const todayReservations = reservations.filter((reservation) => parseIsoDate(reservation.date) === todayIso && reservation.tableNumber !== undefined && reservation.tableNumber !== null);

  const tableStatusMap = todayReservations.reduce<Record<string, TableStatus>>((acc, reservation) => {
    const id = String(reservation.tableNumber);
    const status = reservation.status === 'Pending' ? 'Reserved' : reservation.status === 'Cancelled' ? 'Available' : 'Occupied';

    if (acc[id] === 'Occupied') return acc;
    if (acc[id] === 'Reserved' && status === 'Occupied') {
      acc[id] = 'Occupied';
      return acc;
    }

    acc[id] = status;
    return acc;
  }, {});

  return tables.map((table) => ({
    ...table,
    status: tableStatusMap[String(table.id)] ?? table.status,
  }));
}

export interface Reservation {
  id: string;
  name: string;
  avatar: string;
  avatarColor: string;
  time: string;
  guests: number;
  tableNumber: string;
  status: ReservationStatus;
  date: string;
  specialRequest?: string;
  phone: string;
  email: string;
  occasion?: string;
}

export interface TableSlot {
  id: number;
  status: TableStatus;
  seats: number;
}

export interface TimeSlot {
  time: string;
  busyness: TimeSlotBusyness;
  tableCount: number;
}

export interface ReservationStats {
  total: number;
  totalChange: string;
  confirmed: number;
  confirmedPercent: string;
  pending: number;
  pendingPercent: string;
  cancelled: number;
  cancelledPercent: string;
  noShow: number;
  noShowPercent: string;
}

export interface ReservationAnalytics {
  noShowRate: string;
  noShowChange: string;
  avgPartySize: string;
  avgPartySizeChange: string;
  tableTurnover: string;
  tableTurnoverChange: string;
  peakTime: string;
  occupancyRate: string;
  occupancyChange: string;
}

export interface ReservationsState {
  stats: ReservationStats;
  upcomingReservations: Reservation[];
  allReservations: Reservation[];
  tables: TableSlot[];
  timeSlots: TimeSlot[];
  analytics: ReservationAnalytics;
  selectedDate: string;
  lastDate?: string;
  selectedGuest: Reservation | null;
  filterStatus: ReservationStatus | 'All';
  filterTime: string;
}

// ── Seed Data ──────────────────────────────────────────────────────────────

const ALL_RESERVATIONS: Reservation[] = [
  {
    id: 'r1',
    name: 'Rahul Sharma',
    avatar: 'RS',
    avatarColor: 'bg-orange-500',
    time: '07:00 PM',
    guests: 2,
    tableNumber: 'L0',
    status: 'Confirmed',
    date: '2026-06-24',
    phone: '+91 98765 43210',
    email: 'rahul.sharma@example.com',
    specialRequest: 'Prefer quiet corner table',
    occasion: 'Anniversary Dinner',
  },
  {
    id: 'r2',
    name: 'Sarah Johnson',
    avatar: 'SJ',
    avatarColor: 'bg-purple-500',
    time: '07:30 PM',
    guests: 2,
    tableNumber: 'L12',
    status: 'Pending',
    date: 'May 20, 2025',
    phone: '+91 87654 32109',
    email: 'sarah.j@email.com',
  },
  {
    id: 'r3',
    name: 'Michael Brown',
    avatar: 'MB',
    avatarColor: 'bg-green-500',
    time: '08:00 PM',
    guests: 6,
    tableNumber: 'L3',
    status: 'Confirmed',
    date: 'May 20, 2025',
    phone: '+91 76543 21098',
    email: 'mbrown@email.com',
    specialRequest: 'High chair needed',
  },
  {
    id: 'r4',
    name: 'Emily Davis',
    avatar: 'ED',
    avatarColor: 'bg-pink-500',
    time: '08:30 PM',
    guests: 3,
    tableNumber: 'L9',
    status: 'Confirmed',
    date: 'May 20, 2025',
    phone: '+91 65432 10987',
    email: 'emily.d@email.com',
  },
  {
    id: 'r5',
    name: 'David Wilson',
    avatar: 'DW',
    avatarColor: 'bg-orange-500',
    time: '09:00 PM',
    guests: 5,
    tableNumber: 'L11',
    status: 'Pending',
    date: 'May 20, 2025',
    phone: '+91 54321 09876',
    email: 'dwilson@email.com',
    specialRequest: 'Birthday celebration',
    occasion: 'Birthday',
  },
  {
    id: 'r6',
    name: 'Priya Sharma',
    avatar: 'PS',
    avatarColor: 'bg-teal-500',
    time: '06:00 PM',
    guests: 2,
    tableNumber: 'L21',
    status: 'Confirmed',
    date: 'May 20, 2025',
    phone: '+91 43210 98765',
    email: 'priya.sharma@email.com',
    occasion: 'Date Night',
  },
  {
    id: 'r7',
    name: 'Rahul Gupta',
    avatar: 'RG',
    avatarColor: 'bg-indigo-500',
    time: '01:00 PM',
    guests: 4,
    tableNumber: 'L6',
    status: 'Confirmed',
    date: 'May 20, 2025',
    phone: '+91 32109 87654',
    email: 'rahul.g@email.com',
  },
  {
    id: 'r8',
    name: 'Ananya Patel',
    avatar: 'AP',
    avatarColor: 'bg-rose-500',
    time: '02:30 PM',
    guests: 3,
    tableNumber: 'L4',
    status: 'Cancelled',
    date: 'May 20, 2025',
    phone: '+91 21098 76543',
    email: 'ananya.p@email.com',
    specialRequest: 'Window seat preferred',
  },
  {
    id: 'r9',
    name: 'Vikram Nair',
    avatar: 'VN',
    avatarColor: 'bg-cyan-500',
    time: '07:45 PM',
    guests: 7,
    tableNumber: 'L1',
    status: 'Confirmed',
    date: 'May 20, 2025',
    phone: '+91 10987 65432',
    email: 'vikram.n@email.com',
    specialRequest: 'Corporate dinner – quiet area',
  },
  {
    id: 'r10',
    name: 'Meera Iyer',
    avatar: 'MI',
    avatarColor: 'bg-amber-500',
    time: '08:15 PM',
    guests: 2,
    tableNumber: 'L8',
    status: 'Pending',
    date: 'May 20, 2025',
    phone: '+91 09876 54321',
    email: 'meera.iyer@email.com',
    occasion: 'Engagement',
  },
];

const initialState: ReservationsState = {
  stats: {
    total: 48,
    totalChange: '+12.5% vs Yesterday',
    confirmed: 36,
    confirmedPercent: '75% of total',
    pending: 8,
    pendingPercent: '16.7% of total',
    cancelled: 4,
    cancelledPercent: '8.3% of total',
    noShow: 2,
    noShowPercent: '4.2% of total',
  },

  upcomingReservations: ALL_RESERVATIONS.slice(0, 5),
  allReservations: ALL_RESERVATIONS,

  tables: [
    { id: 1, status: 'Occupied', seats: 4 },
    { id: 2, status: 'Available', seats: 2 },
    { id: 3, status: 'Occupied', seats: 6 },
    { id: 4, status: 'Reserved', seats: 4 },
    { id: 5, status: 'Occupied', seats: 4 },
    { id: 6, status: 'Available', seats: 8 },
    { id: 7, status: 'Reserved', seats: 2 },
    { id: 8, status: 'Available', seats: 4 },
    { id: 9, status: 'Reserved', seats: 6 },
    { id: 10, status: 'Occupied', seats: 4 },
    { id: 11, status: 'Occupied', seats: 2 },
    { id: 12, status: 'Available', seats: 4 },
  ],

  timeSlots: [
    { time: '11:00 AM', busyness: 'Available', tableCount: 12 },
    { time: '01:00 PM', busyness: 'Busy', tableCount: 4 },
    { time: '07:00 PM', busyness: 'Very Busy', tableCount: 3 },
    { time: '09:00 PM', busyness: 'Available', tableCount: 8 },
  ],

  analytics: {
    noShowRate: '2.5%',
    noShowChange: '↓ 0.6% vs last month',
    avgPartySize: '3.6',
    avgPartySizeChange: '↑ 0.3 vs last month',
    tableTurnover: '4.2',
    tableTurnoverChange: '↓ 0.6 vs last month',
    peakTime: '07:00 PM – 09:00 PM',
    occupancyRate: '78%',
    occupancyChange: '↑ 8% vs last month',
  },

  selectedDate: 'All',
  lastDate: undefined,
  selectedGuest: null,
  filterStatus: 'All',
  filterTime: '',
};

// ── Store ──────────────────────────────────────────────────────────────────

interface ReservationsStore extends ReservationsState {
  setSelectedGuest: (reservation: Reservation | null) => void;
  updateReservationStatus: (id: string, status: ReservationStatus) => Promise<void>;
  setSelectedDate: (date: string) => void;
  setFilterStatus: (status: ReservationStatus | 'All') => void;
  setFilterTime: (time: string) => void;
  fetchReservations: (date?: string) => Promise<void>;
  addReservation: (reservation: Omit<Reservation, 'id' | 'avatar' | 'avatarColor'>) => Promise<void>;
  updateReservation: (id: string, updates: Partial<Reservation>) => Promise<void>;
}

export const useReservationsStore = create<ReservationsStore>()(
    (set, get) => ({
      ...initialState,

      setSelectedGuest: (reservation) =>
        set({ selectedGuest: reservation }),

      updateReservationStatus: async (id, status) => {
        // Optimistic UI update (list + selected guest).
        set((state) => {
          const patch = (r: Reservation): Reservation =>
            r.id === id ? { ...r, status } : r;
          return {
            upcomingReservations: state.upcomingReservations.map(patch),
            allReservations: state.allReservations.map(patch),
            selectedGuest:
              state.selectedGuest?.id === id
                ? { ...state.selectedGuest, status }
                : state.selectedGuest,
          };
        });
        try {
          const payload = { status: status.toUpperCase().replace(/[- ]/g, '_') };
          await reservationApi.updateReservation(id, payload);
          await get().fetchReservations(get().lastDate);
        } catch (err) {
          console.error('Failed to update reservation status', err);
          await get().fetchReservations(); // reconcile with server truth
          throw err;
        }
      },

      setSelectedDate: (date) => set({ selectedDate: date }),

      setFilterStatus: (filterStatus) => set({ filterStatus }),

      setFilterTime: (filterTime) => set({ filterTime }),

      fetchReservations: async (date?: string) => {
        try {
          const todayIso = new Date().toISOString().split('T')[0];
          const reservations = await reservationApi.getReservations(date ? { date } : undefined);
          const mapped: Reservation[] = reservations.map((reservation: any) => {
            const name = reservation.name || reservation.guestName || 'Guest';
            return {
              id: reservation.id || reservation._id || reservation._id?.toString() || String(Date.now()),
              name,
              avatar: getInitials(name),
              avatarColor: getAvatarColor(name),
              time: reservation.time || reservation.slot || '',
              guests: reservation.guests || 0,
              tableNumber: reservation.tableNumber ?? reservation.tableId ?? '',
              status: normalizeReservationStatus(reservation.status || ''),
              date: reservation.date || '',
              specialRequest: reservation.specialRequest || reservation.notes || '',
              phone: reservation.phone || reservation.mobile || '',
              email: reservation.email || reservation.customerEmail || '',
              occasion: reservation.occasion || '',
            } as Reservation;
          });

          const sorted = mapped.sort((a: Reservation, b: Reservation) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateA.getTime() - dateB.getTime();
          });

          const total = sorted.length;
          const confirmed = sorted.filter((r) => r.status === 'Confirmed').length;
          const pending = sorted.filter((r) => r.status === 'Pending').length;
          const cancelled = sorted.filter((r) => r.status === 'Cancelled').length;
          const noShow = sorted.filter((r) => r.status === 'No Show').length;

          const stats = {
            total,
            totalChange: `${total > 0 ? `+${Math.round((total / 10) * 100) / 100}% vs Yesterday` : '0% vs Yesterday'}`,
            confirmed,
            confirmedPercent: total ? `${Math.round((confirmed / total) * 100)}% of total` : '0%',
            pending,
            pendingPercent: total ? `${Math.round((pending / total) * 100)}% of total` : '0%',
            cancelled,
            cancelledPercent: total ? `${Math.round((cancelled / total) * 100)}% of total` : '0%',
            noShow,
            noShowPercent: total ? `${Math.round((noShow / total) * 100)}% of total` : '0%',
          };

          const currentTables = get().tables;
          const realTableCount = useTablesStore.getState().tables.length || currentTables.length || 0;
          const refIso = date || todayIso;
          const selectedGuestId = get().selectedGuest?.id;
          set({
            allReservations: sorted,
            upcomingReservations: sorted
              .filter((r) => parseIsoDate(r.date) >= todayIso)
              .slice(0, 8),
            lastDate: date,
            stats,
            analytics: deriveAnalytics(sorted, refIso, realTableCount),
            timeSlots: deriveTimeSlots(sorted, refIso),
            tables: deriveTableSlots(currentTables, sorted),
            selectedGuest: selectedGuestId ? sorted.find((r) => r.id === selectedGuestId) ?? null : null,
          });
        } catch (err) {
          console.error('Failed to fetch reservations from API', err);
        }
      },

      addReservation: async (reservation) => {
        try {
          const payload: any = {
            customerName: reservation.name,
            customerEmail: reservation.email?.trim() || undefined,
            mobile: reservation.phone,
            guests: reservation.guests,
            date: reservation.date,
            slot: reservation.time,
            tableNumber: reservation.tableNumber?.trim() || undefined,
            notes: reservation.specialRequest?.trim() || undefined,
            occasion: reservation.occasion?.trim() || undefined,
          };

          await reservationApi.createReservation(payload);
          await get().fetchReservations(get().lastDate);
        } catch (err) {
          console.error('Failed to create reservation via API', err);
          throw err;
        }
      },

      updateReservation: async (id, updates) => {
         console.log("STORE updateReservation", id, updates);
  try {
    const payload: any = {};

    if (updates.name !== undefined)
      payload.customerName = updates.name;

    if (updates.phone !== undefined)
      payload.mobile = updates.phone;

    if (updates.email !== undefined)
      payload.customerEmail = updates.email;

    if (updates.time !== undefined)
      payload.slot = updates.time;

    if (updates.guests !== undefined)
      payload.guests = updates.guests;

    if (updates.date !== undefined)
      payload.date = updates.date;

    if (updates.specialRequest !== undefined)
      payload.notes = updates.specialRequest;

    if (updates.occasion !== undefined)
      payload.occasion = updates.occasion;

    if (updates.status !== undefined)
      payload.status = updates.status
        .toUpperCase()
        .replace(/[- ]/g, "_");

    if (
    updates.tableNumber !== undefined &&
    updates.tableNumber !== ""
) {
    payload.tableNumber = updates.tableNumber;
}
console.table(payload);
console.log(JSON.stringify(payload, null, 2));

    await reservationApi.updateReservation(id, payload);

    await get().fetchReservations();
  } catch (err: any) {
    console.log("STATUS:", err.response?.status);
    console.log("DATA:", err.response?.data);
    throw err;
}
},
    }),
);