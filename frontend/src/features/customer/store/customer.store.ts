import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateTableCode, getRecommendedItems } from '../utils/customer.utils';
import { apiClient } from '../../../shared/services/apiClient';
import { connectSocket, disconnectSocket, getSocket } from '../../../lib/socket';
import { getCartHasItems } from './cartSnapshot';

export type DiningSession = {
  sessionId: string;
  restaurantId: string;
  restaurantName: string;
  tableId: string;
  tableNumber: string;
  customerName: string;
  sessionToken: string;
  expiresAt: string;
  status: string;
} | null;

export type CustomerMenuItem = {
  id: number;
  name: string;
  desc: string;
  price: number;
  rating: number;
  reviews: number;
  cat: string;
  veg: boolean;
  img: string;
  badge: string;
};

export type CustomerCartItem = {
  id: number;
  qty: number;
};

export type ServiceRequestItem = {
  id: string;
  label: string;
  description: string;
  type: 'waiter' | 'water' | 'cleaning' | 'other';
  status?: string;
};

export type TrackedOrder = {
  id: string;
  items: string;
  structuredItems?: { id: string; name: string; qty: number; price: number; total: number }[];
  total: number;
  status: 'Placed' | 'Preparing' | 'Ready' | 'Served' | 'Completed';
  eta: string;
  date?: string;
  createdAt?: string;
  preparingStartedAt?: string;
  readyAt?: string;
  servedAt?: string;
  updatedAt?: string;
};

export type CustomerNotification = {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'order' | 'offer';
  redirectTo?: string;
};

export type LoyaltyHistory = {
  id: string;
  points: number;
  type: 'earn' | 'redeem';
  description: string;
  date: string;
};

export type OfferCoupon = {
  id: string;
  code: string;
  title: string;
  desc: string;
  requiredPoints: number;
  discountType: 'percentage' | 'fixed' | 'free_item';
  discountValue: number;
  minOrderAmount?: number;
  expiryDate: string;
  claimed: boolean;
};

export type CustomerProfile = {
  name: string;
  phone: string;
  email: string;
  isSmartMember: boolean;
  avatar?: string;
};

export type NotificationPreferences = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
};


export const MENU_CATEGORIES = [
  { label: 'All', icon: '🍽️' },
  { label: 'Biryani', icon: '🍛' },
  { label: 'Pizza', icon: '🍕' },
  { label: 'Burgers', icon: '🍔' },
  { label: 'Desserts', icon: '🧁' },
  { label: 'Drinks', icon: '🥤' },
];

const DEFAULT_OFFERS: OfferCoupon[] = [
  { id: '1', code: 'WELCOME50', title: '₹50 Off Welcome Deal', desc: 'Get flat ₹50 off on orders above ₹200.', requiredPoints: 0, discountType: 'fixed', discountValue: 50, minOrderAmount: 200, expiryDate: '30 Jun 2026', claimed: true },
  { id: '2', code: 'FREEBEV', title: 'Free Mango Lassi', desc: 'Redeem 100 reward points for a free chilled Mango Lassi.', requiredPoints: 100, discountType: 'free_item', discountValue: 89, expiryDate: '15 Jul 2026', claimed: false },
  { id: '3', code: 'BURGERBOGO', title: 'Buy 1 Get 1 Burger', desc: 'Buy any Smash Burger and get another free.', requiredPoints: 150, discountType: 'percentage', discountValue: 100, expiryDate: '10 Jul 2026', claimed: false },
  { id: '4', code: 'CHEF15', title: 'Chef Special 15% OFF', desc: 'Enjoy 15% off on Chef Special dishes.', requiredPoints: 200, discountType: 'percentage', discountValue: 15, expiryDate: '25 Jun 2026', claimed: false },
  { id: '5', code: 'DESSERT80', title: 'Free Gulab Jamun', desc: 'Redeem 80 points to get a free sweet Gulab Jamun dessert.', requiredPoints: 80, discountType: 'free_item', discountValue: 99, expiryDate: '05 Jul 2026', claimed: false },
];

const DEFAULT_NOTIFICATIONS: CustomerNotification[] = [
  { id: 'n1', title: 'Welcome to Smart Dining! 👋', message: 'Scan table QR code to start ordering and earn reward points.', timestamp: '30 mins ago', read: false, type: 'info' },
  { id: 'n2', title: 'Smart Member Activated! ✨', message: 'Congratulations! You are now a Smart Member. Enjoy priority service and exclusive perks.', timestamp: '25 mins ago', read: false, type: 'info' },
  { id: 'n3', title: 'Special Dessert Discount 🧁', message: 'Craving sweets? Get a free Gulab Jamun using 80 points in your Offers tab!', timestamp: 'Yesterday', read: true, type: 'offer' },
];

