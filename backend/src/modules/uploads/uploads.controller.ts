import type { Request, Response } from 'express';
import { UserRole } from '../../constants/roles';
import { ErrorCode } from '../../constants/errors';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import { UploadService } from './uploads.service';

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
    res.status(201).json({ success: true, data: upload });
  });

  static list = asyncHandler(async (req: Request, res: Response) => {
    const uploads = await UploadService.list(tenantIdFromRequest(req));
    res.status(200).json({ success: true, data: uploads });
  });

  static replace = asyncHandler(async (req: Request, res: Response) => {
    const upload = await UploadService.replace(tenantIdFromRequest(req), req.params.id, req.body);
    res.status(200).json({ success: true, data: upload });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    await UploadService.delete(tenantIdFromRequest(req), req.params.id);
    res.status(200).json({ success: true, data: {} });
  });

  static download = asyncHandler(async (req: Request, res: Response) => {
    const file = await UploadService.download(tenantIdFromRequest(req), req.params.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.status(200).send(file.buffer);
  });
}
