import { create } from 'zustand';
import { apiClient } from '../../../shared/services/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────

export type ItemCategory  = 'Ingredients' | 'Beverages' | 'Packaging' | 'Cleaning Supplies' | 'Other';
export type ItemStatus    = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expiring Soon';
export type ItemTab       = 'All Items' | ItemCategory;

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  unit: string;
  currentStock: number;
  parLevel: number;
  status: ItemStatus;
  lastUpdated: string;
  imageEmoji: string;
}

export interface InventoryStats {
  totalItems: number;
  totalItemsChange: string;
  totalValue: string;
  totalValueChange: string;
  lowStockItems: number;
  lowStockChange: string;
  outOfStockItems: number;
  outOfStockChange: string;
  expiringSoon: number;
}

export interface StockAlert {
  id: string;
  name: string;
  detail: string;
  status: 'Low Stock' | 'Out of Stock';
  imageEmoji: string;
}

export interface Supplier {
  id: string;
  name: string;
  spent: string;
  color: string;
  initials: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface StatusDistribution {
  inStock: number;
  inStockPct: number;
  lowStock: number;
  lowStockPct: number;
  outOfStock: number;
  outOfStockPct: number;
  expiringSoon: number;
  expiringSoonPct: number;
}

export interface NewItemForm {
  name: string;
  category: ItemCategory;
  unit: string;
  currentStock: string;
  parLevel: string;
  imageEmoji: string;
}

interface InventoryStore {
  loading: boolean;
  error: string | null;

  stats: InventoryStats;
  items: InventoryItem[];
  stockAlerts: StockAlert[];
  topSuppliers: Supplier[];
  valueOverTime: ChartDataPoint[];
  topUsedIngredients: ChartDataPoint[];
  statusDistribution: StatusDistribution;

  activeTab: ItemTab;
  activeCategory: ItemCategory | 'All Categories';
  searchQuery: string;
  currentPage: number;
  perPage: number;

  // Modal states
  showAddItemModal: boolean;
  showImportModal: boolean;
  showStockAlertsModal: boolean;
  showSuppliersModal: boolean;
  showValueChartModal: boolean;
  showDonutModal: boolean;
  showIngredientsModal: boolean;

  setActiveTab:      (t: ItemTab) => void;
  setActiveCategory: (c: ItemCategory | 'All Categories') => void;
  setSearchQuery:    (q: string) => void;
  setCurrentPage:    (p: number) => void;

  // Modal toggles
  setShowAddItemModal:      (v: boolean) => void;
  setShowImportModal:       (v: boolean) => void;
  setShowStockAlertsModal:  (v: boolean) => void;
  setShowSuppliersModal:    (v: boolean) => void;
  setShowValueChartModal:   (v: boolean) => void;
  setShowDonutModal:        (v: boolean) => void;
  setShowIngredientsModal:  (v: boolean) => void;

