import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { OrdersController } from './orders.controller';
import { adminOrderUpdateSchema, adminOrdersQuerySchema, orderIdParamsSchema, createAdminOrderBodySchema } from './orders.schema';

const router = Router();

router.get('/', validate({ query: adminOrdersQuerySchema }), OrdersController.getAdminOrders);
router.get('/:id', validate({ params: orderIdParamsSchema }), OrdersController.getAdminOrderById);
router.post('/', validate({ body: createAdminOrderBodySchema }), OrdersController.createAdminOrder);
router.patch('/:id', validate({ params: orderIdParamsSchema, body: adminOrderUpdateSchema }), OrdersController.updateAdminOrder);
router.delete('/:id', validate({ params: orderIdParamsSchema }), OrdersController.deleteAdminOrder);

export default router;
