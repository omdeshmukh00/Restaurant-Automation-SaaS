import { create } from 'zustand';
import { apiClient } from '../../../shared/services/apiClient';
import type { UserItem } from '../components/Users/UserDetailModal';

interface UsersState {
  users: UserItem[];
  loading: boolean;
  lastFetchedAt: number | null;
  fetchUsers: (force?: boolean) => Promise<void>;
}

let inFlightUsersPromise: Promise<void> | null = null;

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  loading: false,
  lastFetchedAt: null,

  fetchUsers: async (force = false) => {
    const now = Date.now();
    const lastFetched = get().lastFetchedAt;
    if (!force && get().users.length > 0 && lastFetched && now - lastFetched < 60000) {
      return;
    }
    if (inFlightUsersPromise) {
      return inFlightUsersPromise;
    }

    if (get().users.length === 0) {
      set({ loading: true });
    }

    inFlightUsersPromise = (async () => {
      try {
        const res = await apiClient.get('/super-admin/users');
        const rawUsers = res.data?.data?.users || res.data?.users || [];
        set({ users: rawUsers, lastFetchedAt: Date.now() });
      } catch (err) {
        console.error('Failed to fetch platform users:', err);
      } finally {
        set({ loading: false });
        inFlightUsersPromise = null;
      }
    })();

    return inFlightUsersPromise;
  },
}));
