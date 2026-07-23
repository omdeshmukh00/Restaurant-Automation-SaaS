import { useKitchenStore } from '../store/kitchen.store';
import { getKitchenOrders, getKitchenBatches, getSuggestedBatches, getKitchenLoad, getKitchenPerformance, getKitchenInventory } from '../api/kitchen.api';


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
    const [orders, batches, suggestedBatches, load, performance, inventoryData] = await Promise.all([
      getKitchenOrders(),
      getKitchenBatches(),
      getSuggestedBatches(),
      getKitchenLoad(),
      getKitchenPerformance(),
      getKitchenInventory(),
    ]);

    // Using the Zustand store's setState outside of a component
    useKitchenStore.getState().setOrders(orders);
    useKitchenStore.getState().setBatches(batches);
    useKitchenStore.getState().setSuggestedBatches(suggestedBatches);
    useKitchenStore.getState().setLoad(load);
    useKitchenStore.getState().setPerformance(performance);
    
    // Map inventory data to match store state and set
    const mappedInventory = inventoryData.map((item: any) => ({
      id: item._id || item.id,
      name: item.name,
      category: item.category?.name || item.category || 'General',
      stock: item.stock || 0,
      unit: item.unit || 'units',
      minStock: item.threshold || 0,
      lastRestocked: item.lastRestocked ? new Date(item.lastRestocked).toLocaleDateString() : 'N/A',
      status: (item.stock <= item.threshold ? (item.stock <= (item.threshold * 0.5) ? 'critical' : 'low') : 'ok') as 'low' | 'ok' | 'critical',
      dailyUsage: item.dailyUsage || 0
    }));
    useKitchenStore.getState().setInventory(mappedInventory);
    
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

  const executeOptimisticOrderUpdate = async (id: string, partialOrder: Partial<any>, apiCall: () => Promise<any>) => {
    const previousState = store.ordersById[id];
    if (previousState) {
      store.upsertOrder({ ...previousState, ...partialOrder });
    }
    try {
      await apiCall();
      // On success, backend will emit socket event which will override our optimistic update with authoritative state
    } catch (e) {
      console.error('Optimistic update failed', e);
      if (previousState) {
        // Rollback
        store.upsertOrder(previousState);
      }
      throw e;
    }
  };

  return {
    ordersById: store.ordersById,
    orderIds: store.orderIds,
    batchesById: store.batchesById,
    batchIds: store.batchIds,
    suggestedBatches: store.suggestedBatches,
    inventory: store.inventory,
    load: store.load,
    performance: store.performance,
    refreshDashboard,
    scheduleRefresh,
    executeOptimisticOrderUpdate,
    setOrders: store.setOrders,
    setBatches: store.setBatches,
    setSuggestedBatches: store.setSuggestedBatches,
    setInventory: store.setInventory,
    setLoad: store.setLoad,
    setPerformance: store.setPerformance,
  };
}
