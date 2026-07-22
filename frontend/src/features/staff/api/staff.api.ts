import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '../../../shared/services/apiClient';

// ─── Generic response wrapper ─────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Fetch helper ─────────────────────────────────────────────

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const config: AxiosRequestConfig = {
      url: endpoint,
      method: (options.method as AxiosRequestConfig['method']) || 'GET',
      headers: options.headers ? (options.headers as AxiosRequestConfig['headers']) : undefined,
      data: options.body ? JSON.parse(options.body as string) : undefined,
    };

    const response = await apiClient.request<{ success: boolean; data: T; error?: string }>(config);
    const payload = response.data;
    if (!payload.success) {
      return { success: false, error: payload.error ?? 'Unknown error' };
    }
    return { success: true, data: payload.data };
  } catch (err) {
    // Narrow unknown error safely without `any`
    const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
    const unknownErr = err as unknown;
    let errorStr = 'Unknown error';
    if (isObj(unknownErr)) {
      const resp = unknownErr['response'];
      if (isObj(resp)) {
        const data = resp['data'];
        if (isObj(data)) {
          const e = data['error'];
          if (typeof e === 'string') errorStr = e;
          else if (isObj(e) && typeof e['message'] === 'string') errorStr = e['message'] as string;
        }
      }
      if (typeof unknownErr['message'] === 'string') errorStr = unknownErr['message'] as string;
    }
    console.error(`[Staff API] ${endpoint}:`, errorStr);
    return { success: false, error: String(errorStr) };
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── TYPES (canonical — import these everywhere, never redefine)
// ═══════════════════════════════════════════════════════════════

// ── Tables ──

export type TableStatus =
  | 'available'
  | 'occupied'
  | 'order_placed'
  | 'food_ready'
  | 'served'
  | 'needs_cleaning';

export interface Table {
  id: string;
  tableNumber: string;
  status: TableStatus;
  section: string;
  guestCount?: number;
}

// ── Requests & Alerts ──

export interface CustomerRequest {
  id: string;
  tableNumber: string;
  type: 'call_waiter' | 'water_refill' | 'extra_cutlery' | 'cleaning';
  time: string;
}

export interface FoodAlert {
  id: string;
  tableNumber: string;
  items: string[];
  readyAt: string;
}

// ── Staff ──

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'Manager' | 'Server' | 'Chef' | 'Bartender';
  department: string;
  phone: string;
  status: 'active' | 'on_leave';
  hireDate: string;
  initials: string;
  avatarColor: string;
  avatarUrl?: string | null;
}

// ── Stats (what /api/staff/stats returns) ──
// Note: trend fields are display strings like "↑ 12.5% vs last month"

export interface StaffStats {
  totalStaff: number;
  activeToday: number;
  onLeave: number;
  totalPayroll: string;       // display string e.g. "$18,750"
  avgPerformance: string;     // display string e.g. "4.6 / 5.0"
  totalPayrollTrend: string;
  totalStaffTrend: string;
  avgPerfTrend: string;
}

// ── Analytics ──

export interface AttendanceData {
  present: number;
  absent: number;
  late: number;
  leaves: number;             // field name is `leaves`, not `onLeave`
  overall: string;            // display string e.g. "92%"
}

export interface PayrollData {
  total: string;              // display string e.g. "$18,750.00"
  trend: string;
  regularPay: string;
  overtimePay: string;
  deductions: string;         // negative display string e.g. "-$750.00"
  bonuses: string;            // positive display string e.g. "+$1,250.00"
}

export interface PerformanceData {
  avgRating: string;          // display string e.g. "4.6 / 5.0"
  trend: string;
  distribution: number[];     // array of 5 values — index 0 = 1-star, index 4 = 5-star
}

export interface RolesData {
  managers: number;
  chefs: number;
  servers: number;
  bartenders: number;
  others: number;
  total: number;              // sum of all roles
}

export interface QueueItem {
  id: string;
  tableNumber: string;
  partySize?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'waiting' | 'seated' | 'cancelled';
  waitTime: string;
}

export interface Reservation {
  id: string;
  tableNumber: string;
  guestName: string;
  partySize: number;
  time: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'cancelled';
}

export interface OrderItem {
  id: string;
  tableNumber: string;
  status: 'ready' | 'picked' | 'served' | 'completed';
  items: string[];
  readyAt: string;
}

