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
  type: 'Call Waiter' | 'Water Bottle' | 'Extra Napkins' | 'Clean Table' | 'Cutlery';
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
}

export interface StaffReservation {
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

  private notify() {
    this.listeners.forEach(l => l());
  }

  private loadProfile(): WaiterProfile {
    const defaultProfile: WaiterProfile = {
      name: 'Rahul Sharma',
      role: 'Senior Waiter',
      id: 'EMP-9021',
      section: 'Zone A (Tables 1-8)',
      status: 'On Duty',
      email: 'rahul.sharma@dineease.com',
      phone: '+91 99999 88888',
      joined: 'Jan 2025',
      avatar: ''
    };

    if (typeof window !== 'undefined') {
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
    const defaults: Order[] = [
      {
        id: 'ORD-8271',
        table: 'Table 1',
        items: [
          { name: 'Paneer Tikka Masala', qty: 1, price: 340 },
          { name: 'Butter Naan', qty: 3, price: 60 },
          { name: 'Dal Makhani', qty: 1, price: 280 }
        ],
        status: 'Preparing',
        time: '20 mins ago',
        total: 800
      },
      {
        id: 'ORD-8272',
        table: 'Table 2',
        items: [
          { name: 'Chicken Biryani', qty: 2, price: 420 },
          { name: 'Raita', qty: 2, price: 50 },
          { name: 'Garlic Naan', qty: 2, price: 70 }
        ],
        status: 'Ready',
        time: '12 mins ago',
        total: 1080
      },
      {
        id: 'ORD-8273',
        table: 'Table 3',
        items: [
          { name: 'Veg Hakka Noodles', qty: 1, price: 220 },
          { name: 'Chilli Paneer Dry', qty: 1, price: 290 }
        ],
        status: 'Served',
        time: '45 mins ago',
        total: 510
      },
      {
        id: 'ORD-8268',
        table: 'Table 5',
        items: [
          { name: 'Masala Dosa', qty: 2, price: 180 },
          { name: 'Filter Coffee', qty: 2, price: 60 }
        ],
        status: 'Completed',
        time: '2 hours ago',
        total: 480
      },
      {
        id: 'ORD-8269',
        table: 'Table 4',
        items: [
          { name: 'Spring Rolls', qty: 1, price: 180 }
        ],
        status: 'Cancelled',
        time: '3 hours ago',
        total: 180
      }
    ];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-orders');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaults; }
      }
    }
    return defaults;
  }

  private loadReadyItems(): ReadyItem[] {
    const defaults: ReadyItem[] = [
      { id: '1', table: 'Table 3', item: 'Paneer Tikka Masala', qty: 1, station: 'Main Kitchen', readySince: '2 mins ago', elapsedSec: 120 },
      { id: '2', table: 'Table 1', item: 'Butter Naan', qty: 3, station: 'Main Kitchen', readySince: '1 min ago', elapsedSec: 60 },
      { id: '3', table: 'Table 2', item: 'Virgin Mojito', qty: 2, station: 'Bar', readySince: '4 mins ago', elapsedSec: 240 },
      { id: '4', table: 'Table 5', item: 'Chocolate Lava Cake', qty: 1, station: 'Dessert Station', readySince: '5 mins ago', elapsedSec: 300 },
    ];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-ready');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaults; }
      }
    }
    return defaults;
  }

  private loadRequests(): RequestItem[] {
    const defaults: RequestItem[] = [
      { id: '1', table: 'Table 2', type: 'Call Waiter', time: '2 mins ago', elapsedMinutes: 2, status: 'Pending', severity: 'high' },
      { id: '2', table: 'Table 1', type: 'Extra Napkins', time: '5 mins ago', elapsedMinutes: 5, status: 'Pending', severity: 'low' },
      { id: '3', table: 'Table 3', type: 'Water Bottle', time: '8 mins ago', elapsedMinutes: 8, status: 'InProgress', severity: 'low' },
      { id: '4', table: 'Table 4', type: 'Clean Table', time: '12 mins ago', elapsedMinutes: 12, status: 'Pending', severity: 'medium' },
      { id: '5', table: 'Table 5', type: 'Cutlery', time: '15 mins ago', elapsedMinutes: 15, status: 'Resolved', severity: 'low' },
    ];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-requests');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaults; }
      }
    }
    return defaults;
  }

  private loadAlerts(): AlertItem[] {
    const defaults: AlertItem[] = [
      { id: '1', message: 'Serving Delayed: Order ORD-8271 at Table 1 is 10 mins over target prep time.', type: 'Delayed', severity: 'Critical', time: '2 mins ago' },
      { id: '2', message: 'Cleaning Pending: Table 4 needs sanitization before next walk-in seating.', type: 'Cleaning', severity: 'Warning', time: '6 mins ago' },
      { id: '3', message: 'Table Reassigned: Table 8 has been added to Zone A for this shift.', type: 'Reassigned', severity: 'Info', time: '15 mins ago' },
      { id: '4', message: 'Kitchen Alert: Dessert station is reporting out of stock for Mango Pannacotta.', type: 'Kitchen', severity: 'Warning', time: '25 mins ago' },
      { id: '5', message: 'System Update: Sync active. Shift log reports generated.', type: 'System', severity: 'Info', time: '1 hour ago' },
    ];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-alerts');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaults; }
      }
    }
    return defaults;
  }

  private loadTables(): StaffTable[] {
    const defaults: StaffTable[] = [
      { id: '1', name: 'Table 1', section: 'Zone A', capacity: 2, guests: 2, status: 'Occupied', currentBill: 1240, elapsed: '45 mins', action: 'Order', assignedGuest: 'Rajesh Kumar', turns: 6 },
      { id: '2', name: 'Table 2', section: 'Zone A', capacity: 4, guests: 4, status: 'Bill Requested', currentBill: 3450, elapsed: '1h 15m', action: 'Pay', assignedGuest: 'Priya Sharma', turns: 4 },
      { id: '3', name: 'Table 3', section: 'Zone A', capacity: 4, guests: 3, status: 'Food Served', currentBill: 2100, elapsed: '30 mins', action: 'Service', assignedGuest: 'Amit Patel', turns: 5 },
      { id: '4', name: 'Table 4', section: 'Zone A', capacity: 2, guests: 0, status: 'Cleaning', currentBill: 0, elapsed: '5 mins', action: 'Clean', turns: 3 },
      { id: '5', name: 'Table 5', section: 'Zone B', capacity: 6, guests: 5, status: 'Occupied', currentBill: 4800, elapsed: '2 hours', assignedGuest: 'Neha Gupta', turns: 3 },
      { id: '6', name: 'Table 6', section: 'Zone B', capacity: 4, guests: 0, status: 'Reserved', elapsed: '10 mins', turns: 5 },
      { id: '7', name: 'Table 7', section: 'Zone B', capacity: 2, guests: 0, status: 'Available', turns: 7 },
      { id: '8', name: 'Table 8', section: 'Zone B', capacity: 4, guests: 0, status: 'Available', turns: 2 },
      { id: '9', name: 'Table 9', section: 'Outdoor', capacity: 4, guests: 4, status: 'Occupied', currentBill: 1950, elapsed: '50 mins', assignedGuest: 'Sanjay Dutt', turns: 4 },
      { id: '10', name: 'Table 10', section: 'Outdoor', capacity: 2, guests: 0, status: 'Available', turns: 1 },
    ];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-tables');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaults; }
      }
    }
    return defaults;
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
    const defaults: StaffReservation[] = [
      { id: '1', name: 'Ananya Roy', pax: 4, time: '07:30 PM', phone: '+91 98765 43210', status: 'Confirmed', type: 'Reservation' },
      { id: '2', name: 'Vikram Singh', pax: 2, time: '08:00 PM', phone: '+91 87654 32109', status: 'Confirmed', type: 'Reservation' },
      { id: '3', name: 'Siddharth Sen', pax: 5, time: '15 mins wait', phone: '+91 76543 21098', status: 'Confirmed', type: 'Walk-in', queueNo: 1 },
      { id: '4', name: 'Megha Gupta', pax: 3, time: '25 mins wait', phone: '+91 65432 10987', status: 'Confirmed', type: 'Walk-in', queueNo: 2 },
      { id: '5', name: 'Kabir Mehta', pax: 6, time: '09:00 PM', phone: '+91 54321 09876', status: 'Confirmed', type: 'Reservation' },
    ];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-reservations');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaults; }
      }
    }
    return defaults;
  }

  public setReservations(reservations: StaffReservation[] | ((prev: StaffReservation[]) => StaffReservation[])) {
    this.reservations = typeof reservations === 'function' ? reservations(this.reservations) : reservations;
    if (typeof window !== 'undefined') {
      localStorage.setItem('dineease-staff-reservations', JSON.stringify(this.reservations));
    }
    this.notify();
  }

  private loadMenuItems(): MenuItem[] {
    const defaults: MenuItem[] = [
      { id: '1', name: 'Paneer Tikka Masala', category: 'Mains', price: 340, available: true, spicy: true, veg: true, description: 'Clay-oven roasted cottage cheese cubes cooked in spicy rich tomato-based gravy.' },
      { id: '2', name: 'Butter Naan', category: 'Mains', price: 60, available: true, veg: true, description: 'Leavened flatbread made of white flour, baked in tandoor and brushed with butter.' },
      { id: '3', name: 'Virgin Mojito', category: 'Beverages', price: 160, available: true, veg: true, description: 'Refreshing cocktail containing lime juice, mint leaves, sugar syrup, and soda.' },
      { id: '4', name: 'Chocolate Lava Cake', category: 'Desserts', price: 190, available: true, veg: true, description: 'Rich chocolate cake with a molten chocolate core, served with vanilla ice cream.' },
      { id: '5', name: 'Spring Rolls', category: 'Starters', price: 180, available: true, veg: true, description: 'Crispy fried rolled pastry filled with seasoned vegetables.' },
      { id: '6', name: 'Chicken Biryani', category: 'Mains', price: 420, available: true, spicy: true, veg: false, description: 'Slow-cooked aromatic basmati rice layered with marinated chicken, saffron, and spices.' },
      { id: '7', name: 'Dal Makhani', category: 'Mains', price: 280, available: false, veg: true, description: 'Creamy black lentils slow-cooked overnight with spices, butter, and cream.' },
      { id: '8', name: 'French Fries', category: 'Starters', price: 120, available: true, veg: true, description: 'Golden, crispy, lightly salted deep-fried potato strips.' },
    ];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dineease-staff-menu');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaults; }
      }
    }
    return defaults;
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
