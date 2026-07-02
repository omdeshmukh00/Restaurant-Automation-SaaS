import { Router } from 'express';
import { UserRole } from '../../constants/roles';
import { requireAuth } from '../../middleware/requireAuth';
import { roleGuard } from '../../middleware/roleGuard';
import { tenantGuard } from '../../middleware/tenantGuard';
import { uploadLimiter } from '../../middleware/rateLimiters';
import { validate } from '../../middleware/validate';
import { UploadController } from './uploads.controller';
import { createUploadSchema, replaceUploadSchema, uploadIdParamSchema } from './uploads.schema';

const uploadRouter = Router();

const uploadRoles = [
  UserRole.RESTAURANT_ADMIN,
  UserRole.SERVICE_STAFF,
  UserRole.KITCHEN_STAFF,
  UserRole.CLEANING_STAFF,
  UserRole.SUPER_ADMIN,
];

uploadRouter.use(requireAuth, roleGuard(...uploadRoles), tenantGuard);

uploadRouter.get('/uploads', UploadController.list);
uploadRouter.post('/uploads', uploadLimiter, validate({ body: createUploadSchema }), UploadController.create);
uploadRouter.get('/uploads/:id/download', validate({ params: uploadIdParamSchema }), UploadController.download);
uploadRouter.patch(
  '/uploads/:id',
  uploadLimiter,
  validate({ params: uploadIdParamSchema, body: replaceUploadSchema }),
  UploadController.replace,
);
uploadRouter.delete('/uploads/:id', validate({ params: uploadIdParamSchema }), UploadController.delete);

export default uploadRouter;
