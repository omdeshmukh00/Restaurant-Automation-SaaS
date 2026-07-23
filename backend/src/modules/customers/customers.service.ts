import { Types } from 'mongoose';
import { CustomerProfileModel } from '../analytics/customerProfile.model';
import { UserModel } from '../users/users.model';
import { UserRole } from '../../constants/roles';
import { UserStatus } from '../../constants/statuses';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { TableSessionModel } from '../tableSessions/tableSessions.model';
import { OrderModel } from '../orders/orders.model';

export interface CustomerDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  loyaltyTier: 'Gold' | 'Silver' | 'Bronze';
  totalVisits: number;
  totalSpent: string;
  totalSpentRaw: number;
  lastOrder: string;
  lastOrderId: string;
  status: 'Active' | 'Inactive';
}

const ACTIVE_WINDOW_DAYS = 30;
const NEW_CUSTOMER_DAYS = 30;

// Normalize to digits-only for safe cross-collection joins. A User's `mobile`
// may carry a '+91' prefix from OTP signup while customerprofiles.mobile is
// stored digits-only, so we strip formatting before matching.
function digitsOnly(value?: string | null): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

function formatINR(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function deriveTier(totalSpent: number): CustomerDto['loyaltyTier'] {
  if (totalSpent >= 2000) return 'Gold';
  if (totalSpent >= 800) return 'Silver';
  return 'Bronze';
}

function deriveStatus(lastVisitAt?: Date | string | null): CustomerDto['status'] {
  if (!lastVisitAt) return 'Inactive';
  const last = lastVisitAt instanceof Date ? lastVisitAt : new Date(lastVisitAt);
  if (isNaN(last.getTime())) return 'Inactive';
  const cutoff = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return last.getTime() >= cutoff ? 'Active' : 'Inactive';
}

/**
 * Compute totalSpent and totalVisits for mobiles at a restaurant directly
 * from TableSessions and Orders — NOT from the analytics module (unreliable).
 *
 * A "visit" = a unique TableSession for that mobile+restaurant.
 * "Total spent" = sum of finalAmount for PAID orders in those sessions.
 */
async function computeCustomerMetrics(
  mobiles: string[],
  restaurantId: string,
): Promise<Map<string, { totalVisits: number; totalSpent: number; lastVisitAt: Date | null; lastOrderId: string }>> {
  const rid = new Types.ObjectId(restaurantId);

  // Build all mobile variants for matching
  const allVariants: string[] = [];
  for (const mobile of mobiles) {
    for (const fmt of mobileFormats(mobile)) {
      allVariants.push(fmt);
    }
  }

  if (allVariants.length === 0) return new Map();

  // Get all sessions for these mobiles at this restaurant
  const sessions = await TableSessionModel.find({
    restaurantId: rid,
    mobile: { $in: allVariants },
  })
    .setOptions({ bypassTenant: true })
    .lean()
    .exec();

  // Group sessions by mobile (digits-only)
  const sessionsByMobile = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = digitsOnly(s.mobile);
    if (!sessionsByMobile.has(key)) sessionsByMobile.set(key, []);
    sessionsByMobile.get(key)!.push(s);
  }

  // Get all session IDs for order lookup
  const sessionIds = sessions.map((s) => s._id);

  // Get all PAID orders for these sessions
  const orders = await OrderModel.find({
    restaurantId: rid,
    sessionId: { $in: sessionIds },
    paymentStatus: 'PAID',
  })
    .setOptions({ bypassTenant: true })
    .lean()
    .exec();

  // Index orders by sessionId
  const ordersBySession = new Map<string, typeof orders>();
  for (const o of orders) {
    const sid = o.sessionId?.toString();
    if (!sid) continue;
    if (!ordersBySession.has(sid)) ordersBySession.set(sid, []);
    ordersBySession.get(sid)!.push(o);
  }

  // Build result per mobile
  const result = new Map<string, { totalVisits: number; totalSpent: number; lastVisitAt: Date | null; lastOrderId: string }>();

  for (const mobile of mobiles) {
    const key = digitsOnly(mobile);
    const sessionsForMobile = sessionsByMobile.get(key) || [];

    let totalSpent = 0;
    let lastVisitAt: Date | null = null;
    let lastOrderId = '';

    for (const s of sessionsForMobile) {
      const orderList = ordersBySession.get(s._id.toString()) || [];
      for (const o of orderList) {
        totalSpent += o.finalAmount || 0;
        if (!lastVisitAt || o.createdAt > lastVisitAt) {
          lastVisitAt = o.createdAt;
          lastOrderId = o._id.toString();
        }
      }
    }

    result.set(key, {
      totalVisits: sessionsForMobile.length,
      totalSpent,
      lastVisitAt,
      lastOrderId,
    });
  }

  return result;
}

