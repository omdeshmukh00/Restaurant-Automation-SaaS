import { apiClient } from '../../../shared/services/apiClient';

export interface KitchenOrder {
  id: string;
  table: string;
  item: string;
  status: 'PLACED' | 'PREPARING' | 'READY' | 'DELAYED' | 'REJECTED';
  quantity: number;
  notes?: string;
  createdAt?: string;
}

export interface KitchenBatch {
  id: string;
  item: string;
  quantity: number;
  orders: string[]; // Order IDs included in this batch
  status: 'PENDING' | 'PREPARING' | 'READY';
  createdAt?: string;
}

export interface KitchenLoad {
  stations: Array<{ station: string, loadPercent: number }>;
  aggregate: {
    load: 'Low' | 'Medium' | 'High';
    activeOrdersCount: number;
  };
}

export interface KitchenPerformance {
  avgPrepTime: string;
  efficiency: string;
  completedToday: number;
}

// API calls
export const getKitchenOrders = async (): Promise<KitchenOrder[]> => {
  const res = await apiClient.get('/kitchen/orders');
  return res.data?.data?.orders || res.data?.orders || res.data?.data || res.data || [];
};

export const getKitchenLoad = async (): Promise<any> => {
  const res = await apiClient.get('/kitchen/load');
  return res.data?.data || { stations: [], aggregate: { load: 'Normal', activeOrdersCount: 0 } };
};

export const acceptOrder = async (id: string, estimatedPreparationTime?: number): Promise<KitchenOrder> => {
  const payload = estimatedPreparationTime ? { estimatedPreparationTime } : {};
  const res = await apiClient.patch(`/kitchen/orders/${id}/accept`, payload);
  return res.data?.data || res.data;
};

export const startOrder = async (id: string): Promise<KitchenOrder> => {
  const res = await apiClient.patch(`/kitchen/orders/${id}/start`);
  return res.data?.data || res.data;
};

export const readyOrder = async (id: string): Promise<KitchenOrder> => {
  const res = await apiClient.patch(`/kitchen/orders/${id}/ready`);
  return res.data?.data || res.data;
};

export const delayOrder = async (id: string, delayMinutes: number, reason: string): Promise<KitchenOrder> => {
  const res = await apiClient.patch(`/kitchen/orders/${id}/delay`, { delayMinutes, reason });
  return res.data?.data || res.data;
};

export const rejectOrder = async (id: string): Promise<KitchenOrder> => {
  const res = await apiClient.patch(`/kitchen/orders/${id}/reject`);
  return res.data?.data || res.data;
};

export const addInternalNote = async (id: string, content: string): Promise<KitchenOrder> => {
  const res = await apiClient.patch(`/kitchen/orders/${id}/notes`, { content });
  return res.data?.data || res.data;
};

export const getKitchenBatches = async (): Promise<any[]> => {
  const res = await apiClient.get('/kitchen/batches');
  return res.data?.data?.batches || res.data?.batches || res.data?.data || res.data || [];
};

export const getSuggestedBatches = async (): Promise<any[]> => {
  const res = await apiClient.get('/kitchen/batches/suggestions');
  return res.data?.data?.batches || res.data?.batches || res.data?.data || res.data || [];
};

export const createKitchenBatch = async (data: { name: string; orderIds: string[]; station?: string }): Promise<any> => {
  const res = await apiClient.post('/kitchen/batches', data);
  return res.data?.data?.batch || res.data?.batch || res.data?.data || res.data;
};

export const updateKitchenBatchStatus = async (id: string, status: string): Promise<any> => {
  const res = await apiClient.patch(`/kitchen/batches/${id}`, { status });
  return res.data?.data?.batch || res.data?.batch || res.data?.data || res.data;
};



export const getKitchenPerformance = async (): Promise<KitchenPerformance & { averagePreparationTime: number, ordersCompleted: number, delayedOrders: number }> => {
  const res = await apiClient.get('/kitchen/performance');
  const chefs = res.data?.data?.chefs || [];
  
  if (!chefs.length) {
    return {
      avgPrepTime: '0 min',
      efficiency: '0%',
      completedToday: 0,
      averagePreparationTime: 0,
      ordersCompleted: 0,
      delayedOrders: 0
    };
  }

  let totalAvgMins = 0;
  let totalHandled = 0;
  let totalCompleted = 0;
  let chefsWithOrders = 0;

  for (const chef of chefs) {
    if (chef.handledOrders > 0) {
      totalAvgMins += (chef.avgTicketMinutes || 0);
      chefsWithOrders++;
      totalHandled += (chef.handledOrders || 0);
      totalCompleted += (chef.completedKitchenFlow || 0);
    }
  }

  const avgPrep = chefsWithOrders > 0 ? Math.round(totalAvgMins / chefsWithOrders) : 0;
  const efficiency = totalHandled > 0 ? Math.round((totalCompleted / totalHandled) * 100) : 0;
  const delayed = Math.max(0, totalHandled - totalCompleted);

  return {
    avgPrepTime: `${avgPrep} min`,
    efficiency: `${efficiency}%`,
    completedToday: totalCompleted,
    averagePreparationTime: avgPrep,
    ordersCompleted: totalCompleted,
    delayedOrders: delayed
  };
};

export const updateMenuAvailability = async (id: string, availabilityStatus: 'AVAILABLE' | 'OUT_OF_STOCK' | 'TEMPORARILY_UNAVAILABLE'): Promise<any> => {
  const res = await apiClient.patch(`/kitchen/menu/${id}/availability`, { availabilityStatus });
  return res.data?.data?.item || res.data?.item || res.data?.data || res.data;
};

export const getKitchenMenuItems = async (search?: string): Promise<any[]> => {
  const params = search ? { search } : undefined;
  const res = await apiClient.get('/kitchen/menu/items', { params });
  return res.data?.data?.items || res.data?.items || res.data?.data || res.data || [];
};

export const getAlerts = async (): Promise<any[]> => {
  try {
    const res = await apiClient.get('/kitchen/alerts');
    return res.data?.data || res.data || [];
  } catch (err) {
    return [];
  }
};

export const resolveAlert = async (id: string): Promise<any> => {
  const res = await apiClient.patch(`/kitchen/alerts/${id}/resolve`);
  return res.data?.data || res.data;
};
