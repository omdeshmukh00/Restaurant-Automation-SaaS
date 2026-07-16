import { Router } from 'express';
import { validate } from '../../middleware/validate';
import {
  listCustomersQuerySchema,
  customerIdParamsSchema,
  createCustomerBodySchema,
  updateCustomerBodySchema,
} from './customers.schema';
import {
  listCustomersController,
  createCustomerController,
  getCustomerController,
  updateCustomerController,
  deleteCustomerController,
} from './customers.controller';

const customersRouter = Router();

customersRouter.post(
  '/',
  validate({ body: createCustomerBodySchema }),
  createCustomerController,
);

customersRouter.get(
  '/',
  validate({ query: listCustomersQuerySchema }),
  listCustomersController,
);

customersRouter.get(
  '/:id',
  validate({ params: customerIdParamsSchema }),
  getCustomerController,
);

customersRouter.patch(
  '/:id',
  validate({ params: customerIdParamsSchema, body: updateCustomerBodySchema }),
  updateCustomerController,
);

customersRouter.delete(
  '/:id',
  validate({ params: customerIdParamsSchema }),
  deleteCustomerController,
);

export default customersRouter;
