import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { CleaningController } from './cleaning.controller';
import {
  assignCleaningTaskBodySchema,
  cleaningTaskParamsSchema,
  cleaningTaskQuerySchema,
  completeCleaningBodySchema,
  deepCleanBodySchema,
  maintenanceIssueParamsSchema,
  pauseCleaningBodySchema,
  reportMaintenanceIssueBodySchema,
  startCleaningBodySchema,
  updateMaintenanceIssueBodySchema,
  verifyCleaningBodySchema,
} from './cleaning.schema';

import staffManagementRouter from '../staff/staff.routes';

const router = Router();

router.use('/staff', staffManagementRouter);

// Maintenance issue routes
router.post(
  '/maintenance-issues',
  validate({ body: reportMaintenanceIssueBodySchema }),
  CleaningController.reportMaintenanceIssue
);
router.get(
  '/maintenance-issues',
  CleaningController.getMaintenanceIssues
);
router.patch(
  '/maintenance-issues/:id',
  validate({ params: maintenanceIssueParamsSchema, body: updateMaintenanceIssueBodySchema }),
  CleaningController.updateMaintenanceIssue
);

router.get('/tables', CleaningController.getTables);

// Task routes
router.post('/tasks', CleaningController.createTask);
router.get('/tasks', validate({ query: cleaningTaskQuerySchema }), CleaningController.getTasks);
router.get('/tasks/:id', validate({ params: cleaningTaskParamsSchema }), CleaningController.getTask);

router.patch(
  '/tasks/:id/start',
  validate({ params: cleaningTaskParamsSchema, body: startCleaningBodySchema }),
  CleaningController.startTask,
);
router.patch(
  '/tasks/:id/complete',
  validate({ params: cleaningTaskParamsSchema, body: completeCleaningBodySchema }),
  CleaningController.completeTask,
);
router.patch(
  '/tasks/:id/verify',
  validate({ params: cleaningTaskParamsSchema, body: verifyCleaningBodySchema }),
  CleaningController.verifyTask,
);
router.patch(
  '/tasks/:id/assign',
  validate({ params: cleaningTaskParamsSchema, body: assignCleaningTaskBodySchema }),
  CleaningController.assignTask,
);
router.patch(
  '/tasks/:id/pause',
  validate({ params: cleaningTaskParamsSchema, body: pauseCleaningBodySchema }),
  CleaningController.pauseTask,
);
router.patch(
  '/tasks/:id/deep-clean',
  validate({ params: cleaningTaskParamsSchema, body: deepCleanBodySchema }),
  CleaningController.deepCleanTask,
);

export default router;
