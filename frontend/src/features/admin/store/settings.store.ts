import { create } from 'zustand';
import { adminRestaurantApi } from '../api/admin.restaurants.api';
import { adminUserApi, type AdminProfile } from '../api/admin.users.api';
import { useStaffStore } from './staff.store';
import { apiClient } from '../../../shared/services/apiClient';
import { getStoredUser } from '../../../auth/tokenStore';

export interface AdminProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  mobile: string;
  avatar?: string;
}

export interface RestaurantInfoData {
  name: string;
  type: string;
  cuisine: string;
  phone: string;
  address: string;
  city: string;
  coverImage?: string;
}

export interface BillingData {
  plan: string;
  currency: string;
  cycle: string;
  nextBillingDate: string;
  amount: string;
  status?: string;
  paymentMethod: string;
}

export interface TeamData {
  totalMembers: number;
  managers: number;
  kitchenStaff: number;
  serviceStaff: number;
}

export interface NotificationPref {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: string;
}

export interface BankDetailsData {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branch?: string;
}

export interface TransactionRecord {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  billingCycle: string;
  paidAt?: string;
  createdAt: string;
  plan?: string;
}

export interface SettlementRecord {
  _id: string;
  grossSales: number;
  netSettlement: number;
  platformCommission: number;
  status: string;
  settlementPeriod: { from: string; to: string };
  paidAt?: string;
  settlementMethod?: string;
}

export interface SalaryRecord {
  _id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  amount: number;
  month: number;
  year: number;
  status: string;
  paymentMethod: string;
  paidAt?: string;
}

const STATIC_INTEGRATIONS: Integration[] = [
  {
    id: 'pos',
    name: 'POS System',
    description: 'Sync orders with your point-of-sale',
    icon: 'CreditCard',
    color: 'bg-indigo-50 text-indigo-600',
    status: 'Not connected',
  },
  {
    id: 'accounting',
    name: 'Accounting',
    description: 'Connect to accounting software',
    icon: 'PieChart',
    color: 'bg-emerald-50 text-emerald-600',
    status: 'Not connected',
  },
  {
    id: 'delivery',
    name: 'Delivery Partners',
    description: 'Integrate with delivery platforms',
    icon: 'Truck',
    color: 'bg-orange-50 text-orange-600',
    status: 'Not connected',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Email & SMS marketing tools',
    icon: 'Megaphone',
    color: 'bg-pink-50 text-pink-600',
    status: 'Not connected',
  },
];

interface SettingsState {
  loading: boolean;
  error: string | null;
  activeSection: string;
  admin: AdminProfileData;
  restaurant: RestaurantInfoData;
  billing: BillingData;
  team: TeamData;
  notifications: NotificationPref[];
  integrations: Integration[];
  editingRestaurant: boolean;
  saved: string | null;

  // Billing & Settlements
  bankDetails: BankDetailsData | null;
  transactions: TransactionRecord[];
  settlements: SettlementRecord[];
  settlementSummary: { pendingSettlements: number; completedSettlements: number; totalNetSettlement: number } | null;
  salaryHistory: SalaryRecord[];
  autoRenew: boolean;
  billingLoading: boolean;

  setActiveSection: (section: string) => void;
  setEditingRestaurant: (value: boolean) => void;
  clearSaved: () => void;
  fetchSettings: () => Promise<void>;
  updateProfile: (data: { name?: string; mobile?: string; avatar?: string }) => Promise<void>;
  updateRestaurantInfo: (data: Partial<RestaurantInfoData>) => Promise<void>;
  changePlan: (plan: string) => Promise<void>;
  toggleNotification: (id: string) => Promise<void>;
  toggleIntegration: (id: string) => Promise<void>;

  // Billing & Settlements actions
  fetchBillingData: () => Promise<void>;
  updateBankDetails: (data: BankDetailsData) => Promise<void>;
  toggleAutoRenew: (value: boolean) => Promise<void>;
  paySalary: (staffId: string, month: number, year: number, paymentMethod?: string) => Promise<void>;
  payAllSalaries: (month: number, year: number, paymentMethod?: string) => Promise<void>;
}

const initialIntegrationStatus = () =>
  STATIC_INTEGRATIONS.map((i) => ({ ...i, status: 'Not connected' }));

