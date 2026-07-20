import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { OfferCoupon, useCustomerStore } from '../../store/customer.store';
import { setCartHasItems } from '../../store/cartSnapshot';
import { apiClient } from '../../../../shared/services/apiClient';

export interface CartItem {
  id: string;
  cartItemId?: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  description?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity' | 'cartItemId'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  resCharges: number;
  discount: number;
  total: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  appliedCoupon: OfferCoupon | null;
  setAppliedCoupon: (coupon: OfferCoupon | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<OfferCoupon | null>(null);
  const { diningSession } = useCustomerStore();

  const fetchCart = useCallback(async () => {
    if (!diningSession) return;
    try {
      const res = await apiClient.get('/customer/cart');
      const cart = res.data?.data || res.data;
      if (cart && cart.items) {
        const mappedItems: CartItem[] = cart.items.map((i: any) => ({
          id: i.menuItem?._id || i.menuItem || '',
          cartItemId: i._id,
          name: i.menuItem?.name || 'Item',
          price: i.unitPrice,
          quantity: i.quantity,
          image: i.menuItem?.image || '',
          description: i.menuItem?.description || '',
        }));
        setItems(mappedItems);
        setCartHasItems(mappedItems.length > 0);
      } else {
        setItems([]);
        setCartHasItems(false);
      }
    } catch (err) {
      console.error('Failed to fetch cart', err);
    }
  }, [diningSession]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addItem = useCallback(async (item: Omit<CartItem, 'quantity' | 'cartItemId'>) => {
    try {
      await apiClient.post('/customer/cart/items', { menuItem: item.id, quantity: 1 });
      await fetchCart();
      useCustomerStore.getState().recordActivity();
    } catch (err) {
      console.error('Failed to add item', err);
    }
  }, [fetchCart]);

  const removeItem = useCallback(async (id: string) => {
    const existing = items.find((i) => i.id === id);
    if (!existing?.cartItemId) return;
    try {
      await apiClient.delete(`/customer/cart/items/${existing.cartItemId}`);
      await fetchCart();
      useCustomerStore.getState().recordActivity();
    } catch (err) {
      console.error('Failed to remove item', err);
    }
  }, [items, fetchCart]);

  const updateQuantity = useCallback(async (id: string, quantity: number) => {
    const existing = items.find((i) => i.id === id);
    if (!existing?.cartItemId) return;
    try {
      if (quantity <= 0) {
        await apiClient.delete(`/customer/cart/items/${existing.cartItemId}`);
      } else {
        await apiClient.patch(`/customer/cart/items/${existing.cartItemId}`, { quantity });
      }
      await fetchCart();
      useCustomerStore.getState().recordActivity();
    } catch (err) {
      console.error('Failed to update quantity', err);
    }
  }, [items, fetchCart]);

  const clearCart = useCallback(async () => {
    try {
      await apiClient.delete('/customer/cart');
      setItems([]);
      setCartHasItems(false);
      setAppliedCoupon(null);
      useCustomerStore.getState().recordActivity();
    } catch (err) {
      console.error('Failed to clear cart', err);
    }
  }, []);

  const itemCount = useMemo(() => items.length, [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);
  const resCharges = 30;
  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;
    
    // Check min order amount
    if (appliedCoupon.minOrderAmount && subtotal < appliedCoupon.minOrderAmount) {
      return 0;
    }

    const code = appliedCoupon.code.toUpperCase();
    if (code === 'FREEBEV') {
      const hasLassi = items.some(i => i.name.toLowerCase().includes('mango lassi'));
      if (!hasLassi) return 0;
    }
    if (code === 'DESSERT80') {
      const hasJamun = items.some(i => i.name.toLowerCase().includes('gulab jamun'));
      if (!hasJamun) return 0;
    }
    if (code === 'BURGERBOGO') {
      const burger = items.find(i => i.name.toLowerCase().includes('smash burger'));
      if (!burger || burger.quantity < 2) return 0;
      return burger.price;
    }
    
    if (appliedCoupon.discountType === 'percentage') {
      return Math.round(subtotal * (appliedCoupon.discountValue / 100));
    }
    if (appliedCoupon.discountType === 'fixed' || appliedCoupon.discountType === 'free_item') {
      return appliedCoupon.discountValue;
    }
    
    return 0;
  }, [appliedCoupon, subtotal, items]);
  const total = useMemo(() => Math.max(0, subtotal + resCharges - discount), [subtotal, resCharges, discount]);

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      itemCount,
      subtotal,
      resCharges,
      discount,
      total,
      isCartOpen,
      setIsCartOpen,
      appliedCoupon,
      setAppliedCoupon,
    }),
    [items, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotal, resCharges, discount, total, isCartOpen, appliedCoupon]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
