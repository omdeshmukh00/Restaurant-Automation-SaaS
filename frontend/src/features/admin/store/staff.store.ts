import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../../../shared/services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────

export type StaffRole       = 'Manager' | 'Chef' | 'Server' | 'Bartender' | 'Host' | 'Cleaner';
export type StaffDepartment = 'Management' | 'Kitchen' | 'Service' | 'Bar' | 'Front Desk' | 'Cleaning';
export type StaffStatus     = 'Active' | 'On Leave' | 'Inactive';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: StaffRole;
  department: StaffDepartment;
  phone: string;
  status: StaffStatus;
  hireDate: string;
  performance: number; // 0-5, derived from the performance endpoint
  salary: number; // in INR, from backend
  dateOfBirth?: string; // ISO date, from backend
  dbRole?: string;
  kitchen_role?: string | null;
  staff_role?: string | null;
  cleaning_role?: string | null;
}

export interface ShiftAssignment {
  id: string;
  staffId: string;
  staffName: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  notes?: string;
  scheduledToday: boolean;
  activeNow: boolean;
}

export interface UpcomingBirthday {
  id: string;
  name: string;
  avatar: string;
  date: string;
  daysUntil?: number;
}

export interface AttendanceBreakdown {
  label: string;
  count: number;
  color: string;
}

export interface PayrollLine {
  label: string;
  amount: string;
}

export interface StaffStats {
  totalStaff: number;
  totalStaffChange: string;
  activeToday: number;
  activeTodayPct: string;
  onLeave: number;
  onLeavePct: string;
  totalPayroll: string;
  totalPayrollChange: string;
  avgPerformance: string;
  avgPerformanceChange: string;
  attendancePct: number;
}

export interface RoleDistribution {
  role: StaffRole;
  count: number;
  pct: string;
  color: string;
}

export interface AttendanceRecord {
  staffId: string;
  name: string;
  role: string;
  status: string;
  activeShift: { clockIn: string; clockOut: string | null } | null;
  scheduledToday: boolean;
  onShiftNow: boolean;
  attendanceStatus: string;
}

export interface PerformanceRecord {
  staffId: string;
  name: string;
  role: string;
  status: string;
  serviceOrders: number;
  completedServiceOrders: number;
  serviceCompletionRate: number;
  kitchenOrders: number;
  readyKitchenOrders: number;
  kitchenCompletionRate: number;
  avgKitchenMinutes: number;
  acceptedRequests: number;
  completedRequests: number;
  startedCleaningTasks: number;
  completedCleaningTasks: number;
  verifiedCleaningTasks: number;
}

export interface AddStaffInput {
  name: string;
  email: string;
  phone: string;
  password?: string;
  dbRole?: string;
  kitchen_role?: string | null;
  staff_role?: string | null;
  cleaning_role?: string | null;
  role: StaffRole;
  department: StaffDepartment;
  status: StaffStatus;
  salary: number;
  dateOfBirth?: string;
}

// ── Mapping Helper ─────────────────────────────────────────────────────────

export function mapBackendUserToStaffMember(user: any): StaffMember {
  const initials = user.name
    ? user.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : 'US';

  let feRole: StaffRole = 'Server';
  let feDept: StaffDepartment = 'Service';

  if (user.role === 'kitchen-staff') {
    feRole = 'Chef';
    feDept = 'Kitchen';
  } else if (user.role === 'service-staff') {
    feRole = 'Server';
    feDept = 'Service';
  } else if (user.role === 'cleaning-staff') {
    feRole = 'Cleaner';
    feDept = 'Cleaning';
  } else if (user.role === 'restaurant-admin') {
    feRole = 'Manager';
    feDept = 'Management';
  }

  let feStatus: StaffStatus = 'Active';
  if (user.status === 'INACTIVE' || user.status === 'BLOCKED') {
    feStatus = 'Inactive';
  } else if (user.status === 'SUSPENDED') {
    feStatus = 'On Leave';
  }

  const hireDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Jan 1, 2024';

  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    avatar: initials,
    role: feRole,
    department: feDept,
    phone: user.mobile || '',
    status: feStatus,
    hireDate,
    performance: 0, // filled in from the performance endpoint
    salary: typeof user.salary === 'number' ? user.salary : 0,
    dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString() : undefined,
    dbRole: user.role,
    kitchen_role: user.kitchen_role ?? null,
    staff_role: user.staff_role ?? null,
    cleaning_role: user.cleaning_role ?? null,
  };
}

// ── Derived data helpers (all computed from real backend data) ─────────────

