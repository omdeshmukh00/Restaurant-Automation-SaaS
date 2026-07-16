import { create } from 'zustand';
import { LucideIcon, TrendingUp, ShoppingBag, Users, IndianRupee, CheckCircle2, XCircle, Clock, Settings, Activity } from 'lucide-react';
import { adminAnalyticsApi, adminAuditLogsApi, AuditLogEntry } from '../api/admin.api';
import { adminOrdersApi } from '../api/admin.orders.api';
import { mapBackendOrder, formatCurrency, Order } from './orders.store';
import { getStoredUser } from '../../../auth/tokenStore';
import { useTablesStore } from './tables.store';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StatTile {
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

export interface RevenuePoint {
  day: string;
  thisWeek: number;
  lastWeek: number;
}

export interface TopItem {
  name: string;
  category: string;
  orders: number;
  revenue: string;
  trend: string;
}

export interface RecentOrderRow {
  id: string;
  table: string;
  items: string[];
  total: string;
  status: string;
  time: string;
  timeRaw: number;
  statusColor: string;
}

export interface ActivityItem {
  icon: LucideIcon;
  color: string;
  bg: string;
  text: string;
  time: string;
}

export interface DashboardState {
  loading: boolean;
  statTiles: StatTile[];
  revenueData: RevenuePoint[];
  recentOrders: RecentOrderRow[];
  topItems: TopItem[];
  activities: ActivityItem[];
}

// ── Seed Data (first paint — replaced by fetchDashboard) ────────────────────

const seedRevenue: RevenuePoint[] = [
  { day: 'Mon', thisWeek: 6200,  lastWeek: 5100 },
  { day: 'Tue', thisWeek: 7800,  lastWeek: 6400 },
  { day: 'Wed', thisWeek: 7200,  lastWeek: 7900 },
  { day: 'Thu', thisWeek: 9100,  lastWeek: 6800 },
  { day: 'Fri', thisWeek: 12450, lastWeek: 10200 },
  { day: 'Sat', thisWeek: 11800, lastWeek: 9600 },
  { day: 'Sun', thisWeek: 10500, lastWeek: 8300 },
];

const seedNow = Date.now();
const seedRecentOrders: RecentOrderRow[] = [
  { id: '#ORD-00124', table: 'Table 7',  items: ['Pasta, Wine, Tiramisu'],  total: '₹1,240', status: 'Served',    time: '2 min ago',  timeRaw: seedNow - 2 * 60000,     statusColor: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
  { id: '#ORD-00123', table: 'Table 12', items: ['Burger, Fries, Coke'],     total: '₹680',   status: 'Preparing', time: '8 min ago',  timeRaw: seedNow - 8 * 60000,     statusColor: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
  { id: '#ORD-00122', table: 'Table 3',  items: ['Sushi Platter, Sake'],     total: '₹2,100', status: 'Pending',   time: '12 min ago', timeRaw: seedNow - 12 * 60000,    statusColor: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' },
  { id: '#ORD-00121', table: 'Table 5',  items: ['Steak, Salad, Juice'],     total: '₹1,850', status: 'Served',    time: '18 min ago', timeRaw: seedNow - 18 * 60000,    statusColor: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-40０' },
  { id: '#ORD-00120', table: 'Table 9',  items: ['Pizza, Garlic Bread'],     total: '₹920',   status: 'Cancelled', time: '25 min ago', timeRaw: seedNow - 25 * 60000,    statusColor: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' },
];

const seedTopItems: TopItem[] = [
  { name: 'Margherita Pizza', category: 'Popular', orders: 245, revenue: '₹37,200', trend: '+12%' },
  { name: 'Cheesy Burger',    category: 'Popular', orders: 189, revenue: '₹24,500', trend: '+8%'  },
  { name: 'Grilled Chicken',  category: 'Popular', orders: 147, revenue: '₹13,050', trend: '+5%'  },
  { name: 'Pasta Alfredo',    category: 'Popular', orders: 128, revenue: '₹19,500', trend: '+3%'  },
  { name: 'Caesar Salad',     category: 'Popular', orders: 102, revenue: '₹11,400', trend: '+2%'  },
];

const seedActivities: ActivityItem[] = [
  { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30', text: 'Order #1042 marked as served', time: '2 min ago' },
  { icon: Clock,        color: 'text-blue-500',  bg: 'bg-blue-50 dark:bg-blue-900/30',  text: 'New reservation: Sat 8 PM, party of 4', time: '10 min ago' },
  { icon: XCircle,      color: 'text-red-500',   bg: 'bg-red-50 dark:bg-red-900/30',    text: 'Order #1038 cancelled by customer', time: '25 min ago' },
  { icon: Settings,     color: 'text-purple-500',bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'Inventory restocked: Olive Oil', time: '1 hr ago' },
];

function seedStatTiles(): StatTile[] {
  const loading = (icon: LucideIcon, iconBg: string, iconColor: string): StatTile => ({
    title: '',
    value: '—',
    change: 'Loading…',
    changeType: 'neutral',
    icon,
    iconBg,
    iconColor,
  });
  return [
    { ...loading(TrendingUp, 'bg-orange-50', 'text-orange-500'), title: 'Total Revenue' },
    { ...loading(ShoppingBag, 'bg-blue-50', 'text-blue-500'), title: 'Orders Today' },
    { ...loading(Users, 'bg-green-50', 'text-green-500'), title: 'Active Customers' },
    { ...loading(IndianRupee, 'bg-purple-50', 'text-purple-500'), title: 'Avg Order Value' },
  ];
}

const initialState: DashboardState = {
  loading: false,
  statTiles: seedStatTiles(),
  revenueData: seedRevenue,
  recentOrders: seedRecentOrders,
  topItems: seedTopItems,
  activities: seedActivities,
};

// ── Derivation helpers ──────────────────────────────────────────────────────

function weekdayLabel(period: string): string {
  const d = new Date(period);
  if (isNaN(d.getTime())) return period;
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

function buildRevenueData(revenue: { period: string; totalRevenue: number }[]): RevenuePoint[] {
  const window = revenue.slice(-14);
  const weekLen = 7;
  const thisWeekRaw = window.slice(-weekLen);
  const lastWeekRaw = window.slice(0, Math.max(0, window.length - weekLen));

  return thisWeekRaw.map((tw, i) => {
    const lw = lastWeekRaw[i];
    return {
      day: weekdayLabel(tw.period),
      thisWeek: Math.round(tw.totalRevenue ?? 0),
      lastWeek: lw ? Math.round(lw.totalRevenue ?? 0) : 0,
    };
  });
}

function statusToColor(status: string): string {
  switch (status) {
    case 'Served':
    case 'Completed':
      return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
    case 'Preparing':
      return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400';
    case 'Pending':
      return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400';
    case 'Cancelled':
      return 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400';
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
  }
}

function buildRecentOrders(orders: Order[]): RecentOrderRow[] {
  return orders
    .slice()
    .sort((a, b) => b.timeRaw - a.timeRaw)
    .slice(0, 5)
    .map((o) => ({
      id: o.orderNumber,
      table: o.table,
      items: o.itemNames,
      total: o.amount,
      status: o.status,
      time: o.time,
      timeRaw: o.timeRaw,
      statusColor: statusToColor(o.status),
    }));
}

function buildTopItems(rawOrders: any[]): TopItem[] {
  const agg = new Map<string, { count: number; revenue: number }>();
  for (const o of rawOrders) {
    if (!Array.isArray(o?.items)) continue;
    for (const it of o.items) {
      const name = it?.name || 'Item';
      const qty = Number(it?.quantity) || 0;
      const price = Number(it?.price) || 0;
      const cur = agg.get(name) || { count: 0, revenue: 0 };
      cur.count += qty;
      cur.revenue += price * qty;
      agg.set(name, cur);
    }
  }
  return [...agg.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, v]) => ({
      name,
      category: 'Popular',
      orders: v.count,
      revenue: formatCurrency(Math.round(v.revenue)),
      trend: '+0%',
    }));
}

const FRIENDLY_ACTION: Record<string, string> = {
  ORDER_PLACED: 'New order placed',
  ORDER_CANCELLED: 'Order cancelled',
  ORDER_SERVED: 'Order served',
  ORDER_COMPLETED: 'Order completed',
  ORDER_PICKED: 'Order picked up',
  ORDER_REORDERED: 'Order reordered',
  ORDER_DELETED: 'Order deleted',
  KITCHEN_ORDER_ACCEPTED: 'Kitchen accepted order',
  KITCHEN_ORDER_STARTED: 'Kitchen started cooking',
  KITCHEN_ORDER_READY: 'Order ready',
  KITCHEN_ORDER_DELAYED: 'Order delayed',
  KITCHEN_ORDER_REJECTED: 'Order rejected',
  PAYMENT_CREATED: 'Payment initiated',
  PAYMENT_VERIFIED: 'Payment verified',
  PAYMENT_FAILED: 'Payment failed',
  SESSION_CREATED: 'New table session started',
  SESSION_EXTENDED: 'Table session extended',
  SESSION_ENDED: 'Table session ended',
  SESSION_EXPIRED: 'Table session expired',
  ADMIN_STAFF_CREATED: 'Staff added',
  ADMIN_STAFF_UPDATED: 'Staff updated',
  ADMIN_STAFF_DELETED: 'Staff removed',
  ADMIN_MENU_ITEM_CREATED: 'Menu item added',
  ADMIN_MENU_ITEM_UPDATED: 'Menu item updated',
  ADMIN_MENU_ITEM_DELETED: 'Menu item removed',
  ADMIN_OFFER_CREATED: 'Offer created',
  ADMIN_OFFER_UPDATED: 'Offer updated',
  ADMIN_OFFER_DELETED: 'Offer removed',
  ADMIN_INVENTORY_CREATED: 'Inventory item added',
  ADMIN_INVENTORY_UPDATED: 'Inventory item updated',
  ADMIN_INVENTORY_DELETED: 'Inventory item removed',
  ADMIN_INVENTORY_BULK_IMPORTED: 'Inventory bulk imported',
  ADMIN_SUPPLIER_CREATED: 'Supplier added',
  ADMIN_SUPPLIER_UPDATED: 'Supplier updated',
  ADMIN_SUPPLIER_DELETED: 'Supplier removed',
  ADMIN_SETTINGS_UPDATED: 'Restaurant settings updated',
  QR_GENERATED: 'QR code generated',
  QR_REGENERATED: 'QR code regenerated',
  QR_SCANNED: 'QR code scanned',
  UPLOAD_CREATED: 'File uploaded',
  AUTH_LOGIN: 'Admin signed in',
  AUTH_LOGOUT: 'Admin signed out',
};

function titleCase(s: string): string {
  return s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day > 1 ? 's' : ''} ago`;
}

function mapActivity(log: AuditLogEntry): ActivityItem {
  const action = log.action || '';
  const entityType = log.entityType || '';
  const text = FRIENDLY_ACTION[action] ?? titleCase(action);

  const meta = log.metadata || {};
  let suffix = '';
  if (typeof meta.total === 'number') suffix = ` · ${formatCurrency(meta.total)}`;
  else if (typeof meta.amount === 'number') suffix = ` · ${formatCurrency(meta.amount)}`;

  const negative = /CANCEL|REJECT|FAIL|EXPIRED|DELETED/.test(action);
  const orderLike = /ORDER|KITCHEN|PAYMENT|BILL/.test(entityType) || /ORDER|KITCHEN|PAYMENT/.test(action);
  const sessionLike = /SESSION|TABLE/.test(entityType);
  const adminLike = /STAFF|MENU|OFFER|INVENTORY|SETTINGS|SUPPLIER/.test(entityType) || /ADMIN/.test(action);

  let icon: LucideIcon = Activity;
  let color = 'text-gray-500';
  let bg = 'bg-gray-50 dark:bg-gray-800/50';

  if (negative) {
    icon = XCircle;
    color = 'text-red-500';
    bg = 'bg-red-50 dark:bg-red-900/30';
  } else if (orderLike) {
    icon = CheckCircle2;
    color = 'text-green-500';
    bg = 'bg-green-50 dark:bg-green-900/30';
  } else if (sessionLike) {
    icon = Clock;
    color = 'text-blue-500';
    bg = 'bg-blue-50 dark:bg-blue-900/30';
  } else if (adminLike) {
    icon = Settings;
    color = 'text-purple-500';
    bg = 'bg-purple-50 dark:bg-purple-900/30';
  }

  return { icon, color, bg, text: text + suffix, time: relativeTime(log.createdAt) };
}

// ── Store ──────────────────────────────────────────────────────────────────

interface DashboardStore extends DashboardState {
  fetchDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  ...initialState,

  fetchDashboard: async () => {
    set({ loading: true });

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 13);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Each source fails independently so one broken endpoint can't blank the dashboard.
    const [revData, ordData, audData] = await Promise.all([
      adminAnalyticsApi
        .getRevenue({
          groupBy: 'day',
          from: fmt(from),
          to: fmt(to),
          restaurantId: getStoredUser('admin')?.restaurantId,
        })
        .catch(() => null),
      adminOrdersApi.getOrders({ page: 1, limit: 100 }).catch(() => null),
      adminAuditLogsApi.getAuditLogs({ limit: 12 }).catch(() => null),
    ]);

    const summary = revData?.summary || { totalRevenue: 0, billCount: 0, averageBillValue: 0, totalTax: 0, totalDiscount: 0 };
    const orders: Order[] = ordData?.orders ? ordData.orders.map(mapBackendOrder) : [];
    const today = new Date().toISOString().slice(0, 10);
    const ordersToday = orders.filter((o) => o.date === today).length;
    const activeCount = orders.filter(
      (o) => o.status === 'Pending' || o.status === 'Preparing' || o.status === 'Served'
    ).length;
    // "Active Customers" = tables currently hosting a live dine-in party
    // (occupied, or holding an active session such as a reserved-then-seated
    // table). Read from the live tables array so it reflects the latest fetch.
    const activeCustomers = useTablesStore
      .getState()
      .tables.filter((t) => t.status === 'Occupied' || t.sessionDetails).length;

    const statTiles: StatTile[] = [
      {
        title: 'Total Revenue',
        value: formatCurrency(Math.round(summary.totalRevenue ?? 0)),
        change: `${summary.billCount ?? 0} paid bills`,
        changeType: 'increase',
        icon: TrendingUp,
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-500',
      },
      {
        title: 'Orders Today',
        value: String(ordersToday),
        change: `${activeCount} active`,
        changeType: ordersToday > 0 ? 'increase' : 'neutral',
        icon: ShoppingBag,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-500',
      },
      {
        title: 'Active Customers',
        value: String(activeCustomers),
        change: 'live now',
        changeType: 'neutral',
        icon: Users,
        iconBg: 'bg-green-50',
        iconColor: 'text-green-500',
      },
      {
        title: 'Avg Order Value',
        value: formatCurrency(Math.round(summary.averageBillValue ?? 0)),
        change: 'per bill',
        changeType: 'neutral',
        icon: IndianRupee,
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-500',
      },
    ];

    const revenueData = buildRevenueData(revData?.revenue || []);
    const recentOrders = buildRecentOrders(orders);
    const topItems = buildTopItems(ordData?.orders || []);
    const activities = (audData?.logs || []).slice(0, 8).map(mapActivity);

    set({ loading: false, statTiles, revenueData, recentOrders, topItems, activities });
  },
}));
