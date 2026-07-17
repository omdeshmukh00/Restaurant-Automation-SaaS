// src/modules/users/users.schema.ts
// Zod validation schemas for user-related requests

import { z } from 'zod';
import { UserRole } from '../../constants/roles';

export const mobileSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[^\d+]/g, ''))
  .refine((val) => val.length >= 10 && val.length <= 15, {
    message: 'Mobile number must be between 10 and 15 digits',
  });

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim().optional(),
  mobile: mobileSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    ,
  role: z.nativeEnum(UserRole).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim().optional(),
  mobile: mobileSchema.optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(
  (data) => data.email || data.mobile,
  { message: 'Either email or mobile is required', path: ['email'] }
);

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

export const requestOtpSchema = z.object({
  mobile: mobileSchema,
});

export const verifyOtpSchema = z.object({
  mobile: mobileSchema,
  otp: z.string().min(4).max(6, 'OTP must be between 4 and 6 digits'),
  name: z.string().trim().min(2).max(100).optional(),
});

export const verifyResetOtpSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.string().email('Invalid email address').toLowerCase().trim().optional(),
  mobile: mobileSchema.optional(),
  avatar: z.string().optional(),
  themeMode: z.enum(['light', 'dark', 'system']).optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
});


export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

export const deleteAccountSchema = z.object({
  confirmText: z.literal('DELETE MY ACCOUNT', {
    errorMap: () => ({ message: 'Please type "DELETE MY ACCOUNT" to confirm' }),
  }),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
