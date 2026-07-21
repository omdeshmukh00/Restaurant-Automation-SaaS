import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { KitchenOrder, KitchenBatch, KitchenLoad, KitchenPerformance } from '../api/kitchen.api';
import { InventoryItem } from './kitchenData';

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
  orders: KitchenOrder[];
  batches: KitchenBatch[];
  suggestedBatches: any[];
  inventory: InventoryItem[];
  load: KitchenLoad | null;
  performance: KitchenPerformance | null;

  updateProfile: (newProfile: Partial<KitchenProfile>) => void;
  setOrders: (orders: KitchenOrder[] | ((prev: KitchenOrder[]) => KitchenOrder[])) => void;
  setBatches: (batches: KitchenBatch[] | ((prev: KitchenBatch[]) => KitchenBatch[])) => void;
  setSuggestedBatches: (batches: any[] | ((prev: any[]) => any[])) => void;
  setInventory: (inventory: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
  setLoad: (load: KitchenLoad | ((prev: KitchenLoad | null) => KitchenLoad | null)) => void;
  setPerformance: (performance: KitchenPerformance | ((prev: KitchenPerformance | null) => KitchenPerformance | null)) => void;
}

const DEFAULT_PROFILE: KitchenProfile = {
  id: 'STF-01',
  name: 'Chef Arjun',
  role: 'Executive Chef',
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
      orders: [],
      batches: [],
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
      setOrders: (orders) => set((state) => ({ orders: typeof orders === 'function' ? orders(state.orders) : orders })),
      setBatches: (batches) => set((state) => ({ batches: typeof batches === 'function' ? batches(state.batches) : batches })),
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
