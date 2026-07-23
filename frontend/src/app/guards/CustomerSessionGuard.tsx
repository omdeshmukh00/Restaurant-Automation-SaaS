import React, { useState } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { useCustomerStore } from '../../features/customer/store/customer.store';
import { isValidDiningSession } from '../routeAccess';
import { apiClient } from '../../shared/services/apiClient';

export function CustomerSessionGuard() {
  const { diningSession, setDiningSession, setTableCode } = useCustomerStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [manualToken, setManualToken] = useState('');
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  if (isValidDiningSession(diningSession)) {
    return <Outlet />;
  }

  // Handle manual token submission directly here to encapsulate logic
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    setLoadingSession(true);
    setSessionError(null);
    try {
      const res = await apiClient.post('/public/table-session/init', { token: manualToken.trim() });
      const data = res.data?.data || res.data;

      if (data && data.sessionToken) {
        const tableNo = data.session?.table?.table_no || 'T01';
        setDiningSession({
          sessionId: data.session?.session_id || '',
          restaurantId: data.session?.restaurant?.id || '',
          restaurantName: data.session?.restaurant?.name || 'Restaurant',
          tableId: data.session?.table?.id || '',
          tableNumber: tableNo,
          customerName: 'Guest',
          sessionToken: data.sessionToken,
          expiresAt: data.session?.expires_at || '',
          status: 'ACTIVE',
        });
        setTableCode(tableNo);
      } else {
        setSessionError('Invalid or expired token.');
      }
    } catch (err: any) {
      setSessionError(err.response?.data?.message || 'Failed to initialize session.');
    } finally {
      setLoadingSession(false);
    }
  };

  return (
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
          <form onSubmit={handleManualSubmit} className="space-y-4">
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
  );
}
