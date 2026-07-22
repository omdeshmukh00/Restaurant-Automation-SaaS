import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '../../../shared/services/apiClient';
import { env } from '../../../lib/env';

// ── Types ──────────────────────────────────────────────────────────────────

export type MenuItemStatus = 'Available' | 'Unavailable' | 'Low Stock' | 'Out of Stock';
export type FilterTab = 'All Items' | 'Available' | 'Unavailable' | 'Low Stock';
export type SortOption = 'Name A-Z' | 'Name Z-A' | 'Price Low-High' | 'Price High-Low' | 'Stock Low-High';
export interface AdvancedFilter {
  minPrice: string;
  maxPrice: string;
  statuses: MenuItemStatus[];
}

const LOW_STOCK_THRESHOLD = 10;

export interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  isActive: boolean;
  isHidden: boolean;
  displayOrder: number;
  count: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  categoryName: string;
  image: string;
  isVeg: boolean;
  isSpicy: boolean;
  isAvailable: boolean;
  isHidden: boolean;
  enabled: boolean;
  stockQuantity: number;
  status: MenuItemStatus;
}

export interface ItemCreateInput {
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  isVeg: boolean;
  isSpicy?: boolean;
  isAvailable?: boolean;
  stockQuantity?: number;
  image?: string;
}

export type ItemUpdateInput = Partial<{
  name: string;
  description: string;
  price: number;
  categoryId: string;
  isVeg: boolean;
  isSpicy: boolean;
  isAvailable: boolean;
  isHidden: boolean;
  stockQuantity: number;
  image: string;
}>;

// Raw backend shapes (defensive — list uses .lean() so items arrive as `_id`,
// and categories are full docs with the `id` virtual).
interface RawItem {
  id?: string;
  _id?: string | { toString(): string };
  name?: string;
  description?: string;
  price?: number;
  categoryId?: string | { toString(): string };
  image?: string;
  isVeg?: boolean;
  isSpicy?: boolean;
  isAvailable?: boolean;
  isHidden?: boolean;
  stockQuantity?: number;
}
interface RawCategory {
  id?: string;
  _id?: string | { toString(): string };
  name?: string;
  description?: string;
  image?: string;
  isActive?: boolean;
  isHidden?: boolean;
  displayOrder?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && typeof (v as { toString?: () => string }).toString === 'function') {
    return (v as { toString: () => string }).toString();
  }
  return String(v);
}

function deriveStatus(isAvailable: boolean, isHidden: boolean, stockQuantity: number): MenuItemStatus {
  if (stockQuantity <= 0) return 'Out of Stock';
  if (stockQuantity <= LOW_STOCK_THRESHOLD) return 'Low Stock';
  if (!isAvailable) return 'Unavailable';
  return 'Available';
}

const BACKEND_ORIGIN = (env.apiUrl ?? '').replace(/\/api\/v\d+$/i, '');

