import React, { useState, useEffect } from 'react';
import { X, Star, MapPin, Clock, Utensils, AlertCircle, ChevronRight, Compass } from 'lucide-react';
import { apiClient } from '../../../../shared/services/apiClient';

export interface ViewMenuRestaurant {
  id: string | number;
  _id?: string;
  name: string;
  cuisine?: string;
  location?: string;
  address?: string;
  image?: string;
  rating?: number;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  isOpen?: boolean;
}

interface ViewMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: ViewMenuRestaurant | null;
  onReserveTable: (restaurantId: string | number) => void;
  onLocateRestaurant: (restaurant: ViewMenuRestaurant) => void;
}

export default function ViewMenuModal({
  isOpen,
  onClose,
  restaurant,
  onReserveTable,
  onLocateRestaurant,
}: ViewMenuModalProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !restaurant) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSelectedCategory('All');

    const restId = restaurant._id || restaurant.id;

    apiClient
      .get(`/public/menu?restaurantId=${restId}`)
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data || res.data;
        const fetchedCats = data?.categories || [];
        const fetchedItems = data?.menuItems || [];

        setCategories(fetchedCats);
        setMenuItems(fetchedItems);
      })
      .catch((err) => {
        console.warn('Failed to load public menu:', err);
        if (isMounted) {
          setError('Failed to fetch restaurant menu');
          setMenuItems([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, restaurant]);

  if (!isOpen || !restaurant) return null;

  const restId = restaurant._id || restaurant.id;

  const filteredItems =
    selectedCategory === 'All'
      ? menuItems
      : menuItems.filter((item) => {
          const catId = item.categoryId?._id || item.categoryId || item.category;
          return catId === selectedCategory || item.category === selectedCategory;
        });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-sans">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-[#121214] border border-gray-200 dark:border-neutral-800 shadow-2xl overflow-hidden text-gray-900 dark:text-gray-100 font-sans">
        
        {/* Header Banner */}
        <div className="relative h-44 sm:h-52 w-full shrink-0 overflow-hidden bg-neutral-900">
          <img
            src={restaurant.image || '/images/landing/restaurant-1.png'}
            alt={restaurant.name}
            className="w-full h-full object-cover opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121214] via-[#121214]/40 to-transparent" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors backdrop-blur-sm z-10 cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>

          {/* Restaurant Header Information */}
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/90 text-white text-xs font-bold shadow-sm mb-2 backdrop-blur-sm">
                <Utensils size={12} /> {restaurant.cuisine || 'Multi-Cuisine'}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                {restaurant.name}
              </h2>
              <div className="flex items-center gap-3 text-xs text-gray-300 mt-1">
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-orange-500" />
                  {restaurant.address || restaurant.location || 'Mumbai'}
                </span>
                {restaurant.rating && (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <Star size={13} className="fill-emerald-400" />
                    {restaurant.rating}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onLocateRestaurant(restaurant)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-all shrink-0 cursor-pointer"
            >
              <Compass size={14} className="text-orange-400" />
              Locate
            </button>
          </div>
        </div>

        {/* Category Filter Pills (if categories exist) */}
        {!loading && categories.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-[#18181b]/50 overflow-x-auto flex items-center gap-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === 'All'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              All Items ({menuItems.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id || cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat._id || cat.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === (cat._id || cat.id)
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Modal Body - Menu Items Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 sd-custom-scrollbar">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-400 font-semibold">Loading digital menu...</p>
            </div>
          ) : error || menuItems.length === 0 ? (
            /* NO MENU AVAILABLE FALLBACK CARD */
            <div className="py-12 px-6 text-center bg-gray-50 dark:bg-[#18181b] rounded-2xl border border-dashed border-gray-200 dark:border-neutral-800 my-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto">
                <Utensils size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                No Menu Available
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                This restaurant has not published its digital menu yet. You can still reserve a table directly below to visit in person!
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onReserveTable(restId);
                  }}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-full transition-all shadow-md shadow-orange-500/20 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  Reserve Table Now
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* MENU ITEMS LIST */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item._id || item.id}
                  className="flex gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#18181b] border border-gray-100 dark:border-neutral-800 hover:border-orange-500/30 transition-all shadow-sm"
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-20 h-20 rounded-xl object-cover shrink-0 bg-neutral-100 dark:bg-neutral-800"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {item.name}
                        </h4>
                        <span className="text-xs font-bold font-mono text-orange-500 shrink-0">
                          ₹{item.price}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px]">
                      {item.isVeg !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold uppercase ${
                            item.isVeg
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}
                        >
                          {item.isVeg ? 'Veg' : 'Non-Veg'}
                        </span>
                      )}
                      {item.isAvailable === false && (
                        <span className="px-2 py-0.5 rounded-md font-bold bg-gray-500/10 text-gray-400">
                          Sold Out
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-[#121214] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onLocateRestaurant(restaurant)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Compass size={14} className="text-orange-500" />
            <span>Locate Restaurant</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onReserveTable(restId);
            }}
            className="w-full sm:w-auto px-8 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Reserve Table</span>
            <ChevronRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}
