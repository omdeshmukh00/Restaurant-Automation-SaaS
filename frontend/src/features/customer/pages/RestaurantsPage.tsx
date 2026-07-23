import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Star, Clock, MapPin, ChevronDown, Search, Filter, Flame, Crown, TrendingUp, Utensils } from 'lucide-react';
import '../components/landing/landing.css';
import { apiClient } from '../../../shared/services/apiClient';
import { LandingNavbar, LandingFooter, RestaurantCard } from '../components/landing';
import { landingCache } from '../../../shared/utils/landingCache';

const AREAS = ['All Areas', 'Bandra', 'Andheri', 'Colaba', 'Lower Parel', 'Juhu', 'Powai', 'Dadar'];
const CUISINES = ['All', 'Indian', 'Italian', 'Chinese', 'Japanese', 'Continental', 'Mexican', 'Thai'];
const SORT_OPTIONS = ['Relevance', 'Rating: High to Low', 'Distance', 'Cost: Low to High', 'Cost: High to Low'];

interface RestaurantData {
  id: number;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  area: string;
  distance: string;
  time: string;
  priceRange: string;
  tables: number;
  offer?: string;
  image: string;
  veg: boolean;
  tags: string[];
}



export default function RestaurantsPage() {
  const [searchParams] = useSearchParams();
  const cuisineParam = searchParams.get('cuisine') || 'All';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('All Areas');
  const [selectedCuisine, setSelectedCuisine] = useState(cuisineParam);
  const [sortBy, setSortBy] = useState('Relevance');
  const [vegOnly, setVegOnly] = useState(false);
  const [backendRestaurants, setBackendRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (cuisineParam) {
      setSelectedCuisine(cuisineParam);
    }
  }, [cuisineParam]);

  useEffect(() => {
    let active = true;
    const cached = landingCache.getRestaurants();
    if (cached) {
      setBackendRestaurants(cached);
      setIsLoading(false);
    }
    const fetchRestaurants = async () => {
      try {
        if (!cached) {
          setIsLoading(true);
        }
        const response = await apiClient.get('/public/landing/data');
        if (active && (response.data?.success || response.data?.status === 'success') && response.data?.data?.restaurants) {
          setBackendRestaurants(response.data.data.restaurants);
          landingCache.setRestaurants(response.data.data.restaurants);
        }
      } catch (err) {
        console.error('Failed to fetch restaurants list', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchRestaurants();
    return () => {
      active = false;
    };
  }, []);

  const mapBackendRestaurants = (items: any[]): any[] => {
    return items.map((r, idx) => {
      const imgIndex = (idx % 4) + 1;
      return {
        id: r._id || r.id,
        _id: r._id || r.id,
        name: r.name,
        cuisine: r.cuisine || 'Multi-Cuisine',
        location: `${r.address || r.city || 'Mumbai'}`,
        address: r.address || `${r.city || 'Mumbai'}`,
        googleMapsUrl: r.googleMapsUrl || r.googleMapUrl || r.mapsUrl,
        latitude: r.latitude,
        longitude: r.longitude,
        image: r.coverImage || r.image || `/images/landing/restaurant-${imgIndex}.png`,
        rating: r.rating || 4.5,
        reviewCount: Math.floor(100 + (r.name.length * 15)),
        priceLevel: undefined, // Remove fake cost/RRR
        distance: `${(0.5 + (idx * 0.7)).toFixed(1)} km`,
        waitTime: r.avgWaitTime ? `${r.avgWaitTime} mins` : '15 mins',
        availableTables: r.availableTablesCount !== undefined ? r.availableTablesCount : 0,
        currentOffer: r.currentOffer || undefined,
        isOpen: ['ACTIVE', 'APPLICATION_APPROVED', 'ADMIN_SETUP_PENDING', 'PLAN_SELECTION_PENDING'].includes(r.status),
        isVeg: r.isVeg || 'both',
        veg: r.isVeg === 'veg',
        tags: r.plan === 'PRO' ? ['Trending', 'Date Night'] : ['Popular', 'Family'],
        area: r.city || 'Mumbai',
      };
    });
  };

  const displayRestaurants = mapBackendRestaurants(backendRestaurants);

  const getSingleCuisines = (restaurants: any[]) => {
    const cuisinesSet = new Set<string>();
    restaurants.forEach((r) => {
      if (r.cuisine) {
        // Split by commas, slashes, ampersands, or "and" word boundary
        const parts = r.cuisine.split(/,|\/|&|\band\b/i).map((s: string) => s.trim());
        parts.forEach((p: string) => {
          if (p && p.length > 1) {
            // Capitalize first letter of each word
            const cap = p.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
            cuisinesSet.add(cap);
          }
        });
      }
    });
    return ['All', ...Array.from(cuisinesSet).sort()];
  };

  const dynamicCuisines = getSingleCuisines(displayRestaurants);

  const filtered = displayRestaurants.filter((r) => {
    if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase()) && !r.cuisine.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedArea !== 'All Areas' && r.area !== selectedArea) return false;
    if (selectedCuisine !== 'All' && !r.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase())) return false;
    if (vegOnly && !r.veg) return false;
    return true;
  });

  const openLogin = () => {
    navigate('/auth/customer');
  };

  return (
    <div className="min-h-screen landing-font-inter flex flex-col justify-between bg-[#FFF8F3] dark:bg-neutral-950 text-slate-800 dark:text-neutral-100 transition-colors duration-300">
      <LandingNavbar onLoginOpen={openLogin} />
      
      {/* Spacer for Navbar */}
      <div className="h-[72px] shrink-0" />

      {/* Header section (replaces large hero banner) */}
      <div className="max-w-[1440px] mx-auto w-full px-6 lg:px-12 pt-8 pb-4">
        <h1 className="text-[28px] sm:text-[36px] font-bold text-slate-900 dark:text-white">
          All <span style={{ color: '#FF6B1A' }}>Restaurants</span>
        </h1>
        <p className="text-[14px] text-slate-500 dark:text-neutral-400 mt-1">
          Browse and reserve tables at top-rated restaurants near you
        </p>
      </div>

      {/* ── Filter Bar ───────────────────────────────────── */}
      <div className="sticky top-[72px] z-40 bg-[#FFF8F3]/95 dark:bg-neutral-950/95 backdrop-blur-md border-b border-slate-200 dark:border-neutral-850 transition-colors duration-300">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-3 flex items-center gap-3 overflow-x-auto landing-hide-scrollbar">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 h-[40px] shrink-0 min-w-[200px] rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
            <Search className="w-[15px] h-[15px] text-slate-400 dark:text-neutral-500" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search restaurants..."
              className="flex-1 bg-transparent outline-none text-[13px] text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500"
            />
          </div>

          {/* Area */}
          <div className="flex items-center gap-1.5 px-3 h-[40px] shrink-0 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
            <MapPin className="w-[14px] h-[14px]" style={{ color: '#FF6B1A' }} />
            <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className="bg-transparent outline-none text-[13px] text-slate-800 dark:text-neutral-200 cursor-pointer appearance-none pr-4">
              {AREAS.map((a) => <option key={a} value={a} className="bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100">{a}</option>)}
            </select>
            <ChevronDown className="w-[13px] h-[13px] -ml-3 text-slate-400 dark:text-neutral-500" />
          </div>

          {/* Cuisine */}
          <div className="flex items-center gap-1.5 px-3 h-[40px] shrink-0 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
            <Utensils className="w-[14px] h-[14px]" style={{ color: '#FF6B1A' }} />
            <select value={selectedCuisine} onChange={(e) => setSelectedCuisine(e.target.value)} className="bg-transparent outline-none text-[13px] text-slate-800 dark:text-neutral-200 cursor-pointer appearance-none pr-4">
              {dynamicCuisines.map((c) => <option key={c} value={c} className="bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100">{c}</option>)}
            </select>
            <ChevronDown className="w-[13px] h-[13px] -ml-3 text-slate-400 dark:text-neutral-500" />
          </div>


          {/* Veg Toggle */}
          <button
            onClick={() => setVegOnly(!vegOnly)}
            className="flex items-center gap-1.5 px-3 h-[40px] shrink-0 text-[13px] font-medium transition-all duration-150 rounded-xl border"
            style={{
              borderColor: vegOnly ? '#4CAF50' : 'var(--border-color, #E5E7EB)',
              backgroundColor: vegOnly ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)',
              color: vegOnly ? '#4CAF50' : 'inherit',
            }}
          >
            🌿 Veg Only
          </button>
        </div>
      </div>

      {/* ── Restaurant Grid ──────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10 w-full flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <RestaurantSkeleton key={i} />
            ))
          ) : (
            filtered.map((r) => (
              <RestaurantCard
                key={r.id}
                restaurant={r as any}
                onLoginOpen={openLogin}
              />
            ))
          )}
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[18px] font-semibold text-slate-800 dark:text-neutral-100">No restaurants found</p>
            <p className="text-[14px] mt-2 text-slate-500 dark:text-neutral-400">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <LandingFooter />
    </div>
  );
}

function RestaurantSkeleton() {
  return (
    <div className="animate-pulse flex flex-col bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-805 shadow-sm overflow-hidden" style={{ borderRadius: '12px' }}>
      <div className="h-[200px] bg-slate-200 dark:bg-neutral-800 w-full" />
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="h-5 bg-slate-200 dark:bg-neutral-800 rounded-md w-3/4 mb-3" />
          <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded-md w-1/2 mb-4" />
          <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded-md w-2/3" />
        </div>
        <div className="my-3 border-t border-slate-200 dark:border-neutral-800" />
        <div className="flex gap-4 mb-4">
          <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded-md w-12" />
          <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded-md w-16" />
        </div>
        <div className="flex gap-3 mt-2">
          <div className="h-9 bg-slate-200 dark:bg-neutral-800 rounded-lg flex-1" />
          <div className="h-9 bg-slate-200 dark:bg-neutral-800 rounded-lg flex-1" />
        </div>
      </div>
    </div>
  );
}