export const useSettingsStore = create<SettingsState>((set, get) => ({
  loading: false,
  error: null,
  activeSection: 'profile',
  admin: { id: '', name: '', email: '', role: '', mobile: '' },
  restaurant: { name: '', type: '', cuisine: '', phone: '', address: '', city: '' },
  billing: {
    plan: 'Free',
    currency: 'INR',
    cycle: '—',
    nextBillingDate: 'Not available',
    amount: '—',
    status: 'free',
    paymentMethod: 'Free',
  },
  bankDetails: null,
  transactions: [],
  settlements: [],
  settlementSummary: null,
  salaryHistory: [],
  autoRenew: true,
  billingLoading: false,
  team: { totalMembers: 0, managers: 0, kitchenStaff: 0, serviceStaff: 0 },
  notifications: [
    {
      id: 'dailySalesReports',
      label: 'Daily Sales Reports',
      description: 'Receive a summary of sales at the end of each day',
      enabled: false,
    },
    {
      id: 'inventoryAlerts',
      label: 'Inventory Alerts',
      description: 'Get notified when stock runs low',
      enabled: false,
    },
    {
      id: 'staffNotifications',
      label: 'Staff Notifications',
      description: 'Updates about staff shifts and assignments',
      enabled: false,
    },
  ],
  integrations: initialIntegrationStatus(),
  editingRestaurant: false,
  saved: null,

  setActiveSection: (section) => set({ activeSection: section }),
  setEditingRestaurant: (value) => set({ editingRestaurant: value }),
  clearSaved: () => set({ saved: null }),

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const [settingsRes, overviewRes, meRes] = await Promise.all([
        adminRestaurantApi.getSettings().catch(() => null),
        adminRestaurantApi.getOverview().catch(() => null),
        adminUserApi.getMe().catch(() => null),
      ]);

      // Ensure the staff list is loaded so team counts are accurate.
      const staffState = useStaffStore.getState();
      if (!staffState.members || staffState.members.length === 0) {
        await staffState.fetchMembers().catch(() => undefined);
      }
      const members = useStaffStore.getState().members || [];

      const settings = settingsRes?.settings;
      const billingSummary = settingsRes?.billing ?? null;
      const restaurant = overviewRes?.restaurant;
      const me = meRes;

      const email = settings?.emailPreferences;
      const notifications: NotificationPref[] = [
        {
          id: 'dailySalesReports',
          label: 'Daily Sales Reports',
          description: 'Receive a summary of sales at the end of each day',
          enabled: Boolean(email?.dailySalesReports),
        },
        {
          id: 'inventoryAlerts',
          label: 'Inventory Alerts',
          description: 'Get notified when stock runs low',
          enabled: Boolean(email?.inventoryAlerts),
        },
        {
          id: 'staffNotifications',
          label: 'Staff Notifications',
          description: 'Updates about staff shifts and assignments',
          enabled: Boolean(email?.staffNotifications),
        },
      ];

      const managers = members.filter((m) => m.role === 'Manager').length;
      const kitchenStaff = members.filter((m) => m.role === 'Chef').length;
      const serviceStaff = members.filter((m) =>
        ['Server', 'Bartender', 'Host', 'Cleaner'].includes(m.role)
      ).length;

      const backendIntegrations = settings?.integrations ?? {};
      const integrations: Integration[] = STATIC_INTEGRATIONS.map((i) => ({
        ...i,
        status: backendIntegrations[i.id]?.connected ? 'Connected' : 'Not connected',
      }));

      set({
        loading: false,
        admin: me
          ? {
              id: me.id,
              name: me.name || '',
              email: me.email,
              role: me.role,
              mobile: me.mobile || '',
            }
          : get().admin,
        restaurant: {
          name: settingsRes?.restaurant?.name ?? restaurant?.name ?? '',
          type: settingsRes?.restaurant?.type ?? restaurant?.type ?? '',
          cuisine: settingsRes?.restaurant?.cuisine ?? restaurant?.cuisine ?? '',
          phone: settingsRes?.restaurant?.phone ?? restaurant?.phone ?? '',
          address: settingsRes?.restaurant?.address ?? restaurant?.address ?? '',
          city: settingsRes?.restaurant?.city ?? restaurant?.city ?? '',
        },
        billing: {
          plan: billingSummary?.plan ?? restaurant?.plan ?? 'Free',
          currency: billingSummary?.currency ?? settings?.currency ?? 'INR',
          cycle: billingSummary?.cycle ?? '—',
          nextBillingDate: billingSummary?.nextBillingDate ?? 'Not available',
          amount: billingSummary?.amount ?? '—',
          status: billingSummary?.status ?? 'free',
          paymentMethod: billingSummary?.paymentMethod ?? 'Free',
        },
        team: {
          totalMembers: members.length,
          managers,
          kitchenStaff,
          serviceStaff,
        },
        notifications,
        integrations,
        bankDetails: (settingsRes as any)?.bankDetails ?? null,
      });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load settings',
      });
    }
  },

  updateProfile: async (data) => {
    const result = await adminUserApi.updateMe(data);

    // Check if this was a normal profile update (returns user) or phone-change trigger (returns otpSent)
    if ('user' in result && result.user) {
      const updated = result.user;
      set((s) => ({
        admin: {
          ...s.admin,
          name: updated.name || s.admin.name,
          mobile: updated.mobile || s.admin.mobile,
        },
        saved: 'Profile updated',
      }));
    } else if ('otpSent' in result && result.otpSent) {
      // Phone change triggered — OTP sent to email, mobile not updated yet
      // Don't update admin.mobile here, mark as pending
      set({ saved: null });
    }
  },

  updateRestaurantInfo: async (data) => {
    await adminRestaurantApi.updateSettings(data);
    set((s) => ({
      restaurant: { ...s.restaurant, ...data },
      editingRestaurant: false,
      saved: 'Restaurant information saved',
    }));
  },

  changePlan: async (plan) => {
    await adminRestaurantApi.updateSettings({ plan });
    set((s) => ({
      billing: { ...s.billing, plan },
      saved: `Plan changed to ${plan}`,
    }));
  },

  toggleNotification: async (id) => {
    const current = get().notifications.find((n) => n.id === id);
    if (!current) return;
    const nextEnabled = !current.enabled;

    // Optimistic update
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, enabled: nextEnabled } : n
      ),
    }));

    const emailPreferences: Record<string, boolean> = {};
    for (const n of get().notifications) {
      emailPreferences[n.id] = n.enabled;
    }

    try {
      await adminRestaurantApi.updateSettings({ emailPreferences });
      set({ saved: 'Notification preferences saved' });
    } catch {
      // Revert on failure
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, enabled: current.enabled } : n
        ),
      }));
    }
  },

  toggleIntegration: async (id) => {
    const current = get().integrations.find((i) => i.id === id);
    if (!current) return;
    const nextConnected = current.status !== 'Connected';

    // Optimistic update
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id ? { ...i, status: nextConnected ? 'Connected' : 'Not connected' } : i
      ),
    }));

    const integrations: Record<string, { connected: boolean }> = {
      [id]: { connected: nextConnected },
    };

    try {
      await adminRestaurantApi.updateSettings({ integrations });
      set({ saved: nextConnected ? `${current.name} connected` : `${current.name} disconnected` });
    } catch {
      // Revert on failure
      set((s) => ({
        integrations: s.integrations.map((i) =>
          i.id === id ? { ...i, status: current.status } : i
        ),
      }));
    }
  },

  // ── Billing & Settlements Actions ────────────────────────────────────

  fetchBillingData: async () => {
    set({ billingLoading: true });
    const restaurantId = getStoredUser('admin')?.restaurantId;
    try {
      const [txRes, settleRes, summaryRes, salaryRes, subRes] = await Promise.all([
        apiClient.get('/subscriptions/current', { params: { restaurantId } }).catch(() => null),
        apiClient.get('/admin/settlements', { params: { restaurantId, limit: 10 } }).catch(() => null),
        apiClient.get('/admin/settlements/summary', { params: { restaurantId } }).catch(() => null),
        apiClient.get('/admin/staff/salary/history', { params: { restaurantId, limit: 20 } }).catch(() => null),
        apiClient.get('/subscriptions/current', { params: { restaurantId } }).catch(() => null),
      ]);

      const sub = subRes?.data?.data?.subscription;
      const payments = sub?.lastPaymentId ? [] : []; // Payment history would come from a dedicated endpoint

      set({
        billingLoading: false,
        settlements: settleRes?.data?.data?.settlements ?? [],
        settlementSummary: summaryRes?.data?.data ?? null,
        salaryHistory: salaryRes?.data?.data?.disbursements ?? [],
        autoRenew: sub?.autoRenew ?? true,
      });
    } catch {
      set({ billingLoading: false });
    }
  },

  updateBankDetails: async (data) => {
    await adminRestaurantApi.updateSettings({ bankDetails: data });
    set({ bankDetails: data, saved: 'Bank details saved successfully' });
  },

  toggleAutoRenew: async (value) => {
    const prev = get().autoRenew;
    set({ autoRenew: value });
    try {
      await apiClient.patch('/subscriptions/auto-renew/toggle', { autoRenew: value });
      set({ saved: value ? 'Auto-renewal enabled' : 'Auto-renewal disabled' });
    } catch {
      set({ autoRenew: prev });
    }
  },

  paySalary: async (staffId, month, year, paymentMethod) => {
    const restaurantId = getStoredUser('admin')?.restaurantId;
    await apiClient.post('/admin/staff/salary/pay', {
      staffId,
      month,
      year,
      paymentMethod: paymentMethod || 'CASH',
      restaurantId,
    });
    set({ saved: 'Salary paid successfully' });
    get().fetchBillingData();
  },

  payAllSalaries: async (month, year, paymentMethod) => {
    const restaurantId = getStoredUser('admin')?.restaurantId;
    await apiClient.post('/admin/staff/salary/pay-all', {
      month,
      year,
      paymentMethod: paymentMethod || 'CASH',
      restaurantId,
    });
    set({ saved: 'All salaries paid successfully' });
    get().fetchBillingData();
  },
}));
