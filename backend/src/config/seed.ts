import mongoose from 'mongoose';
import crypto from 'crypto';
import logger from './logger';
import { hashPassword } from '../utils/crypto';
import { UserRole, KitchenRole, StaffInternalRole, CleaningRole } from '../constants/roles';
import {
  CleaningStatus,
  Priority,
  QueueStatus,
  RequestStatus,
  RequestType,
  ReservationStatus,
  RestaurantStatus,
  SessionStatus,
  TableStatus,
  UserStatus,
} from '../constants/statuses';
import { UserModel } from '../modules/users/users.model';
import { RestaurantModel } from '../modules/restaurants/restaurants.model';
import { TableModel } from '../modules/tables/tables.model';
import { TableSessionModel } from '../modules/tableSessions/tableSessions.model';
import { Category, MenuItem } from '../modules/menu/menu.model';
import { OrderModel } from '../modules/orders/orders.model';
import {
  OrderStatus as OrderDocumentStatus,
  PaymentStatus as OrderPaymentStatus,
} from '../modules/orders/orders.schema';
import { NotificationModel } from '../modules/notifications/notifications.model';
import { NotificationCategory, NotificationPriority } from '../modules/notifications/notifications.schema';
import { QueueEntryModel } from '../modules/queue/queue.model';
import { ReservationModel } from '../modules/reservations/reservations.model';
import { StaffRequestModel } from '../modules/staff/staffRequest.model';
import { CleaningTaskModel } from '../modules/cleaning/cleaning.model';
import { OfferModel } from '../modules/offers/offers.model';
import { AuditLogModel } from '../modules/auditLogs/auditLogs.model';
import { FeatureFlagModel, PlatformPlanModel } from '../modules/superAdmin/superAdmin.model';
import {
  SubscriptionModel,
  SubscriptionStatus,
  BillingCycle,
  SubscriptionPaymentProvider,
} from '../modules/subscriptions/subscriptions.model';

type SeedUserInput = {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: UserRole;
  restaurantId?: mongoose.Types.ObjectId;
  kitchen_role?: KitchenRole;
  staff_role?: StaffInternalRole;
  cleaning_role?: CleaningRole;
  dateOfBirth?: string;
  location?: string;
  avatar?: string;
  bio?: string;
};

