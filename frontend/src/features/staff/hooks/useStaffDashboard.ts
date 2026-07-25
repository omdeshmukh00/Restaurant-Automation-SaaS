// src/features/staff/hooks/useStaffDashboard.ts

import { useState, useEffect } from 'react';
import { menuAPI, ordersAPI, requestsAPI, reservationsAPI, tableAPI, notificationsAPI } from '../api/staff.api';
import { staffStore, type Order, type ReadyItem, type RequestItem, type AlertItem, type StaffTable, type StaffReservation, type MenuItem } from '../store/staff.store';
import { connectSocket, getSocket } from '../../../lib/socket';

function toDisplayTime(value?: string | Date | null) {
  if (!value) return 'Just now';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function toRelativeTime(value?: string | Date | null) {
  if (!value) return 'Just now';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;
  const hours = Math.round(diffMinutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''} ago`;
}

function mapTableStatus(status?: string): StaffTable['status'] {
  switch (status?.toUpperCase()) {
    case 'AVAILABLE':
      return 'Available';
    case 'RESERVED':
      return 'Reserved';
    case 'BILL_PENDING':
    case 'PAYMENT_PENDING':
      return 'Bill Requested';
    case 'PAID':
      return 'Food Served';
    case 'DIRTY':
    case 'NEEDS_CLEANING':
    case 'CLEANING_IN_PROGRESS':
      return 'Cleaning';
    case 'OCCUPIED':
    case 'ORDERING':
    default:
      return 'Occupied';
  }
}

function mapTable(table: any): StaffTable {
  const section = typeof table?.section === 'string' && table.section.trim()
    ? table.section
    : table?.floor && Number(table.floor) > 1
      ? `Floor ${table.floor}`
      : 'Zone A';

  return {
    id: String(table?._id || table?.id || 0),
    name: `Table ${table?.tableNumber ?? table?.name ?? table?._id ?? 1}`,
    section: section === 'Outdoor' ? 'Outdoor' : section === 'Zone B' ? 'Zone B' : 'Zone A',
    capacity: Number(table?.capacity ?? 4),
    guests: table?.currentSessionId ? Math.max(1, Number(table?.capacity ?? 1) - 1) : 0,
    status: mapTableStatus(table?.status),
    currentBill: 0,
    elapsed: 'Live',
    action: mapTableStatus(table?.status) === 'Available' ? 'Order' : undefined,
    assignedStaffId: table?.assignedStaffId?.toString?.() || table?.assignedStaffId || null,
    assignedWaiterId: table?.assignedWaiterId?.toString?.() || table?.assignedWaiterId || table?.assignedStaffId?.toString?.() || null,
    assignedWaiterName: table?.assignedStaffId?.name || table?.assignedWaiterId?.name || undefined,
    occupiedAt: table?.occupiedAt || null,
    estimatedVacantAt: table?.estimatedVacantAt || null,
    waitingAssigned: Boolean(table?.waitingAssigned),
  };
}

function mapRequest(request: any): RequestItem {
  const priority = request?.priority?.toUpperCase?.() ?? 'NORMAL';
  const status = request?.status?.toUpperCase?.() ?? 'PENDING';
  const type = request?.type?.toUpperCase?.() ?? 'WAITER';
  const typeLabel = 
    type === 'WATER' ? 'Water Bottle' : 
    type === 'CUTLERY' ? 'Extra Cutlery' : 
    type === 'CLEANING' ? 'Clean Table' : 
    type === 'HELP' ? 'Extra Napkins' : 'Call Waiter';
  const createdAt = request?.createdAt || request?.updatedAt;

  return {
    id: String(request?._id || request?.id || 0),
    table: request?.tableId?.tableNumber ? `Table ${request.tableId.tableNumber}` : 'Table 1',
    type: typeLabel,
    time: toRelativeTime(createdAt),
    elapsedMinutes: Math.max(1, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000)),
    status: status === 'ACCEPTED' ? 'InProgress' : status === 'COMPLETED' ? 'Resolved' : 'Pending',
    severity: priority === 'HIGH' || priority === 'URGENT' ? 'high' : priority === 'NORMAL' ? 'medium' : 'low',
  };
}

function mapReservation(reservation: any): StaffReservation {
  const status = reservation?.status?.toUpperCase?.() ?? 'CONFIRMED';
  return {
    id: String(reservation?._id || reservation?.id || 0),
    name: reservation?.customerName || reservation?.name || 'Guest',
    pax: Number(reservation?.guests ?? reservation?.pax ?? 2),
    time: reservation?.slot || reservation?.time || 'Scheduled',
    phone: reservation?.mobile || reservation?.phone || '',
    status: status === 'CHECKED_IN' || status === 'SEATED' ? 'Seated' : status === 'NOTIFIED' ? 'Notified' : status === 'CANCELLED' ? 'Cancelled' : 'Confirmed',
    type: reservation?.tableId ? 'Reservation' : 'Walk-in',
    assignedTable: reservation?.tableId?.tableNumber ? `Table ${reservation.tableId.tableNumber}` : undefined,
  };
}

function mapOrder(order: any): Order {
  const status = (order?.status ?? '').toUpperCase();
  const items = Array.isArray(order?.items) ? order.items : [];

  return {
    id: order?._id || order?.id || 'ORDER',
    orderNumber: order?.orderNumber || order?._id || order?.id || 'ORDER',
    table: order?.tableId?.tableNumber ? `Table ${order.tableId.tableNumber}` : 'Table 1',
    items: items.map((item: any) => ({
      name: item?.name || 'Item',
      qty: Number(item?.quantity ?? 1),
      price: Number(item?.price ?? item?.totalPrice ?? 0),
    })),
    status: status === 'READY' ? 'Ready' : status === 'SERVED' ? 'Served' : status === 'COMPLETED' ? 'Completed' : status === 'CANCELLED' ? 'Cancelled' : status === 'PREPARING' ? 'Preparing' : 'Pending',
    time: toRelativeTime(order?.createdAt || order?.updatedAt),
    total: Number(order?.finalAmount ?? order?.totalAmount ?? 0),
  };
}

function mapReadyItem(order: any): ReadyItem {
  const items = Array.isArray(order?.items) ? order.items : [];
  const totalQty = items.reduce((sum: number, item: any) => sum + Number(item?.quantity ?? 1), 0);
  const itemNames = items.map((item: any) => item?.name).filter(Boolean).join(', ');
  const tableNum = order?.tableId?.tableNumber ?? order?.tableNumber ?? order?.table ?? '1';

  return {
    id: String(order?._id || order?.id || 0),
    table: typeof tableNum === 'string' && tableNum.toLowerCase().startsWith('table') ? tableNum : `Table ${tableNum}`,
    item: itemNames || 'Ready food',
    qty: totalQty || 1,
    station: 'Main Kitchen',
    readySince: toRelativeTime(order?.updatedAt || order?.readyAt || order?.createdAt),
    elapsedSec: Math.max(0, Math.round((Date.now() - new Date(order?.updatedAt || order?.readyAt || order?.createdAt).getTime()) / 1000)),
  };
}

function mapMenuItem(item: any): MenuItem {
  const categoryName = item?.categoryId?.name || item?.category || 'Mains';
  return {
    id: String(item?._id || item?.id || 0),
    name: item?.name || 'Menu Item',
    category: categoryName === 'Desserts' ? 'Desserts' : categoryName === 'Beverages' ? 'Beverages' : categoryName === 'Starters' ? 'Starters' : 'Mains',
    price: Number(item?.price ?? 0),
    available: item?.isAvailable !== false,
    veg: item?.isVeg ?? true,
    description: item?.description || 'Freshly prepared item',
  };
}

function mapAlert(n: any): AlertItem {
  let severity: AlertItem['severity'] = 'Info';
  const priorityUpper = (n.priority || '').toUpperCase();
  if (priorityUpper === 'HIGH') severity = 'Warning';
  else if (priorityUpper === 'CRITICAL' || priorityUpper === 'URGENT') severity = 'Critical';

  let type: AlertItem['type'] = 'System';
  const categoryUpper = (n.category || '').toUpperCase();
  const typeUpper = (n.type || '').toUpperCase();
  if (categoryUpper === 'KITCHEN') type = 'Kitchen';
  else if (categoryUpper === 'CLEANING') type = 'Cleaning';
  else if (typeUpper === 'DELAYED') type = 'Delayed';
  else if (typeUpper === 'REASSIGNED') type = 'Reassigned';

  return {
    id: String(n._id || n.id),
    message: n.message || n.title || 'System Notification',
    type,
    severity,
    time: toRelativeTime(n.createdAt),
  };
}

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
  staffStore.setLoading(true);
  
  try {
    const [tablesRes, requestsRes, reservationsRes, readyOrdersRes, allOrdersRes, menuRes, alertsRes] = await Promise.all([
      tableAPI.getTables(),
      requestsAPI.getPending(),
      reservationsAPI.getReservations(),
      ordersAPI.getReadyOrders(),
      ordersAPI.getAllOrders(),
      menuAPI.getItems(),
      notificationsAPI.getAll(),
    ]);

    let anySuccess = false;
    const failedEndpoints: string[] = [];
    let mappedOrders: Order[] = [];

    if (allOrdersRes.success && Array.isArray(allOrdersRes.data)) {
      anySuccess = true;
      mappedOrders = allOrdersRes.data.map(mapOrder);
      staffStore.setOrders(mappedOrders);
    } else if (readyOrdersRes.success && Array.isArray(readyOrdersRes.data)) {
      anySuccess = true;
      mappedOrders = readyOrdersRes.data.map(mapOrder);
      staffStore.setOrders(mappedOrders);
    } else if (!allOrdersRes.success) {
      failedEndpoints.push(`Orders (${allOrdersRes.error || 'API error'})`);
    }

    if (tablesRes.success && Array.isArray(tablesRes.data)) {
      anySuccess = true;
      const mappedTables = tablesRes.data.map((rawTbl: any) => {
        const tableObj = mapTable(rawTbl);
        const rawNum = String(rawTbl?.tableNumber ?? rawTbl?.name ?? rawTbl?._id ?? '').toLowerCase();
        const activeOrdersForTable = mappedOrders.filter((o: Order) => {
          const orderTableClean = String(o.table || '').replace(/^table\s+/i, '').toLowerCase().trim();
          const tableObjClean = String(tableObj.name || '').replace(/^table\s+/i, '').toLowerCase().trim();
          const matches =
            orderTableClean === rawNum ||
            orderTableClean === tableObjClean ||
            String(o.table || '').toLowerCase().trim() === String(tableObj.id || '').toLowerCase().trim();
          const isActive = ['Pending', 'Preparing', 'Ready', 'Served'].includes(o.status);
          return matches && isActive;
        });
        const calculatedBill = activeOrdersForTable.reduce((acc: number, order: Order) => acc + (Number(order.total) || 0), 0);
        const effectiveStatus = (activeOrdersForTable.length === 0 && tableObj.status === 'Occupied') ? 'Available' : tableObj.status;
        return {
          ...tableObj,
          status: effectiveStatus,
          currentBill: calculatedBill > 0 ? calculatedBill : 0,
          action: effectiveStatus === 'Available' ? 'Order' : tableObj.action,
        };
      });
      staffStore.setTables(mappedTables);
    } else if (!tablesRes.success) {
      failedEndpoints.push(`Tables (${tablesRes.error || 'API error'})`);
    }

    if (menuRes.success && Array.isArray(menuRes.data)) {
      anySuccess = true;
      staffStore.setMenuItems(menuRes.data.map(mapMenuItem));
    } else if (!menuRes.success) {
      failedEndpoints.push(`Menu Items (${menuRes.error || 'API error'})`);
    }

    if (alertsRes.success && Array.isArray(alertsRes.data)) {
      anySuccess = true;
      staffStore.setAlerts(alertsRes.data.map(mapAlert));
    } else if (!alertsRes.success) {
      failedEndpoints.push(`Notifications (${alertsRes.error || 'API error'})`);
    }

    if (failedEndpoints.length > 0) {
      const errorMsg = `Unable to fetch live backend data: ${failedEndpoints.join('; ')}`;
      console.warn(`[Staff API Sync Warning]: ${errorMsg}`);
      staffStore.setApiError(errorMsg);
    } else {
      staffStore.setApiError(null);
    }

    if (anySuccess) {
      staffStore.setHasSyncedWithBackend(true);
    }
  } catch (err) {
    const errorString = err instanceof Error ? err.message : 'Connection failed';
    console.error('Unable to refresh staff data', err);
    staffStore.setApiError(`Backend Connection Error: ${errorString}`);
  } finally {
    staffStore.setLoading(false);
    refreshInProgress = false;
    if (queuedRefresh) {
      queuedRefresh = false;
      scheduleRefresh();
    }
  }
};

export function useStaffDashboard() {
  const [orders, setOrdersState] = useState(() => staffStore.orders);
  const [readyItems, setReadyItemsState] = useState(() => staffStore.readyItems);
  const [requests, setRequestsState] = useState(() => staffStore.requests);
  const [alerts, setAlertsState] = useState(() => staffStore.alerts);
  const [tables, setTablesState] = useState(() => staffStore.tables);
  const [reservations, setReservationsState] = useState(() => staffStore.reservations);
  const [menuItems, setMenuItemsState] = useState(() => staffStore.menuItems);
  const [loading, setLoadingState] = useState(() => staffStore.loading);
  const [error, setErrorState] = useState(() => staffStore.apiError);

  useEffect(() => {
    const unsubscribe = staffStore.subscribe(() => {
      setOrdersState(staffStore.orders);
      setReadyItemsState(staffStore.readyItems);
      setRequestsState(staffStore.requests);
      setAlertsState(staffStore.alerts);
      setTablesState(staffStore.tables);
      setReservationsState(staffStore.reservations);
      setMenuItemsState(staffStore.menuItems);
      setLoadingState(staffStore.loading);
      setErrorState(staffStore.apiError);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshDashboard();

    // 5-second interval poll to ensure ready food notifications arrive in real time even without websockets
    const pollInterval = setInterval(() => {
      scheduleRefresh();
    }, 5000);

    connectSocket();
    const socket = getSocket();
    if (socket) {
      const handleSync = () => {
        scheduleRefresh();
      };
      socket.on('table.status.changed', handleSync);
      socket.on('table.cleaned', handleSync);
      socket.on('cleaning.completed', handleSync);
      socket.on('cleaning.started', handleSync);
      socket.on('cleaning.task.created', handleSync);
      socket.on('staff.table.waiter_assigned', handleSync);
      socket.on('queue.notified', handleSync);
      socket.on('staff.ticket.created', handleSync);
      socket.on('order.created', handleSync);
      socket.on('order.updated', handleSync);
      socket.on('order.ready', handleSync);
      socket.on('ORDER_READY', handleSync);
      socket.on('order_ready', handleSync);
      socket.on('food.ready', handleSync);
      socket.on('order.served', handleSync);
      socket.on('staff:request-new', handleSync);
      socket.on('staff:request-updated', handleSync);
      socket.on('bill.requested', handleSync);
      socket.on('bill.paid', handleSync);
      socket.on('notification:new', handleSync);

      return () => {
        clearInterval(pollInterval);
        socket.off('table.status.changed', handleSync);
        socket.off('table.cleaned', handleSync);
        socket.off('cleaning.completed', handleSync);
        socket.off('cleaning.started', handleSync);
        socket.off('cleaning.task.created', handleSync);
        socket.off('staff.table.waiter_assigned', handleSync);
        socket.off('queue.notified', handleSync);
        socket.off('staff.ticket.created', handleSync);
        socket.off('order.created', handleSync);
        socket.off('order.updated', handleSync);
        socket.off('order.ready', handleSync);
        socket.off('ORDER_READY', handleSync);
        socket.off('order_ready', handleSync);
        socket.off('food.ready', handleSync);
        socket.off('order.served', handleSync);
        socket.off('staff:request-new', handleSync);
        socket.off('staff:request-updated', handleSync);
        socket.off('bill.requested', handleSync);
        socket.off('bill.paid', handleSync);
        socket.off('notification:new', handleSync);
      };
    }

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  return {
    orders,
    readyItems,
    requests,
    alerts,
    tables,
    reservations,
    menuItems,
    loading,
    error,
    refreshDashboard,
    setOrders: (newOrders: Order[] | ((prev: Order[]) => Order[])) => staffStore.setOrders(newOrders),
    setReadyItems: (newReadyItems: ReadyItem[] | ((prev: ReadyItem[]) => ReadyItem[])) => staffStore.setReadyItems(newReadyItems),
    setRequests: (newRequests: RequestItem[] | ((prev: RequestItem[]) => RequestItem[])) => staffStore.setRequests(newRequests),
    setAlerts: (newAlerts: AlertItem[] | ((prev: AlertItem[]) => AlertItem[])) => staffStore.setAlerts(newAlerts),
    setTables: (newTables: StaffTable[] | ((prev: StaffTable[]) => StaffTable[])) => staffStore.setTables(newTables),
    setReservations: (newReservations: StaffReservation[] | ((prev: StaffReservation[]) => StaffReservation[])) => staffStore.setReservations(newReservations),
    setMenuItems: (newMenuItems: MenuItem[] | ((prev: MenuItem[]) => MenuItem[])) => staffStore.setMenuItems(newMenuItems),
  };
}
