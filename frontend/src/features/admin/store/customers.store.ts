import { create } from 'zustand';
import { customerApi } from '../api/customers.api';

// ── Types ────────────────────────────────────────────────────────────────────

export type CustomerStatus = 'Active' | 'Inactive';
export type LoyaltyTier = 'Gold' | 'Silver' | 'Bronze';
export type SpendFilter = 'All' | 'above500' | 'above1000' | 'above2000' | 'above5000';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  loyaltyTier: LoyaltyTier;
  totalVisits: number;
  totalSpent: string;
  totalSpentRaw: number;
  lastOrder: string;
  lastOrderId: string;
  status: CustomerStatus;
}

export interface CustomerStats {
  totalCustomers: number;
  totalCustomersChange: string;
  loyalCustomers: number;
  loyalCustomersChange: string;
  totalVisits: number;
  totalVisitsChange: string;
  totalSpent: string;
  totalSpentChange: string;
}

export interface TopCustomer {
  rank: number;
  name: string;
  avatar: string;
  spent: string;
  spentRaw: number;
  id: string;
}

export interface LoyaltyDistribution {
  gold: number;
  silver: number;
  bronze: number;
  goldPct: number;
  silverPct: number;
  bronzePct: number;
}

interface CustomersStore {
  stats: CustomerStats;
  customers: Customer[];
  topCustomers: TopCustomer[];
  loyaltyDistribution: LoyaltyDistribution;
  customerOverview: { active: number; inactive: number; new: number; total: number };

  loading: boolean;
  error: string | null;

  activeStatusFilter: CustomerStatus | 'All';
  activeTierFilter: LoyaltyTier | 'All';
  activeSpendFilter: SpendFilter;
  searchQuery: string;
  currentPage: number;
  perPage: number;

  editingCustomer: Customer | null;
  deletingCustomer: Customer | null;

  fetchCustomers: () => Promise<void>;
  setStatusFilter: (s: CustomerStatus | 'All') => void;
  setTierFilter: (t: LoyaltyTier | 'All') => void;
  setSpendFilter: (s: SpendFilter) => void;
  setSearchQuery: (q: string) => void;
  setCurrentPage: (p: number) => void;
  setEditingCustomer: (c: Customer | null) => void;
  setDeletingCustomer: (c: Customer | null) => void;
  addCustomer: (input: { name: string; mobile: string; email?: string; tags?: string[] }) => Promise<void>;
  updateCustomer: (id: string, updates: { name?: string; email?: string }) => Promise<void>;
  removeCustomer: (id: string) => Promise<void>;
}

const emptyStats: CustomerStats = {
  totalCustomers: 0,
  totalCustomersChange: '+0%',
  loyalCustomers: 0,
  loyalCustomersChange: '+0%',
  totalVisits: 0,
  totalVisitsChange: '+0%',
  totalSpent: '₹0.00',
  totalSpentChange: '+0%',
};

export const useCustomersStore = create<CustomersStore>()((set, get) => ({
  stats: emptyStats,
  customers: [],
  topCustomers: [],
  loyaltyDistribution: { gold: 0, silver: 0, bronze: 0, goldPct: 0, silverPct: 0, bronzePct: 0 },
  customerOverview: { active: 0, inactive: 0, new: 0, total: 0 },

  loading: false,
  error: null,

  activeStatusFilter: 'All',
  activeTierFilter: 'All',
  activeSpendFilter: 'All',
  searchQuery: '',
  currentPage: 1,
  perPage: 8,

  editingCustomer: null,
  deletingCustomer: null,

  fetchCustomers: async () => {
    set({ loading: true, error: null });
    try {
      const data = await customerApi.getCustomers({ perPage: 1000 });
      set({
        customers: data.customers,
        stats: data.stats,
        topCustomers: data.topCustomers,
        loyaltyDistribution: data.loyaltyDistribution,
        customerOverview: data.customerOverview,
        loading: false,
      });
    } catch (err: any) {
      set({
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to load customers',
      });
    }
  },

  setStatusFilter: (s) => set({ activeStatusFilter: s, currentPage: 1 }),
  setTierFilter: (t) => set({ activeTierFilter: t, currentPage: 1 }),
  setSpendFilter: (s) => set({ activeSpendFilter: s, currentPage: 1 }),
  setSearchQuery: (q) => set({ searchQuery: q, currentPage: 1 }),
  setCurrentPage: (p) => set({ currentPage: p }),
  setEditingCustomer: (c) => set({ editingCustomer: c }),
  setDeletingCustomer: (c) => set({ deletingCustomer: c }),

  addCustomer: async (input) => {
    set({ loading: true, error: null });
    try {
      await customerApi.createCustomer(input);
      await get().fetchCustomers();
    } catch (err: any) {
      set({
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to add customer',
      });
      throw err;
    }
    set({ loading: false });
  },

  updateCustomer: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      await customerApi.updateCustomer(id, updates);
      await get().fetchCustomers();
    } catch (err: any) {
      set({
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to update customer',
      });
      throw err;
    }
    set({ loading: false });
  },

  removeCustomer: async (id) => {
    set({ loading: true, error: null });
    try {
      await customerApi.deleteCustomer(id);
      await get().fetchCustomers();
    } catch (err: any) {
      set({
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to remove customer',
      });
      throw err;
    }
    set({ loading: false });
  },
}));
