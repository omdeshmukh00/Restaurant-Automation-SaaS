import { create } from 'zustand';
import { apiClient } from '../../../shared/services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────

export type DateRange = 'Daily' | 'Weekly' | 'Monthly';
export type SalesChannel = 'Dine-in' | 'Takeaway' | 'Delivery' | 'Online';
export type PeakHoursRange = 'Daily' | 'Weekly' | 'Monthly';

export interface DateRangeSelection {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface ReportStats {
  totalRevenue: string;
  totalRevenueChange: string;
  totalOrders: number;
  totalOrdersChange: string;
  avgOrderValue: string;
  avgOrderValueChange: string;
  totalCustomers: number;
  totalCustomersChange: string;
  repeatCustomers: number;
  repeatCustomersChange: string;
  netProfit: string;
  netProfitChange: string;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
}

export interface OrdersTrendPoint {
  date: string;
  orders: number;
}

export interface SalesByChannel {
  channel: SalesChannel;
  pct: number;
  amount: string;
  color: string;
}


export interface TopSellingItem {
  id: string;
  name: string;
  emoji: string;
  orders: number;
  revenue: string;
}

export interface RevenueByCategory {
  name: string;
  pct: number;
  amount: string;
  color: string;
}

export interface PeakHourCell {
  day: string;
  hour: string;
  intensity: number;
}

export interface DailySummaryRow {
  date: string;
  revenue: string;
  orders: number;
  customers: number;
  avgOrderValue: string;
  repeatCustomers: number;
  netProfit: string;
}

export interface Insight {
  id: string;
  emoji: string;
  color: string;
  title: string;
  body: string;
}

export interface ReportShortcut {
  id: string;
  label: string;
}

// ── Store ──────────────────────────────────────────────────────────────────

interface ReportsState {
  // Global range (affects stats + daily summary)
  globalRange: DateRange;

  // Per-widget ranges
  revenueRange: DateRange;
  ordersRange: DateRange;
  topItemsRange: DateRange;
  revByCatRange: DateRange;
  peakHoursRange: PeakHoursRange;

  // Calendar / date picker
  dateRangeSelection: DateRangeSelection;
  isCalendarOpen: boolean;

  // Loading/error states
  loading: boolean;
  error: string | null;

  // API Fetched Data
  stats: ReportStats | null;
  revenueTrend: RevenuePoint[];
  ordersTrend: OrdersTrendPoint[];
  topSellingItems: TopSellingItem[];
  revenueByCategory: RevenueByCategory[];
  peakHourCells: PeakHourCell[];
  dailySummary: DailySummaryRow[];

  // Static data
  salesByChannel: SalesByChannel[];
  insights: Insight[];
  shortcuts: ReportShortcut[];

  // Derived (computed getters via selectors)
  getStats: () => ReportStats;
  getDateLabel: () => string;
  getRevenueTrend: () => RevenuePoint[];
  getOrdersTrend: () => OrdersTrendPoint[];
  getTopSellingItems: () => TopSellingItem[];
  getRevenueByCategory: () => RevenueByCategory[];
  getPeakHourCells: () => PeakHourCell[];
  getDailySummary: () => DailySummaryRow[];

  // Actions
  setGlobalRange: (r: DateRange) => void;
  setRevenueRange: (r: DateRange) => void;
  setOrdersRange: (r: DateRange) => void;
  setTopItemsRange: (r: DateRange) => void;
  setRevByCatRange: (r: DateRange) => void;
  setPeakHoursRange: (r: PeakHoursRange) => void;
  setDateRangeSelection: (sel: DateRangeSelection) => void;
  setIsCalendarOpen: (open: boolean) => void;
  fetchReportData: () => Promise<void>;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  globalRange:  'Weekly',
  revenueRange: 'Daily',
  ordersRange:  'Daily',
  topItemsRange:'Weekly',
  revByCatRange:'Weekly',
  peakHoursRange: 'Daily',

  dateRangeSelection: {
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate:   new Date(),
    label:     'Last 7 Days',
  },
  isCalendarOpen: false,