const ROLE_COLORS: Record<StaffRole, string> = {
  Manager: '#f97316',
  Chef: '#22c55e',
  Server: '#3b82f6',
  Bartender: '#a855f7',
  Host: '#eab308',
  Cleaner: '#64748b',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function computePerformanceScore(p?: PerformanceRecord): number {
  if (!p) return 0;
  const blend = ((p.serviceCompletionRate || 0) + (p.kitchenCompletionRate || 0)) / 2;
  return Math.round(blend * 5 * 10) / 10;
}

function withPerformance(members: StaffMember[], performance: PerformanceRecord[]): StaffMember[] {
  const map = new Map(performance.map((p) => [p.staffId, p]));
  return members.map((m) => ({ ...m, performance: computePerformanceScore(map.get(m.id)) }));
}

function deriveStats(
  members: StaffMember[],
  attendance: AttendanceRecord[],
  performance: PerformanceRecord[],
): StaffStats {
  const totalStaff = members.length;
  const activeToday = attendance.filter((a) => a.onShiftNow || a.attendanceStatus === 'ON_SHIFT').length;
  const onLeave = members.filter((m) => m.status === 'On Leave').length;
  const totalSalary = members.reduce((s, m) => s + (m.salary || 0), 0);
  const avgPerf = performance.length
    ? Math.round((performance.reduce((s, p) => s + computePerformanceScore(p), 0) / performance.length) * 10) / 10
    : 0;
  const onShiftNow = attendance.filter((a) => a.onShiftNow).length;
  const attendancePct = attendance.length ? Math.round((onShiftNow / attendance.length) * 100) : 0;

  return {
    totalStaff,
    totalStaffChange: '',
    activeToday,
    activeTodayPct: `${totalStaff ? Math.round((activeToday / totalStaff) * 100) : 0}% of total staff`,
    onLeave,
    onLeavePct: `${totalStaff ? Math.round((onLeave / totalStaff) * 100) : 0}% of total staff`,
    totalPayroll: `₹${totalSalary.toLocaleString('en-IN')}`,
    totalPayrollChange: '',
    avgPerformance: `${avgPerf.toFixed(1)} / 5.0`,
    avgPerformanceChange: '',
    attendancePct,
  };
}

function deriveAttendanceBreakdown(attendance: AttendanceRecord[], members: StaffMember[]): AttendanceBreakdown[] {
  const onLeaveIds = new Set(members.filter((m) => m.status === 'On Leave').map((m) => m.id));
  const onShift = attendance.filter((a) => a.attendanceStatus === 'ON_SHIFT').length;
  const offShift = attendance.filter((a) => a.attendanceStatus === 'OFF_SHIFT').length;
  const noShift = attendance.filter((a) => a.attendanceStatus === 'NO_SHIFT' && !onLeaveIds.has(a.staffId)).length;
  const onLeave = onLeaveIds.size;
  return [
    { label: 'On Shift', count: onShift, color: '#22c55e' },
    { label: 'Off Shift', count: offShift, color: '#f97316' },
    { label: 'No Shift', count: noShift, color: '#64748b' },
    { label: 'On Leave', count: onLeave, color: '#a855f7' },
  ];
}

function derivePayrollLines(members: StaffMember[]): PayrollLine[] {
  const salaries = members.map((m) => m.salary || 0);
  const total = salaries.reduce((a, b) => a + b, 0);
  const avg = salaries.length ? Math.round(total / salaries.length) : 0;
  const max = salaries.length ? Math.max(...salaries) : 0;
  const min = salaries.length ? Math.min(...salaries) : 0;
  return [
    { label: 'Total Payroll', amount: `₹${total.toLocaleString('en-IN')}` },
    { label: 'Average Salary', amount: `₹${avg.toLocaleString('en-IN')}` },
    { label: 'Highest', amount: `₹${max.toLocaleString('en-IN')}` },
    { label: 'Lowest', amount: `₹${min.toLocaleString('en-IN')}` },
  ];
}

function deriveRoleDistribution(members: StaffMember[]): RoleDistribution[] {
  const counts: Record<string, number> = {};
  members.forEach((m) => {
    counts[m.role] = (counts[m.role] || 0) + 1;
  });
  const total = members.length || 1;
  return (Object.keys(ROLE_COLORS) as StaffRole[]).map((role) => ({
    role,
    count: counts[role] || 0,
    pct: `${Math.round(((counts[role] || 0) / total) * 100)}%`,
    color: ROLE_COLORS[role],
  }));
}

function deriveBirthdays(members: StaffMember[]): UpcomingBirthday[] {
  const now = new Date();
  return members
    .filter((m) => m.dateOfBirth)
    .map((m) => {
      const dob = new Date(m.dateOfBirth as string);
      const month = dob.getMonth();
      const day = dob.getDate();
      let next = new Date(now.getFullYear(), month, day);
      if (next < now) next = new Date(now.getFullYear() + 1, month, day);
      const daysUntil = Math.ceil((next.getTime() - now.getTime()) / 86400000);
      return {
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        date: `${MONTHS[month]} ${day}`,
        daysUntil,
      };
    })
    .sort((a, b) => (a.daysUntil || 0) - (b.daysUntil || 0));
}

function recompute(
  set: (partial: Partial<StaffStore>) => void,
  get: () => StaffStore,
): void {
  const { members, attendance, performance } = get();
  const membersWithPerf = withPerformance(members, performance);
  set({
    members: membersWithPerf,
    stats: deriveStats(membersWithPerf, attendance, performance),
    attendanceBreakdown: deriveAttendanceBreakdown(attendance, membersWithPerf),
    payrollLines: derivePayrollLines(membersWithPerf),
    roleDistribution: deriveRoleDistribution(membersWithPerf),
    birthdays: deriveBirthdays(membersWithPerf),
  });
}

// ── Store ──────────────────────────────────────────────────────────────────

interface StaffStore {
  stats: StaffStats;
  members: StaffMember[];
  shifts: ShiftAssignment[];
  birthdays: UpcomingBirthday[];
  attendance: AttendanceRecord[];
  performance: PerformanceRecord[];
  attendanceBreakdown: AttendanceBreakdown[];
  payrollLines: PayrollLine[];
  roleDistribution: RoleDistribution[];

  // filters
  searchQuery: string;
  roleFilter: StaffRole | 'All Roles';
  departmentFilter: StaffDepartment | 'All Departments';
  statusFilter: StaffStatus | 'All';
  currentPage: number;
  perPage: number;
  showAll: boolean;

  setSearchQuery: (q: string) => void;
  setRoleFilter: (r: StaffRole | 'All Roles') => void;
  setDepartmentFilter: (d: StaffDepartment | 'All Departments') => void;
  setStatusFilter: (s: StaffStatus | 'All') => void;
  setCurrentPage: (p: number) => void;
  setShowAll: (v: boolean) => void;
  updateMemberStatus: (id: string, status: StaffStatus) => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchAttendance: () => Promise<void>;
  fetchPerformance: () => Promise<void>;
  fetchShifts: () => Promise<void>;
  addMember: (m: AddStaffInput) => Promise<void>;
  updateMember: (id: string, updates: Partial<StaffMember> & { password?: string; dateOfBirth?: string }) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

const EMPTY_STATS: StaffStats = {
  totalStaff: 0,
  totalStaffChange: '',
  activeToday: 0,
  activeTodayPct: '',
  onLeave: 0,
  onLeavePct: '',
  totalPayroll: '₹0',
  totalPayrollChange: '',
  avgPerformance: '0.0 / 5.0',
  avgPerformanceChange: '',
  attendancePct: 0,
};

export const useStaffStore = create<StaffStore>()(
  persist(
    (set, get) => ({
      stats: EMPTY_STATS,
      members: [],
      shifts: [],
      birthdays: [],
      attendance: [],
      performance: [],
      attendanceBreakdown: [],
      payrollLines: [],
      roleDistribution: [],

      searchQuery: '',
      roleFilter: 'All Roles',
      departmentFilter: 'All Departments',
      statusFilter: 'All',
      currentPage: 1,
      perPage: 5,
      showAll: false,

      setSearchQuery:      (q) => set({ searchQuery: q, currentPage: 1 }),
      setRoleFilter:       (r) => set({ roleFilter: r, currentPage: 1 }),
      setDepartmentFilter: (d) => set({ departmentFilter: d, currentPage: 1 }),
      setStatusFilter:     (s) => set({ statusFilter: s, currentPage: 1 }),
      setCurrentPage:      (p) => set({ currentPage: p }),
      setShowAll:          (v) => set({ showAll: v, currentPage: 1 }),

      fetchMembers: async () => {
        try {
          let res: any;
          try {
            res = await apiClient.get('/staff/members');
          } catch {
            res = await apiClient.get('/admin/staff');
          }
          set({ members: (res.data.data.staff || []).map(mapBackendUserToStaffMember) });
          recompute(set, get);
        } catch (err) {
          console.error('Failed to fetch staff members', err);
        }
      },

      fetchAttendance: async () => {
        try {
          let res: any;
          try {
            res = await apiClient.get('/staff/members/attendance');
          } catch {
            res = await apiClient.get('/admin/staff/attendance');
          }
          set({ attendance: res.data.data.attendance || [] });
          recompute(set, get);
        } catch (err) {
          console.error('Failed to fetch attendance', err);
        }
      },

      fetchPerformance: async () => {
        try {
          let res: any;
          try {
            res = await apiClient.get('/staff/members/performance');
          } catch {
            res = await apiClient.get('/admin/staff/performance');
          }
          set({ performance: res.data.data.performance || [] });
          recompute(set, get);
        } catch (err) {
          console.error('Failed to fetch performance', err);
        }
      },

      fetchShifts: async () => {
        try {
          let res: any;
          try {
            res = await apiClient.get('/staff/members/shifts/list');
          } catch {
            res = await apiClient.get('/admin/staff/shifts/list');
          }
          set({ shifts: res.data.data.shifts || [] });
        } catch (err) {
          console.error('Failed to fetch shifts', err);
        }
      },

      updateMemberStatus: async (id, status) => {
        try {
          const dbStatus = status === 'Active' ? 'ACTIVE' : status === 'On Leave' ? 'SUSPENDED' : 'INACTIVE';
          await apiClient.patch(`/admin/staff/${id}`, { status: dbStatus });
          set((state) => ({
            members: state.members.map((m) => (m.id === id ? { ...m, status } : m)),
          }));
          recompute(set, get);
        } catch (err) {
          console.error('Failed to update member status', err);
        }
      },

      addMember: async (m) => {
        try {
          const payload = {
            name: m.name,
            email: m.email,
            mobile: m.phone,
            password: m.password || 'Staff@123',
            role: m.dbRole || 'service-staff',
            status: m.status === 'Active' ? 'ACTIVE' : m.status === 'On Leave' ? 'SUSPENDED' : 'INACTIVE',
            kitchen_role: m.kitchen_role || null,
            staff_role: m.staff_role || null,
            cleaning_role: m.cleaning_role || null,
            salary: typeof m.salary === 'number' ? m.salary : 0,
            dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth).toISOString() : null,
          };
          const res = await apiClient.post('/admin/staff', payload);
          set((state) => ({
            members: [...state.members, mapBackendUserToStaffMember(res.data.data.staff)],
          }));
          recompute(set, get);
        } catch (err) {
          console.error('Failed to add staff member', err);
          throw err;
        }
      },

      updateMember: async (id, updates) => {
        try {
          const payload: any = {};
          if (updates.name !== undefined) payload.name = updates.name;
          if (updates.email !== undefined) payload.email = updates.email;
          if (updates.phone !== undefined) payload.mobile = updates.phone;
          if (updates.password !== undefined && updates.password.trim() !== '') {
            payload.password = updates.password;
          }
          if (updates.dbRole !== undefined) payload.role = updates.dbRole;
          if (updates.status !== undefined) {
            payload.status =
              updates.status === 'Active' ? 'ACTIVE' : updates.status === 'On Leave' ? 'SUSPENDED' : 'INACTIVE';
          }
          if (updates.kitchen_role !== undefined) payload.kitchen_role = updates.kitchen_role;
          if (updates.staff_role !== undefined) payload.staff_role = updates.staff_role;
          if (updates.cleaning_role !== undefined) payload.cleaning_role = updates.cleaning_role;
          if (updates.salary !== undefined) payload.salary = updates.salary;
          if (updates.dateOfBirth !== undefined) {
            payload.dateOfBirth = updates.dateOfBirth ? new Date(updates.dateOfBirth).toISOString() : null;
          }

          const res = await apiClient.patch(`/admin/staff/${id}`, payload);
          set((state) => ({
            members: state.members.map((m) =>
              m.id === id ? mapBackendUserToStaffMember(res.data.data.staff) : m,
            ),
          }));
          recompute(set, get);
        } catch (err) {
          console.error('Failed to update staff member', err);
          throw err;
        }
      },

      deleteMember: async (id) => {
        try {
          await apiClient.delete(`/admin/staff/${id}`);
          set((state) => ({
            members: state.members.filter((m) => m.id !== id),
          }));
          recompute(set, get);
        } catch (err) {
          console.error('Failed to delete staff member', err);
          throw err;
        }
      },
    }),
    {
      name: 'admin-staff-store-v2',
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        roleFilter: state.roleFilter,
        departmentFilter: state.departmentFilter,
        statusFilter: state.statusFilter,
        currentPage: state.currentPage,
        perPage: state.perPage,
        showAll: state.showAll,
      }),
    },
  ),
);
