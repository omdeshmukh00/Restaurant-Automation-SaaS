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

// Public image delivery — menu item images are inherently public (also served to
// unauthenticated customers). Upload IDs are unguessable ObjectIds; only image
// uploads are served. Registered before auth so <img> tags can load without cookies.
uploadRouter.get('/:id/image', validate({ params: uploadIdParamSchema }), UploadController.downloadImagePublic);

// Security: Define fine-grained RBAC roles
const uploadRoles = [
  UserRole.RESTAURANT_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.SERVICE_STAFF,
];

const deleteRoles = [
  UserRole.RESTAURANT_ADMIN,
  UserRole.SUPER_ADMIN,
];

// All other endpoints require authentication and tenant isolation checks
uploadRouter.use(requireAuth, tenantGuard);

// List and Download: Allow any authenticated user within the same tenant
uploadRouter.get('/', UploadController.list);
uploadRouter.get('/:id/download', validate({ params: uploadIdParamSchema }), UploadController.download);

// Upload and Replace: Restricted to uploadRoles
uploadRouter.post('/', roleGuard(...uploadRoles), uploadLimiter, validate({ body: createUploadSchema }), UploadController.create);
uploadRouter.patch(
  '/:id',
  roleGuard(...uploadRoles),
  uploadLimiter,
  validate({ params: uploadIdParamSchema, body: replaceUploadSchema }),
  UploadController.replace,
);

// Delete: Restricted to deleteRoles only (prevents staff/cleaning staff from deleting)
uploadRouter.delete('/:id', roleGuard(...deleteRoles), validate({ params: uploadIdParamSchema }), UploadController.delete);

export default uploadRouter;
