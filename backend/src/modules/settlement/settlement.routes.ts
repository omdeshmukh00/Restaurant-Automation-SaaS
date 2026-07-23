// src/modules/settlement/settlement.routes.ts
// Settlement module routes for restaurant admin.

import { Router } from 'express';
import { UserRole } from '../../constants/roles';
import { requireAuth } from '../../middleware/requireAuth';
import { roleGuard } from '../../middleware/roleGuard';
import { tenantGuard } from '../../middleware/tenantGuard';
import {
  listSettlementsController,
  getSettlementByIdController,
  generateSettlementController,
  markSettlementPaidController,
  getSettlementSummaryController,
} from './settlement.controller';

const router = Router();
const adminRoles = [UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN];

router.use(requireAuth, roleGuard(...adminRoles), tenantGuard);

router.get('/', listSettlementsController);
router.get('/summary', getSettlementSummaryController);
router.get('/:id', getSettlementByIdController);
router.post('/generate', generateSettlementController);
router.patch('/:id/paid', markSettlementPaidController);

export default router;