function resolveImage(url: string | undefined): string {
  if (!url) return '';
  if (!url.startsWith('/')) return url;
  if (!/^https?:\/\//i.test(BACKEND_ORIGIN)) return url;
  return `${BACKEND_ORIGIN}${url}`;
}

function mapItem(raw: RawItem, categoryName = ''): MenuItem {
  const id = raw.id ?? asString(raw._id);
  const categoryId = asString(raw.categoryId);
  const stockQuantity = typeof raw.stockQuantity === 'number' ? raw.stockQuantity : 0;
  const isAvailable = raw.isAvailable !== false;
  const isHidden = !!raw.isHidden;
  return {
    id,
    name: raw.name ?? '',
    description: raw.description ?? '',
    price: typeof raw.price === 'number' ? raw.price : 0,
    categoryId,
    categoryName,
    image: resolveImage(raw.image),
    isVeg: !!raw.isVeg,
    isSpicy: !!raw.isSpicy,
    isAvailable,
    isHidden,
    enabled: !isHidden,
    stockQuantity,
    status: deriveStatus(isAvailable, isHidden, stockQuantity),
  };
}

function mapCategory(raw: RawCategory): Category {
  return {
    id: raw.id ?? asString(raw._id),
    name: raw.name ?? '',
    description: raw.description ?? '',
    image: raw.image ?? '',
    isActive: raw.isActive !== false,
    isHidden: !!raw.isHidden,
    displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 0,
    count: 0,
  };
}

function buildCategoryNameMap(categories: Category[]): Record<string, string> {
  const map: Record<string, string> = {};
  categories.forEach((c) => {
    map[c.id] = c.name;
  });
  return map;
}

function countItemsByCategory(items: MenuItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  items.forEach((i) => {
    counts[i.categoryId] = (counts[i.categoryId] ?? 0) + 1;
  });
  return counts;
}

function compressImage(
  file: File,
  maxDim = 1000,
  quality = 0.7,
): Promise<{ base64: string; type: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const type = 'image/jpeg';
        let dataUrl = canvas.toDataURL(type, quality);
        let base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (base64.length > 6_000_000 && quality > 0.4) {
          dataUrl = canvas.toDataURL(type, 0.4);
          base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        }
        resolve({ base64, type });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Store ──────────────────────────────────────────────────────────────────

interface MenuStore {
  items: MenuItem[];
  categories: Category[];
  searchQuery: string;
  activeCategory: string;
  sortOption: SortOption;
  activeFilter: FilterTab;
  statusFilter: MenuItemStatus | null;
  advancedFilter: AdvancedFilter;
  currentPage: number;
  perPage: number;
  setCurrentPage: (p: number) => void;
  isLoading: boolean;
  error: string | null;

  fetchItems: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  refresh: () => Promise<void>;
  addItem: (input: ItemCreateInput) => Promise<void>;
  updateItem: (id: string, data: ItemUpdateInput) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleItemEnabled: (id: string) => Promise<void>;
  setItemAvailability: (id: string, isAvailable: boolean) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  addCategory: (name: string) => Promise<void>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  recomputeCounts: () => void;

  setSearchQuery: (q: string) => void;
  setActiveCategory: (id: string) => void;
  setSortOption: (opt: SortOption) => void;
  setActiveFilter: (tab: FilterTab) => void;
  setStatusFilter: (status: MenuItemStatus | null) => void;
  setAdvancedFilter: (f: AdvancedFilter) => void;
}

const DEFAULT_ADVANCED: AdvancedFilter = { minPrice: '', maxPrice: '', statuses: [] };

export const useMenuStore = create<MenuStore>()(
  persist(
    (set, get) => ({
      items: [],
      categories: [],
      searchQuery: '',
      activeCategory: 'all',
      sortOption: 'Name A-Z',
      activeFilter: 'All Items',
      statusFilter: null,
      advancedFilter: DEFAULT_ADVANCED,
      currentPage: 1,
      perPage: 12,
      isLoading: false,
      error: null,

      recomputeCounts: () => {
        set((s) => {
          const counts = countItemsByCategory(s.items);
          return {
            categories: s.categories.map((c) =>
              c.id === 'all' ? { ...c, count: s.items.length } : { ...c, count: counts[c.id] ?? 0 },
            ),
          };
        });
      },

      fetchCategories: async () => {
        try {
          const res = await apiClient.get('/admin/menu/categories');
          const raw = (res.data?.data ?? []) as RawCategory[];
          const mapped = raw
            .map(mapCategory)
            .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
          const allCategory: Category = {
            id: 'all',
            name: 'All Items',
            description: '',
            image: '',
            isActive: true,
            isHidden: false,
            displayOrder: -1,
            count: get().items.length,
          };
          set({ categories: [allCategory, ...mapped] });
          get().recomputeCounts();
        } catch (e: any) {
          set({ error: e?.response?.data?.message ?? 'Failed to load categories' });
        }
      },

      fetchItems: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiClient.get('/admin/menu/items?limit=1000');
          const rawItems = (res.data?.data?.items ?? []) as RawItem[];
          const catMap = buildCategoryNameMap(get().categories);
          const items = rawItems.map((r) => mapItem(r, catMap[asString(r.categoryId)] ?? ''));
          set({ items, isLoading: false });
          get().recomputeCounts();
        } catch (e: any) {
          set({ isLoading: false, error: e?.response?.data?.message ?? 'Failed to load menu items' });
        }
      },

      refresh: async () => {
        await get().fetchCategories();
        await get().fetchItems();
      },

      addItem: async (input) => {
        const res = await apiClient.post('/admin/menu/items', input);
        const raw = res.data?.data as RawItem;
        const catMap = buildCategoryNameMap(get().categories);
        const created = mapItem(raw, catMap[asString(raw.categoryId)] ?? '');
        set((s) => ({ items: [created, ...s.items] }));
        get().recomputeCounts();
      },

      updateItem: async (id, data) => {
        const res = await apiClient.patch(`/admin/menu/items/${id}`, data);
        const raw = res.data?.data as RawItem;
        const catMap = buildCategoryNameMap(get().categories);
        const prevName = get().items.find((i) => i.id === id)?.categoryName ?? '';
        const updated = mapItem(raw, catMap[asString(raw.categoryId)] ?? prevName);
        set((s) => ({ items: s.items.map((i) => (i.id === id ? updated : i)) }));
      },

      deleteItem: async (id) => {
        await apiClient.delete(`/admin/menu/items/${id}`);
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
        get().recomputeCounts();
      },

      toggleItemEnabled: async (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        const isHidden = !item.isHidden;
        const res = await apiClient.patch(`/admin/menu/items/${id}/visibility`, { isHidden });
        const raw = res.data?.data as RawItem;
        const catMap = buildCategoryNameMap(get().categories);
        const updated = mapItem(raw, catMap[asString(raw.categoryId)] ?? item.categoryName);
        set((s) => ({ items: s.items.map((i) => (i.id === id ? updated : i)) }));
      },

      setItemAvailability: async (id, isAvailable) => {
        const res = await apiClient.patch(`/admin/menu/items/${id}/availability`, { isAvailable });
        const raw = res.data?.data as RawItem;
        const catMap = buildCategoryNameMap(get().categories);
        const prevName = get().items.find((i) => i.id === id)?.categoryName ?? '';
        const updated = mapItem(raw, catMap[asString(raw.categoryId)] ?? prevName);
        set((s) => ({ items: s.items.map((i) => (i.id === id ? updated : i)) }));
      },

      uploadImage: async (file) => {
        const { base64, type } = await compressImage(file);
        const res = await apiClient.post('/uploads', {
          fileName: file.name,
          content: base64,
          mimeType: type,
        });
        const id = res.data?.data?._id;
        if (!id) return '';
        return `${env.apiUrl}/uploads/${id}/image`;
      },

      addCategory: async (name) => {
        const res = await apiClient.post('/admin/menu/categories', { name });
        const raw = res.data?.data as RawCategory;
        const cat = mapCategory(raw);
        set((s) => ({ categories: [...s.categories, cat] }));
      },

      updateCategory: async (id, name) => {
        const res = await apiClient.patch(`/admin/menu/categories/${id}`, { name });
        const raw = res.data?.data as RawCategory;
        const updated = mapCategory(raw);
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? updated : c)) }));
      },

      deleteCategory: async (id) => {
        await apiClient.delete(`/admin/menu/categories/${id}`);
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
        get().recomputeCounts();
      },

      setSearchQuery: (q) => set({ searchQuery: q, currentPage: 1 }),
      setActiveCategory: (id) => set({ activeCategory: id, currentPage: 1 }),
      setSortOption: (opt) => set({ sortOption: opt, currentPage: 1 }),
      setActiveFilter: (tab) => set({ activeFilter: tab, currentPage: 1 }),
      setStatusFilter: (status) => set({ statusFilter: status, currentPage: 1 }),
      setAdvancedFilter: (f) => set({ advancedFilter: f, currentPage: 1 }),
      setCurrentPage: (p) => set({ currentPage: Math.max(1, Math.floor(p)) }),
    }),
    {
      name: 'menu-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        searchQuery: s.searchQuery,
        activeCategory: s.activeCategory,
        sortOption: s.sortOption,
        activeFilter: s.activeFilter,
        statusFilter: s.statusFilter,
        advancedFilter: s.advancedFilter,
      }),
    }
  )
);

