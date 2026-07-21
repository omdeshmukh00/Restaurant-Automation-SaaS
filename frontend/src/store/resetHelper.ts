// src/store/resetHelper.ts
// Centralized store reset helper to reset all persisted Zustand stores back to their defaults

import { useUIStore } from './ui.store';
import { useKitchenStore } from '../features/kitchen/store/kitchen.store';
import { useCustomerStore } from '../features/customer/store/customer.store';
import { useCustomersStore } from '../features/admin/store/customers.store';
import { useOrdersStore } from '../features/admin/store/orders.store';
import { useStaffStore } from '../features/admin/store/staff.store';
import { useTablesStore } from '../features/admin/store/tables.store';
import { useSettingsStore } from '../features/admin/store/settings.store';
import { useMenuStore } from '../features/admin/store/menu.store';

export function resetAllStores() {
  console.log('[resetAllStores] Resetting all persisted Zustand stores...');
  
  try {
    (useUIStore.getState() as any).reset();
  } catch (e) {
    console.warn('Failed to reset useUIStore', e);
  }

  try {
    (useKitchenStore.getState() as any).reset();
  } catch (e) {
    console.warn('Failed to reset useKitchenStore', e);
  }

  try {
    (useCustomerStore.getState() as any).reset();
  } catch (e) {
    console.warn('Failed to reset useCustomerStore', e);
  }

  try {
    (useCustomersStore.getState() as any).reset();
  } catch (e) {
    console.warn('Failed to reset useCustomersStore', e);
  }

  try {
    (useOrdersStore.getState() as any).reset();
  } catch (e) {
    console.warn('Failed to reset useOrdersStore', e);
  }

  try {
    (useStaffStore.getState() as any).reset();
  } catch (e) {
    console.warn('Failed to reset useStaffStore', e);
  }

  try {
    (useTablesStore.getState() as any).reset();
  } catch (e) {
    console.warn('Failed to reset useTablesStore', e);
  }

  try {
    (useSettingsStore.getState() as any).reset();
  } catch (e) {
    console.warn('Failed to reset useSettingsStore', e);
  }

  try {
    (useMenuStore.getState() as any).reset();
  } catch (e) {
    console.warn('Failed to reset useMenuStore', e);
  }

  console.log('[resetAllStores] Reset complete.');
}
