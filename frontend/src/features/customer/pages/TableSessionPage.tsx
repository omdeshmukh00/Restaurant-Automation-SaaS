// src/features/customer/pages/TableSessionPage.tsx
// Entry point for QR code scans — reads ?token= from URL, calls the
// backend to initialize (or rejoin) a table session, stores the session
// token in localStorage, and redirects to the customer menu.

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient, setSessionToken } from '../../../shared/services/apiClient';
import { useAuth } from '../../../auth/AuthProvider';

type InitResponse = {
  success: true;
  data: {
    sessionId: string;
    restaurantId: string;
    tableId: string;
    tableNumber: string;
    sessionToken: string;
    expiresAt: string;
    status: string;
  };
};

export default function TableSessionPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isPanelAuthenticated } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('Invalid QR code — no token found in URL.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function initSession() {
      try {
        const { data } = await apiClient.post<InitResponse>(
          '/public/table-session/init',
          { token },
        );

        if (cancelled) return;

        const sessionToken = data.data.sessionToken;
        const restaurantId = data.data.restaurantId;
        const tableNumber = data.data.tableNumber;

        // Persist session info in localStorage
        setSessionToken(sessionToken);
        localStorage.setItem('ra/session-restaurant-id', restaurantId);
        localStorage.setItem('ra/session-table', tableNumber);

        // Redirect to customer menu
        navigate('/customer/menu', { replace: true });
      } catch (err: any) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : 'Failed to initialize session');
        setLoading(false);
      }
    }

    initSession();

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, isPanelAuthenticated, retryCount]);

  // ── Loading state ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-6">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-orange-500/30 border-t-orange-500 animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">Setting up your table…</h2>
          <p className="mt-2 text-sm text-slate-400">
            We're connecting you to the restaurant. Just a moment.
          </p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-6 px-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-red-400">error</span>
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold">Session Error</h2>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">{error}</p>
        </div>
        <button
          onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1); }}
          className="mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return <></>;
}