// ── Selectors ──────────────────────────────────────────────────────────────

export function getFilteredItems(store: MenuStore): MenuItem[] {
  let items = store.items;

  if (store.activeCategory !== 'all') {
    items = items.filter((i) => i.categoryId === store.activeCategory);
  }

  if (store.searchQuery.trim()) {
    const q = store.searchQuery.trim().toLowerCase();
    items = items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    );
  }

  switch (store.activeFilter) {
    case 'Available':
      items = items.filter((i) => i.status === 'Available');
      break;
    case 'Unavailable':
      items = items.filter((i) => i.status === 'Unavailable' || i.status === 'Out of Stock');
      break;
    case 'Low Stock':
      items = items.filter((i) => i.status === 'Low Stock');
      break;
  }

  if (store.statusFilter) {
    items = items.filter((i) => i.status === store.statusFilter);
  }

  const af = store.advancedFilter;
  if (af.minPrice !== '') {
    const m = parseFloat(af.minPrice);
    if (!isNaN(m)) items = items.filter((i) => i.price >= m);
  }
  if (af.maxPrice !== '') {
    const m = parseFloat(af.maxPrice);
    if (!isNaN(m)) items = items.filter((i) => i.price <= m);
  }
  if (af.statuses.length) {
    items = items.filter((i) => af.statuses.includes(i.status));
  }

  switch (store.sortOption) {
    case 'Name A-Z':
      items = [...items].sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'Name Z-A':
      items = [...items].sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'Price Low-High':
      items = [...items].sort((a, b) => a.price - b.price);
      break;
    case 'Price High-Low':
      items = [...items].sort((a, b) => b.price - a.price);
      break;
    case 'Stock Low-High':
      items = [...items].sort((a, b) => a.stockQuantity - b.stockQuantity);
      break;
  }

  return items;
}
