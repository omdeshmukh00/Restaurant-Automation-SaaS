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
  
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');

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
        setLoadingSession(true);
        setSessionError(null);
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
          setLoadingSession(false);
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
  const requiresSession = accessLevel === 'SESSION';

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

    setLoadingSession(true);
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
      setLoadingSession(false);
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
              {!isValidDiningSession(diningSession) && requiresSession ? (
                <div className="h-full w-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4 relative overflow-hidden">
                  <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl" />
                  <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />

                  <div className="max-w-md w-full bg-white dark:bg-zinc-900/80 backdrop-blur-md border border-slate-100 dark:border-zinc-800 rounded-3xl p-8 shadow-xl text-center relative z-10">
                    <div className="mb-6 relative mx-auto w-32 h-32 bg-orange-50 dark:bg-orange-950/20 rounded-2xl flex items-center justify-center border border-orange-100 dark:border-orange-900/30 overflow-hidden">
                      <span className="material-symbols-outlined text-[64px] text-orange-500 animate-pulse">qr_code_scanner</span>
                      <div className="absolute left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,1)] animate-[scan_2s_ease-in-out_infinite]" />
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 mb-2 font-sans">Scan Table QR</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6 font-sans">
                      Please scan the QR code located on your table to initialize your dining session. This will allow you to browse our menu, place orders directly, and request table service.
                    </p>

                    {sessionError && (
                      <div className="text-red-500 dark:text-red-400 text-sm font-medium bg-red-50 dark:bg-red-950/20 px-4 py-3 rounded-2xl border border-red-100 dark:border-red-900/30 mb-6 font-sans">
                        {sessionError}
                      </div>
                    )}

                    {loadingSession ? (
                      <div className="flex flex-col items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-2" />
                        <p className="text-xs text-slate-400 dark:text-zinc-500 font-sans">Verifying table session...</p>
                      </div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (manualToken.trim()) {
                            setSearchParams({ qr_token: manualToken.trim() });
                          }
                        }}
                        className="space-y-4"
                      >
                        <div className="flex flex-col items-stretch text-left">
                          <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider font-sans">
                            Enter Token or Table ID
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="e.g. t1-token"
                              value={manualToken}
                              onChange={(e) => setManualToken(e.target.value)}
                              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-orange-500 text-sm font-sans"
                            />
                            <button
                              type="submit"
                              className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold transition-colors text-sm font-sans flex items-center justify-center"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                  <style dangerouslySetInnerHTML={{__html: `
                    @keyframes scan {
                      0%, 100% { top: 10%; }
                      50% { top: 90%; }
                    }
                  `}} />
                </div>
              ) : (
                <Outlet />
              )}
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
