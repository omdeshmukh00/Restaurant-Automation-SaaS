let cachedRestaurants: any[] | null = null;
let cachedDishes: any[] | null = null;
let cachedOffers: any[] | null = null;
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
  getOffers: () => cachedOffers,
  setOffers: (data: any[]) => {
    cachedOffers = data;
  },
  getLandingData: () => cachedLandingData,
  setLandingData: (data: any) => {
    cachedLandingData = data;
    if (data?.restaurants) cachedRestaurants = data.restaurants;
    if (data?.dishes) cachedDishes = data.dishes;
    if (data?.offers) cachedOffers = data.offers;
  },
  clear: () => {
    cachedRestaurants = null;
    cachedDishes = null;
    cachedOffers = null;
    cachedLandingData = null;
  }
};
