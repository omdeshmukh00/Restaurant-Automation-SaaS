import { useLandingStore } from '../../features/customer/store/landing.store';

export const landingCache = {
  getRestaurants: () => useLandingStore.getState().restaurants,
  setRestaurants: (data: any[]) => {
    const current = useLandingStore.getState().landingData || {};
    useLandingStore.getState().setLandingData({ ...current, restaurants: data });
  },
  getDishes: () => useLandingStore.getState().dishes,
  setDishes: (data: any[]) => {
    const current = useLandingStore.getState().landingData || {};
    useLandingStore.getState().setLandingData({ ...current, dishes: data });
  },
  getOffers: () => useLandingStore.getState().offers,
  setOffers: (data: any[]) => {
    const current = useLandingStore.getState().landingData || {};
    useLandingStore.getState().setLandingData({ ...current, offers: data });
  },
  getLandingData: () => useLandingStore.getState().landingData,
  setLandingData: (data: any) => {
    useLandingStore.getState().setLandingData(data);
  },
  clear: () => {
    useLandingStore.getState().clearCache();
  }
};
