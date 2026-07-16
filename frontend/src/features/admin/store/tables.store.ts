// src/features/admin/store/tables.store.ts
// Zustand store for table management with backend API integration

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../../../shared/services/apiClient';
import { useStaffStore } from './staff.store';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Cleaning' | 'Blocked';
export type TableShape = 'Round' | 'Square' | 'Rectangle';
export type TableSection = string;

export interface Table {
  id: string; // MongoDB ObjectId
  label: string;
  seats: number;
  shape: TableShape;
  section: TableSection;
  floor: number;
  status: TableStatus;
  x: number;
  y: number;
  notes?: string;
  qr_token?: string;
  assignedStaffId?: string | null;
  assignedStaffName?: string;
  currentOrder?: {
    id: string;
    time: string;
    amount: number;
    items: number;
  };
  sessionDetails?: {
    sessionId: string;
    customerName: string;
    sessionCreatedAt: string | null;
    totalOrders: number;
    pendingOrdersCount: number;
    readyOrdersCount: number;
    servedOrdersCount: number;
    currentActiveOrderNumber: string;
    totalBill: number;
    status: string;
  };
}

export interface TableFilter {
  section: TableSection | 'All';
  status: TableStatus | 'All';
  floor: number | 'All';
  search: string;
}

export type ViewMode = 'grid' | 'list' | 'floor' | 'floor-map';

interface TablesStore {
  // Data
  tables: Table[];
  tablePositions: Record<string, { x: number; y: number }>;
  floors: { name: string; number: number }[];
  sections: string[];

  // UI state
  viewMode: ViewMode;
  stats: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    cleaning: number;
    blocked: number;
    occupancyRate: number;
    revenueToday: number;
    coversTodday: number;
    avgTurnover: string;
  };
  selectedFloor: number;
  selectedTableId: string | null;
  showAddModal: boolean;
  showEditModal: boolean;
  filter: TableFilter;

  // Actions
  fetchTables: () => Promise<void>;
  addTable: (table: Omit<Table, 'id'>) => Promise<void>;
  updateTable: (id: string, updates: Partial<Table>) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  updateTableStatus: (id: string, status: TableStatus) => Promise<void>;
  regenerateQrCode: (id: string) => Promise<void>;
  selectTable: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setFloor: (floor: number) => void;
  setShowAddModal: (show: boolean) => void;
  setShowEditModal: (show: boolean) => void;
  setFilter: (patch: Partial<TableFilter>) => void;
  setSearchQuery: (query: string) => void;
  updateRestaurantSettings: (settings: { floors?: { name: string; number: number }[]; sections?: string[] }) => Promise<void>;
  addFloor: (floor: { name: string; number: number }) => Promise<{ name: string; number: number }[]>;
  removeFloor: (number: number) => Promise<{ name: string; number: number }[]>;
  addSection: (name: string) => Promise<string[]>;
  removeSection: (name: string) => Promise<string[]>;
}

// ── Default layout mapping (to preserve map coordinates in UI) ────────────────

const layoutDefaults: Record<string, { x: number; y: number; shape: TableShape; section: TableSection; floor: number }> = {
  'T1': { x: 10, y: 15, shape: 'Square',    section: 'Indoor',  floor: 1 },
  'T2': { x: 30, y: 15, shape: 'Rectangle', section: 'Indoor',  floor: 1 },
  'T3': { x: 50, y: 15, shape: 'Round',     section: 'Indoor',  floor: 1 },
  'T4': { x: 70, y: 15, shape: 'Rectangle', section: 'Private', floor: 1 },
  'T5': { x: 10, y: 45, shape: 'Square',    section: 'Outdoor', floor: 1 },
  'B1': { x: 30, y: 45, shape: 'Round',     section: 'Bar',     floor: 1 },
  'T6': { x: 10, y: 15, shape: 'Square',    section: 'Indoor',  floor: 2 },
  'T7': { x: 30, y: 15, shape: 'Rectangle', section: 'Indoor',  floor: 2 },
};

function mapBackendStatusToFrontendStatus(status: string, isActive: boolean): TableStatus {
  if (!isActive) return 'Blocked';
  switch (status) {
    case 'AVAILABLE':
      return 'Available';
    case 'OCCUPIED':
    case 'ORDERING':
    case 'BILL_PENDING':
    case 'PAYMENT_PENDING':
    case 'PAID':
      return 'Occupied';
    case 'RESERVED':
      return 'Reserved';
    case 'NEEDS_CLEANING':
    case 'CLEANING_IN_PROGRESS':
      return 'Cleaning';
    default:
      return 'Available';
  }
}

function mapFrontendStatusToBackendStatus(status: TableStatus): string {
  switch (status) {
    case 'Available':
      return 'AVAILABLE';
    case 'Occupied':
      return 'OCCUPIED';
    case 'Reserved':
      return 'RESERVED';
    case 'Cleaning':
      return 'NEEDS_CLEANING';
    default:
      return 'AVAILABLE';
  }
}

