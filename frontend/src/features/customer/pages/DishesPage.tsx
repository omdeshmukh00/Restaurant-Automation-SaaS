import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Utensils, Star, Clock, Heart, AlertCircle, ChevronDown } from 'lucide-react';
import '../components/landing/landing.css';
import { apiClient } from '../../../shared/services/apiClient';
import { LandingNavbar, LandingFooter } from '../components/landing';
import { landingCache } from '../../../shared/utils/landingCache';

interface Dish {
  id: number | string;
  name: string;
  price: number;
  rating?: number;
  prepTime: string;
  image: string;
  isVeg?: boolean;
  restaurantName?: string;
  description?: string;
}

const CLOCHE_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <rect width="100" height="100" fill="#f8fafc" rx="16"/>
    <g fill="none" stroke="#000000" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M50 24c0-4.5-3-8-7.5-8s-7.5 3.5-7.5 8" transform="translate(7.5, 0)"/>
      <path d="M22 68c0-22 12.5-36 28-36s28 14 28 36"/>
      <path d="M16 68h68"/>
      <path d="M20 68c0 4 5 7 10 7h40c5 0 10-3 10-7"/>
    </g>
  </svg>
`);

export default function DishesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('Relevance');
  const [vegOnly, setVegOnly] = useState(false);
  const [backendDishes, setBackendDishes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let active = true;
    const cached = landingCache.getDishes();
    if (cached) {
      setBackendDishes(cached);
      setIsLoading(false);
    }
    const fetchDishes = async () => {
      try {
        if (!cached) {
          setIsLoading(true);
        }
        const response = await apiClient.get('/public/dishes');
        if (active && (response.data?.success || response.data?.status === 'success') && response.data?.data?.dishes) {
          setBackendDishes(response.data.data.dishes);
          landingCache.setDishes(response.data.data.dishes);
        }
      } catch (err) {
        console.error('Failed to fetch dishes list', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchDishes();
    return () => {
      active = false;
    };
  }, []);

  const mapBackendDishes = (items: any[]): Dish[] => {
    return items.map((d, idx) => {
      const fallbackImage = CLOCHE_FALLBACK;
      const isImgUrlValid = d.image && d.image.trim().length > 5 && !d.image.includes('dummy');
      return {
        id: d._id || d.id,
        name: d.name,
        price: d.price,
        rating: d.rating || undefined,
        prepTime: d.preparationTime ? `${d.preparationTime} min` : '15 min',
        image: isImgUrlValid ? d.image : fallbackImage,
        isVeg: d.isVeg !== undefined ? !!d.isVeg : idx % 2 === 0,
        restaurantName: d.restaurantId && typeof d.restaurantId === 'object' && d.restaurantId.name
          ? d.restaurantId.name
          : 'Amber Table',
        description: d.description || ''
      };
    });
  };

  const displayDishes = mapBackendDishes(backendDishes);

  // Extract categories dynamically from tags or fallback categories
  const categories = ['All', 'Pizza', 'Burger', 'Biryani', 'Dessert', 'Starter', 'Salad'];

  const filteredDishes = displayDishes.filter((dish) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchName = dish.name.toLowerCase().includes(query);
      const matchDesc = dish.description && dish.description.toLowerCase().includes(query);
      const matchRest = dish.restaurantName && dish.restaurantName.toLowerCase().includes(query);
      if (!matchName && !matchDesc && !matchRest) return false;
    }

    // Category filter
    if (selectedCategory !== 'All') {
      const query = selectedCategory.toLowerCase();
      const matchName = dish.name.toLowerCase().includes(query);
      const matchDesc = dish.description && dish.description.toLowerCase().includes(query);
      if (!matchName && !matchDesc) return false;
    }

    // Veg Only filter
    if (vegOnly && !dish.isVeg) return false;

    return true;
  });

  // Sorting logic
  const sortedDishes = [...filteredDishes];
  if (sortBy === 'Price: Low to High') {
    sortedDishes.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'Price: High to Low') {
    sortedDishes.sort((a, b) => b.price - a.price);
  } else if (sortBy === 'Rating') {
    sortedDishes.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  const openLogin = () => {
    navigate('/auth/customer');
  };

  return (
    <div className="min-h-screen landing-font-inter flex flex-col justify-between bg-[#FFF8F3] dark:bg-neutral-950 text-slate-800 dark:text-neutral-100 transition-colors duration-300">
      <LandingNavbar onLoginOpen={openLogin} />
      
      {/* Spacer for Navbar */}
      <div className="h-[72px] shrink-0" />

      {/* ── Hero Banner ──────────────────────────────────── */}
      <section
        className="relative py-16 sm:py-20 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, rgba(15,12,8,0.92) 0%, rgba(15,15,15,0.85) 50%, rgba(15,12,8,0.92) 100%), url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { emoji: '🥬', top: '10%', left: '4%', size: 55, rotate: -12 },
            { emoji: '🍳', top: '60%', right: '6%', size: 50, rotate: 18 },
            { emoji: '🥑', top: '25%', right: '8%', size: 48, rotate: -8 },
            { emoji: '🍲', bottom: '15%', left: '7%', size: 52, rotate: 10 },
          ].map((item, i) => (
            <div
              key={i}
              className="absolute select-none landing-bg-particle"
              style={{
                top: item.top, left: item.left, right: (item as any).right, bottom: (item as any).bottom,
                fontSize: `${item.size}px`,
                transform: `rotate(${item.rotate}deg)`,
                opacity: 0.07,
              }}
            >
              {item.emoji}
            </div>
          ))}
        </div>

        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10 text-center">
          <h1 className="text-[32px] sm:text-[42px] lg:text-[56px] font-bold landing-font-hero leading-[1.1]">
            Top Delicious <span className="italic" style={{ color: '#FF6B1A' }}>Dishes</span>
          </h1>
          <p className="text-[15px] sm:text-[17px] mt-3 max-w-[500px] mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Most loved dishes prepared fresh by our partner chefs
          </p>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mt-8">
            {[
              { value: `${displayDishes.length}+`, label: 'Total Dishes' },
              { value: '4.8★', label: 'Avg Rating' },
              { value: 'Fast', label: 'Preparation' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-[22px] sm:text-[28px] font-bold" style={{ color: '#FF6B1A' }}>{stat.value}</div>
                <div className="text-[11px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Filter Bar ───────────────────────────────────── */}
      <div className="sticky top-[72px] z-40 bg-[#FFF8F3]/95 dark:bg-neutral-950/95 backdrop-blur-md border-b border-slate-200 dark:border-neutral-850 transition-colors duration-300">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-3 flex items-center gap-3 overflow-x-auto landing-hide-scrollbar">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 h-[40px] shrink-0 min-w-[200px] rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
            <Search className="w-[15px] h-[15px] text-slate-400 dark:text-neutral-500" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="flex-1 bg-transparent outline-none text-[13px] text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500"
            />
          </div>

          {/* Category */}
          <div className="flex items-center gap-1.5 px-3 h-[40px] shrink-0 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
            <Utensils className="w-[14px] h-[14px]" style={{ color: '#FF6B1A' }} />
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-transparent outline-none text-[13px] text-slate-800 dark:text-neutral-200 cursor-pointer appearance-none pr-4">
              {categories.map((c) => <option key={c} value={c} className="bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100">{c}</option>)}
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

      {/* ── Dishes Grid ──────────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-7">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <DishSkeleton key={i} />
            ))
          ) : (
            sortedDishes.map((dish) => (
              <DishCard
                key={dish.id}
                dish={dish}
                onLoginOpen={openLogin}
              />
            ))
          )}
        </div>

        {!isLoading && sortedDishes.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[18px] font-semibold text-slate-800 dark:text-neutral-100">No dishes found</p>
            <p className="text-[14px] mt-2 text-slate-500 dark:text-neutral-400">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <LandingFooter />
    </div>
  );
}

function DishSkeleton() {
  return (
    <div className="animate-pulse flex flex-col bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden h-[450px]" style={{ borderRadius: '20px' }}>
      <div className="h-[200px] bg-slate-200 dark:bg-neutral-800 w-full" />
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="h-5 bg-slate-200 dark:bg-neutral-800 rounded-md w-3/4 mb-3" />
          <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded-md w-1/4 mb-3" />
          <div className="h-12 bg-slate-200 dark:bg-neutral-800 rounded-md w-full mb-3" />
          <div className="h-6 bg-slate-200 dark:bg-neutral-800 rounded-md w-20" />
        </div>
        <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded-md w-24 mt-4 pt-3" />
      </div>
    </div>
  );
}

function DishCard({ dish, onLoginOpen }: { dish: Dish; onLoginOpen: () => void }) {
  return (
    <div
      onClick={onLoginOpen}
      className="landing-card-hover landing-shiny flex flex-col bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden cursor-pointer hover:border-orange-500/50 transition-all duration-300 h-[450px]"
      style={{
        borderRadius: '20px',
      }}
    >
      {/* Image container */}
      <div className="relative h-[200px] overflow-hidden landing-img-overlay-wrap bg-slate-50 dark:bg-neutral-950 flex items-center justify-center shrink-0">
        <img
          src={dish.image}
          alt={dish.name}
          className="landing-img-professional w-full h-full object-cover animate-fadeIn"
          loading="lazy"
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            e.currentTarget.src = CLOCHE_FALLBACK;
          }}
        />

        {/* Veg/Non-Veg Logo */}
        <div
          className="absolute top-3 left-3 flex items-center justify-center p-0.5 z-10 bg-white/95 backdrop-blur-[2px] shadow-sm"
          style={{
            borderRadius: '4px',
            border: `1.5px solid ${dish.isVeg ? '#38A169' : '#A52A2A'}`,
            width: '18px',
            height: '18px',
          }}
          title={dish.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
        >
          {dish.isVeg ? (
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: '#38A169',
              }}
            />
          ) : (
            <span
              className="w-2 h-2"
              style={{
                backgroundColor: '#A52A2A',
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              }}
            />
          )}
        </div>

        {/* Rating Badge */}
        {dish.rating && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 z-10"
            style={{
              backgroundColor: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(4px)',
              borderRadius: '8px',
            }}
          >
            <Star className="w-[12px] h-[12px]" style={{ color: '#FF6B1A', fill: '#FF6B1A' }} />
            <span className="text-[12px] font-bold" style={{ color: '#222222' }}>
              {dish.rating}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between relative dark:bg-neutral-900">
        <div>
          <h4 className="text-[16px] sm:text-[17px] font-bold truncate text-slate-800 dark:text-neutral-100">
            {dish.name}
          </h4>

          {/* Restaurant Name */}
          <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wider mt-1">
            {dish.restaurantName || 'Amber Table'}
          </p>

          {/* Description */}
          {dish.description && (
            <p className="text-[12px] text-slate-500 dark:text-neutral-400 mt-2 line-clamp-3 leading-relaxed">
              {dish.description}
            </p>
          )}

          <p className="text-[18px] sm:text-[20px] font-extrabold mt-3 text-slate-900 dark:text-orange-400" style={{ color: '#FF6B1A' }}>
            ₹{dish.price}
          </p>
        </div>

        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-100 dark:border-neutral-800 text-[12px] text-slate-500 dark:text-neutral-400">
          <Clock className="w-[13px] h-[13px]" />
          <span>{dish.prepTime}</span>
        </div>
      </div>
    </div>
  );
}
