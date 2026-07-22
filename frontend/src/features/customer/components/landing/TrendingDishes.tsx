import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

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

const DISHES: Dish[] = [
  
];

const MARQUEE_TEXT = '✦ POPULAR  ✦ TRENDING  ✦ BEST SELLER  ✦ CHEF SPECIAL  ✦ MUST TRY  ✦ TOP RATED  ✦ SIGNATURE  ✦ FAN FAVORITE  ';

interface TrendingDishesProps {
  onLoginOpen: () => void;
  dishes?: any[];
  isLoading?: boolean;
}

function MarqueeStrip({ reverse = false }: { reverse?: boolean }) {
  return (
    <div
      className="landing-marquee py-2.5 sm:py-3"
      style={{
        background: 'linear-gradient(135deg, #0F0F0F 0%, #1A1008 100%)',
      }}
    >
      <div className={reverse ? 'landing-marquee-content-reverse' : 'landing-marquee-content'}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="text-[12px] sm:text-[13px] font-semibold tracking-[0.2em] uppercase whitespace-nowrap mx-0"
            style={{
              background: 'linear-gradient(90deg, #FF6B1A, #FFB74D, #FF6B1A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {MARQUEE_TEXT}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TrendingDishes({ onLoginOpen, dishes, isLoading = false }: TrendingDishesProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollRow = (dir: 'left' | 'right') => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: dir === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

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

  const displayDishes = dishes && dishes.length > 0
    ? mapBackendDishes(dishes)
    : DISHES;

  const handleViewAllDishes = () => {
    navigate('/dishes');
  };

  return (
    <section className="py-0">
      <MarqueeStrip />

      <div className="py-12 sm:py-16 relative overflow-hidden bg-emerald-50/20 dark:bg-neutral-950">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { emoji: '🥬', top: '10%', left: '4%', size: 55, rotate: -12 },
            { emoji: '🍳', top: '60%', right: '6%', size: 50, rotate: 18 },
            { emoji: '🥑', top: '25%', right: '8%', size: 48, rotate: -8 },
            { emoji: '🍲', bottom: '15%', left: '7%', size: 52, rotate: 10 },
            { emoji: '🥘', top: '70%', left: '20%', size: 44, rotate: -15 },
            { emoji: '🌶️', top: '5%', right: '20%', size: 40, rotate: 25 },
          ].map((item, i) => (
            <div
              key={i}
              className="absolute select-none landing-bg-particle"
              style={{
                top: item.top, left: item.left, right: (item as any).right, bottom: (item as any).bottom,
                fontSize: `${item.size}px`,
                transform: `rotate(${item.rotate}deg)`,
                opacity: 0.07,
                animationDelay: `${i * 0.6}s`,
              }}
            >
              {item.emoji}
            </div>
          ))}
        </div>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2
                className="text-[28px] sm:text-[32px] lg:text-[40px] font-bold"
                style={{ color: '#222222' }}
              >
                Popular <span style={{ color: '#FF6B1A' }}>Dishes</span>
              </h2>
              <p className="text-[15px] mt-1" style={{ color: '#666666' }}>
                Most loved dishes by our customers
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollRow('left')}
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all duration-150 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-805 text-slate-800 dark:text-neutral-200 hover:border-orange-500/50 shadow-sm"
                  aria-label="Scroll dishes left"
                >
                  <ChevronLeft className="w-[16px] h-[16px]" />
                </button>
                <button
                  onClick={() => scrollRow('right')}
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all duration-150 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-805 text-slate-800 dark:text-neutral-200 hover:border-orange-500/50 shadow-sm"
                  aria-label="Scroll dishes right"
                >
                  <ChevronRight className="w-[16px] h-[16px]" />
                </button>
              </div>

              <button
                onClick={handleViewAllDishes}
                className="hidden sm:flex items-center gap-1 text-[14px] font-semibold transition-colors duration-150 landing-btn-premium px-4 py-2"
                style={{ color: '#FF6B1A', borderRadius: '10px' }}
              >
                View All Dishes →
              </button>
            </div>
          </div>

          <div
            ref={rowRef}
            className="flex gap-6 overflow-x-auto landing-hide-scrollbar pb-4"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="min-w-[280px] sm:min-w-[310px] lg:min-w-[330px] flex-shrink-0"
                  style={{ scrollSnapAlign: 'start' }}
                >
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
                </div>
              ))
            ) : (
              displayDishes.map((dish) => (
                <div
                  key={dish.id}
                  className="min-w-[280px] sm:min-w-[310px] lg:min-w-[330px] flex-shrink-0"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <DishCard dish={dish} onLoginOpen={onLoginOpen} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <MarqueeStrip reverse />
    </section>
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
