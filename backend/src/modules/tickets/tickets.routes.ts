import { Router } from 'express';
import { TicketsController } from './tickets.controller';

const router = Router();

// Mounted at /admin/tickets via adminRouter
router.get('/contacts', TicketsController.getContacts);
router.post('/', TicketsController.create);
router.get('/', TicketsController.list);
router.get('/:id', TicketsController.getById);
router.post('/:id/messages', TicketsController.addMessage);
router.patch('/:id/status', TicketsController.updateStatus);
router.post('/:id/escalate', TicketsController.escalate);
router.delete('/:id', TicketsController.deleteTicket);
router.post('/:id/delete-message', TicketsController.deleteMessage);
router.post('/:id/block', TicketsController.toggleBlock);

export default router;
