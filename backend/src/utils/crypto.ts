// src/utils/crypto.ts
// Cryptographic utilities — hashing, comparison, token generation

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/**
 * Hash a refresh token with SHA-256 before storing in DB.
 * Highly optimized, secure one-way hash suitable for high-entropy tokens.
 */
export async function hashToken(token: string): Promise<string> {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Compare a plain token against a stored hash (supports both legacy bcrypt and optimized SHA-256).
 */
export async function compareToken(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$2')) {
    return bcrypt.compare(plain, hash);
  }
  const plainHash = crypto.createHash('sha256').update(plain).digest('hex');
  return safeCompare(plainHash, hash);
}

/**
 * Hash a password with bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plain password against a bcrypt hash.
 */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Timing-safe string comparison.
 * Per instruction.md: use crypto.timingSafeEqual() for all token comparisons — no ===
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Generate a cryptographically secure random token.
 * Used for: invite tokens, reset tokens, OTP, session tokens.
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a numeric OTP of specified length.
 */
export function generateOTP(length: number = 6): string {
  const max = Math.pow(10, length);
  const otp = crypto.randomInt(0, max);
  return otp.toString().padStart(length, '0');
}

/**
 * Normalize a mobile number by removing all formatting characters.
 * Keeps digits and a leading '+' if present.
 */
export function normalizeMobile(mobile: string): string {
  if (!mobile) return '';
  return mobile.replace(/[^\d+]/g, '').trim();
}
