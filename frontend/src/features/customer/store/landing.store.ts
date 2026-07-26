import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../../../shared/services/apiClient';

export interface LandingStats {
  tablesAvailable?: number;
  restaurantsOpen?: number;
  reservationsToday?: number;
  offersRunning?: number;
  averageWaitTime?: number;
  averageRating?: number;
  activeRestaurants?: number;
  happyCustomers?: number;
  dishesServed?: number;
  avgRating?: number;
}

export interface LandingData {
  restaurants?: any[];
  dishes?: any[];
  offers?: any[];
  stats?: LandingStats;
  cuisines?: string[];
}

interface LandingState {
  landingData: LandingData | null;
  restaurants: any[];
  dishes: any[];
  offers: any[];
  stats: LandingStats | null;
  cuisines: string[];
  selectedCuisine: string;
  isLoading: boolean;
  isFetching: boolean;
  lastFetched: number | null;

  // Actions
  fetchLandingData: (force?: boolean) => Promise<void>;
  fetchDishes: (force?: boolean) => Promise<void>;
  setSelectedCuisine: (cuisine: string) => void;
  setLandingData: (data: LandingData) => void;
  clearCache: () => void;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export const useLandingStore = create<LandingState>()(
  persist(
    (set, get) => ({
      landingData: null,
      restaurants: [],
      dishes: [],
      offers: [],
      stats: null,
      cuisines: [],
      selectedCuisine: 'All',
      isLoading: true,
      isFetching: false,
      lastFetched: null,

      setSelectedCuisine: (selectedCuisine: string) => set({ selectedCuisine }),

      setLandingData: (data: LandingData) => {
        set({
          landingData: data,
          restaurants: data.restaurants || get().restaurants,
          dishes: data.dishes || get().dishes,
          offers: data.offers || get().offers,
          stats: data.stats || get().stats,
          cuisines: data.cuisines || get().cuisines,
          isLoading: false,
          lastFetched: Date.now(),
        });
      },

      clearCache: () => {
        set({
          landingData: null,
          restaurants: [],
          dishes: [],
          offers: [],
          stats: null,
          cuisines: [],
          lastFetched: null,
          isLoading: true,
        });
      },

      fetchLandingData: async (force = false) => {
        const { landingData, lastFetched, isFetching } = get();
        const now = Date.now();
        const hasCachedContent = !!(landingData && (landingData.restaurants?.length || landingData.dishes?.length));

        // If we already have stored content, turn off main loading immediately so user sees UI instantly
        if (hasCachedContent) {
          set({ isLoading: false });
          // If cached data is fresh and not forced, return immediately
          if (!force && lastFetched && now - lastFetched < CACHE_TTL_MS) {
            return;
          }
        } else {
          set({ isLoading: true });
        }

        // Avoid duplicate concurrent fetches
        if (isFetching) return;
        set({ isFetching: true });

        try {
          const response = await apiClient.get('/public/landing/data');
          if (
            (response.data?.success || response.data?.status === 'success') &&
            response.data?.data
          ) {
            const data: LandingData = response.data.data;
            set({
              landingData: data,
              restaurants: data.restaurants || [],
              dishes: data.dishes || [],
              offers: data.offers || [],
              stats: data.stats || null,
              cuisines: data.cuisines || [],
              isLoading: false,
              isFetching: false,
              lastFetched: Date.now(),
            });
          } else {
            set({ isFetching: false, isLoading: false });
          }
        } catch (err) {
          console.error('Failed to fetch landing data from store', err);
          set({ isFetching: false, isLoading: false });
        }
      },

      fetchDishes: async (force = false) => {
        const { dishes, isFetching } = get();
        if (dishes.length > 0 && !force) {
          set({ isLoading: false });
          return;
        }

        if (isFetching) return;
        set({ isFetching: true });

        try {
          const response = await apiClient.get('/public/dishes');
          if (
            (response.data?.success || response.data?.status === 'success') &&
            response.data?.data?.dishes
          ) {
            const freshDishes = response.data.data.dishes;
            set((state) => ({
              dishes: freshDishes,
              landingData: state.landingData
                ? { ...state.landingData, dishes: freshDishes }
                : { dishes: freshDishes },
              isLoading: false,
              isFetching: false,
            }));
          } else {
            set({ isFetching: false, isLoading: false });
          }
        } catch (err) {
          console.error('Failed to fetch dishes in store', err);
          set({ isFetching: false, isLoading: false });
        }
      },
    }),
    {
      name: 'restohub-landing-store',
      partialize: (state) => ({
        landingData: state.landingData,
        restaurants: state.restaurants,
        dishes: state.dishes,
        offers: state.offers,
        stats: state.stats,
        cuisines: state.cuisines,
        lastFetched: state.lastFetched,
      }),
      merge: (persistedState: any, currentState) => {
        const merged = { ...currentState, ...persistedState };
        if (merged.landingData && (merged.landingData.restaurants?.length || merged.landingData.dishes?.length)) {
          merged.isLoading = false;
        } else {
          merged.isLoading = true;
        }
        return merged;
      },
    }
  )
);