function computeStats(tables: Table[]) {
  const total = tables.length;
  const available = tables.filter((t) => t.status === 'Available').length;
  const occupied = tables.filter((t) => t.status === 'Occupied').length;
  const reserved = tables.filter((t) => t.status === 'Reserved').length;
  const cleaning = tables.filter((t) => t.status === 'Cleaning').length;
  const blocked = tables.filter((t) => t.status === 'Blocked').length;

  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const revenueToday = tables.reduce((sum, t) => sum + (t.currentOrder?.amount ?? 0), 0);
  const coversTodday = tables.reduce((sum, t) => sum + (t.currentOrder ? t.seats : 0), 0);

  // Real avg turnover: average elapsed minutes of currently active sessions.
  const elapsed = tables
    .filter((t) => t.sessionDetails?.sessionCreatedAt)
    .map((t) => (Date.now() - new Date(t.sessionDetails!.sessionCreatedAt!).getTime()) / 60000);
  const avgTurnover = elapsed.length
    ? `${Math.round(elapsed.reduce((a, b) => a + b, 0) / elapsed.length)} min`
    : '—';

  return {
    total,
    available,
    occupied,
    reserved,
    cleaning,
    blocked,
    occupancyRate,
    revenueToday,
    coversTodday,
    avgTurnover,
  };
}