  // Actions
  fetchInventory: () => Promise<void>;
  addItem: (form: NewItemForm) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  importItems: (raw: string) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveStatus(currentStock: number, parLevel: number): ItemStatus {
  if (currentStock === 0) return 'Out of Stock';
  if (currentStock <= parLevel) return 'Low Stock';
  return 'In Stock';
}

function normalizeCategory(cat?: string): ItemCategory {
  const c = cat || '';
  if (c.toLowerCase().includes('ingred')) return 'Ingredients';
  if (c.toLowerCase().includes('bev')) return 'Beverages';
  if (c.toLowerCase().includes('pack')) return 'Packaging';
  if (c.toLowerCase().includes('clean')) return 'Cleaning Supplies';
  return 'Other';
}

function getInitials(name: string): string {
  if (!name) return 'SP';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const SUPPLIER_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-orange-500', 'bg-purple-500', 'bg-red-500'];

const STATIC_VALUE_OVER_TIME = [
  { label: 'Apr 20', value: 18000 },
  { label: 'Apr 27', value: 19500 },
  { label: 'May 4',  value: 17800 },
  { label: 'May 11', value: 21000 },
];

// ── Store ─────────────────────────────────────────────────────────────────────

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  loading: false,
  error: null,

  stats: {
    totalItems: 0,
    totalItemsChange: '+0%',
    totalValue: '₹0',
    totalValueChange: '+0%',
    lowStockItems: 0,
    lowStockChange: '-0',
    outOfStockItems: 0,
    outOfStockChange: '-0',
    expiringSoon: 0,
  },

  items: [],
  stockAlerts: [],
  topSuppliers: [],
  valueOverTime: STATIC_VALUE_OVER_TIME,
  topUsedIngredients: [],
  statusDistribution: {
    inStock: 0, inStockPct: 0,
    lowStock: 0, lowStockPct: 0,
    outOfStock: 0, outOfStockPct: 0,
    expiringSoon: 0, expiringSoonPct: 0,
  },

  activeTab:      'All Items',
  activeCategory: 'All Categories',
  searchQuery:     '',
  currentPage:     1,
  perPage:         8,

  // Modals
  showAddItemModal:     false,
  showImportModal:      false,
  showStockAlertsModal: false,
  showSuppliersModal:   false,
  showValueChartModal:  false,
  showDonutModal:       false,
  showIngredientsModal: false,

  setActiveTab:      (t) => set({ activeTab: t,      currentPage: 1 }),
  setActiveCategory: (c) => set({ activeCategory: c, currentPage: 1 }),
  setSearchQuery:    (q) => set({ searchQuery: q,    currentPage: 1 }),
  setCurrentPage:    (p) => set({ currentPage: p }),

  setShowAddItemModal:     (v) => set({ showAddItemModal: v }),
  setShowImportModal:      (v) => set({ showImportModal: v }),
  setShowStockAlertsModal: (v) => set({ showStockAlertsModal: v }),
  setShowSuppliersModal:   (v) => set({ showSuppliersModal: v }),
  setShowValueChartModal:  (v) => set({ showValueChartModal: v }),
  setShowDonutModal:       (v) => set({ showDonutModal: v }),
  setShowIngredientsModal: (v) => set({ showIngredientsModal: v }),

  fetchInventory: async () => {
    set({ loading: true, error: null });
    try {
      const [itemsRes, statsRes, alertsRes, analyticsRes, suppliersRes] = await Promise.all([
        apiClient.get('/admin/inventory'),
        apiClient.get('/admin/inventory/stats'),
        apiClient.get('/admin/inventory/alerts'),
        apiClient.get('/admin/inventory/analytics'),
        apiClient.get('/admin/suppliers'),
      ]);

      const backendItems = itemsRes.data?.data?.items || [];
      const statsData = statsRes.data?.data?.stats || {};
      const alertsData = alertsRes.data?.data?.alerts || [];
      const analyticsData = analyticsRes.data?.data?.inventoryAnalytics || {};
      const suppliersData = suppliersRes.data?.data?.suppliers || [];

      // 1. Map items
      const mappedItems: InventoryItem[] = backendItems.map((item: any) => ({
        id: item._id,
        name: item.name,
        category: normalizeCategory(item.category),
        unit: item.unit || 'pcs',
        currentStock: item.stock || 0,
        parLevel: item.threshold || 0,
        status: deriveStatus(item.stock || 0, item.threshold || 0),
        lastUpdated: new Date(item.updatedAt || Date.now()).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        imageEmoji: item.imageEmoji || '📦',
      }));

      // 2. Map stats
      const totalVal = statsData.totalInventoryValue || 0;
      const mappedStats: InventoryStats = {
        totalItems: statsData.totalItems || 0,
        totalItemsChange: '+0%',
        totalValue: `₹${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        totalValueChange: '+0%',
        lowStockItems: statsData.lowStockItems || 0,
        lowStockChange: `-${statsData.lowStockItems || 0}`,
        outOfStockItems: statsData.outOfStockItems || 0,
        outOfStockChange: `-${statsData.outOfStockItems || 0}`,
        expiringSoon: 0,
      };

      // 3. Map alerts
      const mappedAlerts: StockAlert[] = alertsData.map((alert: any) => ({
        id: alert._id,
        name: alert.name,
        detail: alert.stock > 0 ? `${alert.stock.toFixed(2)} ${alert.unit || 'pcs'} left` : 'Out of stock',
        status: alert.stock === 0 ? 'Out of Stock' : 'Low Stock',
        imageEmoji: alert.imageEmoji || '📦',
      }));

      // 4. Map top suppliers (dynamically compute spent based on active inventory items from this supplier)
      const mappedSuppliers: Supplier[] = suppliersData.map((s: any, idx: number) => {
        // Sum stock * pricePerUnit for items from this supplier
        const supplierItems = backendItems.filter((i: any) => i.supplierId === s._id || i.supplierId?._id === s._id);
        const totalSpent = supplierItems.reduce((acc: number, curr: any) => {
          return acc + (curr.stock || 0) * (curr.pricePerUnit || 0);
        }, 0);

        return {
          id: s._id,
          name: s.name,
          spent: `₹${totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          color: SUPPLIER_COLORS[idx % SUPPLIER_COLORS.length],
          initials: getInitials(s.name),
        };
      });

      // 5. Map analytics: Top Used Ingredients
      const topIngredients = analyticsData.topConsumedIngredients || [];
      const mappedUsedIngredients: ChartDataPoint[] = topIngredients.map((item: any) => ({
        label: item.name || 'Unknown',
        value: item.totalConsumed || 0,
      }));

      // Fallback if no analytics items returned, keep some static items
      const topUsedIngredients = mappedUsedIngredients.length > 0 ? mappedUsedIngredients : [
        { label: 'Chicken', value: 84 },
        { label: 'Tomatoes', value: 58 },
        { label: 'Cheese', value: 42 },
        { label: 'Lettuce', value: 31 },
        { label: 'Onions', value: 19 },
      ];

      // 6. Map status distribution percentages
      const health = statsData.stockHealth || { healthy: 0, low: 0, outOfStock: 0 };
      const totalHealth = health.healthy + health.low + health.outOfStock;
      const statusDistribution: StatusDistribution = {
        inStock: health.healthy || 0,
        inStockPct: totalHealth > 0 ? Math.round((health.healthy / totalHealth) * 100) : 0,
        lowStock: health.low || 0,
        lowStockPct: totalHealth > 0 ? Math.round((health.low / totalHealth) * 100) : 0,
        outOfStock: health.outOfStock || 0,
        outOfStockPct: totalHealth > 0 ? Math.round((health.outOfStock / totalHealth) * 100) : 0,
        expiringSoon: 0,
        expiringSoonPct: 0,
      };

      // 7. Map value over time trend chart
      const valueOverTime = [
        ...STATIC_VALUE_OVER_TIME,
        { label: 'Today', value: totalVal },
      ];

      set({
        items: mappedItems,
        stats: mappedStats,
        stockAlerts: mappedAlerts,
        topSuppliers: mappedSuppliers,
        topUsedIngredients,
        statusDistribution,
        valueOverTime,
      });
    } catch (err: any) {
      set({ error: err.response?.data?.message || err.message });
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (form) => {
    set({ loading: true, error: null });
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit.trim() || 'pcs',
        stock: parseFloat(form.currentStock) || 0,
        threshold: parseFloat(form.parLevel) || 0,
        imageEmoji: form.imageEmoji || '📦',
      };
      await apiClient.post('/admin/inventory', payload);
      await get().fetchInventory();
      set({ showAddItemModal: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || err.message });
    } finally {
      set({ loading: false });
    }
  },

  deleteItem: async (id) => {
    set({ loading: true, error: null });
    try {
      await apiClient.delete(`/admin/inventory/${id}`);
      await get().fetchInventory();
    } catch (err: any) {
      set({ error: err.response?.data?.message || err.message });
    } finally {
      set({ loading: false });
    }
  },

  importItems: async (raw) => {
    set({ loading: true, error: null });
    try {
      const lines = raw.trim().split('\n').filter(Boolean);
      const payload = lines.map((line) => {
        const parts = line.split(',').map((s) => s.trim());
        const currentStock = parseFloat(parts[2]) || 0;
        const parLevel     = parseFloat(parts[3]) || 0;
        return {
          name:         parts[0] || 'Unnamed Item',
          category:     parts[1] || 'Other',
          stock:        currentStock,
          threshold:    parLevel,
          unit:         parts[4] || 'pcs',
          imageEmoji:   parts[5] || '📦',
        };
      });
      await apiClient.post('/admin/inventory/bulk-import', payload);
      await get().fetchInventory();
      set({ showImportModal: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || err.message });
    } finally {
      set({ loading: false });
    }
  },
}));
