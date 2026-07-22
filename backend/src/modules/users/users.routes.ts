// src/modules/users/users.routes.ts
// User route definitions

import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import { updateProfileSchema, changePasswordSchema, deleteAccountSchema } from './users.schema';
import * as userController from './users.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /users/me — Get current user profile
router.get('/me', userController.getMe);

// POST /users/me/request-otp — Send profile/password change OTP
router.post('/me/request-otp', userController.requestProfileOtp);

// POST /users/me/request-mobile-otp — Send mobile verification OTP
router.post('/me/request-mobile-otp', userController.requestMobileOtp);

// GET /users/me/order-history — Get past paid bills for the current customer
router.get('/me/order-history', userController.getOrderHistory);

// GET /users/me/reservations — Get all customer reservations
router.get('/me/reservations', userController.getMyReservations);

// POST /users/me/reservations — Create customer reservation
router.post('/me/reservations', userController.createMyReservation);

// PATCH /users/me/reservations/:id — Update/cancel customer reservation
router.patch('/me/reservations/:id', userController.updateMyReservation);

// PATCH /users/me — Update profile
router.patch('/me', validate({ body: updateProfileSchema }), userController.updateProfile);

// PATCH /users/me/password — Change password
router.patch('/me/password', validate({ body: changePasswordSchema }), userController.changePassword);

// DELETE /users/me — Delete account
router.delete('/me', validate({ body: deleteAccountSchema }), userController.deleteAccount);

export default router;