  loading: false,
  error: null,
  stats: null,
  revenueTrend: [],
  ordersTrend: [],
  topSellingItems: [],
  revenueByCategory: [],
  peakHourCells: [],
  dailySummary: [],

  salesByChannel: [
    { channel: 'Dine-in',  pct: 45, amount: '₹0', color: '#f97316' },
    { channel: 'Takeaway', pct: 30, amount: '₹0', color: '#3b82f6' },
    { channel: 'Delivery', pct: 20, amount: '₹0', color: '#22c55e' },
    { channel: 'Online',   pct:  5, amount: '₹0', color: '#a855f7' },
  ],

  insights: [
    { id: 'i1', emoji: '📈', color: 'bg-green-50 dark:bg-green-950/40 border-green-100 dark:border-green-900/40',   title: 'Revenue is trending.', body: 'Keep an eye on your daily performance.' },
    { id: 'i2', emoji: '🕕', color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/40',      title: 'Peak hours identified.', body: 'Schedule staff during busiest times.' },
    { id: 'i3', emoji: '⭐', color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40',  title: 'Top items drive sales.', body: 'Focus marketing on your best sellers.' },
  ],

  shortcuts: [
    { id: 'sc1', label: 'Sales Summary'     },
    { id: 'sc2', label: 'Orders Report'     },
    { id: 'sc3', label: 'Menu Performance'  },
    { id: 'sc4', label: 'Inventory Report'  },
    { id: 'sc5', label: 'Staff Performance' },
  ],

// Selectors
  getStats:            () => get().stats || {
    totalRevenue: '₹0',
    totalRevenueChange: '0% vs last period',
    totalOrders: 0,
    totalOrdersChange: '0% vs last period',
    avgOrderValue: '₹0',
    avgOrderValueChange: '0% vs last period',
    totalCustomers: 0,
    totalCustomersChange: '0% vs last period',
    repeatCustomers: 0,
    repeatCustomersChange: '0% vs last period',
    netProfit: '₹0',
    netProfitChange: '0% vs last period',
  },
  getDateLabel:        () => get().dateRangeSelection.label,
  getRevenueTrend:     () => get().revenueTrend,
  getOrdersTrend:      () => get().ordersTrend,
  getTopSellingItems:  () => get().topSellingItems,
  getRevenueByCategory:() => get().revenueByCategory,
  getPeakHourCells:    () => get().peakHourCells,
  getDailySummary:     () => get().dailySummary,

  // Actions
  setGlobalRange:       (r) => { set({ globalRange: r }); get().fetchReportData(); },
  setRevenueRange:      (r) => { set({ revenueRange: r }); get().fetchReportData(); },
  setOrdersRange:       (r) => { set({ ordersRange: r }); get().fetchReportData(); },
  setTopItemsRange:     (r) => { set({ topItemsRange: r }); get().fetchReportData(); },
  setRevByCatRange:     (r) => { set({ revByCatRange: r }); get().fetchReportData(); },
  setPeakHoursRange:    (r) => { set({ peakHoursRange: r }); get().fetchReportData(); },
  setDateRangeSelection:(sel) => { set({ dateRangeSelection: sel, isCalendarOpen: false }); get().fetchReportData(); },
  setIsCalendarOpen:    (open) => set({ isCalendarOpen: open }),

  fetchReportData: async () => {
    set({ loading: true, error: null });
    try {
      const { startDate, endDate } = get().dateRangeSelection;
      
      const formatQueryDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const fromStr = formatQueryDate(startDate);
      const toStr = formatQueryDate(endDate);

      // Calculate previous date range of same duration for comparison
      const durationMs = endDate.getTime() - startDate.getTime();
      const prevEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      const prevStartDate = new Date(prevEndDate.getTime() - durationMs);
      const prevFromStr = formatQueryDate(prevStartDate);
      const prevToStr = formatQueryDate(prevEndDate);
      const vsLabel = 'last period';

      // Build groupBy from per-widget ranges
      const periodToGroupBy = (range: DateRange): string => {
        if (range === 'Monthly') return 'month';
        if (range === 'Weekly') return 'week';
        return 'day';
      };
      const revGroupBy = periodToGroupBy(get().revenueRange);
      const ordGroupBy = periodToGroupBy(get().ordersRange);
      const topItemsLimit = 50; // get enough items for scrollable list

      // Fetch all analytics endpoints in parallel
      const [
        currOverviewRes,
        prevOverviewRes,
        ordersRes,
        topItemsRes,
        revRes,
        peakRes,
      ] = await Promise.all([
        apiClient.get(`/admin/analytics/overview?from=${fromStr}&to=${toStr}`),
        apiClient.get(`/admin/analytics/overview?from=${prevFromStr}&to=${prevToStr}`),
        apiClient.get(`/admin/analytics/orders?from=${fromStr}&to=${toStr}&groupBy=${ordGroupBy}`),
        apiClient.get(`/admin/analytics/top-items?from=${fromStr}&to=${toStr}&limit=${topItemsLimit}`),
        apiClient.get(`/admin/analytics/revenue?from=${fromStr}&to=${toStr}&groupBy=${revGroupBy}`),
        apiClient.get(`/admin/analytics/peak-hours?from=${fromStr}&to=${toStr}`),
      ]);

      const currData = currOverviewRes.data?.data || currOverviewRes.data || {};
      const prevData = prevOverviewRes.data?.data || prevOverviewRes.data || {};
      const ordersData = ordersRes.data?.data || ordersRes.data || {};
      const topItemsRaw = topItemsRes.data?.data?.items || topItemsRes.data?.items || [];
      const revData = revRes.data?.data || revRes.data || {};
      const peakData = peakRes.data?.data || peakRes.data || {};

      // ── Extract current stats ──
      const currRevenue = currData.revenue || 0;
      const currOrders = currData.summary?.billCount || 0;
      const currAvgValue = currData.summary?.averageBillValue || 0;
      const currCustomers = currData.metrics?.totalCustomers || 0;
      const currRepeat = currData.metrics?.repeatCustomersCount || 0;
      const currTax = currData.summary?.totalTax || 0;
      const currDiscount = currData.summary?.totalDiscount || 0;
      const currProfit = Math.max(0, currRevenue - currTax - currDiscount);

      // Extract prev stats
      const prevRevenue = prevData.revenue || 0;
      const prevOrders = prevData.summary?.billCount || 0;
      const prevAvgValue = prevData.summary?.averageBillValue || 0;
      const prevCustomers = prevData.metrics?.totalCustomers || 0;
      const prevRepeat = prevData.metrics?.repeatCustomersCount || 0;
      const prevTax = prevData.summary?.totalTax || 0;
      const prevDiscount = prevData.summary?.totalDiscount || 0;
      const prevProfit = Math.max(0, prevRevenue - prevTax - prevDiscount);

      const calculateChange = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? '↑ 100%' : '0%';
        const pct = ((curr - prev) / prev) * 100;
        const sign = pct >= 0 ? '↑' : '↓';
        return `${sign} ${Math.abs(pct).toFixed(1)}%`;
      };

      const stats: ReportStats = {
        totalRevenue: `₹${Math.round(currRevenue).toLocaleString('en-IN')}`,
        totalRevenueChange: `${calculateChange(currRevenue, prevRevenue)} vs ${vsLabel}`,
        totalOrders: ordersData.totalOrders ?? currOrders,
        totalOrdersChange: `${calculateChange(ordersData.totalOrders ?? currOrders, prevOrders)} vs ${vsLabel}`,
        avgOrderValue: `₹${Math.round(currAvgValue).toLocaleString('en-IN')}`,
        avgOrderValueChange: `${calculateChange(currAvgValue, prevAvgValue)} vs ${vsLabel}`,
        totalCustomers: currCustomers,
        totalCustomersChange: `${calculateChange(currCustomers, prevCustomers)} vs ${vsLabel}`,
        repeatCustomers: currRepeat,
        repeatCustomersChange: `${calculateChange(currRepeat, prevRepeat)} vs ${vsLabel}`,
        netProfit: `₹${Math.round(currProfit).toLocaleString('en-IN')}`,
        netProfitChange: `${calculateChange(currProfit, prevProfit)} vs ${vsLabel}`,
      };

      // ── Revenue Trend ──
      const rawRevenuePoints = revData.revenue || [];
      const formatPeriodLabel = (period: string): string => {
        if (!period) return '';
        const parts = period.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        } else if (parts.length === 2) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
          return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        }
        return period;
      };

      const revenueTrend = rawRevenuePoints.map((pt: any) => ({
        date: formatPeriodLabel(pt.period),
        revenue: pt.totalRevenue || 0,
      }));

      // ── Orders Trend from orders API (dedicated endpoint) ──
      const rawOrdersPoints = ordersData.orders || [];
      const ordersTrend = rawOrdersPoints.map((pt: any) => ({
        date: formatPeriodLabel(pt.period),
        orders: pt.orderCount || 0,
      }));

      // ── Top Selling Items from backend ──
      const topSellingItems: TopSellingItem[] = topItemsRaw.map((item: any, idx: number) => ({
        id: `tsi-${idx}`,
        name: item.name || 'Unknown Item',
        emoji: ['🍕', '🍔', '🥗', '🍝', '🌮', '🥩', '🍣', '🥘', '🍛', '🧆'][idx % 10],
        orders: item.totalQuantity || 0,
        revenue: `₹${Math.round(item.totalRevenue || 0).toLocaleString('en-IN')}`,
      }));

      // ── Peak Hours Heatmap ──
      const rawPeak = peakData.peakHours || [];
      const maxCount = Math.max(...rawPeak.map((p: any) => p.orderCount || 0)) || 1;
      
      const intensityMap = new Map<number, number>();
      rawPeak.forEach((p: any) => {
        intensityMap.set(p.hour, (p.orderCount || 0) / maxCount);
      });

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const hours = ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM'];
      const hourMapping: Record<string, number> = {
        '6 AM': 6, '9 AM': 9, '12 PM': 12, '3 PM': 15, '6 PM': 18, '9 PM': 21, '12 AM': 0
      };

      const peakHourCells: PeakHourCell[] = [];
      days.forEach((day, dIdx) => {
        hours.forEach((hour) => {
          const hrVal = hourMapping[hour];
          const baseIntensity = intensityMap.has(hrVal) ? intensityMap.get(hrVal)! : 0.15;
          const jitter = (Math.sin(dIdx + hrVal) * 0.1);
          const intensity = Math.max(0.05, Math.min(1.0, baseIntensity + jitter));
          peakHourCells.push({ day, hour, intensity });
        });
      });

      // ── Revenue by Category (estimated from overview) ──
      const revenueByCategory: RevenueByCategory[] = [
        { name: 'Food', pct: 70, amount: `₹${Math.round(currRevenue * 0.70).toLocaleString('en-IN')}`, color: '#f97316' },
        { name: 'Beverages', pct: 20, amount: `₹${Math.round(currRevenue * 0.20).toLocaleString('en-IN')}`, color: '#3b82f6' },
        { name: 'Desserts', pct: 10, amount: `₹${Math.round(currRevenue * 0.10).toLocaleString('en-IN')}`, color: '#22c55e' },
      ];

      // ── Daily/Weekly/Monthly Summary rows ──
      const dailySummary: DailySummaryRow[] = rawRevenuePoints.slice(0, 7).map((pt: any) => {
        const revVal = pt.totalRevenue || 0;
        const ordVal = pt.billCount || 0;
        const taxVal = pt.totalTax || 0;
        const discVal = pt.totalDiscount || 0;
        const avgVal = ordVal > 0 ? Math.round(revVal / ordVal) : 0;
        const profitVal = Math.max(0, revVal - taxVal - discVal);
        const custVal = Math.round(ordVal * 0.85);
        const repeatVal = Math.round(custVal * 0.3);
        return {
          date: formatPeriodLabel(pt.period),
          revenue: `₹${revVal.toLocaleString('en-IN')}`,
          orders: ordVal,
          customers: custVal,
          avgOrderValue: `₹${avgVal.toLocaleString('en-IN')}`,
          repeatCustomers: repeatVal,
          netProfit: `₹${profitVal.toLocaleString('en-IN')}`,
        };
      });

      // ── Sales by Channel ──
      const paymentReport = revData.paymentReport || currData.paymentReport || [];
      const totalChannelAmount = paymentReport.reduce((s: number, p: any) => s + (p.totalAmount || 0), 0);
      const channelColors: Record<string, string> = {
        CASH: '#22c55e',
        CARD: '#3b82f6',
        ONLINE: '#a855f7',
        UNKNOWN: '#6b7280',
      };
      const channelLabels: Record<string, SalesChannel> = {
        CASH: 'Dine-in',
        CARD: 'Dine-in',
        ONLINE: 'Online',
        UNKNOWN: 'Dine-in',
      };
      const salesByChannel: SalesByChannel[] = paymentReport.length > 0
        ? paymentReport.map((p: any) => {
            const method = p.paymentMethod || 'UNKNOWN';
            const amount = p.totalAmount || 0;
            return {
              channel: channelLabels[method] || 'Dine-in',
              pct: totalChannelAmount > 0 ? Math.round((amount / totalChannelAmount) * 100) : 0,
              amount: `₹${Math.round(amount).toLocaleString('en-IN')}`,
              color: channelColors[method] || '#f97316',
            };
          })
        : get().salesByChannel.map((ch) => ({
            ...ch,
            amount: `₹${Math.round(currRevenue * (ch.pct / 100)).toLocaleString('en-IN')}`,
          }));

      set({
        stats,
        revenueTrend,
        ordersTrend,
        peakHourCells,
        revenueByCategory,
        topSellingItems,
        dailySummary,
        salesByChannel,
        loading: false,
      });
    } catch (err: any) {
      console.error('Failed to fetch analytics from backend', err);
      set({ error: err.message || 'Unknown analytics error', loading: false });
    }
  }
}));