function shapeFromUser(
  user: any,
  profile?: any | null,
  metrics?: { totalSpent: number; totalVisits: number; lastVisitAt: Date | null; lastOrderId: string } | null,
): CustomerDto {
  // Use computed metrics (from real orders/sessions) when available, fall back to profile
  const totalSpent = metrics?.totalSpent ?? profile?.totalSpent ?? 0;
  const totalVisits = metrics?.totalVisits ?? profile?.totalVisits ?? 0;
  const lastVisitAt = metrics?.lastVisitAt ?? profile?.lastVisitAt ?? null;
  const lastOrderId = metrics?.lastOrderId ?? '';
  const avatar = user.avatar || initials(user.name);
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email || '',
    phone: user.mobile,
    avatar,
    loyaltyTier: deriveTier(totalSpent),
    totalVisits,
    totalSpent: formatINR(totalSpent),
    totalSpentRaw: totalSpent,
    lastOrder: formatDate(lastVisitAt),
    lastOrderId,
    status: deriveStatus(lastVisitAt),
  };
}

function matchesFilters(
  customer: CustomerDto,
  filters: { status?: string; tier?: string; q?: string },
): boolean {
  if (filters.status && filters.status !== 'All' && customer.status !== filters.status) {
    return false;
  }
  if (filters.tier && filters.tier !== 'All' && customer.loyaltyTier !== filters.tier) {
    return false;
  }
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    const haystack = `${customer.name} ${customer.phone} ${customer.email}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

interface GetCustomersResult {
  customers: CustomerDto[];
  total: number;
  page: number;
  perPage: number;
  stats: {
    totalCustomers: number;
    totalCustomersChange: string;
    loyalCustomers: number;
    loyalCustomersChange: string;
    totalVisits: number;
    totalVisitsChange: string;
    totalSpent: string;
    totalSpentChange: string;
  };
  topCustomers: Array<{ rank: number; id: string; name: string; avatar: string; spent: string; spentRaw: number }>;
  loyaltyDistribution: { gold: number; silver: number; bronze: number; goldPct: number; silverPct: number; bronzePct: number };
  customerOverview: { active: number; inactive: number; new: number; total: number };
}

/**
 * Build all common mobile-format variants for a digits-only number so we can
 * reliably match Users whose `mobile` field may store '+91', '91', or plain digits.
 */
function mobileFormats(digits: string): string[] {
  const formats = [digits];
  if (digits.length === 10) {
    formats.push(`91${digits}`, `+91${digits}`);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    const raw = digits.slice(2);
    formats.push(raw, `+91${raw}`);
  }
  return [...new Set(formats)];
}

/**
 * Returns the set of mobile numbers (digits-only, deduplicated) that belong
 * to the given restaurant. A customer belongs to a restaurant if:
 *   (a) User.restaurantId matches, OR
 *   (b) CustomerProfile.restaurantsVisited contains the restaurantId
 */
async function resolveRestaurantMobiles(restaurantId: string): Promise<Set<string>> {
  const rid = new Types.ObjectId(restaurantId);

  // Source A: Users who registered with this restaurant (OTP signup, admin-created)
  const userMobiles = new Set<string>();
  const restaurantUsers = await UserModel.find({
    role: UserRole.CUSTOMER,
    restaurantId: rid,
  })
    .setOptions({ bypassTenant: true })
    .lean()
    .exec();
  for (const u of restaurantUsers) {
    userMobiles.add(digitsOnly(u.mobile));
  }

  // Source B: CustomerProfiles that have visited this restaurant
  const profileMobiles = new Set<string>();
  const visitingProfiles = await CustomerProfileModel.find({
    restaurantsVisited: rid,
  })
    .setOptions({ bypassTenant: true })
    .lean()
    .exec();
  for (const p of visitingProfiles) {
    profileMobiles.add(digitsOnly(p.mobile));
  }

  // Union is the complete set of mobiles that belong to this restaurant
  return new Set([...userMobiles, ...profileMobiles]);
}

export const CustomersService = {
  /**
   * Get customers scoped to a single restaurant.
   *
   * A customer appears in a restaurant's list if they have at least one
   * restaurant-scoped interaction: started a table session, placed an order,
   * completed a payment, made a reservation, submitted feedback, or was
   * created directly by the restaurant admin.
   *
   * Data sources (union, deduplicated by mobile):
   *  1. Users with role=CUSTOMER and restaurantId == this restaurant
   *  2. CustomerProfiles whose restaurantsVisited array includes this restaurant
   */
  async getAdminCustomers(
    restaurantId: string,
    filters: { status?: string; tier?: string; q?: string; page?: number; perPage?: number },
  ): Promise<GetCustomersResult> {
    // ── Step 1: Resolve all mobile numbers belonging to this restaurant ────
    const relevantMobiles = await resolveRestaurantMobiles(restaurantId);

    // ── Step 2: Compute metrics directly from orders + sessions ───────────
    // This is the authoritative source — NOT the analytics module (unreliable).
    const metricsByMobile = await computeCustomerMetrics(
      Array.from(relevantMobiles),
      restaurantId,
    );

    // ── Step 3: Load all matching Users (any mobile format) ────────────────
    // Build a flat list of every possible mobile-string variant so we match
    // User records regardless of whether they store '+91', '91', or plain digits.
    const allVariants: string[] = [];
    for (const mobile of relevantMobiles) {
      for (const fmt of mobileFormats(mobile)) {
        allVariants.push(fmt);
      }
    }

    const users = allVariants.length > 0
      ? await UserModel.find({
          role: UserRole.CUSTOMER,
          mobile: { $in: allVariants },
        })
          .setOptions({ bypassTenant: true })
          .lean()
          .exec()
      : [];

    // ── Step 4: Load matching CustomerProfiles (for name/email fallback only) ──
    const profiles = allVariants.length > 0
      ? await CustomerProfileModel.find({
          mobile: { $in: Array.from(relevantMobiles) },
        })
          .setOptions({ bypassTenant: true })
          .lean()
          .exec()
      : [];

    // Index profiles by mobile (digits-only) for fast lookup
    const profileByMobile = new Map<string, any>();
    for (const p of profiles) {
      profileByMobile.set(digitsOnly(p.mobile), p);
    }

    // ── Step 5: Build the customer list using computed metrics ────────────
    let totalSpentSum = 0;
    let totalVisitsSum = 0;
    let loyal = 0;
    let gold = 0;
    let silver = 0;
    let bronze = 0;
    let active = 0;
    let inactive = 0;
    const newCutoff = Date.now() - NEW_CUSTOMER_DAYS * 24 * 60 * 60 * 1000;
    let newCount = 0;

    const items: { dto: CustomerDto; date: number }[] = [];
    const seenMobiles = new Set<string>();

    // 5a. Every matching User → shape into CustomerDto with real metrics
    for (const u of users) {
      const key = digitsOnly(u.mobile);
      seenMobiles.add(key);
      const profile = profileByMobile.get(key) || null;
      const metrics = metricsByMobile.get(key) || null;
      const dto = shapeFromUser(u, profile, metrics);

      const spent = metrics?.totalSpent ?? profile?.totalSpent ?? 0;
      const visits = metrics?.totalVisits ?? profile?.totalVisits ?? 0;
      totalSpentSum += spent;
      totalVisitsSum += visits;
      if (dto.loyaltyTier === 'Gold') gold += 1;
      else if (dto.loyaltyTier === 'Silver') silver += 1;
      else bronze += 1;
      if (dto.loyaltyTier !== 'Bronze') loyal += 1;
      if (dto.status === 'Active') active += 1;
      else inactive += 1;
      const first = profile?.firstVisitAt ? new Date(profile.firstVisitAt) : new Date(u.createdAt);
      const ts = !isNaN(first.getTime()) ? first.getTime() : Date.now();
      if (ts >= newCutoff) newCount += 1;
      items.push({ dto, date: ts });
    }

    // 5b. Standalone profiles (no matching User) — customers who visited
    //     but never did an OTP/email signup (e.g. reservation-only guests).
    for (const p of profiles) {
      const key = digitsOnly(p.mobile);
      if (seenMobiles.has(key)) continue;
      seenMobiles.add(key);
      const synthUser = {
        _id: p._id,
        name: p.name || p.mobile,
        email: p.email || '',
        mobile: p.mobile,
        avatar: undefined,
      };
      const metrics = metricsByMobile.get(key) || null;
      const dto = shapeFromUser(synthUser, p, metrics);

      const spent = metrics?.totalSpent ?? p.totalSpent ?? 0;
      const visits = metrics?.totalVisits ?? p.totalVisits ?? 0;
      totalSpentSum += spent;
      totalVisitsSum += visits;
      if (dto.loyaltyTier === 'Gold') gold += 1;
      else if (dto.loyaltyTier === 'Silver') silver += 1;
      else bronze += 1;
      if (dto.loyaltyTier !== 'Bronze') loyal += 1;
      if (dto.status === 'Active') active += 1;
      else inactive += 1;
      const first = p?.firstVisitAt ? new Date(p.firstVisitAt) : new Date();
      const ts = !isNaN(first.getTime()) ? first.getTime() : Date.now();
      if (ts >= newCutoff) newCount += 1;
      items.push({ dto, date: ts });
    }

    // Newest first
    const shaped = items.sort((a, b) => b.date - a.date).map((i) => i.dto);
    const total = shaped.length;
    const filtered = shaped.filter((c) => matchesFilters(c, filters));
    const perPage = filters.perPage && filters.perPage > 0 ? filters.perPage : 8;
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const start = (page - 1) * perPage;
    const customers = filtered.slice(start, start + perPage);

    const denom = Math.max(1, gold + silver + bronze);
    const topCustomers = [...shaped]
      .sort((a, b) => b.totalSpentRaw - a.totalSpentRaw)
      .slice(0, 5)
      .map((c, i) => ({
        rank: i + 1,
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        spent: c.totalSpent,
        spentRaw: c.totalSpentRaw,
      }));

    return {
      customers,
      total: filtered.length,
      page,
      perPage,
      stats: {
        totalCustomers: total,
        totalCustomersChange: '+0%',
        loyalCustomers: loyal,
        loyalCustomersChange: '+0%',
        totalVisits: totalVisitsSum,
        totalVisitsChange: '+0%',
        totalSpent: formatINR(totalSpentSum),
        totalSpentChange: '+0%',
      },
      topCustomers,
      loyaltyDistribution: {
        gold,
        silver,
        bronze,
        goldPct: Math.round((gold / denom) * 100),
        silverPct: Math.round((silver / denom) * 100),
        bronzePct: Math.round((bronze / denom) * 100),
      },
      customerOverview: {
        active,
        inactive,
        new: newCount,
        total,
      },
    };
  },

  /**
   * Get a single customer by ID, but ONLY if they belong to the given restaurant.
   */
  async getCustomerById(restaurantId: string, id: string): Promise<CustomerDto> {
    const user = await UserModel.findOne({
      _id: new Types.ObjectId(id),
      role: UserRole.CUSTOMER,
    })
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();

    if (user) {
      // Verify this user belongs to the restaurant
      const mobile = digitsOnly(user.mobile);
      const belongs = await customerBelongsToRestaurant(restaurantId, user, mobile);
      if (!belongs) {
        throw new AppError('Customer not found at this restaurant', 404, ErrorCode.NOT_FOUND);
      }
      const profile = await CustomerProfileModel.findOne({ mobile })
        .setOptions({ bypassTenant: true })
        .lean()
        .exec();
      // Compute real metrics from orders/sessions
      const metricsMap = await computeCustomerMetrics([mobile], restaurantId);
      const metrics = metricsMap.get(mobile) || null;
      return shapeFromUser(user, profile, metrics);
    }

    // Fallback: standalone CustomerProfile (no User record)
    const profile = await CustomerProfileModel.findById(new Types.ObjectId(id))
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    if (!profile) {
      throw new AppError('Customer not found', 404, ErrorCode.NOT_FOUND);
    }
    // Verify profile belongs to this restaurant
    const rid = new Types.ObjectId(restaurantId);
    const visited = (profile.restaurantsVisited || []).some(
      (r: any) => r.toString() === restaurantId,
    );
    if (!visited) {
      throw new AppError('Customer not found at this restaurant', 404, ErrorCode.NOT_FOUND);
    }
    // Compute real metrics from orders/sessions
    const mobile = digitsOnly(profile.mobile);
    const metricsMap = await computeCustomerMetrics([mobile], restaurantId);
    const metrics = metricsMap.get(mobile) || null;
    return shapeFromUser(
      {
        _id: profile._id,
        name: profile.name || profile.mobile,
        email: profile.email || '',
        mobile: profile.mobile,
        avatar: undefined,
      },
      profile,
      metrics,
    );
  },

  async createCustomer(
    restaurantId: string,
    data: { name: string; mobile: string; email?: string; tags?: string[] },
  ): Promise<CustomerDto> {
    const mobile = data.mobile; // digits-only (schema-normalized)
    const rid = restaurantId ? new Types.ObjectId(restaurantId) : undefined;

    const existing = await UserModel.findOne({
      role: UserRole.CUSTOMER,
      $or: [
        { mobile },
        { mobile: `+${mobile}` },
        { mobile: `+91${mobile}` },
        { mobile: `91${mobile}` },
      ],
    })
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    if (existing) {
      throw new AppError('A user with this mobile number already exists', 409, ErrorCode.CONFLICT);
    }

    let user;
    try {
      user = await UserModel.create({
        name: data.name,
        mobile,
        ...(data.email ? { email: data.email } : {}),
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        ...(rid ? { restaurantId: rid } : {}),
        isMobileVerified: false,
        isEmailVerified: false,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new AppError('A user with this email already exists', 409, ErrorCode.CONFLICT);
      }
      throw err;
    }

    // Mirror into the analytics profile — ensure restaurantsVisited is set so this
    // customer appears in the restaurant's customer list.
    const profile = await CustomerProfileModel.findOne({ mobile })
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    if (!profile) {
      try {
        await CustomerProfileModel.create({
          mobile,
          name: data.name,
          ...(data.email ? { email: data.email } : {}),
          ...(rid ? { restaurantsVisited: [rid] } : {}),
          ...(data.tags && data.tags.length ? { tags: data.tags } : {}),
          totalVisits: 0,
          totalSpent: 0,
          firstVisitAt: new Date(),
          lastVisitAt: new Date(),
        });
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
      }
    } else if (
      rid &&
      Array.isArray(profile.restaurantsVisited) &&
      !profile.restaurantsVisited.some((r: any) => r.toString() === restaurantId)
    ) {
      await CustomerProfileModel.updateOne(
        { _id: profile._id },
        {
          $addToSet: { restaurantsVisited: rid },
          ...(data.tags && data.tags.length ? { tags: data.tags } : {}),
        },
      )
        .setOptions({ bypassTenant: true })
        .exec();
    }

    const created = await UserModel.findById(user._id)
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    return shapeFromUser(created, profile || null);
  },

  async updateCustomer(
    restaurantId: string,
    id: string,
    updates: { name?: string; email?: string; tags?: string[] },
  ): Promise<CustomerDto> {
    const set: Record<string, unknown> = {};
    if (updates.name !== undefined) set.name = updates.name;
    if (updates.email !== undefined) set.email = updates.email || undefined;

    const user = await UserModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), role: UserRole.CUSTOMER },
      { $set: set },
      { new: true },
    )
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();

    if (user) {
      // Verify this user belongs to the restaurant
      const mobile = digitsOnly(user.mobile);
      const belongs = await customerBelongsToRestaurant(restaurantId, user, mobile);
      if (!belongs) {
        throw new AppError('Customer not found at this restaurant', 404, ErrorCode.NOT_FOUND);
      }
      if (updates.tags !== undefined) {
        await CustomerProfileModel.updateOne(
          { mobile },
          { $set: { tags: updates.tags } },
          { upsert: false },
        )
          .setOptions({ bypassTenant: true })
          .exec();
      }
      const profile = await CustomerProfileModel.findOne({ mobile })
        .setOptions({ bypassTenant: true })
        .lean()
        .exec();
      return shapeFromUser(user, profile);
    }

    // Fallback: standalone profile
    const profile = await CustomerProfileModel.findById(new Types.ObjectId(id))
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    if (!profile) {
      throw new AppError('Customer not found', 404, ErrorCode.NOT_FOUND);
    }
    // Verify profile belongs to this restaurant
    const rid = new Types.ObjectId(restaurantId);
    const visited = (profile.restaurantsVisited || []).some(
      (r: any) => r.toString() === restaurantId,
    );
    if (!visited) {
      throw new AppError('Customer not found at this restaurant', 404, ErrorCode.NOT_FOUND);
    }
    const profileSet: Record<string, unknown> = {};
    if (updates.name !== undefined) profileSet.name = updates.name;
    if (updates.email !== undefined) profileSet.email = updates.email || undefined;
    if (updates.tags !== undefined) profileSet.tags = updates.tags;
    await CustomerProfileModel.updateOne({ _id: profile._id }, { $set: profileSet })
      .setOptions({ bypassTenant: true })
      .exec();
    const updated = await CustomerProfileModel.findById(profile._id)
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    return shapeFromUser(
      {
        _id: profile._id,
        name: profile.name || profile.mobile,
        email: profile.email || '',
        mobile: profile.mobile,
        avatar: undefined,
      },
      updated || profile,
    );
  },

  async deleteCustomer(restaurantId: string, id: string): Promise<void> {
    const user = await UserModel.findOne({
      _id: new Types.ObjectId(id),
      role: UserRole.CUSTOMER,
    })
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();

    if (user) {
      // Verify this user belongs to the restaurant
      const mobile = digitsOnly(user.mobile);
      const belongs = await customerBelongsToRestaurant(restaurantId, user, mobile);
      if (!belongs) {
        throw new AppError('Customer not found at this restaurant', 404, ErrorCode.NOT_FOUND);
      }
      await UserModel.deleteOne({ _id: user._id })
        .setOptions({ bypassTenant: true })
        .exec();
      await CustomerProfileModel.deleteOne({ mobile })
        .setOptions({ bypassTenant: true })
        .exec();
      return;
    }

    // Fallback: standalone profile
    const profile = await CustomerProfileModel.findById(new Types.ObjectId(id))
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    if (!profile) {
      throw new AppError('Customer not found', 404, ErrorCode.NOT_FOUND);
    }
    const rid = new Types.ObjectId(restaurantId);
    const visited = (profile.restaurantsVisited || []).some(
      (r: any) => r.toString() === restaurantId,
    );
    if (!visited) {
      throw new AppError('Customer not found at this restaurant', 404, ErrorCode.NOT_FOUND);
    }
    await CustomerProfileModel.deleteOne({ _id: profile._id })
      .setOptions({ bypassTenant: true })
      .exec();
  },
};

/**
 * Check whether a User (which may or may not be scoped to a restaurant)
 * actually belongs to the given restaurant.
 *
 * A user belongs if:
 *   1. User.restaurantId matches, OR
 *   2. Their CustomerProfile (matched by mobile) has restaurantsVisited
 *      containing the restaurantId
 */
async function customerBelongsToRestaurant(
  restaurantId: string,
  user: any,
  mobile: string,
): Promise<boolean> {
  // Direct restaurantId match on the User record
  if (user.restaurantId && user.restaurantId.toString() === restaurantId) {
    return true;
  }

  // Check CustomerProfile restaurantsVisited
  const profile = await CustomerProfileModel.findOne({ mobile })
    .setOptions({ bypassTenant: true })
    .lean()
    .exec();
  if (profile && Array.isArray(profile.restaurantsVisited)) {
    return profile.restaurantsVisited.some(
      (r: any) => r.toString() === restaurantId,
    );
  }

  return false;
}
