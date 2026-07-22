import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Crown, TrendingUp } from 'lucide-react';
import RestaurantCard, { type Restaurant } from './RestaurantCard';

interface TrendingRestaurantsProps {
  onLoginOpen: () => void;
  restaurants?: any[];
  selectedCuisine?: string;
  isLoading?: boolean;
}

function ScrollableRow({ restaurants, onLoginOpen, rowRef, isLoading }: {
  restaurants: Restaurant[];
  onLoginOpen: () => void;
  rowRef: React.RefObject<HTMLDivElement | null>;
  isLoading?: boolean;
}) {
  return (
    <div
      ref={rowRef as React.RefObject<HTMLDivElement>}
      className="flex gap-5 overflow-x-auto landing-hide-scrollbar pb-2"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="min-w-[300px] sm:min-w-[320px] lg:min-w-[340px] flex-shrink-0"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="animate-pulse flex flex-col bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden" style={{ borderRadius: '12px', height: '380px' }}>
              <div className="h-[180px] bg-slate-200 dark:bg-neutral-800 w-full" />
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="h-5 bg-slate-200 dark:bg-neutral-800 rounded-md w-3/4 mb-3" />
                  <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded-md w-1/2 mb-4" />
                </div>
                <div className="my-2 border-t border-slate-200 dark:border-neutral-800" />
                <div className="flex gap-4 mb-4">
                  <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded-md w-12" />
                  <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded-md w-16" />
                </div>
                <div className="flex gap-3 mt-1">
                  <div className="h-9 bg-slate-200 dark:bg-neutral-800 rounded-lg flex-1" />
                  <div className="h-9 bg-slate-200 dark:bg-neutral-800 rounded-lg flex-1" />
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
        restaurants.map((restaurant) => (
          <div
            key={restaurant.id}
            className="min-w-[300px] sm:min-w-[320px] lg:min-w-[340px] flex-shrink-0"
            style={{ scrollSnapAlign: 'start' }}
          >
            <RestaurantCard restaurant={restaurant} onLoginOpen={onLoginOpen} />
          </div>
        ))
      )}
    </div>
  );
}