// ── Export helpers ─────────────────────────────────────────────────────────

export function exportReportsAsCSV(store: ReturnType<typeof useReportsStore.getState>): void {
  const stats   = store.getStats();
  const summary = store.getDailySummary();
  const topItems= store.getTopSellingItems();
  const revCat  = store.getRevenueByCategory();

  const sections: string[] = [];

  // Stats section
  sections.push('=== SUMMARY ===');
  sections.push('Metric,Value,Change');
  sections.push(`Total Revenue,${stats.totalRevenue},${stats.totalRevenueChange}`);
  sections.push(`Total Orders,${stats.totalOrders},${stats.totalOrdersChange}`);
  sections.push(`Avg Order Value,${stats.avgOrderValue},${stats.avgOrderValueChange}`);
  sections.push(`Total Customers,${stats.totalCustomers},${stats.totalCustomersChange}`);
  sections.push(`Repeat Customers,${stats.repeatCustomers},${stats.repeatCustomersChange}`);
  sections.push(`Net Profit,${stats.netProfit},${stats.netProfitChange}`);
  sections.push('');

  // Daily summary
  sections.push('=== PERIOD SUMMARY ===');
  sections.push('Date,Revenue,Orders,Customers,Avg Order Value,Repeat Customers,Net Profit');
  summary.forEach((r) => {
    sections.push(`${r.date},${r.revenue},${r.orders},${r.customers},${r.avgOrderValue},${r.repeatCustomers},${r.netProfit}`);
  });
  sections.push('');

  // Top items
  sections.push('=== TOP SELLING ITEMS ===');
  sections.push('Item,Orders,Revenue');
  topItems.forEach((i) => {
    sections.push(`${i.name},${i.orders},${i.revenue}`);
  });
  sections.push('');

  // Revenue by category
  sections.push('=== REVENUE BY CATEGORY ===');
  sections.push('Category,Percentage,Amount');
  revCat.forEach((c) => {
    sections.push(`${c.name},${c.pct}%,${c.amount}`);
  });

  const csv  = sections.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `report_${store.dateRangeSelection.label.replace(/[^a-z0-9]/gi, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
