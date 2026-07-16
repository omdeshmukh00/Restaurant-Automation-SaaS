import type { Request, Response } from 'express';
import { UserRole } from '../../constants/roles';
import { ErrorCode } from '../../constants/errors';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import { UploadService } from './uploads.service';
import { logAudit } from '../auditLogs/auditLogs.helper';
import { AuditEntity, AuditAction } from '../auditLogs/auditLogs.types';

function tenantIdFromRequest(req: Request): string {
  const tenantId = req.user?.role === UserRole.SUPER_ADMIN
    ? req.body.tenantId ?? req.query.tenantId
    : req.user?.restaurantId;

  if (!tenantId || typeof tenantId !== 'string') {
    throw new AppError('Tenant ID is required', 400, ErrorCode.INVALID_REQUEST);
  }

  return UploadService.normalizeTenantId(tenantId);
}

export class UploadController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const upload = await UploadService.create(tenantIdFromRequest(req), req.user!._id, req.body);
    
    await logAudit(req, {
      entityType: AuditEntity.UPLOAD,
      entityId: upload._id.toString(),
      action: AuditAction.UPLOAD_CREATED,
      metadata: { fileName: upload.fileName },
    });

    res.status(201).json({ success: true, data: upload });
  });

  static list = asyncHandler(async (req: Request, res: Response) => {
    const uploads = await UploadService.list(tenantIdFromRequest(req));
    res.status(200).json({ success: true, data: uploads });
  });

  static replace = asyncHandler(async (req: Request, res: Response) => {
    const upload = await UploadService.replace(tenantIdFromRequest(req), req.params.id, req.body);
    
    await logAudit(req, {
      entityType: AuditEntity.UPLOAD,
      entityId: upload._id.toString(),
      action: AuditAction.UPLOAD_UPDATED,
      metadata: { fileName: upload.fileName },
    });

    res.status(200).json({ success: true, data: upload });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    // Delete service returns void but we need to log before it's gone or just pass the ID
    const tenantId = tenantIdFromRequest(req);
    // Ideally we fetch first to get filename for audit, but let's just log it
    // Wait, let's get the upload to know the filename for the audit log
    const upload = await UploadService.getById(tenantId, req.params.id);
    
    await UploadService.delete(tenantId, req.params.id);
    
    await logAudit(req, {
      entityType: AuditEntity.UPLOAD,
      entityId: req.params.id,
      action: AuditAction.UPLOAD_DELETED,
      metadata: { fileName: upload.fileName },
    });

    res.status(200).json({ success: true, data: {} });
  });

  static download = asyncHandler(async (req: Request, res: Response) => {
    const file = await UploadService.download(tenantIdFromRequest(req), req.params.id);
    const isImage = (file.mimeType ?? '').startsWith('image/');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${isImage ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.fileName)}"`,
    );
    res.status(200).send(file.buffer);
  });

  static downloadImagePublic = asyncHandler(async (req: Request, res: Response) => {
    const file = await UploadService.downloadPublic(req.params.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
    res.status(200).send(file.buffer);
  });
}