export default function TrendingRestaurants({ onLoginOpen, restaurants, selectedCuisine = 'All', isLoading = false }: TrendingRestaurantsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isParticlesActive, setIsParticlesActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollRow = (rowRef: React.RefObject<HTMLDivElement | null>, dir: 'left' | 'right') => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: dir === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

  const handleViewAllHover = () => {
    setIsParticlesActive(true);
    setTimeout(() => setIsParticlesActive(false), 700);
  };

  const handleViewAllClick = () => {
    if (selectedCuisine && selectedCuisine !== 'All') {
      navigate(`/customer/restaurants?cuisine=${encodeURIComponent(selectedCuisine)}`);
    } else {
      navigate('/customer/restaurants');
    }
  };

  const mapBackendRestaurants = (items: any[]): Restaurant[] => {
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
        waitTime: r.avgWaitTime ? `${r.avgWaitTime} min` : '15 min',
        availableTables: r.availableTablesCount !== undefined ? r.availableTablesCount : 0,
        currentOffer: r.currentOffer || undefined,
        isOpen: ['ACTIVE', 'APPLICATION_APPROVED', 'ADMIN_SETUP_PENDING', 'PLAN_SELECTION_PENDING'].includes(r.status),
        isVeg: r.isVeg || 'both',
      };
    });
  };

  const displayRestaurants = mapBackendRestaurants(restaurants || []);

  const filteredRestaurants = selectedCuisine === 'All'
    ? displayRestaurants
    : displayRestaurants.filter((r) =>
        r.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase())
      );

  let row1: Restaurant[] = [];
  let row2: Restaurant[] = [];

  if (isLoading) {
    row1 = [];
    row2 = [];
  } else if (filteredRestaurants.length <= 4) {
    row1 = filteredRestaurants;
    row2 = [];
  } else {
    const mid = Math.ceil(filteredRestaurants.length / 2);
    row1 = filteredRestaurants.slice(0, mid);
    row2 = filteredRestaurants.slice(mid);
  }

  return (
    <section
      id="restaurants"
      className={`pt-0 pb-12 sm:pb-16 ${isVisible ? '' : ''}`}
      ref={ref}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {(isLoading || filteredRestaurants.length > 0) ? (
          <>
            {/* Row 1 */}
            <div className="relative mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 px-4 py-1.5" style={{ background: 'linear-gradient(135deg, rgba(255,107,26,0.1), rgba(255,107,26,0.05))', borderRadius: '999px', border: '1px solid rgba(255,107,26,0.15)' }}>
                  <Crown className="w-[15px] h-[15px]" style={{ color: '#FF6B1A' }} />
                  <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: '#FF6B1A' }}>
                    Featured Selection
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {!isLoading && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => scrollRow(row1Ref, 'left')}
                        className="w-[32px] h-[32px] rounded-full flex items-center justify-center transition-all duration-150 hover:bg-orange-50 hover:border-orange-200"
                        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', color: '#222222' }}
                        aria-label="Scroll row 1 left"
                      >
                        <ChevronLeft className="w-[15px] h-[15px]" />
                      </button>
                      <button
                        onClick={() => scrollRow(row1Ref, 'right')}
                        className="w-[32px] h-[32px] rounded-full flex items-center justify-center transition-all duration-150 hover:bg-orange-50 hover:border-orange-200"
                        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', color: '#222222' }}
                        aria-label="Scroll row 1 right"
                      >
                        <ChevronRight className="w-[15px] h-[15px]" />
                      </button>
                    </div>
                  )}

                  {/* View All Button with Particles */}
                  <div className="relative">
                    <button
                      onClick={handleViewAllClick}
                      onMouseEnter={handleViewAllHover}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold transition-all duration-200 landing-btn-vibrate-hover landing-btn-premium landing-focus-ring"
                      style={{
                        color: '#FFFFFF',
                        background: 'linear-gradient(135deg, #FF6B1A, #E65A0A)',
                        borderRadius: '12px',
                      }}
                    >
                      View All
                      <ChevronRight className="w-[14px] h-[14px]" />
                    </button>

                    {/* Particles */}
                    <div className={`absolute inset-0 pointer-events-none ${isParticlesActive ? 'landing-particles-active' : ''}`}>
                      <span className="landing-particle" style={{ top: '50%', left: '50%' }} />
                      <span className="landing-particle" style={{ top: '30%', left: '40%', background: '#FF8C42' }} />
                      <span className="landing-particle" style={{ top: '60%', left: '60%', background: '#E65A0A' }} />
                      <span className="landing-particle" style={{ top: '20%', left: '70%', width: '4px', height: '4px' }} />
                      <span className="landing-particle" style={{ top: '70%', left: '30%', background: '#FFB74D', width: '3px', height: '3px' }} />
                      <span className="landing-particle" style={{ top: '40%', left: '80%', background: '#FF6B1A', width: '6px', height: '6px' }} />
                    </div>
                  </div>
                </div>
              </div>
              <ScrollableRow restaurants={row1} onLoginOpen={onLoginOpen} rowRef={row1Ref} isLoading={isLoading} />
            </div>

            {/* Row 2 */}
            {(isLoading || (row2 && row2.length > 0)) && (
              <div className="relative mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 px-4 py-1.5" style={{ background: 'linear-gradient(135deg, rgba(255,107,26,0.1), rgba(255,107,26,0.05))', borderRadius: '999px', border: '1px solid rgba(255,107,26,0.15)' }}>
                    <TrendingUp className="w-[15px] h-[15px]" style={{ color: '#FF6B1A' }} />
                    <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: '#FF6B1A' }}>
                      Popular Near You
                    </span>
                  </div>
                  {!isLoading && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => scrollRow(row2Ref, 'left')}
                        className="w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all duration-150"
                        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', color: '#222222' }}
                        aria-label="Scroll row 2 left"
                      >
                        <ChevronLeft className="w-[16px] h-[16px]" />
                      </button>
                      <button
                        onClick={() => scrollRow(row2Ref, 'right')}
                        className="w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all duration-150"
                        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', color: '#222222' }}
                        aria-label="Scroll row 2 right"
                      >
                        <ChevronRight className="w-[16px] h-[16px]" />
                      </button>
                    </div>
                  )}
                </div>
                <ScrollableRow restaurants={row2} onLoginOpen={onLoginOpen} rowRef={row2Ref} isLoading={isLoading} />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-[16px] font-semibold text-slate-800 dark:text-neutral-100">No restaurants found</p>
            <p className="text-[14px] mt-1 text-slate-500 dark:text-neutral-400">Try adjusting your filters</p>
          </div>
        )}

        {/* Mobile View All */}
        <div className="sm:hidden mt-6 text-center">
          <button
            onClick={handleViewAllClick}
            className="text-[14px] font-semibold px-6 py-3 transition-colors duration-150 landing-btn-premium"
            style={{
              color: '#FFFFFF',
              background: 'linear-gradient(135deg, #FF6B1A, #E65A0A)',
              borderRadius: '14px',
            }}
          >
            View All Restaurants
          </button>
        </div>
      </div>
    </section>
  );
}
