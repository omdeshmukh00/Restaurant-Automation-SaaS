import { useKitchenStore } from '../store/kitchen.store';
import { getKitchenOrders, getKitchenBatches, getSuggestedBatches, getKitchenLoad, getKitchenPerformance } from '../api/kitchen.api';
import { INVENTORY } from '../store/kitchenData'; // Placeholder for missing inventory API

let refreshScheduled = false;
let refreshInProgress = false;
let queuedRefresh = false;

export const scheduleRefresh = () => {
  if (refreshScheduled) return;
  refreshScheduled = true;
  setTimeout(() => {
    refreshScheduled = false;
    void refreshDashboard();
  }, 200);
};

export const refreshDashboard = async () => {
  if (refreshInProgress) {
    queuedRefresh = true;
    return;
  }
  refreshInProgress = true;
  queuedRefresh = false;

  try {
    const [orders, batches, suggestedBatches, load, performance] = await Promise.all([
      getKitchenOrders(),
      getKitchenBatches(),
      getSuggestedBatches(),
      getKitchenLoad(),
      getKitchenPerformance(),
    ]);

    // Using the Zustand store's setState outside of a component
    useKitchenStore.getState().setOrders(orders);
    useKitchenStore.getState().setBatches(batches);
    useKitchenStore.getState().setSuggestedBatches(suggestedBatches);
    useKitchenStore.getState().setLoad(load);
    useKitchenStore.getState().setPerformance(performance);
    
    // There is no getKitchenInventory API yet, so we use the mock data as fallback just in case it's empty
    const currentInventory = useKitchenStore.getState().inventory;
    if (currentInventory.length === 0) {
      useKitchenStore.getState().setInventory(INVENTORY);
    }
    
  } catch (err) {
    console.error('Unable to refresh kitchen dashboard', err);
  } finally {
    refreshInProgress = false;
    if (queuedRefresh) {
      queuedRefresh = false;
      scheduleRefresh();
    }
  }
};

export function useKitchenDashboard() {
  const store = useKitchenStore();

  return {
    orders: store.orders,
    batches: store.batches,
    suggestedBatches: store.suggestedBatches,
    inventory: store.inventory,
    load: store.load,
    performance: store.performance,
    refreshDashboard,
    scheduleRefresh,
    setOrders: store.setOrders,
    setBatches: store.setBatches,
    setSuggestedBatches: store.setSuggestedBatches,
    setInventory: store.setInventory,
    setLoad: store.setLoad,
    setPerformance: store.setPerformance,
  };
}
