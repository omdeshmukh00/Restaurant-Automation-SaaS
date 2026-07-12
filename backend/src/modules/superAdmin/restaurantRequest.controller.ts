import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { RestaurantRequestModel } from './restaurantRequest.model';
import { RestaurantModel } from '../restaurants/restaurants.model';
import { UserModel } from '../users/users.model';
import { createRazorpayOrder as createRzpOrder, verifyRazorpaySignature as verifyRzpSig } from '../../services/razorpay.service';
import { AppError } from '../../utils/AppError';
import { ErrorCode } from '../../constants/errors';
import { ok } from '../../utils/responses';
import { logAuditRaw } from '../auditLogs/auditLogs.helper';
import { AuditEntity, AuditAction } from '../auditLogs/auditLogs.types';
import { socketService } from '../../sockets/socket.service';
import { sendRestaurantSubmissionEmail } from '../../services/mail.service';
import { getPlatformSettings } from './platformSettings.model';
import { logger } from '../../config/logger';

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
  selectedPlan: z.string().optional(),
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

    // 1. Prevent duplicate email applications (APPLICATION_PENDING, APPLICATION_APPROVED, PENDING_PAYMENT)
    const existingEmailReq = await RestaurantRequestModel.findOne({
      email: emailLower,
      status: { $in: ['APPLICATION_PENDING', 'APPLICATION_APPROVED', 'PENDING_PAYMENT'] },
    }).setOptions({ bypassTenant: true });

    if (existingEmailReq) {
      throw new AppError('This email already has an existing application.', 400, ErrorCode.CONFLICT);
    }

    // Check duplicate email in restaurants collection
    const existingEmailRest = await RestaurantModel.findOne({
      email: emailLower,
    }).setOptions({ bypassTenant: true });

    if (existingEmailRest) {
      throw new AppError('This email already has an existing application.', 400, ErrorCode.CONFLICT);
    }

    // Check duplicate email in users collection
    const existingEmailUser = await UserModel.findOne({
      email: emailLower,
    }).setOptions({ bypassTenant: true });

    if (existingEmailUser) {
      throw new AppError('This email already has an existing application.', 400, ErrorCode.CONFLICT);
    }

    // 2. Prevent duplicate phone number applications (APPLICATION_PENDING, APPLICATION_APPROVED, PENDING_PAYMENT)
    const existingPhoneReq = await RestaurantRequestModel.findOne({
      phone: parsed.phone,
      status: { $in: ['APPLICATION_PENDING', 'APPLICATION_APPROVED', 'PENDING_PAYMENT'] },
    }).setOptions({ bypassTenant: true });

    if (existingPhoneReq) {
      throw new AppError('This phone number is already registered.', 400, ErrorCode.CONFLICT);
    }

    // Check duplicate phone in restaurants collection
    const existingPhoneRest = await RestaurantModel.findOne({
      phone: parsed.phone,
    }).setOptions({ bypassTenant: true });

    if (existingPhoneRest) {
      throw new AppError('This phone number is already registered.', 400, ErrorCode.CONFLICT);
    }

    // Check duplicate mobile in users collection
    const existingPhoneUser = await UserModel.findOne({
      mobile: parsed.phone,
    }).setOptions({ bypassTenant: true });

    if (existingPhoneUser) {
      throw new AppError('This phone number is already registered.', 400, ErrorCode.CONFLICT);
    }

    // 3. Load Global Settings and check for application processing fee
    const settings = await getPlatformSettings();
    const isFeeEnabled = settings.applicationFeeEnabled;

    if (isFeeEnabled && settings.applicationFeeAmount > 0) {
      // Create Razorpay Order for application processing fee
      const amount = settings.applicationFeeAmount;
      const currency = settings.currency || 'INR';
      const receipt = `app_fee_${Date.now()}`;
      
      const order = await createRzpOrder({ amount, receipt });

      // Save Request in PENDING_PAYMENT status
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
        selectedPlan: parsed.selectedPlan || 'Paid Onboarding',
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        googleMapsUrl: parsed.googleMapsUrl || undefined,
        message: parsed.message,
        status: 'PENDING_PAYMENT',
        submittedAt: new Date(),
        // payment info
        orderId: order.id,
        paymentAmount: amount,
        paymentCurrency: currency,
        paymentStatus: 'PENDING',
      });

      logger.info(`Partner Request Created: ${newRequest._id}`);

      return ok(res, {
        requiresFee: true,
        orderId: order.id,
        amount,
        currency,
        requestId: newRequest._id.toString(),
      });
    }

    // 4. Create RestaurantRequest directly in APPLICATION_PENDING status (no fee required)
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
      selectedPlan: parsed.selectedPlan || 'Free Onboarding',
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      googleMapsUrl: parsed.googleMapsUrl || undefined,
      message: parsed.message,
      status: 'APPLICATION_PENDING',
      submittedAt: new Date(),
    });

    logger.info(`Partner Request Created: ${newRequest._id}`);

    // Log audit event
    void logAuditRaw({
      actorId: newRequest._id.toString(),
      actorRole: 'system',
      entityType: AuditEntity.RESTAURANT,
      entityId: newRequest._id.toString(),
      action: AuditAction.RESTAURANT_REQUEST_SUBMITTED,
      metadata: {
        restaurantName: parsed.restaurantName,
        source: 'onboarding_no_fee',
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Send confirmation email
    void sendRestaurantSubmissionEmail(
      newRequest.email,
      newRequest.ownerName,
      newRequest.restaurantName,
      'Free Onboarding'
    );

    // Broadcast via Socket.IO
    socketService.emitToSuperAdmin('restaurant_request_created', {
      id: newRequest._id.toString(),
      name: newRequest.restaurantName,
      owner: newRequest.ownerName,
      email: newRequest.email,
      phone: newRequest.phone,
      location: `${newRequest.city}, ${newRequest.state}, ${newRequest.country}`,
      plan: newRequest.selectedPlan || 'Free Onboarding',
      requestedAt: newRequest.submittedAt.toISOString(),
      message: newRequest.message ?? '',
      latitude: newRequest.latitude,
      longitude: newRequest.longitude,
      googleMapsUrl: newRequest.googleMapsUrl ?? '',
      status: newRequest.status,
    });

    return ok(res, {
      message: "Your application has been submitted successfully. Our team will review it and you'll receive an email once approved.",
      request: newRequest,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPartnerRequestPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError('Payment details are required', 400, ErrorCode.INVALID_REQUEST);
    }

    const isValid = verifyRzpSig({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValid) {
      throw new AppError('Razorpay payment signature verification failed', 400, ErrorCode.INVALID_REQUEST);
    }

    const request = await RestaurantRequestModel.findOne({ orderId: razorpay_order_id }).setOptions({ bypassTenant: true });
    if (!request) {
      throw new AppError('Application request not found for this order', 404, ErrorCode.NOT_FOUND);
    }

    if (request.status === 'PENDING_PAYMENT') {
      request.status = 'APPLICATION_PENDING';
      request.paymentId = razorpay_payment_id;
      request.paymentSignature = razorpay_signature;
      request.paymentStatus = 'CAPTURED';
      request.paymentTimestamp = new Date();
      await request.save();
      logger.info(`Partner Request Updated (Payment Verified): ${request._id}`);

      // Log audit
      void logAuditRaw({
        actorId: request._id.toString(),
        actorRole: 'system',
        entityType: AuditEntity.RESTAURANT,
        entityId: request._id.toString(),
        action: AuditAction.RESTAURANT_REQUEST_SUBMITTED,
        metadata: {
          restaurantName: request.restaurantName,
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Send confirmation email
      void sendRestaurantSubmissionEmail(
        request.email,
        request.ownerName,
        request.restaurantName,
        'Processing Fee Paid'
      );

      // Broadcast via Socket.IO
      socketService.emitToSuperAdmin('restaurant_request_created', {
        id: request._id.toString(),
        name: request.restaurantName,
        owner: request.ownerName,
        email: request.email,
        phone: request.phone,
        location: `${request.city}, ${request.state}, ${request.country}`,
        plan: request.selectedPlan || 'Paid Onboarding',
        requestedAt: request.submittedAt.toISOString(),
        message: request.message ?? '',
        latitude: request.latitude,
        longitude: request.longitude,
        googleMapsUrl: request.googleMapsUrl ?? '',
        status: request.status,
      });
    }

    return ok(res, {
      message: "Payment verified and application submitted successfully. Our team will review it and you'll receive an email once approved.",
      request,
    });
  } catch (error) {
    next(error);
  }
}

export async function recoverPartnerRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, razorpay_payment_id } = req.body;
    if (!email || !razorpay_payment_id) {
      throw new AppError('Email and Razorpay Payment ID are required', 400, ErrorCode.INVALID_REQUEST);
    }

    const { fetchRazorpayPayment } = await import('../../services/razorpay.service');
    const payment = await fetchRazorpayPayment(razorpay_payment_id);
    if (!payment || payment.status !== 'captured') {
      throw new AppError('Payment not found or not captured on Razorpay', 400, ErrorCode.INVALID_REQUEST);
    }

    const orderId = payment.order_id;
    if (!orderId) {
      throw new AppError('Order ID not found on Razorpay payment details', 400, ErrorCode.INVALID_REQUEST);
    }

    const request = await RestaurantRequestModel.findOne({
      $or: [
        { orderId },
        { email: email.toLowerCase(), status: 'PENDING_PAYMENT' }
      ]
    }).setOptions({ bypassTenant: true });

    if (!request) {
      throw new AppError('Application request not found for this payment reference', 404, ErrorCode.NOT_FOUND);
    }

    if (request.status === 'PENDING_PAYMENT') {
      request.status = 'APPLICATION_PENDING';
      request.paymentId = razorpay_payment_id;
      request.paymentStatus = 'CAPTURED';
      request.orderId = orderId;
      request.paymentAmount = payment.amount ? Number(payment.amount) / 100 : request.paymentAmount;
      request.paymentCurrency = payment.currency || 'INR';
      request.paymentTimestamp = new Date();
      await request.save();

      // Log audit
      void logAuditRaw({
        actorId: request._id.toString(),
        actorRole: 'system',
        entityType: AuditEntity.RESTAURANT,
        entityId: request._id.toString(),
        action: AuditAction.RESTAURANT_REQUEST_SUBMITTED,
        metadata: {
          restaurantName: request.restaurantName,
          recovered: true,
          paymentId: razorpay_payment_id,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Send email
      void sendRestaurantSubmissionEmail(
        request.email,
        request.ownerName,
        request.restaurantName,
        'Processing Fee Paid (Recovered)'
      );

      // Broadcast via Socket.IO
      socketService.emitToSuperAdmin('restaurant_request_created', {
        id: request._id.toString(),
        name: request.restaurantName,
        owner: request.ownerName,
        email: request.email,
        phone: request.phone,
        location: `${request.city}, ${request.state}, ${request.country}`,
        plan: request.selectedPlan || 'Paid Onboarding',
        requestedAt: request.submittedAt.toISOString(),
        message: request.message ?? '',
        latitude: request.latitude,
        longitude: request.longitude,
        googleMapsUrl: request.googleMapsUrl ?? '',
        status: request.status,
      });
    }

    return ok(res, {
      message: 'Application successfully recovered and submitted.',
      request,
    });
  } catch (error) {
    next(error);
  }
}
