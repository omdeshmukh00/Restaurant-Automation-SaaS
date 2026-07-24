// src/features/staff/store/staff.store.ts

export interface WaiterProfile {
  name: string;
  role: string;
  id: string;
  section: string;
  status: string;
  email: string;
  phone: string;
  joined: string;
  avatar: string;
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber?: string;
  table: string;
  items: OrderItem[];
  status: 'Pending' | 'Preparing' | 'Ready' | 'Served' | 'Completed' | 'Cancelled';
  time: string;
  total: number;
  rating?: number;
}

export interface ReadyItem {
  id: string;
  table: string;
  item: string;
  qty: number;
  station: 'Main Kitchen' | 'Bar' | 'Dessert Station';
  readySince: string;
  elapsedSec: number;
}

export interface RequestItem {
  id: string;
  table: string;
  type: 'Call Waiter' | 'Water Bottle' | 'Extra Napkins' | 'Clean Table' | 'Extra Cutlery';
  time: string;
  elapsedMinutes: number;
  status: 'Pending' | 'InProgress' | 'Resolved';
  severity: 'low' | 'medium' | 'high';
}

export interface AlertItem {
  id: string;
  message: string;
  type: 'Delayed' | 'Cleaning' | 'Reassigned' | 'Kitchen' | 'System';
  severity: 'Critical' | 'Warning' | 'Info';
  time: string;
}

export interface StaffTable {
  id: string;
  name: string;
  section: 'Zone A' | 'Zone B' | 'Outdoor';
  capacity: number;
  guests: number;
  status: 'Available' | 'Reserved' | 'Occupied' | 'Cleaning' | 'Bill Requested' | 'Food Served';
  currentBill?: number;
  elapsed?: string;
  action?: string;
  assignedGuest?: string;
  turns?: number;
  assignedStaffId?: string | null;
  assignedWaiterId?: string | null;
  assignedWaiterName?: string;
  occupiedAt?: string | Date | null;
  estimatedVacantAt?: string | Date | null;
  waitingAssigned?: boolean;
}

export interface StaffReservation {
  id: string;
  name: string;
  pax: number;
  time: string;
  phone: string;
  status: 'Confirmed' | 'Seated' | 'Cancelled' | 'Notified';
  type: 'Reservation' | 'Walk-in';
  queueNo?: number;
  assignedTable?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'Starters' | 'Mains' | 'Desserts' | 'Beverages';
  price: number;
  available: boolean;
  spicy?: boolean;
  veg: boolean;
  description: string;
}

class StaffStore {
  private static instance: StaffStore;
  
  public profile: WaiterProfile = this.loadProfile();
  public orders: Order[] = this.loadOrders();
  public readyItems: ReadyItem[] = this.loadReadyItems();
  public requests: RequestItem[] = this.loadRequests();
  public alerts: AlertItem[] = this.loadAlerts();
  public tables: StaffTable[] = this.loadTables();
  public reservations: StaffReservation[] = this.loadReservations();
  public menuItems: MenuItem[] = this.loadMenuItems();

  public loading: boolean = false;
  public apiError: string | null = null;
  public hasSyncedWithBackend: boolean = false;

  private listeners: Set<() => void> = new Set();