const DEFAULT_LOYALTY_HISTORY: LoyaltyHistory[] = [
  { id: 'h1', points: 100, type: 'earn', description: 'Welcome bonus points', date: 'Yesterday' },
  { id: 'h2', points: -50, type: 'redeem', description: 'Redeemed for Free Beverage coupon', date: '2 days ago' },
  { id: 'h3', points: 400, type: 'earn', description: 'Earned from Order #ORD-2840', date: '3 days ago' }
];

export type LiveBill = {
  _id: string | null;
  invoiceNumber: string | null;
  status: string;
  paymentStatus: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  finalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  payments?: any[];
  session: DiningSession;
  orders: TrackedOrder[];
  serviceCharge: number;
  financialSummary: {
    grossTotal: number;
    tax: number;
    discount: number;
    paymentsApplied: number;
    outstandingBalance: number;
  };
};

export function isValidLiveBill(value: any): value is LiveBill {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.status !== 'string') return false;
  if (typeof value.paymentStatus !== 'string') return false;
  if (typeof value.subtotal !== 'number') return false;
  if (typeof value.taxAmount !== 'number') return false;
  if (typeof value.serviceCharge !== 'number') return false;
  if (typeof value.discountAmount !== 'number') return false;
  if (typeof value.finalAmount !== 'number') return false;
  if (typeof value.amountPaid !== 'number') return false;
  if (typeof value.outstandingBalance !== 'number') return false;
  if (!Array.isArray(value.orders)) return false;
  if (!value.financialSummary || typeof value.financialSummary !== 'object') return false;
  return true;
}

type CustomerStore = {
  tableCode: string;
  category: string;
  search: string;
  vegOnly: boolean;
  cart: CustomerCartItem[];
  favourites: number[];
  menuItems: any[];
  orders: TrackedOrder[];
  serviceRequests: ServiceRequestItem[];

  // Dining Session State
  diningSession: DiningSession;
  lastActivity: number | null;
  liveBill: LiveBill | null;

  // Profile Features State
  profile: CustomerProfile;
  loyaltyPoints: number;
  loyaltyHistory: LoyaltyHistory[];
  offers: OfferCoupon[];
  notificationPreferences: NotificationPreferences;
  notifications: CustomerNotification[];

  setCategory: (category: string) => void;
  setSearch: (search: string) => void;
  toggleVegOnly: () => void;

  toggleFavourite: (id: number) => void;

  // Removed fake reorder from store
  requestService: (request: ServiceRequestItem) => void;

  assignRandomTable: () => void;
  setTableCode: (code: string) => void;
  addOrder: (order: TrackedOrder) => void;
  fetchOrders: () => Promise<void>;
  upsertOrderFromSocket: (order: any) => void;
  updateOrderStatusFromSocket: (orderId: string, status: string) => void;
  fetchLiveBill: () => Promise<void>;
  fetchMenu: () => Promise<void>;

  // Dining Session Actions
  setDiningSession: (session: DiningSession) => void;
  clearDiningSession: (forceLocalOnly?: boolean) => Promise<void>;
  recordActivity: () => void;
  checkSessionInactivity: () => Promise<void>;

  // Profile Features Actions
  updateProfile: (profile: Partial<CustomerProfile>) => void;
  addLoyaltyPoints: (points: number, description: string) => void;
  claimOffer: (offerId: string) => boolean;
  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void;

  // Notification Actions
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  addNotification: (title: string, message: string, type: 'info' | 'order' | 'offer', redirectTo?: string) => void;
};

function mapBackendOrderStatusToFrontend(status: string): TrackedOrder['status'] {
  switch (status) {
    case 'PENDING':
    case 'CONFIRMED':
      return 'Placed';
    case 'PREPARING':
    case 'DELAYED':
      return 'Preparing';
    case 'READY':
    case 'PICKED':
      return 'Ready';
    case 'SERVED':
    case 'BILLED':
    case 'PAID':
      return 'Served';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
    case 'REJECTED':
      // Frontend doesn't explicitly have a cancelled step in the UI yet, map to Placed or add it if needed
      // Currently, they just shouldn't be in the active list.
      return 'Placed';
    default:
      return 'Placed';
  }
}

