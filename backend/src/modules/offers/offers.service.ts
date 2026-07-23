import { Types } from 'mongoose';
import { OfferModel, IOffer } from './offers.model';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { buildPaginationMeta } from '../../utils/pagination';
import { socketService } from '../../sockets/socket.service';
import { SocketEvent } from '../../constants/events';

export class OffersService {
  /**
   * Create a new offer.
   */
  static async create(
    restaurantId: string | Types.ObjectId,
    data: {
      title: string;
      description?: string;
      promoCode: string;
      discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
      discountValue: number;
      requiredPoints?: number;
      minOrderAmount?: number | null;
      maxDiscount?: number | null;
      startDate: string;
      expiryDate: string;
      status?: 'ACTIVE' | 'INACTIVE';
      displayPriority?: number;
      image?: string;
    },
  ): Promise<IOffer> {
    const offer = await OfferModel.create({
      restaurantId,
      title: data.title,
      description: data.description ?? '',
      promoCode: data.promoCode.toUpperCase(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      requiredPoints: data.requiredPoints ?? 0,
      minOrderAmount: data.minOrderAmount ?? null,
      maxDiscount: data.maxDiscount ?? null,
      startDate: new Date(data.startDate),
      expiryDate: new Date(data.expiryDate),
      status: data.status ?? 'INACTIVE',
      displayPriority: data.displayPriority ?? 0,
      image: data.image ?? '',
    });

    socketService.emitToRestaurant(
      restaurantId.toString(),
      SocketEvent.OFFER_UPDATED,
      { action: 'created', offerId: offer._id.toString() },
    );

    return offer;
  }

  /**
   * List offers for a restaurant with pagination and filtering.
   */
  static async list(
    restaurantId: string | Types.ObjectId,
    query: {
      page: number;
      limit: number;
      status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
      q?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{ offers: IOffer[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const filter: Record<string, unknown> = { restaurantId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.q) {
      filter.$or = [
        { title: { $regex: query.q, $options: 'i' } },
        { promoCode: { $regex: query.q, $options: 'i' } },
        { description: { $regex: query.q, $options: 'i' } },
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const skip = (query.page - 1) * query.limit;

    const [offers, total] = await Promise.all([
      OfferModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      OfferModel.countDocuments(filter),
    ]);

    return {
      offers: offers as unknown as IOffer[],
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  /**
   * Get a single offer by ID.
   */
  static async getById(
    restaurantId: string | Types.ObjectId,
    offerId: string | Types.ObjectId,
  ): Promise<IOffer> {
    const offer = await OfferModel.findOne({ _id: offerId, restaurantId }).lean();
    if (!offer) {
      throw new AppError('Offer not found', 404, ErrorCode.NOT_FOUND);
    }
    return offer as unknown as IOffer;
  }

  /**
   * Update an offer.
   */
  static async update(
    restaurantId: string | Types.ObjectId,
    offerId: string | Types.ObjectId,
    data: Partial<{
      title: string;
      description: string;
      promoCode: string;
      discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
      discountValue: number;
      requiredPoints: number;
      minOrderAmount: number | null;
      maxDiscount: number | null;
      startDate: string;
      expiryDate: string;
      status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
      displayPriority: number;
      image: string;
    }>,
  ): Promise<IOffer> {
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.promoCode !== undefined) updateData.promoCode = data.promoCode.toUpperCase();
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.discountValue !== undefined) updateData.discountValue = data.discountValue;
    if (data.requiredPoints !== undefined) updateData.requiredPoints = data.requiredPoints;
    if (data.minOrderAmount !== undefined) updateData.minOrderAmount = data.minOrderAmount;
    if (data.maxDiscount !== undefined) updateData.maxDiscount = data.maxDiscount;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.expiryDate !== undefined) updateData.expiryDate = new Date(data.expiryDate);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.displayPriority !== undefined) updateData.displayPriority = data.displayPriority;
    if (data.image !== undefined) updateData.image = data.image;

    const offer = await OfferModel.findOneAndUpdate(
      { _id: offerId, restaurantId },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!offer) {
      throw new AppError('Offer not found', 404, ErrorCode.NOT_FOUND);
    }

    socketService.emitToRestaurant(
      restaurantId.toString(),
      SocketEvent.OFFER_UPDATED,
      { action: 'updated', offerId: offer._id.toString() },
    );

    return offer;
  }

  /**
   * Delete an offer.
   */
  static async delete(
    restaurantId: string | Types.ObjectId,
    offerId: string | Types.ObjectId,
  ): Promise<void> {
    const offer = await OfferModel.findOneAndDelete({ _id: offerId, restaurantId });
    if (!offer) {
      throw new AppError('Offer not found', 404, ErrorCode.NOT_FOUND);
    }

    socketService.emitToRestaurant(
      restaurantId.toString(),
      SocketEvent.OFFER_UPDATED,
      { action: 'deleted', offerId },
    );
  }

  /**
   * Toggle offer status (ACTIVE / INACTIVE).
   */
  static async toggleStatus(
    restaurantId: string | Types.ObjectId,
    offerId: string | Types.ObjectId,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<IOffer> {
    const offer = await OfferModel.findOneAndUpdate(
      { _id: offerId, restaurantId },
      { $set: { status } },
      { new: true },
    );

    if (!offer) {
      throw new AppError('Offer not found', 404, ErrorCode.NOT_FOUND);
    }

    socketService.emitToRestaurant(
      restaurantId.toString(),
      SocketEvent.OFFER_UPDATED,
      { action: 'status_changed', offerId: offer._id.toString(), status },
    );

    return offer;
  }

  /**
   * Get active offers for a restaurant (customer-facing).
   * Only returns offers that are ACTIVE and within their validity period.
   */
  static async getActiveOffers(
    restaurantId: string | Types.ObjectId,
  ): Promise<IOffer[]> {
    const now = new Date();
    const offers = await OfferModel.find({
      restaurantId,
      status: 'ACTIVE',
      startDate: { $lte: now },
      expiryDate: { $gte: now },
    })
      .sort({ displayPriority: -1, createdAt: -1 })
      .lean();

    return offers as unknown as IOffer[];
  }
}