  constructor() {
    if (StaffStore.instance) {
      return StaffStore.instance;
    }
    StaffStore.instance = this;
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify() {
    this.listeners.forEach(l => l());
  }

  public setLoading(loading: boolean) {
    this.loading = loading;
    this.notify();
  }

  public setApiError(error: string | null) {
    this.apiError = error;
    this.notify();
  }

  public setHasSyncedWithBackend(synced: boolean) {
    this.hasSyncedWithBackend = synced;
    this.notify();
  }

  private loadProfile(): WaiterProfile {
    const defaultProfile: WaiterProfile = {
      name: 'Staff Member',
      role: 'Floor Supervisor',
      id: 'EMP-9021',
      section: 'Service Floor',
      status: 'On Duty',
      email: '',
      phone: '',
      joined: 'Jan 2025',
      avatar: ''
    };

    if (typeof window !== 'undefined') {
      try {
        const storedUserRaw = localStorage.getItem('ra/user/staff');
        if (storedUserRaw) {
          const u = JSON.parse(storedUserRaw);
          const rawRole = u.internal_role || u.staff_role || u.staffRole || u.role;
          const sRole = String(rawRole || '').trim().toUpperCase();
          let mappedRole = 'Floor Supervisor';
          if (sRole === 'FLOOR_SUPERVISOR' || sRole === 'SUPERVISOR' || sRole === 'FLOOR SUPERVISOR') {
            mappedRole = 'Floor Supervisor';
          } else if (sRole === 'FLOOR_STAFF' || sRole === 'FLOOR STAFF' || sRole === 'FLOOR') {
            mappedRole = 'Floor Staff';
          } else if (sRole === 'WAITER' || sRole === 'SERVER') {
            mappedRole = 'Waiter';
          }
          return {
            ...defaultProfile,
            id: u.id || defaultProfile.id,
            name: u.name || defaultProfile.name,
            role: mappedRole,
            email: u.email || '',
            phone: u.mobile || u.phone || '',
          };
        }
      } catch (e) {
        console.error('Failed to parse ra/user/staff', e);
      }

      const saved = localStorage.getItem('dineease-staff-profile');
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

  public updateProfile(updated: Partial<WaiterProfile>) {
    this.profile = { ...this.profile, ...updated };
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineease-staff-profile', JSON.stringify(this.profile));
    }
    this.notify();
  }

  private loadOrders(): Order[] {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-orders');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  }

  private loadReadyItems(): ReadyItem[] {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-ready');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  }

  private loadRequests(): RequestItem[] {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-requests');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  }

  private loadAlerts(): AlertItem[] {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-alerts');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  }

  private loadTables(): StaffTable[] {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-tables');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  }

  public setOrders(orders: Order[] | ((prev: Order[]) => Order[])) {
    this.orders = typeof orders === 'function' ? orders(this.orders) : orders;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineease-staff-orders', JSON.stringify(this.orders));
    }
    this.notify();
  }

  public setReadyItems(readyItems: ReadyItem[] | ((prev: ReadyItem[]) => ReadyItem[])) {
    this.readyItems = typeof readyItems === 'function' ? readyItems(this.readyItems) : readyItems;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineease-staff-ready', JSON.stringify(this.readyItems));
    }
    this.notify();
  }

  public setRequests(requests: RequestItem[] | ((prev: RequestItem[]) => RequestItem[])) {
    this.requests = typeof requests === 'function' ? requests(this.requests) : requests;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineease-staff-requests', JSON.stringify(this.requests));
    }
    this.notify();
  }

  public setAlerts(alerts: AlertItem[] | ((prev: AlertItem[]) => AlertItem[])) {
    this.alerts = typeof alerts === 'function' ? alerts(this.alerts) : alerts;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineease-staff-alerts', JSON.stringify(this.alerts));
    }
    this.notify();
  }

  public setTables(tables: StaffTable[] | ((prev: StaffTable[]) => StaffTable[])) {
    this.tables = typeof tables === 'function' ? tables(this.tables) : tables;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineease-staff-tables', JSON.stringify(this.tables));
    }
    this.notify();
  }

  private loadReservations(): StaffReservation[] {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-reservations');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  }

  public setReservations(reservations: StaffReservation[] | ((prev: StaffReservation[]) => StaffReservation[])) {
    this.reservations = typeof reservations === 'function' ? reservations(this.reservations) : reservations;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineease-staff-reservations', JSON.stringify(this.reservations));
    }
    this.notify();
  }

  private loadMenuItems(): MenuItem[] {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-menu');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
      }
    }
    return [];
  }

  public setMenuItems(menu: MenuItem[] | ((prev: MenuItem[]) => MenuItem[])) {
    this.menuItems = typeof menu === 'function' ? menu(this.menuItems) : menu;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineease-staff-menu', JSON.stringify(this.menuItems));
    }
    this.notify();
  }
}

export const staffStore = new StaffStore();
