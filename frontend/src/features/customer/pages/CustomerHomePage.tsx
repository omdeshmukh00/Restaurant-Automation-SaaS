import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSearch } from '../components/dashboard/SearchContext';
import FoodCard from '../components/dashboard/FoodCard';
import CategoryFilter from '../components/dashboard/CategoryFilter';
import QuickActions from '../components/dashboard/QuickActions';
import { useCustomerStore } from '../store/customer.store';
import { apiClient } from '../../../shared/services/apiClient';
import { useAuth } from '../../../auth/AuthProvider';


export default function CustomerHomePage() {
  const { diningSession } = useCustomerStore();
  const { filteredItems, vegOnly, setVegOnly, spicyOnly, setSpicyOnly } = useSearch();
  const { profile } = useCustomerStore();

  const getGreetingText = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Hello';
  }, []);

  const [greeting, setGreeting] = useState(getGreetingText);

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreetingText());
    }, 60000);
    return () => clearInterval(interval);
  }, [getGreetingText]);

  const recommended = filteredItems.slice(0, 8);


  if (!diningSession) return null;

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto h-full sd-custom-scrollbar">
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-sd-on-surface font-sans">{greeting}, {profile.name.split(' ')[0]}! (Table {diningSession.tableNumber}) 👋</h2>
        <p className="text-sm text-sd-on-surface-variant font-sans">What would you like to order today?</p>
      </div>


      {/* Quick Actions — extra features */}
      <QuickActions />

      {/* Categories */}
      <section className="mb-4 mt-6">
        <CategoryFilter />
      </section>

      {/* Sub-filters (Styled like /menu sub-filter bar) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between border-b border-sd-surface-variant pb-4 mb-6 px-1">
        <div>
          <h3 className="text-base font-bold text-sd-on-surface font-sans">Recommended for you</h3>
          <p className="text-xs text-sd-on-surface-variant font-sans">Handpicked dishes based on your taste</p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto">
          {/* Veg Mode Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm font-semibold text-sd-on-surface-variant font-sans">Veg Mode</span>
            <div
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                vegOnly ? 'bg-sd-secondary/20' : 'bg-sd-surface-variant'
              }`}
            >
              <input
                className="sr-only peer"
                type="checkbox"
                checked={vegOnly}
                onChange={(e) => setVegOnly(e.target.checked)}
              />
              <div
                className={`absolute left-0.5 h-4 w-4 rounded-full shadow-sm transition-all ${
                  vegOnly ? 'translate-x-4 bg-sd-secondary' : 'bg-white'
                }`}
              />
            </div>
          </label>

          {/* Extra Spicy Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="material-symbols-outlined text-sd-primary text-[18px]">local_fire_department</span>
            <span className="text-sm font-semibold text-sd-on-surface-variant font-sans">Extra Spicy</span>
            <div
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                spicyOnly ? 'bg-sd-primary/20' : 'bg-sd-surface-variant'
              }`}
            >
              <input
                className="sr-only peer"
                type="checkbox"
                checked={spicyOnly}
                onChange={(e) => setSpicyOnly(e.target.checked)}
              />
              <div
                className={`absolute left-0.5 h-4 w-4 rounded-full shadow-sm transition-all ${
                  spicyOnly ? 'translate-x-4 bg-sd-primary' : 'bg-white'
                }`}
              />
            </div>
          </label>
        </div>
      </div>

      {/* Recommended */}
      <section className="mb-8 food-grid-container">
        <div className="cq-food-grid-5">
          {recommended.map((item) => (
            <FoodCard key={item.id} item={item} />
          ))}
        </div>
        <div className="flex justify-center mt-8">
          <Link
            to="/customer/menu"
            className="px-6 py-2.5 border-2 border-sd-primary text-sd-primary hover:bg-sd-primary hover:text-white rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2 font-sans"
          >
            View All Menu
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
