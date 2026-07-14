import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, ShoppingBag, Users, Clock } from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import { RecentOrdersTable } from '../components/dashboard/RecentOrdersTable';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { TableOverview } from '../components/dashboard/TableOverview';
import { TopMenuItems } from '../components/dashboard/TopMenuItems';
import { connectSocket, getSocket } from '../../../lib/socket';
import { useTablesStore } from '../store/tables.store';
import { apiClient } from '../../../shared/services/apiClient';
import { UsageMeter } from '../components/dashboard/UsageMeter';
import { UpgradePrompt } from '../components/dashboard/UpgradePrompt';

const AdminDashboard = () => {
  const { restaurant, fetchOverview } = useOutletContext<{ restaurant: any; fetchOverview: () => Promise<void> }>();
  const [usageData, setUsageData] = useState<any>(null);

  const fetchUsageData = async () => {
    try {
      const res = await apiClient.get('/subscriptions/usage-dashboard');
      if (res.data) {
        setUsageData(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch usage data', error);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, []);

  useEffect(() => {
    // Only connect socket and setup listeners if restaurant is active
    if (restaurant && restaurant.status === 'ACTIVE') {
      connectSocket();
      useTablesStore.getState().fetchTables();

      const interval = setInterval(() => {
        const socket = getSocket();
        if (!socket || !socket.connected) {
          useTablesStore.getState().fetchTables();
        }
      }, 15000);

      const socket = getSocket();
      if (socket) {
        const handleSync = () => {
          useTablesStore.getState().fetchTables();
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

        return () => {
          clearInterval(interval);
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
        };
      }

      return () => clearInterval(interval);
    }
  }, [restaurant]);

  // We don't render OnboardingWizard inline anymore as it is managed as a full-screen overlay in AdminLayout.tsx

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{`Welcome back, ${restaurant?.ownerName || 'Admin'}! Here's what's happening today.`}</p>
      </div>

      {usageData && (
        <UpgradePrompt status={usageData.status} quotas={usageData.quotas} />
      )}

      {/* Stat cards — 2 cols on mobile, 4 on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Revenue"     value="₹48,200" change="+12% from yesterday" changeType="increase" icon={TrendingUp} iconBg="bg-orange-50" iconColor="text-orange-500" />
        <StatCard title="Orders Today"      value="142"     change="+8 in last hour"     changeType="increase" icon={ShoppingBag} iconBg="bg-blue-50"   iconColor="text-blue-500"   />
        <StatCard title="Active Customers"  value="67"      change="12 tables occupied"  changeType="neutral"  icon={Users}      iconBg="bg-green-50"  iconColor="text-green-500"  />
        <StatCard title="Avg Order Time"    value="18 min"  change="-2 min vs last week" changeType="increase" icon={Clock}      iconBg="bg-purple-50" iconColor="text-purple-500" />
      </div>

      {usageData && (
        <UsageMeter planName={usageData.planName} quotas={usageData.quotas} />
      )}

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