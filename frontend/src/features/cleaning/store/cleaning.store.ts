// src/features/cleaning/store/cleaning.store.ts

export type TableStatus =
  | 'Needs Cleaning'
  | 'Cleaning Requested'
  | 'In Progress'
  | 'Ready for Inspection'
  | 'Available'
  | 'Done'
  | '--';
export type PriorityLevel = 'High' | 'Medium' | 'Low';

export interface CleaningStaffMember {
  id: string;
  name: string;
  role: string;
  area: string;
  phone: string;
  avatar: string;
}

export interface RoutineChore {
  id: string;
  name: string;
  area: string;
  frequency: string;
  assignedTo: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  lastDone?: string;
}

export interface TableItem {
  id: string;
  area: string;
  seats: number;
  status: TableStatus;
  priority: PriorityLevel;
  timeAgo: string; // Time elapsed since vacant
  assignedTo: { name: string; avatar: string } | null;
  progress?: number; // Only for In Progress tables
  notes?: string;
  maintenanceIssue?: string;
  taskType?: string;
  taskName?: string;
  floor?: number;
  section?: string;
  taskId?: string;
}

export interface CleaningRequest {
  id: string;
  type: string;
  icon: string;
  iconColor: string;
  location: string;
  requestedBy: { name: string; avatar: string };
  priority: PriorityLevel;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | 'Scheduled';
  requestedOn: string;
  requestedTime: string;
  notes?: string;
  assignedTo?: { name: string; avatar: string } | null;
  rawId?: string;
}

export interface StaffProfile {
  name: string;
  id: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  joinedOn: string;
  status: string;
  avatar: string;
  preferredArea: string;
  preferredShift: string;
  daysAvailable: string;
  breakPreference: string;
  preferredTaskTypes: string;
}

class CleaningStore {
  private static instance: CleaningStore;

  public profile: StaffProfile = this.loadProfile();