async function upsertUser(input: SeedUserInput) {
  const password = await hashPassword(input.password);

  return UserModel.findOneAndUpdate(
    { email: input.email.toLowerCase() },
    {
      $set: {
        name: input.name,
        email: input.email.toLowerCase(),
        mobile: input.mobile,
        password,
        role: input.role,
        status: UserStatus.ACTIVE,
        restaurantId: input.restaurantId ?? null,
        kitchen_role: input.kitchen_role ?? null,
        staff_role: input.staff_role ?? null,
        cleaning_role: input.cleaning_role ?? null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        location: input.location ?? null,
        avatar: input.avatar ?? null,
        bio: input.bio ?? null,
        isEmailVerified: true,
        isMobileVerified: true,
        isDeleted: false,
        deletedAt: null,
        failedLoginAttempts: 0,
        lockUntil: null,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
}

function buildOrderItem(menuItem: { _id: mongoose.Types.ObjectId; name: string; price: number }, quantity: number) {
  return {
    menuItemId: menuItem._id,
    name: menuItem.name,
    quantity,
    price: menuItem.price,
    totalPrice: menuItem.price * quantity,
    notes: '',
  };
}

export async function seedDevelopmentData(): Promise<void> {
  const amberTable = await RestaurantModel.findOneAndUpdate(
    { slug: 'amber-table' },
    {
      $set: {
        name: 'Amber Table',
        slug: 'amber-table',
        status: RestaurantStatus.ACTIVE,
        plan: 'PRO',
        cuisine: 'Modern Indian',
        city: 'Bengaluru',
        rating: 4.7,
        settings: {
          currency: 'INR',
          taxRate: 0.05,
          serviceChargeEnabled: true,
          sessionDurationMinutes: 90,
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await RestaurantModel.findOneAndUpdate(
    { slug: 'pepper-harbor' },
    {
      $set: {
        name: 'Pepper Harbor',
        slug: 'pepper-harbor',
        status: RestaurantStatus.PENDING_APPROVAL,
        plan: 'STARTER',
        cuisine: 'Italian',
        city: 'Mumbai',
        rating: 4.3,
        settings: {
          currency: 'INR',
          taxRate: 0.05,
          serviceChargeEnabled: false,
          sessionDurationMinutes: 90,
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  // Seed Super Admin Mock Restaurants into Database
  await Promise.all([
    RestaurantModel.findOneAndUpdate(
      { slug: 'spice-paradise' },
      {
        $set: {
          name: 'Spice Paradise',
          slug: 'spice-paradise',
          status: RestaurantStatus.ACTIVE,
          plan: 'Premium',
          cuisine: 'Indian',
          city: 'Mumbai',
          state: 'Maharashtra',
          rating: 4.5,
          ownerName: 'Rajesh Kumar',
          email: 'rajesh@spiceparadise.com',
          phone: '+91 98765 43210',
          branches: 3,
          expectedMonthlyOrders: 150,
          settings: { currency: 'INR', taxRate: 0.05, serviceChargeEnabled: true, sessionDurationMinutes: 90 },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    RestaurantModel.findOneAndUpdate(
      { slug: 'urban-bites' },
      {
        $set: {
          name: 'Urban Bites',
          slug: 'urban-bites',
          status: RestaurantStatus.ACTIVE,
          plan: 'Standard',
          cuisine: 'Fast Food',
          city: 'Delhi',
          state: 'NCR',
          rating: 4.3,
          ownerName: 'Priya Sharma',
          email: 'priya@urbanbites.com',
          phone: '+91 98765 43211',
          branches: 2,
          expectedMonthlyOrders: 120,
          settings: { currency: 'INR', taxRate: 0.05, serviceChargeEnabled: true, sessionDurationMinutes: 90 },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    RestaurantModel.findOneAndUpdate(
      { slug: 'gourmet-haven' },
      {
        $set: {
          name: 'Gourmet Haven',
          slug: 'gourmet-haven',
          status: RestaurantStatus.ACTIVE,
          plan: 'Premium',
          cuisine: 'Continental',
          city: 'Bangalore',
          state: 'Karnataka',
          rating: 4.6,
          ownerName: 'Amit Patel',
          email: 'amit@gourmethaven.com',
          phone: '+91 98765 43212',
          branches: 1,
          expectedMonthlyOrders: 90,
          settings: { currency: 'INR', taxRate: 0.05, serviceChargeEnabled: true, sessionDurationMinutes: 90 },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    RestaurantModel.findOneAndUpdate(
      { slug: 'fusion-kitchen' },
      {
        $set: {
          name: 'Fusion Kitchen',
          slug: 'fusion-kitchen',
          status: RestaurantStatus.ACTIVE,
          plan: 'Basic',
          cuisine: 'Italian',
          city: 'Pune',
          state: 'Maharashtra',
          rating: 4.4,
          ownerName: 'Neha Singh',
          email: 'neha@fusionkitchen.com',
          phone: '+91 98765 43213',
          branches: 2,
          expectedMonthlyOrders: 80,
          settings: { currency: 'INR', taxRate: 0.05, serviceChargeEnabled: true, sessionDurationMinutes: 90 },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    RestaurantModel.findOneAndUpdate(
      { slug: 'ocean-delights' },
      {
        $set: {
          name: 'Ocean Delights',
          slug: 'ocean-delights',
          status: RestaurantStatus.ACTIVE,
          plan: 'Standard',
          cuisine: 'Seafood',
          city: 'Chennai',
          state: 'Tamil Nadu',
          rating: 4.2,
          ownerName: 'Vikram Reddy',
          email: 'vikram@oceandelights.com',
          phone: '+91 98765 43214',
          branches: 1,
          expectedMonthlyOrders: 70,
          settings: { currency: 'INR', taxRate: 0.05, serviceChargeEnabled: true, sessionDurationMinutes: 90 },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
  ]);

  const [adminUser, customerUser, staffUser, , , superAdminUser] = await Promise.all([
    upsertUser({
      name: 'Admin',
      email: 'adminpanel16@gmail.com',
      mobile: '5555555555',
      password: 'Happy@100',
      role: UserRole.RESTAURANT_ADMIN,
      restaurantId: amberTable._id,
    }),
    upsertUser({
      name: 'Aarav Guest',
      email: 'guest@ambertable.com',
      mobile: '9999999999',
      password: 'Guest@123',
      role: UserRole.CUSTOMER,
      restaurantId: amberTable._id,
    }),
    upsertUser({
      name: 'Riya Service',
      email: 'staffpanel320@gmail.com',
      mobile: '8888888888',
      password: 'Happy@100',
      role: UserRole.SERVICE_STAFF,
      restaurantId: amberTable._id,
      staff_role: StaffInternalRole.FLOOR_SUPERVISOR,
      dateOfBirth: '2000-03-15',
    }),
    upsertUser({
      name: 'Kabir Kitchen',
      email: 'kitchenpanel1@gmail.com',
      mobile: '7777777777',
      password: 'Happy@100',
      role: UserRole.KITCHEN_STAFF,
      restaurantId: amberTable._id,
      kitchen_role: KitchenRole.HEAD_CHEF,
      dateOfBirth: '1995-07-20',
    }),
    upsertUser({
      name: 'Meera Cleaning',
      email: 'cleaningpanel14@gmail.com',
      mobile: '6666666666',
      password: 'Happy@100',
      role: UserRole.CLEANING_STAFF,
      restaurantId: amberTable._id,
      cleaning_role: CleaningRole.CLEANING_SUPERVISOR,
      dateOfBirth: '1998-12-05',
    }),
    upsertUser({
      name: 'Platform Owner',
      email: 'adminsuper22@gmail.com',
      mobile: '4444444444',
      password: 'Happy@100',
      role: UserRole.SUPER_ADMIN,
      location: 'Kolkata, WB',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
      bio: 'Super Administrator managing the HQ Terminal platform.',
    }),
  ]);

  await Promise.all([
    PlatformPlanModel.findOneAndUpdate(
      { name: 'STARTER' },
      { $set: { name: 'STARTER', priceMonthly: 4999, tenantLimit: 1, usageLimit: 100, yearlyDiscountPercentage: 20, features: ['Digital Menu', 'Basic Analytics', 'Order Management'] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    PlatformPlanModel.findOneAndUpdate(
      { name: 'PRO' },
      { $set: { name: 'PRO', priceMonthly: 12999, tenantLimit: 5, usageLimit: 1000, yearlyDiscountPercentage: 25, features: ['Digital Menu', 'Advanced Analytics', 'Order Management', 'Inventory Management', 'Staff Management'] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    PlatformPlanModel.findOneAndUpdate(
      { name: 'ENTERPRISE' },
      { $set: { name: 'ENTERPRISE', priceMonthly: 24999, tenantLimit: 20, usageLimit: 10000, yearlyDiscountPercentage: 30, features: ['Digital Menu', 'Advanced Analytics', 'Order Management', 'Inventory Management', 'Staff Management', 'Multi-branch Support', 'Custom Branding'] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    PlatformPlanModel.findOneAndUpdate(
      { name: 'Free' },
      { $set: { name: 'Free', priceMonthly: 0, tenantLimit: 1, usageLimit: 100, staffLimit: 5, yearlyDiscountPercentage: 0, features: ['Digital Menu', 'Basic Order Management'] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    PlatformPlanModel.findOneAndUpdate(
      { name: 'Standard' },
      { $set: { name: 'Standard', priceMonthly: 599, tenantLimit: 15, usageLimit: 500, staffLimit: 15, yearlyDiscountPercentage: 15, features: ['Digital Menu', 'Basic Analytics', 'Order Management', 'Staff Management'] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    PlatformPlanModel.findOneAndUpdate(
      { name: 'Premium' },
      { $set: { name: 'Premium', priceMonthly: 999, tenantLimit: 30, usageLimit: 2000, staffLimit: 30, yearlyDiscountPercentage: 20, features: ['Digital Menu', 'Advanced Analytics', 'Order Management', 'Staff Management', 'Inventory Management'] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    PlatformPlanModel.findOneAndUpdate(
      { name: 'Enterprise' },
      { $set: { name: 'Enterprise', priceMonthly: 1999, tenantLimit: 100, usageLimit: 10000, staffLimit: null, yearlyDiscountPercentage: 25, features: ['Digital Menu', 'Advanced Analytics', 'Order Management', 'Staff Management', 'Inventory Management', 'Multi-branch Support'] } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    FeatureFlagModel.findOneAndUpdate(
      { key: 'smart-recommendations' },
      { $set: { key: 'smart-recommendations', enabled: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    FeatureFlagModel.findOneAndUpdate(
      { key: 'otp-login' },
      { $set: { key: 'otp-login', enabled: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
  ]);

  const proPlan = await PlatformPlanModel.findOne({ name: 'PRO' });
  const starterPlan = await PlatformPlanModel.findOne({ name: 'STARTER' });

  if (proPlan) {
    await SubscriptionModel.findOneAndUpdate(
      { restaurantId: amberTable._id },
      {
        $set: {
          restaurantId: amberTable._id,
          plan: 'PRO',
          planId: proPlan._id,
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          startedAt: new Date(),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: true,
          paymentProvider: SubscriptionPaymentProvider.MOCK,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  const pepperHarbor = await RestaurantModel.findOne({ slug: 'pepper-harbor' });
  if (starterPlan && pepperHarbor) {
    await SubscriptionModel.findOneAndUpdate(
      { restaurantId: pepperHarbor._id },
      {
        $set: {
          restaurantId: pepperHarbor._id,
          plan: 'STARTER',
          planId: starterPlan._id,
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          startedAt: new Date(),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: true,
          paymentProvider: SubscriptionPaymentProvider.MOCK,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  const [tableOne, tableTwo, tableThree] = await Promise.all([
    TableModel.findOneAndUpdate(
      { restaurantId: amberTable._id, tableNumber: 'T1' },
      {
        $set: {
          restaurantId: amberTable._id,
          tableNumber: 'T1',
          capacity: 4,
          status: TableStatus.AVAILABLE,
          qrCode: 'amber-table-t1-seed',
          floor: 1,
          section: 'Indoor',
          isActive: true,
        },
        $setOnInsert: {
          qrToken: crypto.randomBytes(16).toString('hex'),
          qrGeneratedAt: new Date(),
          qrLastRegeneratedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    TableModel.findOneAndUpdate(
      { restaurantId: amberTable._id, tableNumber: 'T2' },
      {
        $set: {
          restaurantId: amberTable._id,
          tableNumber: 'T2',
          capacity: 6,
          status: TableStatus.OCCUPIED,
          qrCode: 'amber-table-t2-seed',
          floor: 1,
          section: 'Indoor',
          isActive: true,
        },
        $setOnInsert: {
          qrToken: crypto.randomBytes(16).toString('hex'),
          qrGeneratedAt: new Date(),
          qrLastRegeneratedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    TableModel.findOneAndUpdate(
      { restaurantId: amberTable._id, tableNumber: 'T3' },
      {
        $set: {
          restaurantId: amberTable._id,
          tableNumber: 'T3',
          capacity: 2,
          status: TableStatus.NEEDS_CLEANING,
          qrCode: 'amber-table-t3-seed',
          floor: 1,
          section: 'Indoor',
          isActive: true,
        },
        $setOnInsert: {
          qrToken: crypto.randomBytes(16).toString('hex'),
          qrGeneratedAt: new Date(),
          qrLastRegeneratedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    TableModel.findOneAndUpdate(
      { restaurantId: amberTable._id, tableNumber: 'T4' },
      {
        $set: {
          restaurantId: amberTable._id,
          tableNumber: 'T4',
          capacity: 8,
          status: TableStatus.RESERVED,
          qrCode: 'amber-table-t4-seed',
          floor: 1,
          section: 'Private',
          isActive: true,
        },
        $setOnInsert: {
          qrToken: crypto.randomBytes(16).toString('hex'),
          qrGeneratedAt: new Date(),
          qrLastRegeneratedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    TableModel.findOneAndUpdate(
      { restaurantId: amberTable._id, tableNumber: 'T5' },
      {
        $set: {
          restaurantId: amberTable._id,
          tableNumber: 'T5',
          capacity: 4,
          status: TableStatus.AVAILABLE,
          qrCode: 'amber-table-t5-seed',
          floor: 1,
          section: 'Outdoor',
          isActive: true,
        },
        $setOnInsert: {
          qrToken: crypto.randomBytes(16).toString('hex'),
          qrGeneratedAt: new Date(),
          qrLastRegeneratedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    TableModel.findOneAndUpdate(
      { restaurantId: amberTable._id, tableNumber: 'B1' },
      {
        $set: {
          restaurantId: amberTable._id,
          tableNumber: 'B1',
          capacity: 2,
          status: TableStatus.OCCUPIED,
          qrCode: 'amber-table-b1-seed',
          floor: 1,
          section: 'Bar',
          isActive: true,
        },
        $setOnInsert: {
          qrToken: crypto.randomBytes(16).toString('hex'),
          qrGeneratedAt: new Date(),
          qrLastRegeneratedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    TableModel.findOneAndUpdate(
      { restaurantId: amberTable._id, tableNumber: 'T6' },
      {
        $set: {
          restaurantId: amberTable._id,
          tableNumber: 'T6',
          capacity: 4,
          status: TableStatus.AVAILABLE,
          qrCode: 'amber-table-t6-seed',
          floor: 2,
          section: 'Indoor',
          isActive: true,
        },
        $setOnInsert: {
          qrToken: crypto.randomBytes(16).toString('hex'),
          qrGeneratedAt: new Date(),
          qrLastRegeneratedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    TableModel.findOneAndUpdate(
      { restaurantId: amberTable._id, tableNumber: 'T7' },
      {
        $set: {
          restaurantId: amberTable._id,
          tableNumber: 'T7',
          capacity: 6,
          status: TableStatus.AVAILABLE,
          qrCode: 'amber-table-t7-seed',
          floor: 2,
          section: 'Indoor',
          isActive: false, // Blocked
        },
        $setOnInsert: {
          qrToken: crypto.randomBytes(16).toString('hex'),
          qrGeneratedAt: new Date(),
          qrLastRegeneratedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
  ]);

  const activeSession = await TableSessionModel.findOneAndUpdate(
    { sessionToken: 'amber-table-session-seed' },
    {
      $set: {
        restaurantId: amberTable._id,
        tableId: tableTwo._id,
        customerName: customerUser.name,
        mobile: customerUser.mobile,
        sessionToken: 'amber-table-session-seed',
        sessionStart: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        lastActivityAt: new Date(),
        status: SessionStatus.ACTIVE,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).select('+sessionToken');

  tableTwo.currentSessionId = activeSession._id;
  await tableTwo.save();

  const [starterCategory, pizzaCategory, dessertCategory] = await Promise.all([
    Category.findOneAndUpdate(
      { restaurantId: amberTable._id, name: 'starter' },
      {
        $set: {
          restaurantId: amberTable._id,
          name: 'starter',
          description: 'Starters',
          displayOrder: 1,
          isActive: true,
          isHidden: false,
          createdBy: adminUser._id,
          updatedBy: adminUser._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    Category.findOneAndUpdate(
      { restaurantId: amberTable._id, name: 'pizza' },
      {
        $set: {
          restaurantId: amberTable._id,
          name: 'pizza',
          description: 'Wood-fired pizzas',
          displayOrder: 2,
          isActive: true,
          isHidden: false,
          createdBy: adminUser._id,
          updatedBy: adminUser._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    Category.findOneAndUpdate(
      { restaurantId: amberTable._id, name: 'dessert' },
      {
        $set: {
          restaurantId: amberTable._id,
          name: 'dessert',
          description: 'Desserts',
          displayOrder: 3,
          isActive: true,
          isHidden: false,
          createdBy: adminUser._id,
          updatedBy: adminUser._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
  ]);

  const [broccoliItem, mushroomPizzaItem] = await Promise.all([
    MenuItem.findOneAndUpdate(
      { restaurantId: amberTable._id, name: 'Tandoori Broccoli' },
      {
        $set: {
          restaurantId: amberTable._id,
          categoryId: starterCategory._id,
          name: 'Tandoori Broccoli',
          description: 'Charred broccoli with hung curd glaze.',
          shortDescription: 'Smoky, creamy, vegetarian starter.',
          price: 320,
          isVeg: true,
          isAvailable: true,
          isHidden: false,
          spiceLevel: 1,
          preparationTime: 10,
          tags: ['starter', 'popular'],
          displayOrder: 1,
          createdBy: adminUser._id,
          updatedBy: adminUser._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    MenuItem.findOneAndUpdate(
      { restaurantId: amberTable._id, name: 'Truffle Mushroom Pizza' },
      {
        $set: {
          restaurantId: amberTable._id,
          categoryId: pizzaCategory._id,
          name: 'Truffle Mushroom Pizza',
          description: 'Wood-fired pizza with truffle cream.',
          shortDescription: 'Rich mushroom pizza.',
          price: 640,
          isVeg: true,
          isAvailable: true,
          isHidden: false,
          spiceLevel: 0,
          preparationTime: 15,
          tags: ['pizza', 'recommended'],
          displayOrder: 1,
          createdBy: adminUser._id,
          updatedBy: adminUser._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    MenuItem.findOneAndUpdate(
      { restaurantId: amberTable._id, name: 'Chicken Pepperoni Pizza' },
      {
        $set: {
          restaurantId: amberTable._id,
          categoryId: pizzaCategory._id,
          name: 'Chicken Pepperoni Pizza',
          description: 'Pepperoni pizza with smoked mozzarella.',
          shortDescription: 'Crowd-favorite non-veg pizza.',
          price: 720,
          isVeg: false,
          isAvailable: true,
          isHidden: false,
          spiceLevel: 3,
          preparationTime: 18,
          tags: ['pizza'],
          displayOrder: 2,
          createdBy: adminUser._id,
          updatedBy: adminUser._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    MenuItem.findOneAndUpdate(
      { restaurantId: amberTable._id, name: 'Saffron Tres Leches' },
      {
        $set: {
          restaurantId: amberTable._id,
          categoryId: dessertCategory._id,
          name: 'Saffron Tres Leches',
          description: 'Soft cake soaked in saffron milk.',
          shortDescription: 'Signature dessert.',
          price: 280,
          isVeg: true,
          isAvailable: false,
          isHidden: false,
          spiceLevel: 0,
          preparationTime: 7,
          tags: ['dessert'],
          displayOrder: 1,
          createdBy: adminUser._id,
          updatedBy: adminUser._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
  ]);

  await OrderModel.findOneAndUpdate(
    { orderNumber: 'ORD-SEED-1001' },
    {
      $set: {
        restaurantId: amberTable._id,
        tableId: tableTwo._id,
        sessionId: activeSession._id,
        orderNumber: 'ORD-SEED-1001',
        items: [buildOrderItem(mushroomPizzaItem, 1)],
        totalAmount: 640,
        taxAmount: 32,
        discountAmount: 0,
        finalAmount: 672,
        status: OrderDocumentStatus.PREPARING,
        paymentStatus: OrderPaymentStatus.PENDING,
        customerId: customerUser._id,
        estimatedPreparationTime: 14,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await OrderModel.findOneAndUpdate(
    { orderNumber: 'ORD-SEED-1002' },
    {
      $set: {
        restaurantId: amberTable._id,
        tableId: tableTwo._id,
        sessionId: activeSession._id,
        orderNumber: 'ORD-SEED-1002',
        items: [buildOrderItem(broccoliItem, 1)],
        totalAmount: 320,
        taxAmount: 16,
        discountAmount: 0,
        finalAmount: 336,
        status: OrderDocumentStatus.READY,
        paymentStatus: OrderPaymentStatus.PENDING,
        customerId: customerUser._id,
        readyAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await Promise.all([
    ReservationModel.findOneAndUpdate(
      { restaurantId: amberTable._id, customerName: 'Ishita Shah', date: '2026-05-11', slot: '20:00' },
      {
        $set: {
          restaurantId: amberTable._id,
          customerName: 'Ishita Shah',
          mobile: '9876543210',
          guests: 4,
          date: '2026-05-11',
          slot: '20:00',
          status: ReservationStatus.CONFIRMED,
          tableId: tableOne._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    QueueEntryModel.findOneAndUpdate(
      { restaurantId: amberTable._id, customerName: 'Walk-in Singh', status: QueueStatus.WAITING },
      {
        $set: {
          restaurantId: amberTable._id,
          customerName: 'Walk-in Singh',
          guests: 3,
          priority: Priority.NORMAL,
          status: QueueStatus.WAITING,
          etaMinutes: 12,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    StaffRequestModel.findOneAndUpdate(
      { restaurantId: amberTable._id, sessionId: activeSession._id, type: RequestType.WAITER },
      {
        $set: {
          restaurantId: amberTable._id,
          sessionId: activeSession._id,
          tableId: tableTwo._id,
          type: RequestType.WAITER,
          status: RequestStatus.PENDING,
          priority: Priority.HIGH,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    StaffRequestModel.findOneAndUpdate(
      { restaurantId: amberTable._id, sessionId: activeSession._id, type: RequestType.WATER },
      {
        $set: {
          restaurantId: amberTable._id,
          sessionId: activeSession._id,
          tableId: tableTwo._id,
          type: RequestType.WATER,
          status: RequestStatus.ACCEPTED,
          priority: Priority.NORMAL,
          acceptedBy: staffUser._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    CleaningTaskModel.findOneAndUpdate(
      { restaurantId: amberTable._id, tableId: tableThree._id },
      {
        $set: {
          restaurantId: amberTable._id,
          tableId: tableThree._id,
          priority: Priority.HIGH,
          status: CleaningStatus.PENDING,
          verifiedBy: null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    OfferModel.findOneAndUpdate(
      { restaurantId: amberTable._id, code: 'LUNCH10' },
      {
        $set: {
          restaurantId: amberTable._id,
          name: 'Lunch Saver',
          code: 'LUNCH10',
          discountPercent: 10,
          active: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    NotificationModel.findOneAndUpdate(
      { restaurantId: amberTable._id, recipientRole: UserRole.RESTAURANT_ADMIN, title: 'Low stock alert' },
      {
        $set: {
          restaurantId: amberTable._id,
          tableSessionId: null,
          recipientRole: UserRole.RESTAURANT_ADMIN,
          title: 'Low stock alert',
          message: 'Mozzarella below threshold.',
          type: 'LOW_STOCK_ALERT',
          category: NotificationCategory.SYSTEM,
          priority: NotificationPriority.NORMAL,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          metadata: { sku: 'mozzarella', userId: adminUser._id },
          isRead: false,
          readAt: null,
          readBy: null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    AuditLogModel.findOneAndUpdate(
      { action: 'Restaurant Deleted', entityId: 'taste-of-bengal-deleted' },
      {
        $set: {
          actorId: superAdminUser._id,
          actorRole: 'SUPER_ADMIN',
          entityType: 'ADMIN',
          entityId: 'taste-of-bengal-deleted',
          action: 'Restaurant Deleted',
          metadata: {
            restaurantName: 'Taste of Bengal',
            details: 'Super Admin permanently deleted terminated restaurant Taste of Bengal',
          },
          ipAddress: '192.168.1.45',
          userAgent: 'Chrome on Windows 11',
          createdAt: new Date('2026-06-25T14:30:00Z'),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    AuditLogModel.findOneAndUpdate(
      { action: 'Updated Commission Rate', entityId: 'platformSettings' },
      {
        $set: {
          actorId: superAdminUser._id,
          actorRole: 'SUPER_ADMIN',
          entityType: 'ADMIN',
          entityId: 'platformSettings',
          action: 'Updated Commission Rate',
          metadata: {
            target: 'Platform Settings',
            details: 'Changed commission rate from 8% to 10%',
          },
          ipAddress: '192.168.1.100',
          userAgent: 'Chrome on Windows 11',
          createdAt: new Date('2026-06-25T12:15:00Z'),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    AuditLogModel.findOneAndUpdate(
      { action: 'Restaurant Request Approved', entityId: 'pohewala-appr' },
      {
        $set: {
          actorId: superAdminUser._id,
          actorRole: 'SUPER_ADMIN',
          entityType: 'RESTAURANT',
          entityId: 'pohewala-appr',
          action: 'Restaurant Request Approved',
          metadata: {
            restaurantName: 'Pohewala',
            target: 'Pohewala',
            details: 'Approved onboarding request for Pohewala (Enterprise Plan)',
          },
          ipAddress: '192.168.1.102',
          userAgent: 'Chrome on Windows 11',
          createdAt: new Date('2026-06-25T11:00:00Z'),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    AuditLogModel.findOneAndUpdate(
      { action: 'Onboarding Fee Captured', entityId: 'RZP-PAY-9921' },
      {
        $set: {
          actorId: null,
          actorRole: 'system',
          entityType: 'TRANSACTION',
          entityId: 'RZP-PAY-9921',
          action: 'Onboarding Fee Captured',
          metadata: {
            target: 'Taste of India',
            details: 'Captured ₹1,499 onboarding fee payment via Razorpay',
          },
          ipAddress: '103.21.244.18',
          userAgent: 'Razorpay Webhook v2',
          createdAt: new Date('2026-06-24T18:20:00Z'),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    AuditLogModel.findOneAndUpdate(
      { action: 'Plan Upgraded', entityId: 'urban-bites-sub' },
      {
        $set: {
          actorId: null,
          actorRole: 'system',
          entityType: 'SUBSCRIPTION',
          entityId: 'urban-bites-sub',
          action: 'Plan Upgraded',
          metadata: {
            target: 'Urban Bites',
            details: 'Auto-upgraded from Standard to Premium due to order volume',
          },
          ipAddress: '127.0.0.1 (Localhost)',
          userAgent: 'System Automated Job',
          createdAt: new Date('2026-06-24T16:45:00Z'),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    AuditLogModel.findOneAndUpdate(
      { action: 'Maintenance Mode Updated', entityId: 'sys-maint-1' },
      {
        $set: {
          actorId: superAdminUser._id,
          actorRole: 'SUPER_ADMIN',
          entityType: 'SYSTEM',
          entityId: 'sys-maint-1',
          action: 'Maintenance Mode Updated',
          metadata: {
            target: 'Platform Settings',
            details: 'Platform maintenance mode settings updated by Super Admin',
          },
          ipAddress: '127.0.0.1 (Localhost)',
          userAgent: 'Chrome on Windows 11',
          createdAt: new Date('2026-06-24T10:10:00Z'),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
    AuditLogModel.findOneAndUpdate(
      { action: 'Order Payment Settled', entityId: 'ORD-PAY-4012' },
      {
        $set: {
          actorId: adminUser._id,
          actorRole: 'RESTAURANT_ADMIN',
          entityType: 'TRANSACTION',
          entityId: 'ORD-PAY-4012',
          action: 'Order Payment Settled',
          metadata: {
            target: 'Amber Table',
            details: 'Settled dine-in order payment of ₹850 via UPI',
          },
          ipAddress: '103.21.244.18',
          userAgent: 'Safari on iPhone',
          createdAt: new Date('2026-06-23T20:15:00Z'),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ),
  ]);

  // Seed Subscriptions and Payments for all restaurants
  try {
    const { SubscriptionModel, SubscriptionPaymentModel, SubscriptionStatus, SubscriptionPaymentProvider, SubscriptionPaymentStatus, BillingCycle } = await import('../modules/subscriptions/subscriptions.model');

    const allRestaurants = await RestaurantModel.find();
    for (const rest of allRestaurants) {
      const planName = rest.plan || 'Free';
      const planDoc = await PlatformPlanModel.findOne({ name: planName });
      const planId = planDoc ? planDoc._id : new mongoose.Types.ObjectId();
      const monthlyPrice = planDoc ? planDoc.priceMonthly : 0;

      const isTrial = rest.status === RestaurantStatus.PENDING_APPROVAL || planName === 'Free' || planName === 'Basic';

      // Sync subscriptionPlan_id on restaurant
      rest.subscriptionPlan_id = planId;
      await rest.save();

      let sub = await SubscriptionModel.findOne({ restaurantId: rest._id });
      if (!sub) {
        sub = await SubscriptionModel.create({
          restaurantId: rest._id,
          plan: planName,
          planId,
          priceMonthly: monthlyPrice,
          status: rest.status === RestaurantStatus.SUSPENDED ? SubscriptionStatus.SUSPENDED : SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          startedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          isTrial,
        });
      } else {
        sub.priceMonthly = monthlyPrice;
        sub.planId = planId;
        await sub.save();
      }

      // Seed 2 completed payments for non-trial restaurants
      const existingPaymentsCount = await SubscriptionPaymentModel.countDocuments({ restaurantId: rest._id });
      if (existingPaymentsCount === 0 && !isTrial && monthlyPrice > 0) {
        await SubscriptionPaymentModel.create({
          subscriptionId: sub._id,
          restaurantId: rest._id,
          planId,
          provider: SubscriptionPaymentProvider.MOCK,
          status: SubscriptionPaymentStatus.COMPLETED,
          billingCycle: BillingCycle.MONTHLY,
          amount: monthlyPrice,
          currency: 'INR',
          paidAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          metadata: { info: 'Automated initial billing' },
        });

        await SubscriptionPaymentModel.create({
          subscriptionId: sub._id,
          restaurantId: rest._id,
          planId,
          provider: SubscriptionPaymentProvider.MOCK,
          status: SubscriptionPaymentStatus.COMPLETED,
          billingCycle: BillingCycle.MONTHLY,
          amount: monthlyPrice,
          currency: 'INR',
          paidAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          metadata: { info: 'Automated renewal billing' },
        });
      }
    }
  } catch (err) {
    logger.error('Failed to seed subscriptions and payments', err);
  }

  // Post-seed: ensure tenantId is populated for all tenant-scoped documents in the DB
  const dbConnection = mongoose.connection.db;
  if (dbConnection) {
    const collections = await dbConnection.listCollections().toArray();
    for (const colInfo of collections) {
      const name = colInfo.name;
      // Skip system or excluded collections
      if (name.startsWith('system.') || ['plans', 'featureFlags', 'restaurant_requests', 'platformSettings'].includes(name)) {
        continue;
      }
      
      const col = dbConnection.collection(name);
      
      // 1. For the 'restaurants' collection, set tenantId to the document's _id as a string
      if (name === 'restaurants') {
        const docs = await col.find({}).toArray();
        for (const doc of docs) {
          if (!doc.tenantId) {
            await col.updateOne({ _id: doc._id }, { $set: { tenantId: doc._id.toString() } });
          }
        }
      } else {
        // 2. For other collections, if the document has restaurantId, set tenantId to restaurantId as a string
        const docs = await col.find({ restaurantId: { $exists: true } }).toArray();
        for (const doc of docs) {
          if (doc.restaurantId && !doc.tenantId) {
            await col.updateOne({ _id: doc._id }, { $set: { tenantId: doc.restaurantId.toString() } });
          }
        }
      }
    }
  }

  logger.info('Seeded local development data', {
    restaurantCount: await RestaurantModel.countDocuments(),
    userCount: await UserModel.countDocuments(),
  });
}
