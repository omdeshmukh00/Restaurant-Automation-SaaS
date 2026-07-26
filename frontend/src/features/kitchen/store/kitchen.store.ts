import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { KitchenOrder, KitchenBatch, KitchenLoad, KitchenPerformance } from '../api/kitchen.api';
import { InventoryItem } from '../pages/KitchenInventoryPage';

export interface KitchenProfile {
  id: string;
  name: string;
  role: string;
  status: 'on-duty' | 'off-duty' | 'on-break';
  station: string;
  shift: string;
  phone: string;
  email: string;
  avatar: string;
}

interface KitchenStore {
  profile: KitchenProfile;
  
  ordersById: Record<string, KitchenOrder>;
  orderIds: string[];
  
  batchesById: Record<string, KitchenBatch>;
  batchIds: string[];
  
  suggestedBatches: any[];
  inventory: InventoryItem[];
  load: KitchenLoad | null;
  performance: KitchenPerformance | null;

  updateProfile: (newProfile: Partial<KitchenProfile>) => void;
  setOrders: (orders: KitchenOrder[]) => void;
  upsertOrder: (order: KitchenOrder) => void;
  setBatches: (batches: KitchenBatch[]) => void;
  upsertBatch: (batch: KitchenBatch) => void;
  
  setSuggestedBatches: (batches: any[] | ((prev: any[]) => any[])) => void;
  setInventory: (inventory: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
  setLoad: (load: KitchenLoad | ((prev: KitchenLoad | null) => KitchenLoad | null)) => void;
  setPerformance: (performance: KitchenPerformance | ((prev: KitchenPerformance | null) => KitchenPerformance | null)) => void;
}

const DEFAULT_PROFILE: KitchenProfile = {
  id: 'STF-01',
  name: 'Chef Arjun',
  role: 'Head-Chef',
  status: 'on-duty',
  station: 'Grill Station',
  shift: '6:00 AM - 2:00 PM',
  phone: '+91 98765 43210',
  email: 'arjun.chef@flavoroast.com',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmbmbzz4OJ7IsEkEHmNZJz11jLymeZ8GiEKeOnWQmoOE5Q_HuXkjmZXYQQnxukQmYSukcHmGlDaE2DekU_XTxx94qss_9SynPU_qRxjig9w5vwaSPK0QOJ19bP2nDTKH0okSa-V_RlIcQtcPnyw0GO46oo69eT4L-oy_NlsShqVsJ53F8vs3K8QuVkaIozpaP67AMr8YinHpVrCmjqhBE2XnqtFhZ4QaLUR6pKjqn9OeT0fUi28Ah4z0Az_h_TwjcYiaHG7j24-Qs',
};

export const useKitchenStore = create<KitchenStore>()(
  persist(
    (set) => ({
      profile: DEFAULT_PROFILE,
      ordersById: {},
      orderIds: [],
      batchesById: {},
      batchIds: [],
      suggestedBatches: [],
      inventory: [],
      load: null,
      performance: null,
      updateProfile: (newProfile) =>
        set((state) => ({
          profile: {
            ...state.profile,
            ...newProfile,
          },
        })),
      setOrders: (orders) => set(() => {
        const ordersById: Record<string, KitchenOrder> = {};
        const orderIds: string[] = [];
        orders.forEach(o => {
          const id = o.id || (o as any)._id;
          if (id) {
            ordersById[id] = { ...o, id };
            orderIds.push(id);
          }
        });
        return { ordersById, orderIds };
      }),
      upsertOrder: (order) => set((state) => {
        const id = order.id || (order as any)._id;
        if (!id) return state;
        
        const existingOrder = state.ordersById[id];
        if (existingOrder && order.updatedAt && existingOrder.updatedAt) {
          const newTime = new Date(order.updatedAt).getTime();
          const oldTime = new Date(existingOrder.updatedAt).getTime();
          if (newTime < oldTime) {
            return state; // Ignore stale event
          }
        }

        const exists = state.orderIds.includes(id);
        return {
          ordersById: { ...state.ordersById, [id]: { ...existingOrder, ...order, id } },
          orderIds: exists ? state.orderIds : [...state.orderIds, id],
        };
      }),
      setBatches: (batches) => set(() => {
        const batchesById: Record<string, KitchenBatch> = {};
        const batchIds: string[] = [];
        batches.forEach(b => {
          const id = b.id || (b as any)._id;
          if (id) {
            batchesById[id] = { ...b, id };
            batchIds.push(id);
          }
        });
        return { batchesById, batchIds };
      }),
      upsertBatch: (batch) => set((state) => {
        const id = batch.id || (batch as any)._id;
        if (!id) return state;

        const existingBatch = state.batchesById[id];
        if (existingBatch && batch.updatedAt && existingBatch.updatedAt) {
          const newTime = new Date(batch.updatedAt).getTime();
          const oldTime = new Date(existingBatch.updatedAt).getTime();
          if (newTime < oldTime) {
            return state; // Ignore stale event
          }
        }

        const exists = state.batchIds.includes(id);
        return {
          batchesById: { ...state.batchesById, [id]: { ...existingBatch, ...batch, id } },
          batchIds: exists ? state.batchIds : [...state.batchIds, id],
        };
      }),
      setSuggestedBatches: (batches) => set((state) => ({ suggestedBatches: typeof batches === 'function' ? batches(state.suggestedBatches) : batches })),
      setInventory: (inventory) => set((state) => ({ inventory: typeof inventory === 'function' ? inventory(state.inventory) : inventory })),
      setLoad: (load) => set((state) => ({ load: typeof load === 'function' ? load(state.load) : load })),
      setPerformance: (performance) => set((state) => ({ performance: typeof performance === 'function' ? performance(state.performance) : performance })),
    }),
    {
      name: 'kitchen-profile-store', // Kept original name for backward compatibility
    }
  )
);
