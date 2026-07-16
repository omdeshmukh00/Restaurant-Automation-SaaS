import React, { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { StatCard } from '../components/dashboard/StatCard';
import { RecentOrdersTable } from '../components/dashboard/RecentOrdersTable';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { TableOverview } from '../components/dashboard/TableOverview';
import { TopMenuItems } from '../components/dashboard/TopMenuItems';
import { connectSocket, getSocket } from '../../../lib/socket';
import { useTablesStore } from '../store/tables.store';
import { useDashboardStore } from '../store/dashboard.store';

const AdminDashboard = () => {
  const { restaurant, fetchOverview } = useOutletContext<{ restaurant: any; fetchOverview: () => Promise<void> }>();

  const statTiles = useDashboardStore((s) => s.statTiles);

  useEffect(() => {
    // Always load dashboard data — it works off the session's restaurantId,
    // independent of the restaurant.status (ACTIVE / PENDING / etc.).
    const bootstrap = async () => {
      await useTablesStore.getState().fetchTables();
      await useDashboardStore.getState().fetchDashboard();
    };
    bootstrap();

    const interval = setInterval(() => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        useTablesStore.getState().fetchTables();
      }
    }, 15000);
    const dashInterval = setInterval(() => {
      useDashboardStore.getState().fetchDashboard();
    }, 30000);

    // Only open the live socket / wire realtime listeners once the
    // restaurant is ACTIVE (live order + table events).
    if (restaurant && restaurant.status === 'ACTIVE') {
      connectSocket();

      const socket = getSocket();
      if (socket) {
        const handleSync = () => {
          useTablesStore.getState().fetchTables();
        };

        const handleDashboardSync = () => {
          useDashboardStore.getState().fetchDashboard();
        };

        socket.on('table.status.changed', handleSync);
        socket.on('table.session.created', handleSync);
        socket.on('table.session.closed', handleSync);
        socket.on('table.session.expired', handleSync);
        socket.on('order.created', handleSync);
        socket.on('order.updated', handleSync);
        socket.on('order.ready', handleSync);
        socket.on('bill.requested', handleSync);
        socket.on('bill.paid', handleSync);
        socket.on('cleaning.started', handleSync);
        socket.on('cleaning.completed', handleSync);
        socket.on('staff:request-new', handleSync);

        socket.on('order.created', handleDashboardSync);
        socket.on('order.updated', handleDashboardSync);
        socket.on('order.ready', handleDashboardSync);
        socket.on('bill.paid', handleDashboardSync);

        return () => {
          clearInterval(interval);
          clearInterval(dashInterval);

          socket.off('table.status.changed', handleSync);
          socket.off('table.session.created', handleSync);
          socket.off('table.session.closed', handleSync);
          socket.off('table.session.expired', handleSync);
          socket.off('order.created', handleSync);
          socket.off('order.updated', handleSync);
          socket.off('order.ready', handleSync);
          socket.off('bill.requested', handleSync);
          socket.off('bill.paid', handleSync);
          socket.off('cleaning.started', handleSync);
          socket.off('cleaning.completed', handleSync);
          socket.off('staff:request-new', handleSync);

          socket.off('order.created', handleDashboardSync);
          socket.off('order.updated', handleDashboardSync);
          socket.off('order.ready', handleDashboardSync);
          socket.off('bill.paid', handleDashboardSync);
        };
      }
    }

    return () => {
      clearInterval(interval);
      clearInterval(dashInterval);
    };
  }, [restaurant]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{`Welcome back, ${restaurant?.ownerName || 'Admin'}! Here's what's happening today.`}</p>
      </div>

      {/* Stat cards — 2 cols on mobile, 4 on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statTiles.map((tile) => (
          <StatCard
            key={tile.title}
            title={tile.title}
            value={tile.value}
            change={tile.change}
            changeType={tile.changeType}
            icon={tile.icon}
            iconBg={tile.iconBg}
            iconColor={tile.iconColor}
          />
        ))}
      </div>

      {/* Revenue chart + Activity feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
        <div className="xl:col-span-2"><RevenueChart /></div>
        <div><ActivityFeed /></div>
      </div>

      <TableOverview />

      {/* Recent orders + Top items */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
        <div className="xl:col-span-2"><RecentOrdersTable /></div>
        <div><TopMenuItems /></div>
      </div>
    </div>
  );
};

export default AdminDashboard;