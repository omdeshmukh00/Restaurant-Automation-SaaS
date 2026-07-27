import { create } from 'zustand';
import { superAdminRestaurantRequestsApi } from '../api/superAdmin.api';
import type { Transaction } from '../components/Transactions/Transactiontypes';

interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  lastFetchedAt: number | null;
  fetchTransactions: (force?: boolean) => Promise<void>;
}

let inFlightTxsPromise: Promise<void> | null = null;

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  loading: false,
  lastFetchedAt: null,

  fetchTransactions: async (force = false) => {
    const now = Date.now();
    const lastFetched = get().lastFetchedAt;
    if (!force && get().transactions.length > 0 && lastFetched && now - lastFetched < 60000) {
      return;
    }
    if (inFlightTxsPromise) {
      return inFlightTxsPromise;
    }

    if (get().transactions.length === 0) {
      set({ loading: true });
    }

    inFlightTxsPromise = (async () => {
      try {
        const txs = await superAdminRestaurantRequestsApi.getTransactions();
        set({ transactions: txs, lastFetchedAt: Date.now() });
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
      } finally {
        set({ loading: false });
        inFlightTxsPromise = null;
      }
    })();

    return inFlightTxsPromise;
  },
}));
