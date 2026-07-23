// src/modules/auditLogs/auditLogs.helper.ts
// Fire-and-forget helper. Import this in any controller or service to write
// an audit log without blocking the main response or throwing on failure.
//
// Usage:
//   import { logAudit } from '../auditLogs/auditLogs.helper';
//
//   await logAudit(req, {
//     entityType: AuditEntity.ORDER,
//     entityId:   order._id.toString(),
//     action:     AuditAction.ORDER_PLACED,
//     metadata:   { total: order.totalAmount },
//   });

import type { Request } from 'express';
import logger from '../../config/logger';
import { AuditLogModel } from './auditLogs.schema';
import type { CreateAuditLogInput } from './auditLogs.types';
import { socketService } from '../../sockets/socket.service';

// Helper to extract real client IP address from proxy headers (x-forwarded-for, x-real-ip, cf-connecting-ip)
export function extractRealIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const raw = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    const clientIp = raw.split(',')[0].trim();
    if (clientIp) return cleanIp(clientIp);
  }
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    const raw = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    if (raw) return cleanIp(raw.trim());
  }
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) {
    const raw = Array.isArray(cfIp) ? cfIp[0] : cfIp;
    if (raw) return cleanIp(raw.trim());
  }
  return cleanIp(req.ip || req.socket?.remoteAddress || '127.0.0.1');
}

function cleanIp(ip: string): string {
  if (!ip) return '127.0.0.1';
  let clean = ip;
  if (clean.startsWith('::ffff:')) {
    clean = clean.replace('::ffff:', '');
  }
  if (clean === '::1') return '127.0.0.1';
  return clean;
}

// ── Full input helper (use when req is not available, e.g. in a service) ──
export async function logAuditRaw(input: CreateAuditLogInput): Promise<void> {
  try {
    const ipAddress = input.ipAddress ? cleanIp(input.ipAddress) : '127.0.0.1';
    const log = await AuditLogModel.create({ ...input, ipAddress });

    // Emit a real-time activity event to the restaurant room so the admin
    // dashboard ActivityFeed updates instantly.
    if (input.restaurantId) {
      socketService.emitToRestaurant(input.restaurantId, 'activity:new', {
        _id: log._id.toString(),
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorRole: input.actorRole,
        metadata: input.metadata ?? {},
        createdAt: log.createdAt?.toISOString?.() ?? new Date().toISOString(),
      });
    }
  } catch (err) {
    // Log the failure but NEVER re-throw — audit logs must not break business logic
    logger.error('[AuditLog] Failed to write audit log', {
      error: err,
      input,
    });
  }
}

// ── Request-aware helper (use inside Express controllers) ────────────
// Automatically extracts actorId, actorRole, restaurantId, ipAddress,
// and userAgent from the request object.
export async function logAudit(
  req: Request,
  payload: Omit<CreateAuditLogInput, 'actorId' | 'actorRole' | 'restaurantId' | 'ipAddress' | 'userAgent'> &
    Partial<Pick<CreateAuditLogInput, 'actorId' | 'actorRole' | 'restaurantId' | 'ipAddress' | 'userAgent'>>,
): Promise<void> {
  const actorId = (req as any).user?._id?.toString() || payload.actorId || null;
  const actorRole = (req as any).user?.role || payload.actorRole || 'system';

  const input: CreateAuditLogInput = {
    actorId,
    actorRole,
    restaurantId: payload.restaurantId ?? (req as any).user?.restaurantId?.toString(),
    entityType:   payload.entityType,
    entityId:     payload.entityId,
    externalEntityId: payload.externalEntityId,
    provider:     payload.provider,
    action:       payload.action,
    metadata:     payload.metadata ?? {},
    ipAddress:    payload.ipAddress ?? extractRealIp(req),
    userAgent:    payload.userAgent ?? (req.headers['user-agent'] as string) ?? undefined,
  };

  await logAuditRaw(input);
}
