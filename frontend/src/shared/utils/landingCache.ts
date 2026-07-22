let cachedRestaurants: any[] | null = null;
let cachedDishes: any[] | null = null;
let cachedLandingData: any = null;

export const landingCache = {
  getRestaurants: () => cachedRestaurants,
  setRestaurants: (data: any[]) => {
    cachedRestaurants = data;
  },
  getDishes: () => cachedDishes,
  setDishes: (data: any[]) => {
    cachedDishes = data;
  },
  getLandingData: () => cachedLandingData,
  setLandingData: (data: any) => {
    cachedLandingData = data;
    if (data?.restaurants) cachedRestaurants = data.restaurants;
  },
  clear: () => {
    cachedRestaurants = null;
    cachedDishes = null;
    cachedLandingData = null;
  }
};
