import { Router } from 'express';
import { validate } from '../../middleware/validate';
import {
  arriveReservationBodySchema,
  checkInReservationBodySchema,
  createReservationBodySchema,
  listReservationsQuerySchema,
  entityIdParamsSchema,
  markNoShowBodySchema,
  reservationAvailabilityQuerySchema,
  updateReservationBodySchema,
} from './reservations.schema';
import {
  arriveReservationController,
  checkInReservationController,
  createReservationController,
  getAvailabilityController,
  getReservationByIdController,
  listReservationsController,
  markNoShowController,
  updateReservationController,
} from './reservations.controller';

const router = Router();

// Reservation lifecycle routes
router.post('/', validate({ body: createReservationBodySchema }), createReservationController);
router.get('/', validate({ query: listReservationsQuerySchema }), listReservationsController);
router.get('/availability', validate({ query: reservationAvailabilityQuerySchema }), getAvailabilityController);
router.get('/:id', validate({ params: entityIdParamsSchema }), getReservationByIdController);
router.patch('/:id', validate({ params: entityIdParamsSchema, body: updateReservationBodySchema }), updateReservationController);
router.patch('/:id/arrive', validate({ params: entityIdParamsSchema, body: arriveReservationBodySchema }), arriveReservationController);
router.patch('/:id/no-show', validate({ params: entityIdParamsSchema, body: markNoShowBodySchema }), markNoShowController);
router.patch('/:id/check-in', validate({ params: entityIdParamsSchema, body: checkInReservationBodySchema }), checkInReservationController);

export default router;
