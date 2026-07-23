import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, MapPin, Clock, Users, Heart, AlertCircle } from 'lucide-react';
import ViewMenuModal, { ViewMenuRestaurant } from './ViewMenuModal';

export interface Restaurant {
  id: number | string;
  _id?: string;
  name: string;
  cuisine: string;
  location: string;
  address?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  image: string;
  rating: number;
  reviewCount: number;
  priceLevel?: string;
  distance: string;
  waitTime: string;
  availableTables: number;
  currentOffer?: string;
  isOpen: boolean;
  isVeg?: string;
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  onLoginOpen?: () => void;
}

export default function RestaurantCard({ restaurant, onLoginOpen }: RestaurantCardProps) {
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);
  const [heartBounce, setHeartBounce] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [locationAlert, setLocationAlert] = useState<string | null>(null);

  const restId = restaurant._id || restaurant.id;

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFav(!isFav);
    setHeartBounce(true);
    setTimeout(() => setHeartBounce(false), 250);
  };

  const handleReserveTable = (targetRestId?: string | number) => {
    const finalId = targetRestId || restId;
    navigate('/customer/reservations', {
      state: {
        restaurantId: String(finalId),
        restaurantName: restaurant.name,
      },
    });
  };

  const handleLocateRestaurant = (restToLocate?: ViewMenuRestaurant | Restaurant) => {
    const target = restToLocate || restaurant;
    const mapsUrlRaw = target.googleMapsUrl || (target as any).googleMapUrl || (target as any).mapsUrl;
    const hasMapsUrl = !!(mapsUrlRaw && mapsUrlRaw.trim().length > 5);
    const hasCoords =
      target.latitude != null &&
      target.longitude != null &&
      !isNaN(Number(target.latitude)) &&
      !isNaN(Number(target.longitude)) &&
      Number(target.latitude) !== 0 &&
      Number(target.longitude) !== 0;

    // 1. Google maps URL stored in DB
    if (hasMapsUrl) {
      window.open(mapsUrlRaw.trim(), '_blank', 'noopener,noreferrer');
      return;
    }

    // 2. Latitude & Longitude coordinates
    if (hasCoords) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${target.latitude},${target.longitude}`;
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // 3. Fallback if both googleMapsUrl and lat/long are missing/empty
    setLocationAlert('Unable to locate restaurant. Location details unavailable.');
    setTimeout(() => setLocationAlert(null), 3500);
  };

  return (
    <>
      {/* Sleek Alert Toast for Location Failures */}
      {locationAlert && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-600 text-white shadow-2xl animate-fadeIn text-xs font-bold font-sans">
          <AlertCircle size={16} className="shrink-0" />
          <span>{locationAlert}</span>
        </div>
      )}

      <div
        className="landing-card-hover landing-shiny flex flex-col bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm dark:shadow-none overflow-hidden text-slate-800 dark:text-neutral-100 transition-colors duration-300"
        style={{
          borderRadius: '12px',
        }}
      >
        {/* Image Container */}
        <div className="landing-img-overlay-wrap relative h-[200px] overflow-hidden">
          <img
            src={restaurant.image}
            alt={restaurant.name}
            className="landing-img-professional w-full h-full object-cover"
            loading="lazy"
          />

          {/* Open/Closed Badge */}
          <div
            className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold"
            style={{
              borderRadius: '999px',
              backgroundColor: restaurant.isOpen ? 'rgba(76,175,80,0.9)' : 'rgba(220,53,69,0.9)',
              color: '#FFFFFF',
              backdropFilter: 'blur(4px)',
            }}
          >
            <span
              className="w-[6px] h-[6px] rounded-full"
              style={{
                backgroundColor: '#FFFFFF',
              }}
            />
            {restaurant.isOpen ? 'Open Now' : 'Closed'}
          </div>

          {/* Favorite Button */}
          <button
            onClick={handleFavorite}
            className={`absolute top-3 right-3 w-[36px] h-[36px] rounded-full flex items-center justify-center transition-all duration-150 ${
              heartBounce ? 'landing-heart-bounce' : ''
            }`}
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(4px)',
            }}
            aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className="w-[18px] h-[18px]"
              style={{
                color: isFav ? '#FF6B1A' : '#666666',
                fill: isFav ? '#FF6B1A' : 'none',
              }}
            />
          </button>

          {/* Offer Badge */}
          {restaurant.currentOffer && (
            <div
              className="absolute bottom-3 left-3 px-3 py-1 text-[11px] font-semibold text-white"
              style={{
                backgroundColor: '#FF6B1A',
                borderRadius: '999px',
              }}
            >
              {restaurant.currentOffer}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col">
          {/* Name + Rating */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[18px] sm:text-[20px] font-semibold leading-tight truncate landing-font-hero text-slate-900 dark:text-white">
              {restaurant.name}
            </h3>
            <div
              className="flex items-center gap-1 px-2 py-1 shrink-0"
              style={{
                backgroundColor: '#E8F5E9',
                borderRadius: '8px',
              }}
            >
              <Star className="w-[13px] h-[13px]" style={{ color: '#4CAF50', fill: '#4CAF50' }} />
              <span className="text-[13px] font-bold" style={{ color: '#4CAF50' }}>
                {restaurant.rating}
              </span>
            </div>
          </div>

          {/* Cuisine + Veg Badge */}
          <div className="flex items-center gap-2 mt-1 truncate">
            <span className="text-[13px] text-slate-550 dark:text-neutral-400">
              {restaurant.cuisine}
            </span>
            <span className="text-slate-300 dark:text-neutral-700 font-bold">•</span>
            {restaurant.isVeg === 'veg' && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-900/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Pure Veg
              </span>
            )}
            {restaurant.isVeg === 'non-veg' && (
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-450 flex items-center gap-0.5 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded-md border border-rose-200/50 dark:border-rose-900/30">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Non-Veg
              </span>
            )}
            {restaurant.isVeg === 'both' && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md border border-amber-200/50 dark:border-amber-900/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Veg & Non-Veg
              </span>
            )}
          </div>

          {/* Location + Distance */}
          <div className="flex items-center gap-1.5 mt-2 text-[13px] text-slate-500 dark:text-neutral-400">
            <MapPin className="w-[14px] h-[14px] shrink-0 text-slate-400 dark:text-neutral-500" />
            <span className="truncate">{restaurant.location}</span>
            <span className="shrink-0">• {restaurant.distance}</span>
          </div>

          {/* Divider */}
          <div className="my-3 border-t border-slate-200 dark:border-neutral-800" />

          {/* Info Row */}
          <div className="flex items-center gap-4 text-[13px] text-slate-500 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <Clock className="w-[13px] h-[13px] text-slate-400 dark:text-neutral-500" />
              {restaurant.waitTime}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-[13px] h-[13px] text-slate-400 dark:text-neutral-500" />
              {restaurant.availableTables} tables
            </span>
            {restaurant.priceLevel && (
              <span className="font-medium text-[#FF6B1A]">
                {restaurant.priceLevel}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {/* View Menu Button */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="h-[42px] text-[13px] font-semibold transition-all duration-150 landing-btn-press landing-focus-ring cursor-pointer border border-slate-200 dark:border-neutral-800 rounded-[10px] text-slate-800 dark:text-neutral-200 bg-transparent hover:border-[#FF6B1A] dark:hover:border-[#FF6B1A] hover:text-[#FF6B1A] dark:hover:text-[#FF6B1A]"
            >
              View Menu
            </button>

            {/* Reserve Table Button (Auto-selects restaurant in /customer/reservations) */}
            <button
              onClick={() => handleReserveTable()}
              className="h-[42px] text-[13px] font-semibold text-white transition-colors duration-150 landing-btn-press landing-focus-ring cursor-pointer"
              style={{
                backgroundColor: '#FF6B1A',
                borderRadius: '10px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E65A0A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FF6B1A'; }}
            >
              Reserve Table
            </button>
          </div>

          {/* Locate Restaurant Button */}
          <button
            onClick={() => handleLocateRestaurant()}
            className="w-full mt-3 h-[42px] text-[13px] font-semibold flex items-center justify-center gap-2 transition-all duration-150 landing-btn-press landing-focus-ring cursor-pointer border border-slate-200 dark:border-neutral-800 rounded-[10px] text-slate-800 dark:text-neutral-200 bg-[#F9FAFB] dark:bg-neutral-850 hover:border-[#FF6B1A] dark:hover:border-[#FF6B1A] hover:bg-[#FFF5F0] dark:hover:bg-neutral-800 hover:text-[#FF6B1A] dark:hover:text-[#FF6B1A]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Locate Restaurant
          </button>
        </div>
      </div>

      {/* View Menu & Details Modal */}
      <ViewMenuModal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        restaurant={restaurant}
        onReserveTable={(id) => handleReserveTable(id)}
        onLocateRestaurant={(r) => handleLocateRestaurant(r)}
      />
    </>
  );
}
