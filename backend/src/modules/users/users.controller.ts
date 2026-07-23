// src/modules/users/users.controller.ts
// User route handlers

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import * as userService from './users.service';
import { comparePassword, hashPassword } from '../../utils/crypto';
import { sendPasswordChangedAlertEmail } from '../../services/mail.service';
import logger from '../../config/logger';

import * as otpService from '../../services/otp.service';
import { sendOTPEmail } from '../../services/mail.service';
import { LoyaltyWalletModel } from '../loyalty/loyalty.model';
import { NotificationModel } from '../notifications/notifications.model';

/**
 * GET /auth/me — Get current authenticated user's profile.
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.findById(req.user!._id);

  if (!user) {
    throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
  }

  sendSuccess(res, { user });
});

/**
 * POST /users/me/request-otp — Send OTP to registered email address for profile/password updates.
 */
export const requestProfileOtp = asyncHandler(async (req: Request, res: Response) => {
  const email = req.user?.email;
  if (!email) {
    throw new AppError('No registered email found for this account', 400, ErrorCode.INVALID_REQUEST);
  }

  const { otp, expiresAt } = await otpService.createOTP(email, 'email');
  sendOTPEmail(email, otp).catch((err) => {
    logger.error('Failed to send profile OTP email asynchronously', err);
  });

  const responseData: any = {
    otpSent: true,
    otpExpiresAt: expiresAt,
    otpExpiresIn: 120,
  };

  if (process.env.NODE_ENV !== 'production') {
    responseData.devOtp = otp;
  }

  sendSuccess(res, responseData);
});

/**
 * POST /users/me/request-mobile-otp — Send mobile verification OTP for phone updates.
 */
export const requestMobileOtp = asyncHandler(async (req: Request, res: Response) => {
  const { mobile } = req.body;
  if (!mobile) {
    throw new AppError('Mobile number is required', 400, ErrorCode.INVALID_REQUEST);
  }

  const { otp, expiresAt } = await otpService.createOTP(mobile, 'mobile');

  console.log("\n-----------------------------------------");
  console.log(`[CleanServe Security] SMS OTP sent to ${mobile} is: ${otp}`);
  console.log("-----------------------------------------\n");

  const responseData: any = {
    otpSent: true,
    otpExpiresAt: expiresAt,
    otpExpiresIn: 300,
    otp,
  };

  sendSuccess(res, responseData);
});

/**
 * PATCH /users/me — Update current user's profile.
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { otp, mobileOtp, ...updates } = req.body;

  // If mobile number is being updated, verify it with mobileOtp
  if (updates.mobile && updates.mobile !== (req.user as any)?.mobile) {
    if (!mobileOtp) {
      throw new AppError('Mobile OTP verification is required to update phone number.', 400, ErrorCode.INVALID_REQUEST);
    }
    await otpService.verifyOTP(updates.mobile, 'mobile', mobileOtp);
  }

  // If OTP is provided, verify it against the registered email
  if (otp) {
    const userEmail = req.user?.email;
    if (!userEmail) {
      throw new AppError('No registered email found to verify OTP', 400, ErrorCode.INVALID_REQUEST);
    }
    await otpService.verifyOTP(userEmail, 'email', otp);
  }

  const user = await userService.updateProfile(req.user!._id, updates);

  if (!user) {
    throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
  }

  sendSuccess(res, { user });
});

/**
 * PATCH /users/me/password — Change password.
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.findByIdWithTokens(req.user!._id);

  if (!user) {
    throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
  }

  const { currentPassword, newPassword, otp } = req.body;

  if (otp) {
    await otpService.verifyOTP(user.email, 'email', otp);
  }

  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400, ErrorCode.INVALID_REQUEST);
  }

  user.password = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.refreshTokens = []; // Invalidate all sessions on password change
  await user.save();

  try {
    await sendPasswordChangedAlertEmail(
      user.email,
      user.name,
      req.ip,
      req.headers['user-agent']
    );
  } catch (err) {
    logger.error('Failed to send password changed alert', err);
  }

  sendSuccess(res, { message: 'Password changed successfully. Please log in again.' });
});

/**
 * DELETE /users/me — Soft-delete account (requires confirmation text).
 */
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  await userService.softDeleteUser(req.user!._id);
  sendSuccess(res, { message: 'Account scheduled for deletion' });
});

