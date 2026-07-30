import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, fail } from '../../utils/responses';
import { TicketsService } from './tickets.service';

export class TicketsController {
  /**
   * GET /api/v1/admin/tickets/contacts
   * Get available contacts (Staff, Customers, SuperAdmin) for Admin support chat.
   */
  static getContacts = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!.toString();
    const contacts = await TicketsService.getContacts(restaurantId);
    ok(res, { contacts });
  });

  /**
   * POST /api/v1/admin/tickets
   * Raise a new support ticket / initiate chat.
   */
  static create = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!.toString();
    const userId = req.user!._id ? req.user!._id.toString() : (req.user as any).id;
    const userName = (req.user as any).fullName || (req.user as any).name || req.user!.email || 'Admin User';
    const userRole = req.user!.role || 'RESTAURANT_ADMIN';

    const ticket = await TicketsService.createTicket({
      restaurantId,
      createdBy: userId,
      senderName: userName,
      senderRole: userRole,
      targetRole: req.body.targetRole || 'SUPER_ADMIN',
      targetUser: req.body.targetUser,
      subject: req.body.subject,
      category: req.body.category || 'TECHNICAL',
      priority: req.body.priority || 'MEDIUM',
      description: req.body.description,
      attachments: req.body.attachments,
    });

    ok(res, { ticket }, 201);
  });

  /**
   * GET /api/v1/admin/tickets
   * List tickets for current restaurant with filters.
   */
  static list = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!.toString();
    const result = await TicketsService.getTickets(restaurantId, {
      status: req.query.status as any,
      category: req.query.category as any,
      priority: req.query.priority as any,
      targetRole: req.query.targetRole as string,
      search: req.query.search as string,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 30,
    });

    ok(res, result);
  });

  /**
   * GET /api/v1/admin/tickets/:id
   * Get single ticket detail with message history.
   */
  static getById = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!.toString();
    const ticket = await TicketsService.getTicketById(restaurantId, req.params.id);

    if (!ticket) {
      fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      return;
    }

    ok(res, { ticket });
  });

  /**
   * POST /api/v1/admin/tickets/:id/messages
   * Add a message reply to ticket conversation.
   */
  static addMessage = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!.toString();
    const userId = req.user!._id ? req.user!._id.toString() : (req.user as any).id;
    const userName = (req.user as any).fullName || (req.user as any).name || req.user!.email || 'Admin User';
    const userRole = req.user!.role || 'RESTAURANT_ADMIN';

    const ticket = await TicketsService.addMessage(restaurantId, req.params.id, {
      senderId: userId,
      senderName: userName,
      senderRole: userRole,
      message: req.body.message,
      attachments: req.body.attachments,
    });

    if (!ticket) {
      fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      return;
    }

    ok(res, { ticket });
  });

  /**
   * PATCH /api/v1/admin/tickets/:id/status
   * Update ticket status.
   */
  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!.toString();
    const { status, rejectionReason } = req.body;

    const ticket = await TicketsService.updateStatus(restaurantId, req.params.id, status, rejectionReason);

    if (!ticket) {
      fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      return;
    }

    ok(res, { ticket });
  });

  /**
   * POST /api/v1/admin/tickets/:id/escalate
   * Escalate ticket to SuperAdmin.
   */
  static escalate = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user!.restaurantId!.toString();
    const userName = (req.user as any).fullName || (req.user as any).name || req.user!.email || 'Admin User';
    const userRole = req.user!.role || 'RESTAURANT_ADMIN';
    const { reason } = req.body;

    const ticket = await TicketsService.escalateTicket(restaurantId, req.params.id, reason, userRole, userName);

    if (!ticket) {
      fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      return;
    }

    ok(res, { ticket });
  });

  // ────────────────────────────────────────────────────────────────
  // SUPER ADMIN CONTROLLERS
  // ────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/superadmin/tickets/contacts
   * Get all contacts for SuperAdmin support portal.
   */
  static superAdminGetContacts = asyncHandler(async (_req: Request, res: Response) => {
    const contacts = await TicketsService.getSuperAdminContacts();
    ok(res, { contacts });
  });

  /**
   * GET /api/v1/superadmin/tickets
   * List all platform tickets across restaurants for SuperAdmin.
   */
  static superAdminList = asyncHandler(async (req: Request, res: Response) => {
    const result = await TicketsService.getSuperAdminTickets({
      restaurantId: req.query.restaurantId as string,
      status: req.query.status as any,
      category: req.query.category as any,
      priority: req.query.priority as any,
      search: req.query.search as string,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 30,
    });

    ok(res, result);
  });

  /**
   * POST /api/v1/superadmin/tickets/:id/messages
   * SuperAdmin reply to any ticket.
   */
  static superAdminAddMessage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id ? req.user!._id.toString() : (req.user as any).id;
    const userName = (req.user as any).fullName || (req.user as any).name || req.user!.email || 'SuperAdmin Support';

    const ticket = await TicketsService.superAdminAddMessage(req.params.id, {
      senderId: userId,
      senderName: userName,
      senderRole: 'SUPER_ADMIN',
      message: req.body.message,
      attachments: req.body.attachments,
    });

    if (!ticket) {
      fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      return;
    }

    ok(res, { ticket });
  });

  /**
   * PATCH /api/v1/superadmin/tickets/:id/status
   * SuperAdmin update status (e.g. RESOLVED or REJECTED with rejectionReason).
   */
  static superAdminUpdateStatus = asyncHandler(async (req: Request, res: Response) => {
    const userName = (req.user as any).fullName || (req.user as any).name || req.user!.email || 'SuperAdmin Support';
    const { status, rejectionReason } = req.body;

    const ticket = await TicketsService.superAdminUpdateStatus(req.params.id, status, rejectionReason, userName);

    if (!ticket) {
      fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      return;
    }

    ok(res, { ticket });
  });

  /**
   * DELETE /api/v1/admin/tickets/:id
   * Delete ticket chat thread.
   */
  static deleteTicket = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user?.restaurantId ? req.user.restaurantId.toString() : undefined;
    const success = await TicketsService.deleteTicket(restaurantId, req.params.id);
    if (!success) {
      fail(res, 'NOT_FOUND', 'Ticket not found or already deleted', 404);
      return;
    }
    ok(res, { message: 'Ticket deleted successfully' });
  });

  /**
   * POST /api/v1/admin/tickets/:id/delete-message
   * Delete specific message (for me or for everyone).
   */
  static deleteMessage = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user?.restaurantId ? req.user.restaurantId.toString() : undefined;
    const { messageId, deleteForEveryone } = req.body;
    const ticket = await TicketsService.deleteMessage(restaurantId, req.params.id, messageId, deleteForEveryone);
    if (!ticket) {
      fail(res, 'NOT_FOUND', 'Ticket or message not found', 404);
      return;
    }
    ok(res, { ticket });
  });

  /**
   * POST /api/v1/admin/tickets/:id/block
   * Toggle block contact in chat.
   */
  static toggleBlock = asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = req.user?.restaurantId ? req.user.restaurantId.toString() : undefined;
    const ticket = await TicketsService.toggleBlockTicket(restaurantId, req.params.id);
    if (!ticket) {
      fail(res, 'NOT_FOUND', 'Ticket not found', 404);
      return;
    }
    ok(res, { ticket });
  });
}
