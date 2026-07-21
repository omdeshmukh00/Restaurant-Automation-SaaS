import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';

import { StaffSearchProvider } from '../features/staff/components/dashboard/StaffSearchContext';
import StaffSidebar from '../features/staff/components/dashboard/StaffSidebar';
import StaffTopBar from '../features/staff/components/dashboard/StaffTopBar';
import { NotificationWindow } from '../features/staff/components/NotificationWindow';
import { useStaffProfile } from '../features/staff/hooks/useStaffProfile';
import { getRolePermissions } from '../features/staff/utils/roleAccess';
import { connectSocket, getSocket } from '../lib/socket';
import { staffStore } from '../features/staff/store/staff.store';
import { usePlatformSettingsGuard } from '../shared/hooks/usePlatformSettingsGuard';
import MaintenanceAlertModal from '../shared/components/MaintenanceAlertModal';
import { refreshDashboard, scheduleRefresh } from '../features/staff/hooks/useStaffDashboard';

export default function StaffLayout(): JSX.Element {
  const { settings } = usePlatformSettingsGuard();
  const { profile } = useStaffProfile();
  const location = useLocation();

  const allowedPaths = getRolePermissions(profile.role);
  const currentPath = location.pathname.replace(/\/$/, '');

  const isAllowed = allowedPaths.includes(currentPath);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('staff-sidebar-collapsed');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  useEffect(() => {
    // 1. Establish Socket Connection
    connectSocket();

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
      }
    };
  }, []);

  if (!isAllowed && allowedPaths.length > 0) {
    return <Navigate to={allowedPaths[0]} replace />;
  }
  return (
    <StaffSearchProvider>
      <div className="flex min-h-screen bg-sd-surface text-sd-on-surface font-sans staff-panel">
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
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
            sidebarCollapsed ? 'ml-[72px]' : 'ml-[72px] lg:ml-64'
          }`}
        >
          <StaffTopBar onNotificationClick={() => setIsNotificationOpen(true)} />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>

      <NotificationWindow
        open={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        theme={{
          cardBg: '#1e293b', // slate-800
          cardBorder: '#334155', // slate-700
          miniCardBg: '#0f172a', // slate-900
          textPrimary: '#ffffff',
          textSecondary: '#cbd5e1', // slate-300
          textMuted: '#94a3b8', // slate-400
          font: 'sans-serif'
        }}
      />

      {/* Maintenance Alert Modal overlay */}
      <MaintenanceAlertModal
        isOpen={!!settings?.disableStaffPanel}
        title="Staff Panel Disabled"
        message="Due to temporary platform maintenance, the Staff Panel is currently disabled."
      />
    </StaffSearchProvider>
  );
}