/**
 * GET /users/me/loyalty - Get loyalty wallet and transactions for current user
 */
export const getLoyalty = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.findById(req.user!._id);
  
  if (!user || !user.mobile) {
    return sendSuccess(res, { wallet: null });
  }

  // Find all wallets for this mobile number
  const wallets = await LoyaltyWalletModel.find({ mobile: user.mobile }).sort({ updatedAt: -1 }).lean();

  sendSuccess(res, { wallets });
});

/**
 * GET /users/me/notifications - Get notifications for current user
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.findById(req.user!._id);
  
  if (!user) {
    return sendSuccess(res, { notifications: [] });
  }

  const notifications = await NotificationModel.find({
    $or: [
      { 'metadata.mobile': user.mobile },
      { 'metadata.email': user.email },
      ...(user.mobile ? [] : [{ 'metadata.customerName': user.name }])
    ]
  }).sort({ createdAt: -1 }).limit(50).lean();

  sendSuccess(res, { notifications });
});

/**
 * GET /users/me/order-history — Get past paid bills for the current customer
 */
export const getOrderHistory = asyncHandler(async (req: Request, res: Response) => {
  const { UserModel } = await import('./users.model');
  const user = await UserModel.findById(req.user!._id).lean();
  if (!user) {
    throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
  }

  const { BillingModel } = await import('../billing/billing.model');
  const { BillStatus } = await import('../billing/billing.schema');

  // Pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const query = {
    status: BillStatus.PAID,
    $or: [
      { customerId: user._id },
      { customerPhone: user.mobile }
    ]
  };

  const total = await BillingModel.countDocuments(query);

  const bills = await BillingModel.find(query)
    .sort({ paidAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('restaurantId', 'name logo')
    .populate({
      path: 'orderIds',
      select: 'items status',
    })
    .lean();

  // Format response optimized for the frontend
  const formattedHistory = bills.map((bill: any) => {
    // Flatten ordered items from all orders in this bill
    const allItems = bill.orderIds?.flatMap((order: any) => order.items || []) || [];
    
    const formattedItems = allItems.map((item: any) => ({
      itemName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      lineTotal: item.price * item.quantity,
    }));

    return {
      restaurantId: bill.restaurantId?._id || null,
      restaurantName: bill.restaurantId?.name || 'Unknown Restaurant',
      restaurantLogo: bill.restaurantId?.logo || null,
      invoiceNumber: bill.invoiceNumber || null,
      billNumber: bill._id,
      paidAt: bill.paidAt || bill.createdAt,
      paymentMethod: bill.paymentMethod || 'UNKNOWN',
      grandTotal: bill.finalAmount,
      items: formattedItems,
      summary: {
        subtotal: bill.subtotal,
        tax: bill.taxAmount + (bill.serviceCharge || 0),
        discount: bill.discountAmount - (bill.appliedCoupons?.reduce((sum: number, c: any) => sum + (c.discountAmount || 0), 0) || 0),
        couponDiscount: bill.appliedCoupons?.reduce((sum: number, c: any) => sum + (c.discountAmount || 0), 0) || 0,
        grandTotal: bill.finalAmount,
      },
      status: 'PAID'
    };
  });

  sendSuccess(res, { 
    orderHistory: formattedHistory,
    pagination: {
      page,
      limit,
      total,
      hasNext: skip + bills.length < total
    }
  });
});

/**
 * GET /users/me/reservations/slots — Get popular time slots and their availability
 */
export const getReservationSlots = asyncHandler(async (req: Request, res: Response) => {
  const { restaurantId, date, guests } = req.query;
  if (!restaurantId || !date) {
    throw new AppError('Missing restaurantId or date', 400, ErrorCode.INVALID_REQUEST);
  }

  const { ReservationModel } = await import('../reservations/reservations.model');
  const { TableModel } = await import('../tables/tables.model');
  const { ReservationStatus } = await import('../../constants/statuses');

  const guestCount = typeof guests === 'string' ? parseInt(guests, 10) : 2;

  // Hardcoded popular slots (for frontend display)
  const TIME_SLOTS = [
    '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
    '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM',
  ];

  // Helper to parse 12h to 24h
  const parseTimeTo24h = (time12h: string): string => {
    const [time, modifier] = time12h.split(' ');
    const [hoursStr, minutes] = time.split(':');
    let hours = hoursStr;
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  // Check how many tables have capacity >= requested guests
  const tables = await TableModel.find({ restaurantId, capacity: { $gte: guestCount } }).lean();
  const totalSuitableTables = tables.length;

  const reservations = await ReservationModel.find({
    restaurantId,
    date,
    status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] }
  }).lean();

  const availability = TIME_SLOTS.map(time => {
    const backendSlot = parseTimeTo24h(time);
    
    // Count how many reservations already exist for this slot (using the suitable tables)
    // NOTE: This assumes 1 reservation = 1 table.
    const bookings = reservations.filter((r: any) => r.slot === backendSlot).length;
    
    let status = 'available';
    if (totalSuitableTables === 0 || bookings >= totalSuitableTables) {
      status = 'unavailable';
    } else if (totalSuitableTables - bookings <= 2) {
      status = 'limited';
    }

    return { time, status };
  });

  sendSuccess(res, { slots: availability });
});

