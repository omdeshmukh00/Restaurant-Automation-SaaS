import { Router } from 'express';
import { roles } from '../../constants/roles';
import { requireAuth, requireKitchenRole } from '../../middleware/requireAuth';
import { roleGuard } from '../../middleware/roleGuard';
import { tenantGuard } from '../../middleware/tenantGuard';
import { validate } from '../../middleware/validate';
import { KitchenRole } from '../../constants/roles';
import { inventoryQuerySchema } from '../inventory/inventory.schema';
import {
  acceptOrderBodySchema,
  delayOrderBodySchema,
  orderIdParamsSchema,
  rejectOrderBodySchema,
  addInternalNoteBodySchema,
} from '../orders/orders.schema';
import { KitchenController } from './kitchen.controller';
import {
  createKitchenBatchBodySchema,
  kitchenBatchParamsSchema,
  kitchenOrdersQuerySchema,
  updateKitchenBatchBodySchema,
  updateMenuAvailabilityBodySchema,
  updateMenuAvailabilityParamsSchema,
} from './kitchen.schema';

const router = Router();
const kitchenRoles = [roles.kitchenStaff, roles.restaurantAdmin] as const;

router.use(requireAuth, roleGuard(...kitchenRoles), tenantGuard);

router.get('/dashboard', KitchenController.getDashboard);

router.get(
  '/inventory',
  validate({ query: inventoryQuerySchema }),
  requireKitchenRole([KitchenRole.KITCHEN_SUPERVISOR, KitchenRole.HEAD_CHEF]),
  KitchenController.getInventory
);
router.get(
  '/inventory/alerts',
  validate({ query: inventoryQuerySchema }),
  requireKitchenRole([KitchenRole.KITCHEN_SUPERVISOR, KitchenRole.HEAD_CHEF]),
  KitchenController.getInventoryAlerts
);

router.get('/orders', validate({ query: kitchenOrdersQuerySchema }), KitchenController.getOrders);
router.get('/orders/:id', validate({ params: orderIdParamsSchema }), KitchenController.getOrderDetails);
router.patch(
  '/orders/:id/accept',
  validate({ params: orderIdParamsSchema, body: acceptOrderBodySchema }),
  requireKitchenRole([KitchenRole.CHEF, KitchenRole.KITCHEN_SUPERVISOR, KitchenRole.HEAD_CHEF]),
  KitchenController.acceptOrder,
);
router.patch('/orders/:id/start', validate({ params: orderIdParamsSchema }), KitchenController.startCooking);
router.patch('/orders/:id/ready', validate({ params: orderIdParamsSchema }), KitchenController.markReady);
router.patch(
  '/orders/:id/delay',
  validate({ params: orderIdParamsSchema, body: delayOrderBodySchema }),
  requireKitchenRole([KitchenRole.CHEF, KitchenRole.KITCHEN_SUPERVISOR, KitchenRole.HEAD_CHEF]),
  KitchenController.delayOrder,
);
router.patch(
  '/orders/:id/reject',
  validate({ params: orderIdParamsSchema, body: rejectOrderBodySchema }),
  KitchenController.rejectOrder,
);
router.patch(
  '/orders/:id/notes',
  validate({ params: orderIdParamsSchema, body: addInternalNoteBodySchema }),
  KitchenController.addInternalNote,
);

router.get('/menu/items', KitchenController.getMenuItems);

router.patch(
  '/menu/:id/availability',
  validate({ params: updateMenuAvailabilityParamsSchema, body: updateMenuAvailabilityBodySchema }),
  KitchenController.updateMenuAvailability
);

router.get('/batches', KitchenController.getBatches);
router.get('/batches/suggestions', KitchenController.getSuggestedBatches);
router.get('/batches/:id', validate({ params: kitchenBatchParamsSchema }), KitchenController.getBatch);
router.post('/batches', validate({ body: createKitchenBatchBodySchema }), KitchenController.createBatch);
router.patch(
  '/batches/:id',
  validate({ params: kitchenBatchParamsSchema, body: updateKitchenBatchBodySchema }),
  KitchenController.updateBatch,
);

router.get('/load', KitchenController.getLoad);
router.get(
  '/performance',
  requireKitchenRole([KitchenRole.HEAD_CHEF]),
  KitchenController.getPerformance
);

router.get(
  '/alerts',
  requireKitchenRole([KitchenRole.KITCHEN_SUPERVISOR, KitchenRole.HEAD_CHEF]),
  KitchenController.getAlerts
);
router.patch(
  '/alerts/:id/resolve',
  requireKitchenRole([KitchenRole.KITCHEN_SUPERVISOR, KitchenRole.HEAD_CHEF]),
  KitchenController.resolveAlert
);

export default router;