export const useTablesStore = create<TablesStore>()(
  persist(
    (set, get) => ({
      tables: [],
      tablePositions: {},
      viewMode: 'grid',
      stats: computeStats([]),
      selectedFloor: 1,
      selectedTableId: null,
      showAddModal: false,
      showEditModal: false,
      filter: { section: 'All', status: 'All', floor: 'All', search: '' },
      floors: [
        { name: 'Floor 1', number: 1 },
        { name: 'Floor 2', number: 2 },
      ],
      sections: ['Indoor', 'Outdoor', 'Bar', 'Private'],

      fetchTables: async () => {
        try {
          const res = await apiClient.get('/admin/tables');
          const backendTables = res.data?.data?.tables || [];
          const floors = res.data?.data?.floors || [
            { name: 'Floor 1', number: 1 },
            { name: 'Floor 2', number: 2 },
          ];
          const sections = res.data?.data?.sections || ['Indoor', 'Outdoor', 'Bar', 'Private'];
          
          // Resolve assigned-staff names from the staff store. Always ensure the
          // staff list is loaded first — it may be empty if the Staff page hasn't
          // been visited yet — so table assignments show the real name instead of
          // silently falling back to "Unassigned".
          const staffState = useStaffStore.getState();
          if (!staffState.members || staffState.members.length === 0) {
            await staffState.fetchMembers().catch(() => undefined);
          }
          const staffMembers = useStaffStore.getState().members || [];
          const staffNameById = (id?: string | null) =>
            id ? (staffMembers.find((s) => s.id === id)?.name ?? '') : '';

          const tablePositions = get().tablePositions || {};
          const mappedTables: Table[] = backendTables.map((t: any) => {
            const tableNumber = t.tableNumber || 'Table';
            const tableId = t._id || t.id;
            const layout = layoutDefaults[tableNumber] || {
              x: 50,
              y: 50,
              shape: t.capacity > 4 ? 'Rectangle' : 'Square',
              section: t.section || 'Indoor',
              floor: t.floor || 1,
            };

            // Position priority: backend-stored value (if meaningful) →
            // persisted localStorage (migration) → layout default.
            let x = layout.x;
            let y = layout.y;
            const local = tablePositions[tableId];
            const backendPos =
              t.position && (t.position.x !== 0 || t.position.y !== 0)
                ? { x: t.position.x, y: t.position.y }
                : null;
            if (backendPos) {
              x = backendPos.x;
              y = backendPos.y;
            } else if (local) {
              x = local.x;
              y = local.y;
            }

            let currentOrder = undefined;
            if (t.currentOrder) {
              currentOrder = {
                id: t.currentOrder.id,
                time: t.currentOrder.time,
                amount: t.currentOrder.amount,
                items: t.currentOrder.items,
              };
            }

            return {
              id: tableId,
              label: tableNumber,
              seats: t.capacity,
              shape: (t.shape as TableShape) || layout.shape,
              section: t.section || layout.section,
              floor: t.floor || layout.floor,
              status: mapBackendStatusToFrontendStatus(t.status, t.isActive !== false),
              x,
              y,
              qr_token: t.qrToken,
              notes: t.notes || '',
              assignedStaffId: t.assignedStaffId || null,
              assignedStaffName: staffNameById(t.assignedStaffId),
              currentOrder,
              sessionDetails: t.sessionDetails,
            };
          });

          set({ 
            tables: mappedTables, 
            floors, 
            sections, 
            stats: computeStats(mappedTables) 
          });
        } catch (err) {
          console.error('Failed to fetch tables from API', err);
        }
      },

      updateRestaurantSettings: async (settings) => {
        try {
          await apiClient.patch('/admin/restaurant/settings', settings);
          await get().fetchTables();
        } catch (err) {
          console.error('Failed to update restaurant settings', err);
          throw err;
        }
      },

      addFloor: async (floor) => {
        const res = await apiClient.post('/admin/restaurant/floors', floor);
        const floors = res.data?.data?.floors ?? get().floors;
        set({ floors });
        return floors;
      },

      removeFloor: async (number) => {
        const res = await apiClient.delete(`/admin/restaurant/floors/${number}`);
        const floors = res.data?.data?.floors ?? get().floors;
        set({ floors });
        return floors;
      },

      addSection: async (name) => {
        const res = await apiClient.post('/admin/restaurant/sections', { name });
        const sections = res.data?.data?.sections ?? get().sections;
        set({ sections });
        return sections;
      },

      removeSection: async (name) => {
        const res = await apiClient.delete(`/admin/restaurant/sections/${encodeURIComponent(name)}`);
        const sections = res.data?.data?.sections ?? get().sections;
        set({ sections });
        return sections;
      },

      addTable: async (table) => {
        try {
          const payload: any = {
            tableNumber: table.label,
            capacity: table.seats,
            floor: table.floor,
            section: table.section,
            status: mapFrontendStatusToBackendStatus(table.status),
            notes: table.notes,
            shape: table.shape,
            assignedStaffId: table.assignedStaffId ?? null,
          };
          if (typeof table.x === 'number' && typeof table.y === 'number') {
            payload.position = { x: table.x, y: table.y };
          }
          await apiClient.post('/admin/tables', payload);
          await get().fetchTables();
        } catch (err) {
          console.error('Failed to add table via API', err);
        }
      },

      updateTable: async (id, updates) => {
        try {
          // Optimistic local update for instant feedback. Derive the assigned
          // staff name from the staff store so the panel updates immediately.
          set((state) => ({
            tables: state.tables.map((t) => {
              if (t.id !== id) return t;
              const next = { ...t, ...updates };
              if (updates.assignedStaffId !== undefined) {
                const staff = useStaffStore.getState().members.find(
                  (m) => m.id === updates.assignedStaffId
                );
                next.assignedStaffName = updates.assignedStaffId ? (staff?.name ?? '') : '';
              }
              return next;
            }),
          }));

          const current = get().tables.find((t) => t.id === id);
          const payload: any = {};
          if (updates.label !== undefined) payload.tableNumber = updates.label;
          if (updates.seats !== undefined) payload.capacity = updates.seats;
          if (updates.floor !== undefined) payload.floor = updates.floor;
          if (updates.section !== undefined) payload.section = updates.section;
          if (updates.shape !== undefined) payload.shape = updates.shape;
          if (updates.notes !== undefined) payload.notes = updates.notes;
          if (updates.assignedStaffId !== undefined) payload.assignedStaffId = updates.assignedStaffId;
          if (updates.status !== undefined) {
            payload.isActive = updates.status !== 'Blocked';
          }
          if (updates.x !== undefined || updates.y !== undefined) {
            payload.position = {
              x: updates.x ?? current?.x ?? 50,
              y: updates.y ?? current?.y ?? 50,
            };
          }

          const hasApiUpdates = Object.keys(payload).length > 0;
          if (hasApiUpdates) {
            await apiClient.patch(`/admin/tables/${id}`, payload);
            if (updates.status !== undefined && updates.status !== 'Blocked') {
              await apiClient.patch(`/tables/${id}/status`, {
                status: mapFrontendStatusToBackendStatus(updates.status),
              });
            }
          }
          await get().fetchTables();
        } catch (err) {
          console.error('Failed to update table via API', err);
        }
      },

      deleteTable: async (id) => {
        try {
          await apiClient.delete(`/admin/tables/${id}`);
          await get().fetchTables();
          set({ selectedTableId: null });
        } catch (err) {
          console.error('Failed to delete table via API', err);
        }
      },

      updateTableStatus: async (id, status) => {
        try {
          if (status === 'Blocked') {
            await apiClient.patch(`/admin/tables/${id}`, { isActive: false });
          } else {
            await apiClient.patch(`/admin/tables/${id}`, { isActive: true });
            const payload = {
              status: mapFrontendStatusToBackendStatus(status),
            };
            await apiClient.patch(`/tables/${id}/status`, payload);
          }
          await get().fetchTables();
        } catch (err) {
          console.error('Failed to update table status via API', err);
        }
      },

      regenerateQrCode: async (id) => {
        try {
          await apiClient.post(`/admin/tables/${id}/qr/regenerate`);
          await get().fetchTables();
        } catch (err) {
          console.error('Failed to regenerate table QR code via API', err);
        }
      },

      selectTable: (id) => set({ selectedTableId: id }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setFloor: (floor) => set({ selectedFloor: floor }),
      setShowAddModal: (show) => set({ showAddModal: show }),
      setShowEditModal: (show) => set({ showEditModal: show }),
      setFilter: (patch) =>
        set((state) => ({ filter: { ...state.filter, ...patch } })),
      setSearchQuery: (query) =>
        set((state) => ({ filter: { ...state.filter, search: query } })),
    }),
    {
      name: 'ra-tables-store',
      partialize: (state) => ({
        viewMode: state.viewMode,
        selectedFloor: state.selectedFloor,
        tablePositions: state.tablePositions,
      }),
    },
  ),
);