/**
 * GET /users/me/reservations — Get all reservations for the current customer
 */
export const getMyReservations = asyncHandler(async (req: Request, res: Response) => {
  const { UserModel } = await import('./users.model');
  const user = await UserModel.findById(req.user!._id).lean();
  if (!user) {
    throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
  }

  const { ReservationModel } = await import('../reservations/reservations.model');
  const reservations = await ReservationModel.find({ mobile: user.mobile }).sort({ date: -1, slot: -1 }).lean();
  sendSuccess(res, { reservations });
});

/**
 * POST /users/me/reservations — Create a new reservation for the current customer
 */
export const createMyReservation = asyncHandler(async (req: Request, res: Response) => {
  const { UserModel } = await import('./users.model');
  const user = await UserModel.findById(req.user!._id).lean();
  if (!user) {
    throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
  }

  const { ReservationsService } = await import('../reservations/reservations.service');
  const { ReservationStatus } = await import('../../constants/statuses');
  
  const { restaurantId, guests, date, slot, notes } = req.body;
  if (!restaurantId || !guests || !date || !slot) {
    throw new AppError('Missing required fields', 400, ErrorCode.INVALID_REQUEST);
  }

  const reservation = await ReservationsService.createReservation({
    restaurantId,
    customerName: user.name,
    customerEmail: user.email,
    mobile: user.mobile,
    guests: Number(guests),
    date,
    slot,
    notes,
    status: ReservationStatus.PENDING,
  });

  sendSuccess(res, { reservation }, 201);
});

/**
 * PATCH /users/me/reservations/:id — Update or cancel a customer's reservation
 */
export const updateMyReservation = asyncHandler(async (req: Request, res: Response) => {
  const { UserModel } = await import('./users.model');
  const user = await UserModel.findById(req.user!._id).lean();
  if (!user) {
    throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
  }

  const { ReservationModel } = await import('../reservations/reservations.model');
  const { id } = req.params;
  const updates = req.body;

  const reservation = await ReservationModel.findOneAndUpdate(
    { _id: id, mobile: user.mobile },
    updates,
    { new: true }
  ).lean();

  if (!reservation) {
    throw new AppError('Reservation not found or unauthorized', 404, ErrorCode.NOT_FOUND);
  }

  sendSuccess(res, { reservation });
});
