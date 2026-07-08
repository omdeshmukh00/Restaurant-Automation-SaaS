import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminOrdersApi } from '../api/admin.orders.api';

// ── Types ────────────────────────────────────────────────────────────────────

export type OrderStatus   = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled' | 'Served';
export type PaymentMethod = 'Paid' | 'Online' | 'Card' | 'Cash';
export type OrderSortBy   = 'default' | 'time';
export type DateFilter    = 'all' | 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

export interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  customerAvatar: string;
  items: number;
  itemNames: string[];
  table: string;
  amount: string;
  amountRaw: number;
  payment: PaymentMethod;
  status: OrderStatus;
  assignedStaff: string;
  staffAvatar: string;
  time: string;
  timeRaw: number; // minutes ago — used for sort
  date: string;    // e.g. "2025-05-20"
  notes?: string;
}

export interface OrderStats {
  totalOrders: number;
  totalOrdersChange: string;
  pending: number;
  completed: number;
  totalRevenue: string;
  totalRevenueChange: string;
  avgOrderValue: string;
  avgOrderValueChange: string;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'G';
}

function mapBackendOrderStatus(status: string): OrderStatus {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'CONFIRMED':
    case 'PREPARING':
    case 'DELAYED':
    case 'READY':
      return 'Preparing';
    case 'PICKED':
    case 'SERVED':
      return 'Served';
    case 'BILLED':
    case 'PAID':
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
    case 'REJECTED':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

function mapBackendPaymentStatus(status: string): PaymentMethod {
  switch (status) {
    case 'PAID':
      return 'Paid';
    case 'PENDING':
      return 'Online';
    case 'FAILED':
      return 'Card';
    case 'REFUNDED':
      return 'Cash';
    default:
      return 'Cash';
  }
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

function mapBackendOrder(order: any): Order {
  const customerName = order.customerName || 'Guest';
  const assignedStaff =
    typeof order.serviceStaffId === 'object' && order.serviceStaffId?.name
      ? order.serviceStaffId.name
      : typeof order.kitchenStaffId === 'object' && order.kitchenStaffId?.name
      ? order.kitchenStaffId.name
      : 'Unassigned';
  const tableLabel =
    typeof order.tableId === 'object' && order.tableId?.tableNumber
      ? order.tableId.tableNumber
      : String(order.tableId || 'Unknown');
  const created = order.createdAt ? new Date(order.createdAt) : new Date();
  const minuteDiff = Math.max(0, Math.round((Date.now() - created.getTime()) / 60000));

  return {
    id: order._id?.toString() || String(Date.now()),
    orderNumber: order.orderNumber || order._id?.toString() || String(Date.now()),
    customer: customerName,
    customerAvatar: getInitials(customerName),
    items: Array.isArray(order.items) ? order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) : 0,
    itemNames: Array.isArray(order.items)
      ? order.items.flatMap((item: any) => Array(item.quantity || 1).fill(item.name || 'Item'))
      : [],
    table: tableLabel,
    amount: formatCurrency(order.finalAmount ?? order.totalAmount ?? 0),
    amountRaw: order.finalAmount ?? order.totalAmount ?? 0,
    payment: mapBackendPaymentStatus(order.paymentStatus ?? 'PENDING'),
    status: mapBackendOrderStatus(order.status ?? 'PENDING'),
    assignedStaff,
    staffAvatar: getInitials(assignedStaff),
    time: minuteDiff <= 1 ? 'just now' : `${minuteDiff} mins ago`,
    timeRaw: minuteDiff,
    date: created.toISOString().split('T')[0],
    notes: order.specialInstructions || '',
  };
}

function deriveOrderStats(orders: Order[]): OrderStats {
  const totalOrders = orders.length;
  const completed = orders.filter((order) => order.status === 'Completed').length;
  const pending = orders.filter((order) => order.status === 'Pending' || order.status === 'Preparing').length;
  const totalRevenueRaw = orders.reduce((sum, order) => sum + order.amountRaw, 0);
  const avgOrderValue = totalOrders ? totalRevenueRaw / totalOrders : 0;

  return {
    totalOrders,
    totalOrdersChange: '+0%',
    pending,
    completed,
    totalRevenue: formatCurrency(totalRevenueRaw),
    totalRevenueChange: '+0%',
    avgOrderValue: formatCurrency(avgOrderValue),
    avgOrderValueChange: '+0%',
  };
}

interface OrdersStore {
  stats: OrderStats;
  orders: Order[];  allOrders: Order[];  activeTab: OrderStatus | 'All';
  searchQuery: string;
  currentPage: number;
  perPage: number;
  sortBy: OrderSortBy;
  dateFilter: DateFilter;
  paymentFilter: PaymentMethod | 'All';
  minAmount: string;
  maxAmount: string;

  setActiveTab:     (tab: OrderStatus | 'All') => void;
  setSearchQuery:   (q: string) => void;
  setCurrentPage:   (p: number) => void;
  setPerPage:       (n: number) => void;
  setSortBy:        (s: OrderSortBy) => void;
  setDateFilter:    (d: DateFilter) => void;
  setPaymentFilter: (p: PaymentMethod | 'All') => void;
  setMinAmount:     (v: string) => void;
  setMaxAmount:     (v: string) => void;
  resetFilters:     () => void;
  fetchOrders:      () => Promise<void>;
  createOrder:      (payload: { customerName: string; table: string; payment: PaymentMethod; notes: string; items: { name: string; price: number; quantity: number }[] }) => Promise<void>;
  updateOrder:      (id: string, patch: Partial<Order>) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  addOrder:          (order: Order) => void;
}

// ── Seed Data ─────────────────────────────────────────────────────────────────

const seedOrders: Order[] = [
  {
    id: '#ORD-00124', orderNumber: '#ORD-00124', customer: 'Smith Jonith', customerAvatar: 'SJ', items: 4,
    itemNames: ['Pasta Carbonara', 'Garlic Bread', 'Red Wine', 'Tiramisu'],
    table: 'T-05', amount: '₹1,245', amountRaw: 1245, payment: 'Paid',
    status: 'Pending', assignedStaff: 'Jessica', staffAvatar: 'JE',
    time: '2 mins ago', timeRaw: 2, date: '2025-05-20',
    notes: 'Extra spicy, no onions.',
  },
  {
    id: '#ORD-00123', orderNumber: '#ORD-00123', customer: 'Sarah Johnson', customerAvatar: 'SA', items: 3,
    itemNames: ['Grilled Salmon', 'Caesar Salad', 'Fresh Lime Soda'],
    table: 'T-12', amount: '₹2,840', amountRaw: 2840, payment: 'Paid',
    status: 'Preparing', assignedStaff: 'Michael', staffAvatar: 'MI',
    time: '15 mins ago', timeRaw: 15, date: '2025-05-20',
  },
  {
    id: '#ORD-00122', orderNumber: '#ORD-00122', customer: 'Michael Brown', customerAvatar: 'MB', items: 5,
    itemNames: ['Butter Chicken', 'Naan x2', 'Dal Makhani', 'Raita', 'Lassi'],
    table: 'T-03', amount: '₹3,610', amountRaw: 3610, payment: 'Online',
    status: 'Pending', assignedStaff: 'David', staffAvatar: 'DA',
    time: '25 mins ago', timeRaw: 25, date: '2025-05-20',
  },
  {
    id: '#ORD-00121', orderNumber: '#ORD-00121', customer: 'Emily Davis', customerAvatar: 'ED', items: 2,
    itemNames: ['Margherita Pizza', 'Coke'],
    table: 'T-08', amount: '₹1,530', amountRaw: 1530, payment: 'Paid',
    status: 'Completed', assignedStaff: 'Jessica', staffAvatar: 'JE',
    time: '35 mins ago', timeRaw: 35, date: '2025-05-20',
  },
  {
    id: '#ORD-00120', orderNumber: '#ORD-00120', customer: 'David Wilson', customerAvatar: 'DW', items: 6,
    itemNames: ['Lamb Chops', 'Mashed Potato', 'Mushroom Sauce', 'Bread Roll', 'Red Wine x2'],
    table: 'T-15', amount: '₹5,920', amountRaw: 5920, payment: 'Card',
    status: 'Completed', assignedStaff: 'Michael', staffAvatar: 'MI',
    time: '45 mins ago', timeRaw: 45, date: '2025-05-20',
    notes: 'Medium-rare steak.',
  },
  {
    id: '#ORD-00119', orderNumber: '#ORD-00119', customer: 'Sophia Martinez', customerAvatar: 'SM', items: 4,
    itemNames: ['Veg Biryani', 'Paneer Tikka', 'Gulab Jamun', 'Masala Chai'],
    table: 'T-11', amount: '₹2,460', amountRaw: 2460, payment: 'Cash',
    status: 'Cancelled', assignedStaff: 'David', staffAvatar: 'DA',
    time: '1 hour ago', timeRaw: 60, date: '2025-05-20',
    notes: 'Customer left.',
  },
  {
    id: '#ORD-00118', orderNumber: '#ORD-00118', customer: 'James Wilson', customerAvatar: 'JW', items: 3,
    itemNames: ['Fish & Chips', 'Coleslaw', 'Lemonade'],
    table: 'T-02', amount: '₹1,850', amountRaw: 1850, payment: 'Paid',
    status: 'Preparing', assignedStaff: 'Jessica', staffAvatar: 'JE',
    time: '1 hour ago', timeRaw: 65, date: '2025-05-19',
  },
  {
    id: '#ORD-00117', orderNumber: '#ORD-00117', customer: 'Lisa Martinez', customerAvatar: 'LM', items: 7,
    itemNames: ['Sushi Platter', 'Miso Soup', 'Edamame', 'Sake', 'Tempura', 'Green Tea', 'Ice Cream'],
    table: 'T-09', amount: '₹8,240', amountRaw: 8240, payment: 'Card',
    status: 'Completed', assignedStaff: 'Michael', staffAvatar: 'MI',
    time: '2 hours ago', timeRaw: 120, date: '2025-05-19',
  },
  {
    id: '#ORD-00116', orderNumber: '#ORD-00116', customer: 'Robert Taylor', customerAvatar: 'RT', items: 2,
    itemNames: ['Club Sandwich', 'Fresh Juice'],
    table: 'T-06', amount: '₹890', amountRaw: 890, payment: 'Cash',
    status: 'Served', assignedStaff: 'David', staffAvatar: 'DA',
    time: '2 hours ago', timeRaw: 125, date: '2025-05-19',
  },
  {
    id: '#ORD-00115', orderNumber: '#ORD-00115', customer: 'Amanda White', customerAvatar: 'AW', items: 5,
    itemNames: ['Pasta Arrabiata', 'Bruschetta', 'Tiramisu', 'White Wine', 'Espresso'],
    table: 'T-14', amount: '₹4,650', amountRaw: 4650, payment: 'Online',
    status: 'Completed', assignedStaff: 'Jessica', staffAvatar: 'JE',
    time: '3 hours ago', timeRaw: 180, date: '2025-05-18',
  },
];

// ── Store ─────────────────────────────────────────────────────────────────────

export const useOrdersStore = create<OrdersStore>()(
  persist(
    (set, get) => ({
      stats: deriveOrderStats([]),
      orders: [],
      allOrders: [],
      activeTab: 'All',
      searchQuery: '',
      currentPage: 1,
      perPage: 10,
      sortBy: 'default',
      dateFilter: 'all',
      paymentFilter: 'All',
      minAmount: '',
      maxAmount: '',

      setActiveTab:     (tab) => set({ activeTab: tab, currentPage: 1 }),
      setSearchQuery:   (q)   => set({ searchQuery: q, currentPage: 1 }),
      setCurrentPage:   (p)   => set({ currentPage: p }),
      setPerPage:       (n)   => set({ perPage: n, currentPage: 1 }),
      setSortBy:        (s)   => set({ sortBy: s, currentPage: 1 }),
      setDateFilter:    (d)   => set({ dateFilter: d, currentPage: 1 }),
      setPaymentFilter: (p)   => set({ paymentFilter: p, currentPage: 1 }),
      setMinAmount:     (v)   => set({ minAmount: v, currentPage: 1 }),
      setMaxAmount:     (v)   => set({ maxAmount: v, currentPage: 1 }),
      resetFilters: () => set({
        activeTab: 'All', searchQuery: '', dateFilter: 'all',
        paymentFilter: 'All', minAmount: '', maxAmount: '',
        sortBy: 'default', currentPage: 1,
      }),

      fetchOrders: async () => {
        try {
          const state = get();

          // Build params common to both calls (date range, min/max amount, payment)
          const commonParams: Record<string, any> = {};
          if (state.paymentFilter && state.paymentFilter !== 'All') {
            commonParams.paymentStatus =
              state.paymentFilter === 'Paid' ? 'PAID' :
              state.paymentFilter === 'Online' ? 'PENDING' :
              state.paymentFilter === 'Card' ? 'PAID' :
              state.paymentFilter === 'Cash' ? 'PAID' : undefined;
          }
          if (state.minAmount) commonParams.minAmount = Number(state.minAmount);
          if (state.maxAmount) commonParams.maxAmount = Number(state.maxAmount);
          if (state.dateFilter && ['today', 'yesterday', 'last7', 'last30'].includes(state.dateFilter)) {
            commonParams.dateRange = state.dateFilter;
          }

          // 1) Fetch a larger set to compute counts and overall stats (no status filter)
          const allParams = { ...commonParams, page: 1, limit: 1000 };
          const allResponse = await adminOrdersApi.getOrders(allParams);
          const allMapped = allResponse.orders.map(mapBackendOrder);
          // summary fetch for stats

          // 2) Fetch view-specific page (may include status)
          const viewParams: Record<string, any> = { ...commonParams, page: state.currentPage, limit: state.perPage };
          if (state.activeTab && state.activeTab !== 'All') viewParams.status = state.activeTab.toUpperCase();

          const viewResponse = await adminOrdersApi.getOrders(viewParams);
          const viewMapped = viewResponse.orders.map(mapBackendOrder);
          // view fetch for page

          set({ orders: viewMapped, allOrders: allMapped, stats: deriveOrderStats(allMapped) });
        } catch (err) {
          console.error('Failed to load admin orders', err);
        }
      },

      createOrder: async (payload) => {
        try {
          const created = await adminOrdersApi.createOrder({
            customerName: payload.customerName,
            table: payload.table,
            paymentStatus:
              payload.payment === 'Paid'
                ? 'PAID'
                : payload.payment === 'Online'
                ? 'PENDING'
                : payload.payment === 'Card'
                ? 'PAID'
                : 'PAID',
            items: payload.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              notes: '',
            })),
            specialInstructions: payload.notes,
          });

          // Map returned order and insert at top so it's immediately visible
          const mapped = mapBackendOrder(created);
          // Ensure admin sees new order: switch to All tab and prepend
          set((s) => ({ activeTab: 'All', orders: [mapped, ...s.orders], allOrders: [mapped, ...s.allOrders] }));

          // Refresh to get accurate counts/pagination
          await get().fetchOrders();
        } catch (err) {
          console.error('Failed to create admin order', err);
          throw err;
        }
      },

      updateOrder: async (id, patch) => {
        try {
          const payload: any = {};
          if (patch.status !== undefined) {
            payload.status =
              patch.status === 'Pending' ? 'PENDING' :
              patch.status === 'Preparing' ? 'PREPARING' :
              patch.status === 'Served' ? 'SERVED' :
              patch.status === 'Completed' ? 'COMPLETED' :
              patch.status === 'Cancelled' ? 'CANCELLED' : 'PENDING';
          }
          if (patch.table !== undefined) {
            payload.table = patch.table;
          }
          if (patch.notes !== undefined) {
            payload.specialInstructions = patch.notes;
          }
          if (patch.payment !== undefined) {
            payload.paymentStatus =
              patch.payment === 'Paid'
                ? 'PAID'
                : patch.payment === 'Online'
                ? 'PENDING'
                : patch.payment === 'Card'
                ? 'PAID'
                : 'PAID';
          }

          await adminOrdersApi.updateOrder(id, payload);
          await get().fetchOrders();
        } catch (err) {
          console.error('Failed to update admin order', err);
          throw err;
        }
      },

      updateOrderStatus: async (id, status) => {
        try {
          await get().updateOrder(id, { status });
        } catch (err) {
          console.error('Failed to update order status', err);
          throw err;
        }
      },

      addOrder: (order) =>
        set((state) => ({ orders: [order, ...state.orders] })),
    }),
    {
      name: 'admin-orders-store',
    }
  )
);