export interface EscalationPayload {
  tableId: string;
  issue: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ── Schedule & misc ──

export interface ScheduleItem {
  time: string;               // e.g. "09:00 AM – 05:00 PM"
  label: string;              // e.g. "Morning Shift"
  staff: number;
  dot: string;                // hex color for the shift indicator dot
  avatars: string[];          // array of initials strings
  extra: number;              // count of additional staff beyond shown avatars
}

export interface BirthdayItem {
  name: string;
  role: string;               // e.g. "Server · Service"
  date: string;               // e.g. "May 24"
  initials: string;
  color: string;              // hex avatar color
}
function mapBackendRoleToStaffRole(role?: string): StaffMember['role'] {
  switch (role) {
    case 'kitchen-staff':
      return 'Chef';
    case 'cleaning-staff':
      return 'Bartender';
    case 'restaurant-admin':
      return 'Manager';
    case 'service-staff':
    case 'staff':
    default:
      return 'Server';
  }
}

function buildStaffProfile(user: Partial<StaffMember> & { mobile?: string; role?: string; restaurantName?: string; id?: string }): StaffMember {
  const name = user.name || 'Staff Member';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ST';

  return {
    id: String(user.id || ''),
    name,
    email: user.email ?? '',
    role: mapBackendRoleToStaffRole(user.role),
    department: user.restaurantName ? `${user.restaurantName}` : 'Service',
    phone: user.mobile ?? '',
    status: 'active',
    hireDate: '',
    initials,
    avatarColor: '#f97316',
    avatarUrl: null,
  };
}
// ═══════════════════════════════════════════════════════════════
// ─── API ENDPOINT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ── Tables ──

export const tableAPI = {
  /** GET /staff/tables — fetch all tables */
  getTables: async (filters?: { status?: string; floor?: number; section?: string }): Promise<ApiResponse<Table[]>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (typeof filters?.floor !== 'undefined') params.append('floor', String(filters.floor));
    if (filters?.section) params.append('section', filters.section);

    const endpoint = `/staff/tables${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetchAPI<{ tables: Table[]; meta?: unknown }>(endpoint);
    return {
      success: res.success,
      data: res.data?.tables,
      error: res.error,
    };
  },

  /** GET /staff/tables/:id — fetch a single table by id */
  getTable: async (id: string): Promise<ApiResponse<Table>> => {
    const res = await fetchAPI<{ table: Table }>(`/staff/tables/${id}`);
    return {
      success: res.success,
      data: res.data?.table,
      error: res.error,
    };
  },

  /** PATCH /staff/tables/:id/assign — assign a table */
  assign: async (id: string): Promise<ApiResponse<Table>> => {
    const res = await fetchAPI<{ table: Table }>(`/staff/tables/${id}/assign`, { method: 'PATCH' });
    return {
      success: res.success,
      data: res.data?.table,
      error: res.error,
    };
  },

  /** PATCH /staff/tables/:id/reserve — mark a table reserved */
  reserve: async (id: string): Promise<ApiResponse<Table>> => {
    const res = await fetchAPI<{ table: Table }>(`/staff/tables/${id}/reserve`, { method: 'PATCH' });
    return {
      success: res.success,
      data: res.data?.table,
      error: res.error,
    };
  },

  /** PATCH /staff/tables/:id/occupy — mark a table occupied */
  occupy: async (id: string): Promise<ApiResponse<Table>> => {
    const res = await fetchAPI<{ table: Table }>(`/staff/tables/${id}/occupy`, { method: 'PATCH' });
    return {
      success: res.success,
      data: res.data?.table,
      error: res.error,
    };
  },

  /** Generic fallback for table status changes. Use documented transitions when available. */
  updateStatus: async (id: string, status: string): Promise<ApiResponse<Table>> => {
    let backendStatus = 'AVAILABLE';
    const statusUpper = status.toUpperCase();
    if (statusUpper === 'NEEDS_CLEANING' || statusUpper === 'DIRTY' || statusUpper === 'CLEANING') {
      backendStatus = 'AVAILABLE';
    } else if (statusUpper === 'CLEANING_IN_PROGRESS') {
      backendStatus = 'CLEANING_IN_PROGRESS';
    } else if (statusUpper === 'OCCUPIED') {
      backendStatus = 'OCCUPIED';
    } else if (statusUpper === 'RESERVED') {
      backendStatus = 'RESERVED';
    } else if (statusUpper === 'AVAILABLE') {
      backendStatus = 'AVAILABLE';
    }

    const res = await fetchAPI<{ table: Table }>(`/staff/tables/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: backendStatus }),
    });
    return {
      success: res.success,
      data: res.data?.table,
      error: res.error,
    };
  },
};

// ── Customer Requests ──