export function mapBackendOrderToTrackedOrder(o: any): TrackedOrder {
  const itemsStr = o.items?.map((i: any) => `${i.name} x${i.quantity}`).join(', ') || '';
  const structuredItems = o.items?.map((i: any) => ({
    id: i.menuItemId || i.id || '',
    name: i.name,
    qty: i.quantity,
    price: i.price,
    total: i.totalPrice || (i.price * i.quantity)
  })) || [];
  
  return {
    id: o.orderNumber || o._id,
    items: itemsStr,
    structuredItems: structuredItems,
    total: o.finalAmount || o.totalAmount || 0,
    status: mapBackendOrderStatusToFrontend(o.status),
    eta: o.estimatedPreparationTime ? `${o.estimatedPreparationTime} min` : '15 min',
    date: new Date(o.createdAt).toLocaleString('en-IN'),
    createdAt: o.createdAt,
    preparingStartedAt: o.preparingStartedAt,
    readyAt: o.readyAt,
    servedAt: o.servedAt,
    updatedAt: o.updatedAt,
  };
}

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set, get) => ({
      tableCode: 'T07',
      category: 'All',
      search: '',
      vegOnly: false,
      cart: [],
      favourites: [],
      menuItems: [],
      orders: [],
      serviceRequests: [],
      diningSession: null,
      lastActivity: null,
      liveBill: null,

      // Initializing Profile Features State
      profile: {
        name: '',
        phone: '',
        email: '',
        isSmartMember: false,
      },
      loyaltyPoints: 0,
      loyaltyHistory: [],
      offers: DEFAULT_OFFERS,
      notificationPreferences: {
        email: true,
        sms: true,
        whatsapp: false,
        push: true,
      },
      notifications: [],

      setCategory: (category) => set({ category }),
      setSearch: (search) => set({ search }),
      toggleVegOnly: () => set((state) => ({ vegOnly: !state.vegOnly })),

      toggleFavourite: (id) => set((state) => ({
        favourites: state.favourites.includes(id)
          ? state.favourites.filter((favouriteId) => favouriteId !== id)
          : [...state.favourites, id],
      })),

      fetchOrders: async () => {
        try {
          const res = await apiClient.get('/customer/orders');
          const data = res.data?.data || res.data;
          if (data && data.orders) {
            const mapped: TrackedOrder[] = data.orders.map(mapBackendOrderToTrackedOrder);
            set({ orders: mapped });
          }
        } catch (err) {
          console.error('Failed to fetch customer orders', err);
        }
      },
      fetchMenu: async () => {
        try {
          const { diningSession } = get();
          if (!diningSession) return;
          const res = await apiClient.get(`/public/menu?restaurantId=${diningSession.restaurantId}`);
          const data = res.data?.data || res.data;
          if (data && data.menuItems) {
            set({ menuItems: data.menuItems });
          }
        } catch (err) {
          console.error('Failed to fetch menu', err);
        }
      },
      upsertOrderFromSocket: (orderPayload: any) => {
        set((state) => {
          const newOrder = mapBackendOrderToTrackedOrder(orderPayload);
          const existingOrder = state.orders.find(o => o.id === newOrder.id);
          
          if (existingOrder) {
            // Idempotency / Stale event protection
            if (newOrder.updatedAt && existingOrder.updatedAt) {
              const newTime = new Date(newOrder.updatedAt).getTime();
              const oldTime = new Date(existingOrder.updatedAt).getTime();
              if (newTime < oldTime) return state; // Ignore stale event
            }
          }

          const nextOrders = existingOrder 
            ? state.orders.map(o => o.id === newOrder.id ? newOrder : o)
            : [newOrder, ...state.orders];

          // Priority for Active Workflow Sorting
          const statusRank: Record<string, number> = {
            'Placed': 3,
            'Preparing': 2,
            'Ready': 1,
            'Served': 4,
            'Completed': 5
          };

          nextOrders.sort((a, b) => {
            const rankA = statusRank[a.status] ?? 99;
            const rankB = statusRank[b.status] ?? 99;
            
            if (rankA !== rankB) return rankA - rankB;
            
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });

          return { orders: nextOrders };
        });
      },
      updateOrderStatusFromSocket: (orderId: string, status: string) => {
        set((state) => {
          const mappedStatus = mapBackendOrderStatusToFrontend(status);
          return {
            orders: state.orders.map(o => {
              if (o.id === orderId || o.id === `ORD-${orderId}` || orderId.endsWith(o.id) || o.id.endsWith(orderId)) {
                return { ...o, status: mappedStatus };
              }
              return o;
            })
          };
        });
      },
      fetchLiveBill: async () => {
        try {
          const { getLiveBill } = await import('../api/customer.api');
          const data = await getLiveBill();
          set({ liveBill: data });
        } catch (err) {
          console.error('Failed to fetch live bill', err);
        }
      },
      // Fake reorder logic has been removed and replaced by CartContext reorderItems
      requestService: (request) => {
        get().recordActivity();
        set((state) => ({ serviceRequests: [{ ...request, id: `${request.id}-${Date.now()}` }, ...state.serviceRequests] }));
      },

      assignRandomTable: () => set({ tableCode: generateTableCode() }),
      setTableCode: (tableCode) => set({ tableCode }),
      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),

      setDiningSession: (diningSession) => {
        if (diningSession) {
          localStorage.setItem('x-session-token', diningSession.sessionToken);
          set({
            diningSession,
            tableCode: diningSession.tableNumber,
            lastActivity: Date.now(),
          });
          disconnectSocket();
          connectSocket();

          // Socket bindings are handled by CustomerLayout.tsx to ensure proper cleanup
        } else {
          localStorage.removeItem('x-session-token');
          set({
            diningSession: null,
            lastActivity: null,
          });
          disconnectSocket();
        }
      },
      clearDiningSession: async (forceLocalOnly = false) => {
        const { diningSession } = get();
        if (diningSession && !forceLocalOnly) {
          try {
            await apiClient.post('/customer/session/end');
          } catch (e: any) {
            console.error('Failed to end dining session on backend', e);
            // Don't throw, we still want to clean up local state
          }
        }
        localStorage.removeItem('x-session-token');
        set({
          diningSession: null,
          lastActivity: null,
          cart: [],
          orders: [],
          liveBill: null,
          tableCode: 'T07', // Reset to default or clear it
        });
        disconnectSocket();
      },
      recordActivity: () => {
        if (get().diningSession) {
          set({ lastActivity: Date.now() });
        }
      },
      checkSessionInactivity: async () => {
        const { diningSession, lastActivity, clearDiningSession, orders, liveBill } = get();
        if (diningSession && lastActivity) {
          const inactiveMs = Date.now() - lastActivity;
          if (inactiveMs > 20 * 60 * 1000) {
            const hasActiveOrders = orders.some(o => o.status !== 'Completed');
            const isBillPending = liveBill && (liveBill.status === 'GENERATED' || liveBill.finalAmount > 0);
            const isPaymentPending = diningSession.status === 'PAYMENT_PENDING';
            const hasActiveCart = getCartHasItems();

            if (hasActiveOrders || isBillPending || isPaymentPending || hasActiveCart) {
              return; // Skip cycle without updating lastActivity
            }

            try {
              await clearDiningSession();
            } catch (e) {
              console.error('Failed to auto-expire session', e);
            }
          }
        }
      },

      // Profile features action implementations
      updateProfile: (profileUpdates) => set((state) => ({
        profile: { ...state.profile, ...profileUpdates }
      })),
      addLoyaltyPoints: (points, description) => set((state) => ({
        loyaltyPoints: state.loyaltyPoints + points,
        loyaltyHistory: [
          {
            id: `h-${Date.now()}`,
            points,
            type: points > 0 ? 'earn' : 'redeem',
            description,
            date: 'Just now'
          },
          ...state.loyaltyHistory
        ]
      })),
      claimOffer: (offerId) => {
        let success = false;
        set((state) => {
          const offer = state.offers.find((o) => o.id === offerId);
          if (!offer || offer.claimed || state.loyaltyPoints < offer.requiredPoints) {
            return {};
          }

          success = true;
          const updatedOffers = state.offers.map((o) =>
            o.id === offerId ? { ...o, claimed: true } : o
          );
          
          const updatedHistory: LoyaltyHistory[] = offer.requiredPoints > 0 ? [
            {
              id: `h-${Date.now()}`,
              points: -offer.requiredPoints,
              type: 'redeem' as const,
              description: `Redeemed for ${offer.title}`,
              date: 'Just now'
            },
            ...state.loyaltyHistory
          ] : state.loyaltyHistory;

          const updatedNotifications = [
            {
              id: `n-${Date.now()}`,
              title: 'Offer Unlocked! 🎉',
              message: `You successfully unlocked "${offer.title}". Use coupon code "${offer.code}" during checkout.`,
              timestamp: 'Just now',
              read: false,
              type: 'offer' as const,
            },
            ...state.notifications
          ];

          return {
            loyaltyPoints: state.loyaltyPoints - offer.requiredPoints,
            offers: updatedOffers,
            loyaltyHistory: updatedHistory,
            notifications: updatedNotifications,
          };
        });
        return success;
      },
      updateNotificationPreferences: (prefs) => set((state) => ({
        notificationPreferences: { ...state.notificationPreferences, ...prefs }
      })),

      // Notification action implementations
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) => n.id === id ? { ...n, read: true } : n)
      })),
      markAllNotificationsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true }))
      })),
      deleteNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      })),
      clearAllNotifications: () => set({ notifications: [] }),
      addNotification: (title, message, type, redirectTo) => set((state) => ({
        notifications: [
          {
            id: `n-${Date.now()}`,
            title,
            message,
            timestamp: 'Just now',
            read: false,
            type,
            redirectTo,
          },
          ...state.notifications
        ]
      })),
    }),
    {
      name: 'restohub-customer-store',
      merge: (persistedState: any, currentState) => {
        const nextState = { ...currentState, ...persistedState };
        if (nextState.liveBill && !isValidLiveBill(nextState.liveBill)) {
          nextState.liveBill = null;
        }
        return nextState;
      },
    }
  )
);