  private loadProfile(): StaffProfile {
    const defaultProfile: StaffProfile = {
      name: 'Priya Sharma',
      id: 'CS-1024',
      email: 'priya.sharma@cleanserve.com',
      phone: '+91 98765 43210',
      role: 'Cleaning Staff',
      department: 'Housekeeping',
      joinedOn: 'Feb 12, 2024',
      status: 'Active',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDa2YAJKAFQ_1YcbCXr9gWlXaoH1A_IQEjTEvJow9XOiXzf7N3kKDctQGwB_KXYqfHi5PGPLS2I4O9fkKOEGiWdsildQg5Vfmz05wcp_WiN4rZKyxzhEspK03vL9BZsmY_SdVZj9jBt5lCmAfSkMUlzuHsIslYMMEX5Q0WjP3tzo_dJkKtNCBmGtgdDixcta81A9KxtOnzWftBuUDgJv8HOjUm_KQMlyHP7JMggbPxQp6Ewa-AVQYMO3uYRKs2vlrtM8QQdTQx4QhY',
      preferredArea: 'Dining Area A',
      preferredShift: 'Morning (6 AM - 2 PM)',
      daysAvailable: 'Mon, Tue, Wed, Thu, Fri, Sat',
      breakPreference: '1:00 PM - 1:30 PM',
      preferredTaskTypes: 'Table Cleaning, Restroom Cleaning, Floor Cleaning'
    };

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cleanserve-profile');
      if (saved) {
        try {
          return { ...defaultProfile, ...JSON.parse(saved) };
        } catch (e) {
          return defaultProfile;
        }
      }
    }
    return defaultProfile;
  }

  public updateProfile(updated: Partial<StaffProfile>) {
    this.profile = { ...this.profile, ...updated };
    if (typeof window !== 'undefined') {
      localStorage.setItem('cleanserve-profile', JSON.stringify(this.profile));
    }
    this.notify();
  }

  // Start empty and wait for backend data
  public tables: TableItem[] = [];

  public requests: CleaningRequest[] = [];

  public chores: RoutineChore[] = this.loadChores();

  private loadChores(): RoutineChore[] {
    const defaultChores: RoutineChore[] = [];

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cleanserve-chores');
      if (saved) {
        try { return JSON.parse(saved); } catch { return defaultChores; }
      }
    }
    return defaultChores;
  }

  public addChore(newChore: RoutineChore) {
    this.chores = [newChore, ...this.chores];
    this.saveChoresToLocalStorage();
    this.notify();
  }

  public updateChoreStatus(id: string, status: 'Pending' | 'In Progress' | 'Completed') {
    this.chores = this.chores.map((c) =>
      c.id === id
        ? {
            ...c,
            status,
            lastDone: status === 'Completed' ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : c.lastDone,
          }
        : c
    );
    this.saveChoresToLocalStorage();
    this.notify();
  }

  public deleteChore(id: string) {
    this.chores = this.chores.filter((c) => c.id !== id);
    this.saveChoresToLocalStorage();
    this.notify();
  }

  private saveChoresToLocalStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cleanserve-chores', JSON.stringify(this.chores));
    }
  }

  public addCleaningRequest(newRequest: CleaningRequest) {
    this.requests = [newRequest, ...this.requests];
    this.notify();
  }

  public staffMembers: CleaningStaffMember[] = this.loadStaff();

  private loadStaff(): CleaningStaffMember[] {
    const defaultStaff: CleaningStaffMember[] = [];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cleanserve-staff');
      if (saved) {
        try { return JSON.parse(saved); } catch { return defaultStaff; }
      }
    }
    return defaultStaff;
  }

  public setStaffMembers(members: CleaningStaffMember[]) {
    this.staffMembers = members;
    this.notify();
  }

  public addStaffMember(member: CleaningStaffMember) {
    this.staffMembers = [...this.staffMembers, member];
    if (typeof window !== 'undefined') {
      localStorage.setItem('cleanserve-staff', JSON.stringify(this.staffMembers));
    }
    this.notify();
  }

  public removeStaffMember(id: string) {
    this.staffMembers = this.staffMembers.filter((s) => s.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cleanserve-staff', JSON.stringify(this.staffMembers));
    }
    this.notify();
  }

  public assignTableStaff(tableId: string, member: { name: string; avatar: string } | null) {
    this.tables = this.tables.map((t) =>
      t.id === tableId ? { ...t, assignedTo: member } : t
    );
    this.notify();
  }

  public editTable(id: string, updates: Partial<TableItem>) {
    this.tables = this.tables.map((t) => (t.id === id ? { ...t, ...updates } : t));
    this.notify();
  }

  public deleteTable(id: string) {
    this.tables = this.tables.filter((t) => t.id !== id);
    this.notify();
  }

  public syncTasks(backendTasks: any[]) {
    this.tables = backendTasks.map((t: any) => {
      let priority: PriorityLevel = 'Medium';
      if (t.priority === 'HIGH') priority = 'High';
      if (t.priority === 'LOW') priority = 'Low';

      let status: TableStatus = 'Needs Cleaning';
      if (t.status === 'IN_PROGRESS') status = 'In Progress';
      else if (t.status === 'COMPLETED') status = 'Ready for Inspection';
      else if (t.status === 'VERIFIED') status = 'Available';

      const tableObj = t.tableDetails as any;
      const tableLabel = tableObj?.tableNumber || 'T00';

      return {
        id: tableLabel,
        taskId: t._id || t.id,
        area: tableObj?.section || 'Dining Area A',
        seats: tableObj?.capacity || 4,
        floor: tableObj?.floor || 1,
        section: tableObj?.section || 'Main',
        status,
        priority,
        timeAgo: 'Just Now',
        assignedTo: t.startedBy ? { name: 'Staff Member', avatar: '' } : null,
        notes: t.notes || '',
      };
    });
    this.notify();
  }
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (CleaningStore.instance) {
      return CleaningStore.instance;
    }
    CleaningStore.instance = this;
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public startCleaning(id: string) {
    this.tables = this.tables.map((t) => {
      if (t.id === id) {
        this.requests = this.requests.map((r) =>
          r.location.includes(id) ? { ...r, status: 'In Progress' } : r
        );
        return { ...t, status: 'In Progress', progress: 10, timeAgo: 'Started Just Now' };
      }
      return t;
    });
    this.notify();
  }
  public updateProgress(id: string) {
    this.tables = this.tables.map((t) => {
      if (t.id === id && t.status === 'In Progress') {
        const currentProgress = t.progress || 0;
        if (currentProgress >= 90) {
          return { ...t, status: 'Ready for Inspection', progress: 100, timeAgo: 'Just Now' };
        }
        return { ...t, progress: currentProgress + 20, timeAgo: 'Updated Just Now' };
      }
      return t;
    });
    this.notify();
  }

  public completeInspection(id: string) {
    this.tables = this.tables.map((t) => {
      if (t.id === id) {
        return { ...t, status: 'Ready for Inspection', progress: 100, timeAgo: 'Just Now' };
      }
      return t;
    });
    this.notify();
  }

  public reportMaintenance(id: string, issue: string) {
    this.tables = this.tables.map((t) => {
      if (t.id === id) {
        return { ...t, maintenanceIssue: issue, status: 'Needs Cleaning', priority: 'High' };
      }
      return t;
    });
    this.notify();
  }

  public addTable(newTable: TableItem) {
    this.tables = [...this.tables, newTable];
    this.notify();
  }
  public completeRequest(id: string) {
    const req = this.requests.find((r) => r.id === id);
    if (req && req.rawId) {
      this.tables = this.tables.map((t) => {
        if (t.id === req.rawId) {
          return { ...t, status: 'Done' as TableStatus };
        }
        return t;
      });
    }
    this.requests = this.requests.map((r) => (r.id === id ? { ...r, status: 'Completed' as const } : r));
    this.notify();
  }
  public verifyInspection(id: string) {
    this.tables = this.tables.filter((t) => t.id !== id);
    this.notify();
  }
  public updateRequestStatus(
    id: string,
    newStatus: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | 'Scheduled'
  ) {
    this.requests = this.requests.map((r) => {
      if (r.id === id) {
        if (r.rawId) {
          this.tables = this.tables.map((t) => {
            if (t.id === r.rawId) {
              let tableStatus: TableStatus = 'Available';
              if (newStatus === 'In Progress') {
                tableStatus = 'In Progress';
              } else if (newStatus === 'Completed') {
                tableStatus = 'Done';
              }
              return { ...t, status: tableStatus };
            }
            return t;
          });
        }
        return { ...r, status: newStatus };
      }
      return r;
    });
    this.notify();
  }
  public verifyRequest(id: string) {
    const req = this.requests.find((r) => r.id === id);
    if (req && req.rawId) {
      this.tables = this.tables.map((t) => {
        if (t.id === req.rawId) {
          return { ...t, status: '--' as TableStatus };
        }
        return t;
      });
    }
    this.requests = this.requests.filter((r) => r.id !== id);
    this.notify();
  }
}

export const cleaningStore = new CleaningStore();