export const requestsAPI = {
  /** GET /staff/requests — fetch all staff requests */
  getPending: async (): Promise<ApiResponse<CustomerRequest[]>> => {
    const res = await fetchAPI<{ requests: CustomerRequest[]; meta?: unknown }>('/staff/requests');
    return {
      success: res.success,
      data: res.data?.requests,
      error: res.error,
    };
  },

  /** PATCH /staff/requests/:id/accept — accept a staff request */
  accept: (id: string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/staff/requests/${id}/accept`, { method: 'PATCH' });
  },

  /** PATCH /staff/requests/:id/complete — complete a staff request */
  complete: (id: string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/staff/requests/${id}/complete`, { method: 'PATCH' });
  },

  /** Alias for request completion in the current UI */
  resolve: (id: string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/staff/requests/${id}/complete`, { method: 'PATCH' });
  },
};

// ── Queue ──

export const queueAPI = {
  getQueue: async (): Promise<ApiResponse<QueueItem[]>> => {
    const res = await fetchAPI<{ queue: QueueItem[]; meta?: unknown }>('/staff/queue');
    return {
      success: res.success,
      data: res.data?.queue,
      error: res.error,
    };
  },

  getItem: async (id: number): Promise<ApiResponse<QueueItem>> => {
    const res = await fetchAPI<{ item: QueueItem }>(`/staff/queue/${id}`);
    return {
      success: res.success,
      data: res.data?.item,
      error: res.error,
    };
  },

  updatePriority: (id: number, priority: 'LOW' | 'MEDIUM' | 'HIGH'): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/staff/queue/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority }),
    });
  },
};

// ── Reservations ──

export const reservationsAPI = {
  getReservations: async (): Promise<ApiResponse<Reservation[]>> => {
    const res = await fetchAPI<{ reservations: Reservation[]; meta?: unknown }>('/staff/reservations');
    return {
      success: res.success,
      data: res.data?.reservations,
      error: res.error,
    };
  },

  createReservation: async (payload: {
    customerName: string;
    customerEmail?: string;
    mobile: string;
    guests: number;
    date: string;
    slot: string;
    tableNumber?: string;
    notes?: string;
    occasion?: string;
  }): Promise<ApiResponse<Reservation>> => {
    const res = await fetchAPI<{ reservation: Reservation }>('/staff/reservations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      success: res.success,
      data: res.data?.reservation,
      error: res.error,
    };
  },

  getReservation: async (id: string): Promise<ApiResponse<Reservation>> => {
    const res = await fetchAPI<{ reservation: Reservation }>(`/staff/reservations/${id}`);
    return {
      success: res.success,
      data: res.data?.reservation,
      error: res.error,
    };
  },

  checkIn: async (id: string): Promise<ApiResponse<Reservation>> => {
    const res = await fetchAPI<{ reservation: Reservation }>(`/staff/reservations/${id}/check-in`, {
      method: 'PATCH',
    });
    return {
      success: res.success,
      data: res.data?.reservation,
      error: res.error,
    };
  },
};

// ── Orders ──

export const ordersAPI = {
  getReadyOrders: async (): Promise<ApiResponse<OrderItem[]>> => {
    const res = await fetchAPI<{ orders: OrderItem[]; meta?: unknown }>('/staff/orders/ready');
    return {
      success: res.success,
      data: res.data?.orders,
      error: res.error,
    };
  },

  pickOrder: (id: string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/staff/orders/${id}/pick`, { method: 'PATCH' });
  },

  serveOrder: (id: string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/staff/orders/${id}/serve`, { method: 'PATCH' });
  },

  completeOrder: (id: string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/staff/orders/${id}/complete`, { method: 'PATCH' });
  },
};

// ── Issues ──

