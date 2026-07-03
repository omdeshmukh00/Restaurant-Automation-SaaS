// src/features/staff/hooks/useStaffDashboard.ts

import { useState, useEffect } from 'react';
import { staffStore, type Order, type ReadyItem, type RequestItem, type AlertItem, type StaffTable, type StaffReservation, type MenuItem } from '../store/staff.store';

export function useStaffDashboard() {
  const [orders, setOrdersState] = useState(() => staffStore.orders);
  const [readyItems, setReadyItemsState] = useState(() => staffStore.readyItems);
  const [requests, setRequestsState] = useState(() => staffStore.requests);
  const [alerts, setAlertsState] = useState(() => staffStore.alerts);
  const [tables, setTablesState] = useState(() => staffStore.tables);
  const [reservations, setReservationsState] = useState(() => staffStore.reservations);
  const [menuItems, setMenuItemsState] = useState(() => staffStore.menuItems);

  useEffect(() => {
    const unsubscribe = staffStore.subscribe(() => {
      setOrdersState(staffStore.orders);
      setReadyItemsState(staffStore.readyItems);
      setRequestsState(staffStore.requests);
      setAlertsState(staffStore.alerts);
      setTablesState(staffStore.tables);
      setReservationsState(staffStore.reservations);
      setMenuItemsState(staffStore.menuItems);
    });
    return () => {
      unsubscribe();
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
    setOrders: (newOrders: Order[] | ((prev: Order[]) => Order[])) => staffStore.setOrders(newOrders),
    setReadyItems: (newReadyItems: ReadyItem[] | ((prev: ReadyItem[]) => ReadyItem[])) => staffStore.setReadyItems(newReadyItems),
    setRequests: (newRequests: RequestItem[] | ((prev: RequestItem[]) => RequestItem[])) => staffStore.setRequests(newRequests),
    setAlerts: (newAlerts: AlertItem[] | ((prev: AlertItem[]) => AlertItem[])) => staffStore.setAlerts(newAlerts),
    setTables: (newTables: StaffTable[] | ((prev: StaffTable[]) => StaffTable[])) => staffStore.setTables(newTables),
    setReservations: (newReservations: StaffReservation[] | ((prev: StaffReservation[]) => StaffReservation[])) => staffStore.setReservations(newReservations),
    setMenuItems: (newMenuItems: MenuItem[] | ((prev: MenuItem[]) => MenuItem[])) => staffStore.setMenuItems(newMenuItems),
  };
}
