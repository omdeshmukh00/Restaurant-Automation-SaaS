import { create } from 'zustand';
import { adminOffersApi, type AdminOffer, type CreateOfferPayload, type UpdateOfferPayload, type OfferListParams } from '../api/admin.offers.api';

export type OfferStatusFilter = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'ALL';

interface OffersStore {
  offers: AdminOffer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: OfferStatusFilter;

  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: OfferStatusFilter) => void;
  setPage: (p: number) => void;

  fetchOffers: () => Promise<void>;
  createOffer: (payload: CreateOfferPayload) => Promise<AdminOffer>;
  updateOffer: (id: string, payload: UpdateOfferPayload) => Promise<AdminOffer>;
  deleteOffer: (id: string) => Promise<void>;
  toggleStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') => Promise<AdminOffer>;
}

export const useOffersStore = create<OffersStore>((set, get) => ({
  offers: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  loading: false,
  error: null,
  searchQuery: '',
  statusFilter: 'ALL',

  setSearchQuery: (q) => set({ searchQuery: q, page: 1 }),
  setStatusFilter: (s) => set({ statusFilter: s, page: 1 }),
  setPage: (p) => set({ page: p }),

  fetchOffers: async () => {
    const { page, limit, searchQuery, statusFilter } = get();
    set({ loading: true, error: null });

    try {
      const params: OfferListParams = { page, limit };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const data = await adminOffersApi.list(params);
      set({
        offers: data.offers,
        total: data.meta.total,
        totalPages: data.meta.totalPages,
        loading: false,
      });
    } catch (err: any) {
      set({
        loading: false,
        error: err?.response?.data?.error?.message || 'Failed to load offers',
      });
    }
  },

  createOffer: async (payload) => {
    const offer = await adminOffersApi.create(payload);
    await get().fetchOffers();
    return offer;
  },

  updateOffer: async (id, payload) => {
    const offer = await adminOffersApi.update(id, payload);
    await get().fetchOffers();
    return offer;
  },

  deleteOffer: async (id) => {
    await adminOffersApi.delete(id);
    await get().fetchOffers();
  },

  toggleStatus: async (id, status) => {
    const offer = await adminOffersApi.toggleStatus(id, status);
    // Optimistically update local state
    set((state) => ({
      offers: state.offers.map((o) => (o._id === id ? { ...o, status } : o)),
    }));
    return offer;
  },
}));