export const issuesAPI = {
  escalate: (payload: EscalationPayload): Promise<ApiResponse<void>> => {
    return fetchAPI<void>('/staff/issues/escalate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ── Food Alerts ──

export const foodAlertsAPI = {
  /** GET /notifications */
  getActive: async (): Promise<ApiResponse<FoodAlert[]>> => {
    const res = await fetchAPI<{ notifications: any[] }>('/notifications');
    const mapped = (res.data?.notifications || []).map((n: any) => ({
      id: String(n._id || n.id),
      tableNumber: n.metadata?.tableNumber || 'Table 1',
      items: Array.isArray(n.metadata?.items) ? n.metadata.items : [n.message || n.title],
      readyAt: new Date(n.createdAt).toLocaleTimeString(),
    }));
    return {
      success: res.success,
      data: mapped,
      error: res.error,
    };
  },

  /** PATCH /notifications/:id/read */
  action: (id: string, _action: 'picked_up' | 'served'): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/notifications/${id}/read`, { method: 'PATCH' });
  },
};

export const notificationsAPI = {
  /** GET /notifications */
  getAll: async (): Promise<ApiResponse<any[]>> => {
    const res = await fetchAPI<{ notifications: any[] }>('/notifications');
    return {
      success: res.success,
      data: res.data?.notifications,
      error: res.error,
    };
  },

  /** PATCH /notifications/:id/read */
  markAsRead: (id: string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  /** PATCH /notifications/read-all */
  markAllAsRead: (): Promise<ApiResponse<void>> => {
    return fetchAPI<void>('/notifications/read-all', { method: 'PATCH' });
  },
};

// ── Menu ──

export const menuAPI = {
  getItems: async (): Promise<ApiResponse<any[]>> => {
    const res = await fetchAPI<{ items: any[]; meta?: unknown }>('/admin/menu/items');
    return {
      success: res.success,
      data: res.data?.items,
      error: res.error,
    };
  },

  /** GET /admin/menu/categories */
  getCategories: async (): Promise<ApiResponse<any[]>> => {
    const res = await fetchAPI<{ categories: any[] }>('/admin/menu/categories');
    return {
      success: res.success,
      data: res.data?.categories,
      error: res.error,
    };
  },

  /** PATCH /admin/menu/items/:id/availability */
  toggleAvailability: async (id: string, isAvailable: boolean): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/admin/menu/items/${id}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    });
  },

  /** POST /admin/menu/items */
  createItem: async (item: any): Promise<ApiResponse<any>> => {
    return fetchAPI<any>('/admin/menu/items', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  /** DELETE /admin/menu/items/:id */
  deleteItem: async (id: string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/admin/menu/items/${id}`, {
      method: 'DELETE',
    });
  },
};

// ── Staff ──

export const staffAPI = {
  /** GET /admin/staff */
  getAll: (): Promise<ApiResponse<StaffMember[]>> => {
    // admin staff list is the documented source of truth for staff management.
    // If the backend exposes a different service route, update this wrapper accordingly.
    return fetchAPI<StaffMember[]>('/admin/staff');
  },

  /** GET /admin/staff/stats */
  getStats: (): Promise<ApiResponse<StaffStats>> => {
    return fetchAPI<StaffStats>('/admin/staff/stats');
  },

  /** POST /admin/staff */
  create: (staff: Omit<StaffMember, 'id'>): Promise<ApiResponse<StaffMember>> => {
    return fetchAPI<StaffMember>('/admin/staff', {
      method: 'POST',
      body: JSON.stringify(staff),
    });
  },

  /** PATCH /admin/staff/:id */
  update: (id: string, updates: Partial<StaffMember>): Promise<ApiResponse<StaffMember>> => {
    return fetchAPI<StaffMember>(`/admin/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  /** DELETE /admin/staff/:id */
  delete: (id: string): Promise<ApiResponse<void>> => {
    return fetchAPI<void>(`/admin/staff/${id}`, { method: 'DELETE' });
  },
};

// ── Analytics ──

export const analyticsAPI = {
  /** GET /admin/staff/attendance */
  getAttendance: (): Promise<ApiResponse<AttendanceData>> => {
    return fetchAPI<AttendanceData>('/admin/staff/attendance');
  },

  /** GET /admin/staff/payroll */
  getPayroll: (): Promise<ApiResponse<PayrollData>> => {
    return fetchAPI<PayrollData>('/admin/staff/payroll');
  },

  /** GET /admin/staff/performance */
  getPerformance: (): Promise<ApiResponse<PerformanceData>> => {
    return fetchAPI<PerformanceData>('/admin/staff/performance');
  },

  /** GET /admin/staff/roles */
  getRoles: (): Promise<ApiResponse<RolesData>> => {
    return fetchAPI<RolesData>('/admin/staff/roles');
  },

  /** GET /admin/staff/shifts/list */
  getSchedule: (): Promise<ApiResponse<ScheduleItem[]>> => {
    return fetchAPI<ScheduleItem[]>('/admin/staff/shifts/list');
  },

  /** GET /admin/staff/birthdays */
  getBirthdays: (): Promise<ApiResponse<BirthdayItem[]>> => {
    return fetchAPI<BirthdayItem[]>('/admin/staff/birthdays');
  },
};

// ── User / Auth ──

export const userAPI = {
  /** GET /auth/me — get authenticated user profile */
  getProfile: async (): Promise<ApiResponse<StaffMember>> => {
    const res = await fetchAPI<{ user: Partial<StaffMember> & { mobile?: string; role?: string; restaurantName?: string; id?: string } }>('/auth/me');
    return {
      success: res.success,
      data: res.data?.user ? buildStaffProfile(res.data.user) : undefined,
      error: res.error,
    };
  },

  /** PATCH /users/me — update profile */
  updateProfile: async (updates: Partial<StaffMember> & { mobile?: string }): Promise<ApiResponse<StaffMember>> => {
    const payload: any = { ...updates };
    if (updates.phone) {
      payload.mobile = updates.phone;
      delete payload.phone;
    }
    const res = await fetchAPI<{ user: Partial<StaffMember> & { mobile?: string; role?: string; restaurantName?: string; id?: string } }>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return {
      success: res.success,
      data: res.data?.user ? buildStaffProfile(res.data.user) : undefined,
      error: res.error,
    };
  },

  /** POST /auth/logout */
  logout: (): Promise<ApiResponse<void>> => {
    return fetchAPI<void>('/auth/logout', { method: 'POST' });
  },
};
