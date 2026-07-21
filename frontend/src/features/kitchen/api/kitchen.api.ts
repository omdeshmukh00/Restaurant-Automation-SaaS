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
  load: 'Low' | 'Medium' | 'High';
  activeOrdersCount: number;
}

export interface KitchenPerformance {
  avgPrepTime: string;
  efficiency: string;
  completedToday: number;
}

// Mock Data for Demo & Fallback
export const mockOrders: KitchenOrder[] = [
  { id: '1', table: 'T1', item: 'Paneer Butter Masala', status: 'PREPARING', quantity: 2, notes: 'Make it extra spicy' },
  { id: '2', table: 'T3', item: 'Veg Biryani', status: 'READY', quantity: 1 },
  { id: '3', table: 'T5', item: 'Chicken Curry', status: 'DELAYED', quantity: 3, notes: 'No onions' },
  { id: '4', table: 'T2', item: 'Garlic Naan', status: 'PLACED', quantity: 4 },
  { id: '5', table: 'T4', item: 'Paneer Butter Masala', status: 'PLACED', quantity: 1 }
];

export const mockBatches: KitchenBatch[] = [
  { id: 'b1', item: 'Paneer Butter Masala', quantity: 3, orders: ['1', '5'], status: 'PREPARING' }
];

export const mockLoad: KitchenLoad = {
  load: 'Medium',
  activeOrdersCount: 5
};

export const mockPerformance: KitchenPerformance = {
  avgPrepTime: '12 min',
  efficiency: '85%',
  completedToday: 24
};

// API calls with safe fallback to mock data on error/failure
export const getKitchenOrders = async (): Promise<KitchenOrder[]> => {
  try {
    const res = await apiClient.get('/kitchen/orders');
    return res.data?.data?.orders || res.data?.orders || res.data?.data || res.data || mockOrders;
  } catch (err) {
    console.warn('Using mock kitchen orders due to API error:', err);
    return mockOrders;
  }
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

export const delayOrder = async (id: string): Promise<KitchenOrder> => {
  const res = await apiClient.patch(`/kitchen/orders/${id}/delay`);
  return res.data?.data || res.data;
};

export const rejectOrder = async (id: string): Promise<KitchenOrder> => {
  const res = await apiClient.patch(`/kitchen/orders/${id}/reject`);
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

export const getKitchenLoad = async (): Promise<KitchenLoad> => {
  try {
    const res = await apiClient.get('/kitchen/load');
    return res.data?.data || res.data || mockLoad;
  } catch (err) {
    const activeOrders = mockOrders.filter(o => o.status !== 'READY' && o.status !== 'REJECTED');
    let load: 'Low' | 'Medium' | 'High' = 'Low';
    if (activeOrders.length > 5) {
      load = 'High';
    } else if (activeOrders.length > 2) {
      load = 'Medium';
    }
    return {
      load,
      activeOrdersCount: activeOrders.length
    };
  }
};

export const getKitchenPerformance = async (): Promise<KitchenPerformance> => {
  try {
    const res = await apiClient.get('/kitchen/performance');
    return res.data?.data || res.data || mockPerformance;
  } catch (err) {
    return mockPerformance;
  }
};


