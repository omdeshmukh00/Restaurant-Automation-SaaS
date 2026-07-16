import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminOrdersApi } from '../api/admin.orders.api';

// ── Types ────────────────────────────────────────────────────────────────────

export type OrderStatus   = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled' | 'Served';
export type PaymentMethod = 'Unpaid' | 'Cash' | 'Card' | 'Online';
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
  timeRaw: number; // creation timestamp (epoch ms) — used for sort & relative time
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

function mapBackendPayment(order: any): PaymentMethod {
  // Paid orders show the actual method the customer used; unpaid orders show "Unpaid".
  if (order.paymentStatus === 'PAID') {
    switch (order.paymentMethod) {
      case 'CARD':
        return 'Card';
      case 'ONLINE':
        return 'Online';
      default:
        return 'Cash';
    }
  }
  return 'Unpaid';
}

export function formatCurrency(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatTimeAgo(epoch: number): string {
  const diffMs = Date.now() - epoch;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min > 1 ? 's' : ''} ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`;

  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} week${wk > 1 ? 's' : ''} ago`;

  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`;

  const yr = Math.floor(day / 365);
  return `${yr} year${yr > 1 ? 's' : ''} ago`;
}

export function mapBackendOrder(order: any): Order {
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
    payment: mapBackendPayment(order),
    status: mapBackendOrderStatus(order.status ?? 'PENDING'),
    assignedStaff,
    staffAvatar: getInitials(assignedStaff),
    time: minuteDiff <= 1 ? 'just now' : `${minuteDiff} mins ago`,
    timeRaw: created.getTime(),
    date: created.toISOString().split('T')[0],
    notes: order.specialInstructions || '',
  };
}

export function deriveOrderStats(orders: Order[]): OrderStats {
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

export interface OrderFilterCriteria {
  dateFilter: DateFilter;
  paymentFilter: PaymentMethod | 'All';
  searchQuery: string;
  minAmount: string;
  maxAmount: string;
}

// Single source of truth for the "filtered scope": every filter EXCEPT the
// active status tab. Used by both the stat cards and the tab counts so they
// always reflect the data the user is currently looking at.
export function getFilteredOrders(allOrders: Order[], criteria: OrderFilterCriteria): Order[] {
  const { dateFilter, paymentFilter, searchQuery, minAmount, maxAmount } = criteria;

  const filterByDate = (t: number) => {
    if (dateFilter === 'all') return true;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTomorrow = startOfToday + 24 * 60 * 60 * 1000;
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    switch (dateFilter) {
      case 'today':
        return t >= startOfToday && t < startOfTomorrow;
      case 'yesterday':
        return t >= startOfYesterday && t < startOfToday;
      case 'last7':
        return t >= startOfToday - 6 * 24 * 60 * 60 * 1000;
      case 'last30':
        return t >= startOfToday - 29 * 24 * 60 * 60 * 1000;
      default:
        return true;
    }
  };

  const q = searchQuery.toLowerCase();
  const min = minAmount !== '' ? Number(minAmount) : null;
  const max = maxAmount !== '' ? Number(maxAmount) : null;

  return allOrders.filter((o) => {
    if (!filterByDate(o.timeRaw)) return false;
    if (paymentFilter !== 'All' && o.payment !== paymentFilter) return false;
    if (
      q &&
      !(
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.table.toLowerCase().includes(q)
      )
    ) {
      return false;
    }
    if (min !== null && o.amountRaw < min) return false;
    if (max !== null && o.amountRaw > max) return false;
    return true;
  });
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
  createOrder:      (payload: { customerName: string; table: string; payment: PaymentMethod; notes: string; staffId?: string; items: { name: string; price: number; quantity: number }[] }) => Promise<void>;
  updateOrder:      (id: string, patch: Partial<Order>, force?: boolean) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  deleteOrder:      (id: string) => Promise<void>;
  addOrder:          (order: Order) => void;
}

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
          // Fetch the full order list once. All filtering (date range, payment
          // method, search, amount, status tab) is applied client-side on the
          // page so the table and the stat cards always stay in sync.
          const response = await adminOrdersApi.getOrders({ page: 1, limit: 1000 });
          const mapped = response.orders.map(mapBackendOrder);

          set({ orders: mapped, allOrders: mapped, stats: deriveOrderStats(mapped) });
        } catch (err) {
          console.error('Failed to load admin orders', err);
        }
      },

      createOrder: async (payload) => {
        try {
          const created = await adminOrdersApi.createOrder({
            customerName: payload.customerName,
            table: payload.table,
            paymentStatus: payload.payment === 'Unpaid' ? 'PENDING' : 'PAID',
            paymentMethod:
              payload.payment === 'Card'
                ? 'CARD'
                : payload.payment === 'Online'
                ? 'ONLINE'
                : payload.payment === 'Unpaid'
                ? undefined
                : 'CASH',
            assignedStaff: payload.staffId,
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

      updateOrder: async (id, patch, force = false) => {
        try {
          const payload: any = {};
          if (patch.status !== undefined) {
            payload.status =
              patch.status === 'Pending' ? 'PENDING' :
              patch.status === 'Preparing' ? 'PREPARING' :
              patch.status === 'Served' ? 'SERVED' :
              patch.status === 'Completed' ? 'COMPLETED' :
              patch.status === 'Cancelled' ? 'CANCELLED' : 'PENDING';
            // Admin Edit modal forces status changes, bypassing the normal
            // order state machine on the backend.
            if (force) payload.adminOverride = true;
          }
          if (patch.table !== undefined) {
            payload.table = patch.table;
          }
          if (patch.notes !== undefined) {
            payload.specialInstructions = patch.notes;
          }
          if (patch.payment !== undefined) {
            if (patch.payment === 'Unpaid') {
              payload.paymentStatus = 'PENDING';
            } else {
              payload.paymentStatus = 'PAID';
              payload.paymentMethod =
                patch.payment === 'Card'
                  ? 'CARD'
                  : patch.payment === 'Online'
                  ? 'ONLINE'
                  : 'CASH';
            }
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

      deleteOrder: async (id) => {
        try {
          await adminOrdersApi.deleteOrder(id);
          // Remove the deleted order from both the visible and cached lists,
          // then recompute the stat cards from the remaining orders.
          set((s) => {
            const allOrders = s.allOrders.filter((o) => o.id !== id);
            return {
              orders: s.orders.filter((o) => o.id !== id),
              allOrders,
              stats: deriveOrderStats(allOrders),
            };
          });
        } catch (err) {
          console.error('Failed to delete admin order', err);
          throw err;
        }
      },

      addOrder: (order) =>
        set((state) => ({ orders: [order, ...state.orders] })),
    }),
    {
      name: 'admin-orders-store',
      // Only persist UI filter state. Order data is always fetched fresh so we
      // never show stale orders loaded from localStorage.
      partialize: (state) => ({
        activeTab: state.activeTab,
        searchQuery: state.searchQuery,
        paymentFilter: state.paymentFilter,
        dateFilter: state.dateFilter,
        sortBy: state.sortBy,
        perPage: state.perPage,
        currentPage: state.currentPage,
        minAmount: state.minAmount,
        maxAmount: state.maxAmount,
      }),
    }
  )
);
