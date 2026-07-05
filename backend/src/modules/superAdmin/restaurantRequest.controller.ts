import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { RestaurantRequestModel } from './restaurantRequest.model';
import { UserModel } from '../users/users.model';
import { createRazorpayOrder as createRzpOrder, verifyRazorpaySignature as verifyRzpSig } from '../../services/razorpay.service';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { ok } from '../../utils/responses';
import { logAuditRaw } from '../auditLogs/auditLogs.helper';
import { AuditEntity } from '../auditLogs/auditLogs.types';
import { socketService } from '../../sockets/socket.service';
import { sendRestaurantSubmissionEmail } from '../../services/mail.service';

// Zod schema for Partner Request validation
export const createPartnerRequestSchema = z.object({
  restaurantName: z.string().trim().min(2, 'Restaurant name must be at least 2 characters'),
  ownerName: z.string().trim().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().trim().min(5, 'Address must be at least 5 characters'),
  city: z.string().trim().min(2, 'City must be at least 2 characters'),
  state: z.string().trim().min(2, 'State must be at least 2 characters'),
  country: z.string().trim().min(2, 'Country must be at least 2 characters'),
  pinCode: z.string().trim().min(6, 'Pin code must be at least 6 characters'),
  gstNumber: z.string().trim().optional(),
  cuisine: z.string().trim().min(2, 'Cuisine must be at least 2 characters'),
  branches: z.number().int().positive().default(1),
  expectedMonthlyOrders: z.number().int().nonnegative(),
  selectedPlan: z.string().min(1, 'Selected plan is required'),
  latitude: z.number(),
  longitude: z.number(),
  googleMapsUrl: z.string().trim().optional(),
  message: z.string().trim().optional(),

  // Razorpay payment details (optional, only for paid plans)
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

import { PlatformPlanModel } from './superAdmin.model';

export async function createRazorpayOrderForPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { plan } = req.body;
    if (!plan || typeof plan !== 'string') {
      throw new AppError('Plan name is required', 400, ErrorCode.INVALID_REQUEST);
    }

    const planDoc = await PlatformPlanModel.findOne({ name: plan });
    if (!planDoc) {
      throw new AppError('Plan not found', 404, ErrorCode.NOT_FOUND);
    }

    const amount = planDoc.priceMonthly;
    if (amount <= 0) {
      throw new AppError('Cannot create payment order for free plan', 400, ErrorCode.INVALID_REQUEST);
    }

    const receipt = `partner_req_${Date.now()}`;
    const order = await createRzpOrder({ amount, receipt });

    return ok(res, {
      orderId: order.id,
      amount,
      currency: 'INR',
    });
  } catch (error) {
    next(error);
  }
}

export async function submitPartnerRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createPartnerRequestSchema.parse(req.body);

    const emailLower = parsed.email.toLowerCase();
    
    // 1. Prevent duplicate email applications (PENDING or APPROVED)
    const existingEmailReq = await RestaurantRequestModel.findOne({
      email: emailLower,
      status: { $in: ['PENDING', 'APPROVED'] },
    }).setOptions({ bypassTenant: true });

    if (existingEmailReq) {
      throw new AppError('An application with this email already exists or is approved.', 400, ErrorCode.CONFLICT);
    }

    // Check duplicate email in users collection
    const existingEmailUser = await UserModel.findOne({
      email: emailLower,
    }).setOptions({ bypassTenant: true });

    if (existingEmailUser) {
      throw new AppError('This email is already registered to a user account.', 400, ErrorCode.CONFLICT);
    }

    // 2. Prevent duplicate phone number applications (PENDING or APPROVED)
    const existingPhoneReq = await RestaurantRequestModel.findOne({
      phone: parsed.phone,
      status: { $in: ['PENDING', 'APPROVED'] },
    }).setOptions({ bypassTenant: true });

    if (existingPhoneReq) {
      throw new AppError('An application with this phone number already exists or is approved.', 400, ErrorCode.CONFLICT);
    }

    // Check duplicate mobile in users collection
    const existingPhoneUser = await UserModel.findOne({
      mobile: parsed.phone,
    }).setOptions({ bypassTenant: true });

    if (existingPhoneUser) {
      throw new AppError('This phone number is already registered to a user account.', 400, ErrorCode.CONFLICT);
    }

    const planDoc = await PlatformPlanModel.findOne({ name: parsed.selectedPlan });
    const isPaid = planDoc ? planDoc.priceMonthly > 0 : parsed.selectedPlan !== 'Free';

    // 3. For paid plans, verify Razorpay payment
    let paymentDetails: any = {};
    if (isPaid) {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new AppError('Payment details are required for paid plans', 400, ErrorCode.INVALID_REQUEST);
      }

      const isValid = verifyRzpSig({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });

      if (!isValid) {
        throw new AppError('Razorpay payment verification failed', 400, ErrorCode.INVALID_REQUEST);
      }

      const priceMap: Record<string, number> = {
        Standard: 599,
        Premium: 999,
        Enterprise: 1999,
      };
      const paymentAmount = planDoc ? planDoc.priceMonthly : (priceMap[parsed.selectedPlan] || 0);

      paymentDetails = {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        paymentAmount,
        paymentCurrency: 'INR',
        paymentStatus: 'CAPTURED',
      };
    }

    // 4. Create RestaurantRequest
    const newRequest = await RestaurantRequestModel.create({
      restaurantName: parsed.restaurantName,
      ownerName: parsed.ownerName,
      email: emailLower,
      phone: parsed.phone,
      address: parsed.address,
      city: parsed.city,
      state: parsed.state,
      country: parsed.country,
      pinCode: parsed.pinCode,
      gstNumber: parsed.gstNumber,
      cuisine: parsed.cuisine,
      branches: parsed.branches,
      expectedMonthlyOrders: parsed.expectedMonthlyOrders,
      selectedPlan: parsed.selectedPlan,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      googleMapsUrl: parsed.googleMapsUrl || undefined,
      message: parsed.message,
      status: 'PENDING',
      submittedAt: new Date(),
      ...paymentDetails,
    });

    // 5. Log audit event
    void logAuditRaw({
      actorId: newRequest._id.toString(),
      actorRole: 'system',
      entityType: AuditEntity.RESTAURANT,
      entityId: newRequest._id.toString(),
      action: 'RESTAURANT_REQUEST_SUBMITTED' as any,
      metadata: {
        restaurantName: parsed.restaurantName,
        selectedPlan: parsed.selectedPlan,
        paymentId: paymentDetails.paymentId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Send confirmation email
    void sendRestaurantSubmissionEmail(
      newRequest.email,
      newRequest.ownerName,
      newRequest.restaurantName,
      newRequest.selectedPlan
    );

    // 6. Broadcast via Socket.IO to super-admin room
    socketService.emitToSuperAdmin('restaurant_request_created', {
      id: newRequest._id.toString(),
      name: newRequest.restaurantName,
      owner: newRequest.ownerName,
      email: newRequest.email,
      phone: newRequest.phone,
      location: `${newRequest.city}, ${newRequest.state}, ${newRequest.country}`,
      plan: newRequest.selectedPlan,
      requestedAt: newRequest.submittedAt.toISOString(),
      message: newRequest.message ?? '',
      latitude: newRequest.latitude,
      longitude: newRequest.longitude,
      googleMapsUrl: newRequest.googleMapsUrl ?? '',
    });

    return ok(res, {
      message: "Your application has been submitted successfully. Our team will review it and you'll receive an email once your application is approved.",
      request: newRequest,
    });
  } catch (error) {
    next(error);
  }
}
