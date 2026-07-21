import { Types } from 'mongoose';
import { CustomerProfileModel } from '../analytics/customerProfile.model';
import { UserModel } from '../users/users.model';
import { UserRole } from '../../constants/roles';
import { UserStatus } from '../../constants/statuses';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';

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

// Build a CustomerDto from a User (the login identity — the source of truth)
// joined with its optional analytics profile (loyalty/visits/spend). Customers
// that signed up via OTP or reservations may not yet have a profile, in which
// case analytics default to zero and the customer is shown as Inactive.
function shapeFromUser(user: any, profile?: any | null): CustomerDto {
  const totalSpent = profile?.totalSpent || 0;
  const totalVisits = profile?.totalVisits || 0;
  const lastVisitAt = profile?.lastVisitAt || null;
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
    lastOrderId: '',
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

export const CustomersService = {
  // The Customers page is backed by the `users` collection (role=CUSTOMER) — that
  // is where every customer is created (OTP signup, reservations, admin add). We do
  // NOT scope by restaurant so that ALL previously-created customers are shown,
  // including OTP signups whose `restaurantId` is null. Loyalty analytics are joined
  // from `customerprofiles` by mobile (digits-only match).
  async getAdminCustomers(
    restaurantId: string,
    filters: { status?: string; tier?: string; q?: string; page?: number; perPage?: number },
  ): Promise<GetCustomersResult> {
    // NOTE: The global tenantPlugin injects `tenantId: <currentTenant>` into every
    // Mongoose query. Landing-page signups (and OTP signups) are created WITHOUT a
    // tenantId, so tenant-scoping would hide them. We intentionally BYPASS tenant
    // scoping here so the admin sees ALL their customers, including the signups.
    const users = await UserModel.find({ role: UserRole.CUSTOMER }).setOptions({ bypassTenant: true }).lean().exec();
    const profiles = await CustomerProfileModel.find({}).setOptions({ bypassTenant: true }).lean().exec();

    // Index loyalty profiles by mobile so we can (a) join analytics onto users
    // and (b) surface profiles that have no matching login identity at all.
    const profileByMobile = new Map<string, any>();
    for (const p of profiles) {
      profileByMobile.set(digitsOnly(p.mobile), p);
    }

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

    // 1) Every customer login identity (users with role CUSTOMER).
    for (const u of users) {
      const key = digitsOnly(u.mobile);
      seenMobiles.add(key);
      const profile = profileByMobile.get(key) || null;
      const dto = shapeFromUser(u, profile);
      totalSpentSum += profile?.totalSpent || 0;
      totalVisitsSum += profile?.totalVisits || 0;
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

    // 2) Loyalty/reservation profiles that have no matching user login — e.g.
    //    customers who booked or ordered but never did an OTP/email signup.
    //    Without this, the admin only ever sees customers who signed up.
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
      const dto = shapeFromUser(synthUser, p);
      totalSpentSum += p.totalSpent || 0;
      totalVisitsSum += p.totalVisits || 0;
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

    // Newest first so freshly registered / created customers appear at the top
    // of the admin list (and stay visible after a live re-fetch).
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

  async getCustomerById(restaurantId: string, id: string): Promise<CustomerDto> {
    const user = await UserModel.findOne({
      _id: new Types.ObjectId(id),
      role: UserRole.CUSTOMER,
    })
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    if (user) {
      const profile = await CustomerProfileModel.findOne({ mobile: digitsOnly(user.mobile) })
        .setOptions({ bypassTenant: true })
        .lean()
        .exec();
      return shapeFromUser(user, profile);
    }
    // Fallback: this id may be a standalone loyalty/reservation profile.
    const profile = await CustomerProfileModel.findById(new Types.ObjectId(id))
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    if (!profile) {
      throw new AppError('Customer not found', 404, ErrorCode.NOT_FOUND);
    }
    return shapeFromUser(
      { _id: profile._id, name: profile.name || profile.mobile, email: profile.email || '', mobile: profile.mobile, avatar: undefined },
      profile,
    );
  },

  async createCustomer(
    restaurantId: string,
    data: { name: string; mobile: string; email?: string; tags?: string[] },
  ): Promise<CustomerDto> {
    const mobile = data.mobile; // digits-only (schema-normalized)
    const rid = restaurantId ? new Types.ObjectId(restaurantId) : undefined;

    // The User is the login identity. Block duplicate mobile numbers with a clear
    // 409 so the admin knows this customer already exists. We also guard the common
    // Indian dialing formats ('+91', '91' prefixes) against the digits-only value.
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
      // Email is a sparse unique field; a collision surfaces as 11000.
      if (err?.code === 11000) {
        throw new AppError('A user with this email already exists', 409, ErrorCode.CONFLICT);
      }
      throw err;
    }

    // Mirror into the analytics profile (no auth) so this customer shows spend/visits
    // consistently alongside OTP/reservation-created customers. Never overwrite an
    // existing profile's accumulated analytics.
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
      // Tags live on the analytics profile (the User model has no tags field).
      if (updates.tags !== undefined) {
        await CustomerProfileModel.updateOne(
          { mobile: digitsOnly(user.mobile) },
          { $set: { tags: updates.tags } },
          { upsert: false },
        )
          .setOptions({ bypassTenant: true })
          .exec();
      }
      const profile = await CustomerProfileModel.findOne({ mobile: digitsOnly(user.mobile) })
        .setOptions({ bypassTenant: true })
        .lean()
        .exec();
      return shapeFromUser(user, profile);
    }

    // Fallback: standalone loyalty/reservation profile (no login identity).
    const profile = await CustomerProfileModel.findById(new Types.ObjectId(id))
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    if (!profile) {
      throw new AppError('Customer not found', 404, ErrorCode.NOT_FOUND);
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
      { _id: profile._id, name: profile.name || profile.mobile, email: profile.email || '', mobile: profile.mobile, avatar: undefined },
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
      // Remove the login identity AND its analytics profile so the customer fully
      // disappears from the admin view.
      await UserModel.deleteOne({ _id: user._id })
        .setOptions({ bypassTenant: true })
        .exec();
      await CustomerProfileModel.deleteOne({ mobile: digitsOnly(user.mobile) })
        .setOptions({ bypassTenant: true })
        .exec();
      return;
    }
    // Fallback: standalone loyalty/reservation profile (no login identity).
    const profile = await CustomerProfileModel.findById(new Types.ObjectId(id))
      .setOptions({ bypassTenant: true })
      .lean()
      .exec();
    if (!profile) {
      throw new AppError('Customer not found', 404, ErrorCode.NOT_FOUND);
    }
    await CustomerProfileModel.deleteOne({ _id: profile._id })
      .setOptions({ bypassTenant: true })
      .exec();
  },
};
