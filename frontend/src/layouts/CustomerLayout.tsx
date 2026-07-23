import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { CartProvider } from '../features/customer/components/dashboard/CartContext';
import { SearchProvider } from '../features/customer/components/dashboard/SearchContext';
import CustomerSidebar from '../features/customer/components/dashboard/CustomerSidebar';
import CustomerTopBar from '../features/customer/components/dashboard/CustomerTopBar';
import CustomerBottomNav from '../features/customer/components/dashboard/CustomerBottomNav';
import CartSidebar from '../features/customer/components/dashboard/CartSidebar';
import QRScannerModal from '../features/customer/components/dashboard/QRScannerModal';
import { useCustomerStore } from '../features/customer/store/customer.store';

import { getCustomerRouteAccessLevel, isValidDiningSession } from '../app/routeAccess';
import { useAuth } from '../auth/AuthProvider';
import { apiClient } from '../shared/services/apiClient';
import { connectSocket, getSocket } from '../lib/socket';
import { usePlatformSettingsGuard } from '../shared/hooks/usePlatformSettingsGuard';
import MaintenanceAlertModal from '../shared/components/MaintenanceAlertModal';


export default function CustomerLayout() {
  const { settings } = usePlatformSettingsGuard();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { diningSession, setDiningSession, checkSessionInactivity, tableCode, setTableCode } = useCustomerStore();
  const { signInAs } = useAuth();

  useEffect(() => {
    if (searchParams.get('scan') === 'true') {
      setScannerOpen(true);
      if (searchParams.get('expired') === 'true') {
        setToastMsg('Your dining session has ended. Please scan the QR code again.');
        setTimeout(() => setToastMsg(''), 4000);
      }
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('scan');
      newParams.delete('expired');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    document.title = settings?.platformName || 'RestoHub';
  }, [settings?.platformName]);

  // Inactivity check
  useEffect(() => {
    checkSessionInactivity();
    const interval = setInterval(() => {
      checkSessionInactivity();
    }, 15000);
    return () => clearInterval(interval);
  }, [checkSessionInactivity]);

  // Lightweight Safety Net for user activity
  useEffect(() => {
    const handleActivity = () => {
      const store = useCustomerStore.getState();
      if (store.diningSession && (Date.now() - (store.lastActivity || 0) > 60000)) {
        store.recordActivity();
      }
    };

    window.addEventListener('click', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, []);

  // Connect socket and listen to real-time events for customer session
  useEffect(() => {
    if (diningSession) {
      connectSocket();
      
      const store = useCustomerStore.getState();
      store.fetchOrders(); // Recover active orders on load/refresh

      const socket = getSocket();
      if (socket) {
        const handleOrderUpdate = (data: any) => {
          if (data && data.orderId && data.status) {
            useCustomerStore.getState().updateOrderStatusFromSocket(data.orderId, data.status);
          } else {
            useCustomerStore.getState().fetchOrders(); // Fallback if no specific payload
          }
        };

        const handleNewOrder = (data: any) => {
          // New order from REST is already handled there, but if we receive order.new via socket
          // without full order data, we could fetch, but for customers we shouldn't get this usually 
          // unless another device ordered for same table.
          useCustomerStore.getState().fetchOrders();
        };

        const handleReconnect = () => {
          useCustomerStore.getState().fetchOrders();
          useCustomerStore.getState().fetchLiveBill();
        };

        // Socket.io 'connect' fires on initial connect AND subsequent reconnects.
        // It provides robust recovery if the network drops.
        socket.on('connect', handleReconnect);
        socket.on('order.updated', handleOrderUpdate);
        socket.on('order.new', handleNewOrder);
        socket.on('payment.success', () => {
          useCustomerStore.getState().fetchOrders();
          useCustomerStore.getState().fetchLiveBill();
        });
        
        socket.on('order.accepted', (data: any) => {
          if (data?.order) useCustomerStore.getState().upsertOrderFromSocket(data.order);
          useCustomerStore.getState().addNotification(
            'Order Confirmed! 👨‍🍳',
            `Your order ${data.order?.orderNumber || 'has'} been confirmed.`,
            'order'
          );
        });

        socket.on('order.preparing', (data: any) => {
          if (data?.order) useCustomerStore.getState().upsertOrderFromSocket(data.order);
          useCustomerStore.getState().addNotification(
            'Preparing Food! 🍳',
            `Chef has started cooking your order ${data.order?.orderNumber || ''}.`,
            'order'
          );
        });

        socket.on('order.ready', (data: any) => {
          if (data?.order) useCustomerStore.getState().upsertOrderFromSocket(data.order);
          useCustomerStore.getState().addNotification(
            'Order Ready! 🛎️',
            `Your food for order ${data.order?.orderNumber || ''} is ready for pickup!`,
            'order'
          );
        });

        socket.on('order.serving', (data: any) => {
          if (data?.order) useCustomerStore.getState().upsertOrderFromSocket(data.order);
          useCustomerStore.getState().addNotification(
            'Serving Food! 🏃‍♂️',
            `Staff is serving your order ${data.order?.orderNumber || ''}.`,
            'order'
          );
        });

        socket.on('order.served', (data: any) => {
          if (data?.order) useCustomerStore.getState().upsertOrderFromSocket(data.order);
          useCustomerStore.getState().addNotification(
            'Order Served! 🍽️',
            `Your order ${data.order?.orderNumber || ''} has been served! Enjoy your meal!`,
            'order'
          );
        });

        socket.on('order.completed', (data: any) => {
          if (data?.order) useCustomerStore.getState().upsertOrderFromSocket(data.order);
        });

        socket.on('order.rejected', (data: any) => {
          if (data?.order) useCustomerStore.getState().upsertOrderFromSocket(data.order);
          useCustomerStore.getState().addNotification(
            'Order Rejected ❌',
            `Your order ${data.order?.orderNumber || ''} was rejected: ${data.reason}`,
            'order'
          );
        });

        socket.on('staff.request.accepted', (data: any) => {
          useCustomerStore.getState().addNotification(
            'Waiter Assisted 🙋‍♂️',
            `Staff has accepted your request and is on the way!`,
            'info'
          );
        });

        socket.on('staff.request.completed', (data: any) => {
          useCustomerStore.getState().addNotification(
            'Request Completed ✅',
            `Your service request has been fulfilled by staff.`,
            'info'
          );
        });

        socket.on('table.session.expired', () => {
          useCustomerStore.getState().addNotification(
            'Session Expired ⏰',
            `Your session has expired due to inactivity.`,
            'info'
          );
          useCustomerStore.getState().setDiningSession(null);
        });

        socket.on('table.session.closed', () => {
          useCustomerStore.getState().setDiningSession(null);
        });

        return () => {
          socket.off('connect', handleReconnect);
          socket.off('order.updated', handleOrderUpdate);
          socket.off('order.new', handleOrderUpdate);
          socket.off('payment.success');
          socket.off('order.accepted');
          socket.off('order.preparing');
          socket.off('order.ready');
          socket.off('order.serving');
          socket.off('order.served');
          socket.off('order.completed');
          socket.off('order.rejected');
          socket.off('staff.request.accepted');
          socket.off('staff.request.completed');
          socket.off('table.session.expired');
          socket.off('table.session.closed');
        };
      }
    }
  }, [diningSession]);

  // Init session from URL token parameter (Google Lens / scanned URL)
  useEffect(() => {
    const rawToken =
      searchParams.get('qr_token') ||
      searchParams.get('table_token') ||
      searchParams.get('qr') ||
      searchParams.get('table') ||
      searchParams.get('tableId') ||
      sessionStorage.getItem('pending_qr_token');

    if (rawToken) {
      const initSession = async () => {
        try {
          const res = await apiClient.post('/public/table-session/init', { token: rawToken });
          const data = res.data?.data || res.data;

          if (data && data.sessionToken) {
            const tableNo = data.session?.table?.table_no || 'T01';
            setDiningSession({
              sessionId: data.session?.session_id || '',
              restaurantId: data.session?.restaurant?.id || '',
              restaurantName: data.session?.restaurant?.name || 'Amber Table',
              tableId: data.session?.table?.id || '',
              tableNumber: tableNo,
              customerName: 'Guest',
              sessionToken: data.sessionToken,
              expiresAt: data.session?.expires_at || '',
              status: 'ACTIVE',
            });
            setTableCode(tableNo);
          } else {
            // Fallback for demo table code if backend token init doesn't return sessionToken
            const fallbackTable = rawToken.length < 5 ? (rawToken.startsWith('T') ? rawToken : `T${rawToken.padStart(2, '0')}`) : 'T01';
            setDiningSession({
              sessionId: `demo-${Date.now()}`,
              restaurantId: 'demo-rest',
              restaurantName: 'Amber Table',
              tableId: `table-${fallbackTable}`,
              tableNumber: fallbackTable,
              customerName: 'Guest',
              sessionToken: `demo-session-${Date.now()}`,
              expiresAt: new Date(Date.now() + 7200000).toISOString(),
              status: 'ACTIVE',
            });
            setTableCode(fallbackTable);
          }
        } catch (err: any) {
          // Fallback if backend API call fails or table token is demo
          const fallbackTable = rawToken.length < 5 ? (rawToken.startsWith('T') ? rawToken : `T${rawToken.padStart(2, '0')}`) : 'T01';
          setDiningSession({
            sessionId: `demo-${Date.now()}`,
            restaurantId: 'demo-rest',
            restaurantName: 'Amber Table',
            tableId: `table-${fallbackTable}`,
            tableNumber: fallbackTable,
            customerName: 'Guest',
            sessionToken: `demo-session-${Date.now()}`,
            expiresAt: new Date(Date.now() + 7200000).toISOString(),
            status: 'ACTIVE',
          });
          setTableCode(fallbackTable);
        } finally {
          sessionStorage.removeItem('pending_qr_token');
          // Clean all token query params from URL
          const newParams = new URLSearchParams(searchParams);
          ['qr_token', 'table_token', 'qr', 'table', 'tableId'].forEach((p) => newParams.delete(p));
          setSearchParams(newParams, { replace: true });
        }
      };
      initSession();
    }
  }, [searchParams, setDiningSession, setTableCode, setSearchParams]);

  // Show cart panel only on home/menu pages
  const showCartPanel = ['/customer/home', '/customer/menu', '/customer'].some((p) =>
    location.pathname === p || location.pathname.startsWith(p + '/')
  );
  const cartVisible =
    showCartPanel &&
    !location.pathname.includes('/checkout') &&
    !location.pathname.includes('/orders') &&
    !location.pathname.includes('/reservations') &&
    !location.pathname.includes('/feedback') &&
    !location.pathname.includes('/profile');

  useEffect(() => {
    if (!cartVisible) {
      setCartOpen(false);
    }
  }, [location.pathname, cartVisible]);

  const accessLevel = getCustomerRouteAccessLevel(location.pathname);

  const extractQrToken = (scannedText: string): string => {
    if (!scannedText) return '';
    const text = scannedText.trim();
    if (text.includes('qr_token=')) {
      const match = text.match(/qr_token=([^&/#]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    if (text.startsWith('http://') || text.startsWith('https://')) {
      try {
        const url = new URL(text);
        const token = url.searchParams.get('qr_token');
        if (token) return token;
      } catch (e) {
        // ignore
      }
    }
    return text;
  };

  const handleScanSuccess = async (scannedData: string) => {
    setScannerOpen(false);
    const token = extractQrToken(scannedData);

    if (!token) {
      setToastMsg('❌ Invalid QR code scanned');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }

    setToastMsg('⏳ Verifying QR token & starting session...');

    try {
      const res = await apiClient.post('/public/table-session/init', { token });
      const data = res.data?.data || res.data;

      if (data && data.sessionToken) {
        setDiningSession({
          sessionId: data.session?.session_id || '',
          restaurantId: data.session?.restaurant?.id || '',
          restaurantName: data.session?.restaurant?.name || 'Restaurant',
          tableId: data.session?.table?.id || '',
          tableNumber: data.session?.table?.table_no || 'Unknown Table',
          customerName: 'Guest',
          sessionToken: data.sessionToken,
          expiresAt: data.session?.expires_at || '',
          status: 'ACTIVE',
        });

        // Removed fake JWT login: signInAs('customer')
        setToastMsg(`✅ Connected to Table ${data.session?.table?.table_no || ''}!`);
        navigate('/customer/menu');
      } else {
        setToastMsg('❌ Invalid or expired QR token');
      }
    } catch (err: any) {
      console.error('Failed to initialize session from QR scan:', err);
      const errMsg = err.response?.data?.message || 'Invalid or expired QR token';
      setToastMsg(`❌ ${errMsg}`);
    } finally {
      setTimeout(() => setToastMsg(''), 4000);
    }
  };

  return (
    <CartProvider>
      <SearchProvider>
        <div className="flex h-screen overflow-hidden bg-sd-surface customer-panel">
          <CustomerSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            onOpenScanner={() => setScannerOpen(true)}
          />

          <div
            className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
              sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-64'
            }`}
          >
            <CustomerTopBar
              onToggleCart={() => setCartOpen(!cartOpen)}
              onOpenQRScanner={() => setScannerOpen(true)}
            />

            <main className="flex-1 overflow-hidden h-full">
              <Outlet />
            </main>
          </div>

          {!location.pathname.includes('/checkout') && (
            <CartSidebar
              isOpen={cartOpen}
              onClose={() => setCartOpen(!cartOpen)}
              isPersistent={cartVisible}
            />
          )}

          <CustomerBottomNav onOpenScanner={() => setScannerOpen(true)} />
          <QRScannerModal
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScanSuccess={handleScanSuccess}
          />

          {/* Maintenance Alert Modal overlay */}
          <MaintenanceAlertModal
            isOpen={!!settings?.disableCustomerPanel}
            title="Customer Ordering Disabled"
            message="Due to temporary platform maintenance, online menu and customer ordering services are currently disabled."
          />

          {toastMsg && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-sd-inverse-surface text-white px-6 py-3 rounded-2xl shadow-xl z-[100] animate-fadeIn font-sans text-sm font-semibold">
              {toastMsg}
            </div>
          )}
        </div>
      </SearchProvider>
    </CartProvider>
  );
}
