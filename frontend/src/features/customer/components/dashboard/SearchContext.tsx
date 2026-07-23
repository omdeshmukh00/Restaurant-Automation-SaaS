import React, { createContext, useContext, useState, useMemo } from 'react';

// ── Menu data (shared across pages) ──────────────────────────
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  rating: number;
  reviews: number;
  badge?: string;
  isVeg?: boolean;
  isSpicy?: boolean;
}

import { useCustomerStore } from '../../store/customer.store';
import { apiClient } from '../../../../shared/services/apiClient';
import { getSocket } from '../../../../lib/socket';
import { useEffect, useCallback } from 'react';

function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('biryani') || lower.includes('rice')) return 'soup_kitchen';
  if (lower.includes('pizza')) return 'local_pizza';
  if (lower.includes('burger')) return 'lunch_dining';
  if (lower.includes('dessert') || lower.includes('cake') || lower.includes('sweet')) return 'cake';
  if (lower.includes('drink') || lower.includes('beverage') || lower.includes('lassi')) return 'local_bar';
  if (lower.includes('starter') || lower.includes('soup') || lower.includes('appetizer')) return 'skillet';
  return 'dinner_dining';
}

// ── Search / Filter context ──────────────────────────────────
interface SearchContextType {
  query: string;
  setQuery: (q: string) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  vegOnly: boolean;
  setVegOnly: (v: boolean) => void;
  spicyOnly: boolean;
  setSpicyOnly: (s: boolean) => void;
  filteredItems: MenuItem[];
  categories: { name: string; icon: string }[];
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const { menuItems: storeMenuItems, fetchMenu, diningSession } = useCustomerStore();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('Recommended');
  const [vegOnly, setVegOnly] = useState(false);
  const [spicyOnly, setSpicyOnly] = useState(false);

  const menuItems = useMemo(() => {
    return storeMenuItems.map((item: any) => ({
      id: item._id || item.id,
      name: item.name,
      price: item.price,
      image: item.image || '',
      description: item.description || '',
      category: item.categoryId?.name || item.category || 'Main',
      rating: item.rating || 4.5,
      reviews: item.reviews || 0,
      isVeg: item.isVeg,
      isSpicy: item.isSpicy,
    }));
  }, [storeMenuItems]);

  const categories = useMemo(() => {
    const cats = new Set(menuItems.map(m => m.category));
    return [
      { name: 'All', icon: 'grid_view' },
      ...Array.from(cats).map(name => ({
        name,
        icon: getCategoryIcon(name),
      }))
    ];
  }, [menuItems]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMenuUpdate = () => {
      fetchMenu();
    };

    socket.on('menu.updated', handleMenuUpdate);
    return () => {
      socket.off('menu.updated', handleMenuUpdate);
    };
  }, [fetchMenu]);

  const filteredItems = useMemo(() => {
    let result = [...menuItems];

    // Category filter
    if (activeCategory !== 'All') {
      result = result.filter((item) => item.category === activeCategory);
    }

    // Search filter
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    // Veg filter
    if (vegOnly) {
      result = result.filter((item) => item.isVeg);
    }

    // Spicy filter
    if (spicyOnly) {
      result = result.filter((item) => item.isSpicy);
    }

    // Sort
    if (sortBy === 'Popularity') {
      result.sort((a, b) => b.reviews - a.reviews);
    } else if (sortBy === 'Price: Low to High') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'Rating') {
      result.sort((a, b) => b.rating - a.rating);
    }

    return result;
  }, [menuItems, query, activeCategory, sortBy, vegOnly, spicyOnly]);

  const value = useMemo(
    () => ({
      query,
      setQuery,
      activeCategory,
      setActiveCategory,
      sortBy,
      setSortBy,
      vegOnly,
      setVegOnly,
      spicyOnly,
      setSpicyOnly,
      filteredItems,
      categories,
    }),
    [query, activeCategory, sortBy, vegOnly, spicyOnly, filteredItems, categories]
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}
