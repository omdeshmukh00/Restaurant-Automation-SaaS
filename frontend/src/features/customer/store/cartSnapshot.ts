// src/features/customer/store/cartSnapshot.ts
/**
 * Shared synchronous snapshot of the cart state.
 * Allows Zustand stores to check cart status without duplicating state
 * or relying on asynchronous network requests.
 */
let cartHasItems = false;

export const setCartHasItems = (hasItems: boolean): void => {
  cartHasItems = hasItems;
};

export const getCartHasItems = (): boolean => {
  return cartHasItems;
};
