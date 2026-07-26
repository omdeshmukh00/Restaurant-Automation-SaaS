import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';

import { StaffSearchProvider } from '../features/staff/components/dashboard/StaffSearchContext';
import StaffSidebar from '../features/staff/components/dashboard/StaffSidebar';
import StaffTopBar from '../features/staff/components/dashboard/StaffTopBar';
import StaffBottomNav from '../features/staff/components/dashboard/StaffBottomNav';
import { NotificationWindow } from '../features/staff/components/NotificationWindow';
import { getRolePermissions, isPathAllowed } from '../features/staff/utils/roleAccess';
import { useStaffProfile } from '../features/staff/hooks/useStaffProfile';
import { getSocket } from '../lib/socket';
import { staffStore } from '../features/staff/store/staff.store';
import { usePlatformSettingsGuard } from '../shared/hooks/usePlatformSettingsGuard';
import MaintenanceAlertModal from '../shared/components/MaintenanceAlertModal';
import { refreshDashboard, scheduleRefresh } from '../features/staff/hooks/useStaffDashboard';

import { getStoredUser } from '../auth/tokenStore';
import { mapBackendRoleToStaffRole } from '../features/staff/api/staff.api';

export default function StaffLayout(): JSX.Element {
  const { settings } = usePlatformSettingsGuard();
  const { profile } = useStaffProfile();
  const location = useLocation();

  const storedStaffUser = getStoredUser('staff');
  const rawRole = storedStaffUser
    ? (storedStaffUser as any).internal_role || (storedStaffUser as any).staff_role || (storedStaffUser as any).staffRole || storedStaffUser.role
    : null;
  const effectiveRole = profile.role && profile.role !== 'Senior Waiter'
    ? profile.role
    : rawRole
    ? mapBackendRoleToStaffRole(storedStaffUser?.role, rawRole)
    : profile.role || 'Floor Supervisor';

  const allowedPaths = getRolePermissions(effectiveRole);
  const isAllowed = isPathAllowed(effectiveRole, location.pathname);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('staff-sidebar-collapsed');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => {
      setSidebarCollapsed(prev => !prev);
    };
    window.addEventListener('toggle-staff-sidebar', handleToggle);
    return () => {
      window.removeEventListener('toggle-staff-sidebar', handleToggle);
    };
  }, []);

  useEffect(() => {
    // Socket connection is handled by SocketProvider at the app root.
    // This layout only attaches listeners to the existing socket.

    const playNotificationSound = () => {
      try {
        const audioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtx) return;
        const audioContext = new audioCtx();

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);

        setTimeout(() => {
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);

          oscillator2.type = 'sine';
          oscillator2.frequency.setValueAtTime(880, audioContext.currentTime);
          gainNode2.gain.setValueAtTime(0.08, audioContext.currentTime);
          oscillator2.start();
          oscillator2.stop(audioContext.currentTime + 0.2);
        }, 120);
      } catch (e) {
        console.error('Audio play failed', e);
      }
    };

    // Load initial data
    void refreshDashboard();

    // Set polling fallback (only if socket is not connected)
    const interval = setInterval(() => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        scheduleRefresh();
      }
    }, 15000);

    // Set up Socket listeners
    const socket = getSocket();
    if (socket) {
      socket.on('staff:request-new', () => {
        playNotificationSound();
        scheduleRefresh();
      });

      socket.on('order.ready', () => {
        playNotificationSound();
        scheduleRefresh();
      });

      socket.on('table.session.created', scheduleRefresh);
      socket.on('table.status.changed', scheduleRefresh);
      socket.on('bill.requested', scheduleRefresh);
      socket.on('bill.paid', scheduleRefresh);
      socket.on('order.created', scheduleRefresh);
      socket.on('order.updated', scheduleRefresh);

      socket.on('cleaning.completed', scheduleRefresh);
      socket.on('cleaning.started', scheduleRefresh);
      socket.on('cleaning.task.created', scheduleRefresh);
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('staff:request-new');
        socket.off('order.ready');
        socket.off('table.session.created');
        socket.off('table.status.changed');
        socket.off('bill.requested');
        socket.off('bill.paid');
        socket.off('order.created');
        socket.off('order.updated');

        socket.off('cleaning.completed');
        socket.off('cleaning.started');
        socket.off('cleaning.task.created');
      }
    };
  }, []);

  if (!isAllowed && allowedPaths.length > 0) {
    return <Navigate to={allowedPaths[0]} replace />;
  }
  return (
    <StaffSearchProvider>
      <div className="flex h-screen max-h-screen overflow-hidden bg-sd-surface text-sd-on-surface font-sans staff-panel w-full">
        {/* Sidebar */}
        <StaffSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            localStorage.setItem('staff-sidebar-collapsed', String(next));
          }}
          onItemClick={() => {
            if (window.innerWidth < 1024) {
              setSidebarCollapsed(true);
              localStorage.setItem('staff-sidebar-collapsed', 'true');
            }
          }}
        />

        {/* Mobile Backdrop when Sidebar is expanded */}
        {!sidebarCollapsed && (
          <button
            className="lg:hidden fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-40 w-full h-full border-none outline-none cursor-default"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Close sidebar"
          />
        )}

        {/* Main Area */}
        <div
          className={`flex-1 flex flex-col h-full min-w-0 transition-all duration-300 ml-0 ${
            sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
          }`}
        >
          <StaffTopBar />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
            <Outlet />
          </main>
        </div>

        {/* Mobile Bottom Nav */}
        <StaffBottomNav />
      </div>

      {/* Maintenance Alert Modal overlay */}
      <MaintenanceAlertModal
        isOpen={!!settings?.disableStaffPanel}
        title="Staff Panel Disabled"
        message="Due to temporary platform maintenance, the Staff Panel is currently disabled."
      />
    </StaffSearchProvider>
  );
}