import { Router } from 'express';
import { validate } from '../../middleware/validate';
import {
  createOfferBodySchema,
  offerIdParamsSchema,
  offersQuerySchema,
  updateOfferBodySchema,
  toggleOfferStatusSchema,
} from './offers.schema';
import { OffersController } from './offers.controller';

const router = Router();

// Admin routes (mounted at /admin/offers via admin.routes)
router.post('/', validate({ body: createOfferBodySchema }), OffersController.create);
router.get('/', validate({ query: offersQuerySchema }), OffersController.list);
router.get('/:id', validate({ params: offerIdParamsSchema }), OffersController.getById);
router.patch('/:id', validate({ params: offerIdParamsSchema, body: updateOfferBodySchema }), OffersController.update);
router.delete('/:id', validate({ params: offerIdParamsSchema }), OffersController.delete);
router.patch('/:id/toggle', validate({ params: offerIdParamsSchema, body: toggleOfferStatusSchema }), OffersController.toggleStatus);

export default router;
