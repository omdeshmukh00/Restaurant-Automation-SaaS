import { TicketModel, ITicket, TicketCategory, TicketPriority, TicketStatus, TicketTargetRole } from './tickets.model';
import { UserModel } from '../users/users.model';
import { Types } from 'mongoose';

export interface CreateTicketDTO {
  restaurantId: string;
  createdBy: string;
  senderName: string;
  senderRole?: string;
  targetRole?: TicketTargetRole;
  targetUser?: string;
  subject: string;
  category: TicketCategory;
  priority?: TicketPriority;
  description: string;
  attachments?: string[];
}

export interface AddMessageDTO {
  senderId?: string;
  senderName: string;
  senderRole?: string;
  message: string;
  attachments?: string[];
}

export class TicketsService {
  private static async generateTicketId(): Promise<string> {
    const count = await TicketModel.countDocuments();
    const sequence = 10000 + count + 1;
    return `TKT-${sequence}`;
  }

  static async createTicket(dto: CreateTicketDTO): Promise<ITicket> {
    const ticketId = await this.generateTicketId();
    const initialMessage = {
      senderId: new Types.ObjectId(dto.createdBy),
      senderName: dto.senderName,
      senderRole: dto.senderRole || 'RESTAURANT_ADMIN',
      message: dto.description,
      attachments: dto.attachments || [],
      createdAt: new Date(),
    };

    const ticket = new TicketModel({
      ticketId,
      restaurantId: new Types.ObjectId(dto.restaurantId),
      createdBy: new Types.ObjectId(dto.createdBy),
      targetRole: dto.targetRole || 'SUPER_ADMIN',
      targetUser: dto.targetUser ? new Types.ObjectId(dto.targetUser) : undefined,
      subject: dto.subject,
      category: dto.category,
      priority: dto.priority || 'MEDIUM',
      status: 'OPEN',
      description: dto.description,
      messages: [initialMessage],
      attachments: dto.attachments || [],
      lastRepliedAt: new Date(),
    });

    return await ticket.save();
  }

  static async getContacts(restaurantId: string) {
    const rId = new Types.ObjectId(restaurantId);

    // Filter staff members only (exclude restaurant-admin)
    const staffRoleVariants = [
      'service-staff', 'kitchen-staff', 'cleaning-staff', 'staff', 'kitchen', 'cleaning',
      'SERVICE-STAFF', 'KITCHEN-STAFF', 'CLEANING-STAFF', 'STAFF', 'KITCHEN', 'CLEANING'
    ];
    const customerRoleVariants = ['customer', 'CUSTOMER'];

    const [staffUsers, customerUsers] = await Promise.all([
      UserModel.find({
        restaurantId: rId,
        role: { $in: staffRoleVariants },
        status: { $nin: ['DELETED', 'INACTIVE', 'SUSPENDED'] },
      })
        .select('name email mobile role kitchen_role staff_role cleaning_role createdAt')
        .lean(),
      UserModel.find({
        $or: [
          { restaurantId: rId },
          { role: { $in: customerRoleVariants } },
        ],
        status: { $nin: ['DELETED', 'INACTIVE', 'SUSPENDED'] },
      })
        .select('name email mobile role createdAt')
        .limit(100)
        .lean(),
    ]);

    const superAdminContact = {
      _id: 'SUPER_ADMIN',
      name: 'SuperAdmin Platform Support',
      role: 'SUPER_ADMIN',
      email: 'support@restohub.com',
      mobile: '+1-800-RESTOHUB',
    };

    return {
      superAdmin: superAdminContact,
      staff: staffUsers,
      customers: customerUsers,
    };
  }

  static async getSuperAdminContacts() {
    const staffRoleVariants = [
      'service-staff', 'kitchen-staff', 'cleaning-staff', 'staff', 'kitchen', 'cleaning',
      'SERVICE-STAFF', 'KITCHEN-STAFF', 'CLEANING-STAFF', 'STAFF', 'KITCHEN', 'CLEANING'
    ];
    const adminRoleVariants = ['restaurant-admin', 'RESTAURANT_ADMIN', 'admin', 'ADMIN'];
    const customerRoleVariants = ['customer', 'CUSTOMER'];

    const [restaurantAdmins, staffUsers, customerUsers] = await Promise.all([
      UserModel.find({ role: { $in: adminRoleVariants }, status: { $nin: ['DELETED', 'INACTIVE', 'SUSPENDED'] } })
        .populate('restaurantId', 'name city')
        .select('name email mobile role restaurantId createdAt')
        .lean(),
      UserModel.find({ role: { $in: staffRoleVariants }, status: { $nin: ['DELETED', 'INACTIVE', 'SUSPENDED'] } })
        .populate('restaurantId', 'name city')
        .select('name email mobile role kitchen_role staff_role cleaning_role restaurantId createdAt')
        .lean(),
      UserModel.find({ role: { $in: customerRoleVariants }, status: { $nin: ['DELETED', 'INACTIVE', 'SUSPENDED'] } })
        .select('name email mobile role createdAt')
        .limit(200)
        .lean(),
    ]);

    return {
      restaurantAdmins,
      staff: staffUsers,
      customers: customerUsers,
    };
  }

  static async getTickets(
    restaurantId: string,
    query: {
      status?: TicketStatus;
      category?: TicketCategory;
      priority?: TicketPriority;
      targetRole?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const filter: any = { restaurantId: new Types.ObjectId(restaurantId) };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }
    if (query.targetRole) {
      filter.targetRole = query.targetRole;
    }
    if (query.search) {
      filter.$or = [
        { ticketId: { $regex: query.search, $options: 'i' } },
        { subject: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      TicketModel.find(filter)
        .populate('createdBy', 'name email mobile role')
        .populate('targetUser', 'name email mobile role')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TicketModel.countDocuments(filter),
    ]);

    const statsResult = await TicketModel.aggregate([
      { $match: { restaurantId: new Types.ObjectId(restaurantId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      total: 0,
      open: 0,
      inProgress: 0,
      escalated: 0,
      resolved: 0,
      rejected: 0,
      closed: 0,
    };

    statsResult.forEach((item) => {
      stats.total += item.count;
      if (item._id === 'OPEN') stats.open = item.count;
      if (item._id === 'IN_PROGRESS') stats.inProgress = item.count;
      if (item._id === 'ESCALATED') stats.escalated = item.count;
      if (item._id === 'RESOLVED') stats.resolved = item.count;
      if (item._id === 'REJECTED') stats.rejected = item.count;
      if (item._id === 'CLOSED') stats.closed = item.count;
    });

    return {
      tickets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    };
  }

  static async getTicketById(restaurantId: string, id: string): Promise<ITicket | null> {
    const isMongoId = Types.ObjectId.isValid(id);
    const query: any = { restaurantId: new Types.ObjectId(restaurantId) };
    if (isMongoId) {
      query.$or = [{ _id: new Types.ObjectId(id) }, { ticketId: id }];
    } else {
      query.ticketId = id;
    }

    return await TicketModel.findOne(query)
      .populate('createdBy', 'name email mobile role')
      .populate('targetUser', 'name email mobile role');
  }

  static async addMessage(
    restaurantId: string,
    id: string,
    dto: AddMessageDTO
  ): Promise<ITicket | null> {
    const ticket = await this.getTicketById(restaurantId, id);
    if (!ticket) return null;

    const newMessage: any = {
      senderId: dto.senderId ? new Types.ObjectId(dto.senderId) : undefined,
      senderName: dto.senderName,
      senderRole: dto.senderRole || 'RESTAURANT_ADMIN',
      message: dto.message,
      attachments: dto.attachments || [],
      createdAt: new Date(),
    };

    ticket.messages.push(newMessage);
    ticket.lastRepliedAt = new Date();

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      ticket.status = 'OPEN';
    }

    return await ticket.save();
  }

  static async updateStatus(
    restaurantId: string,
    id: string,
    status: TicketStatus,
    rejectionReason?: string
  ): Promise<ITicket | null> {
    const ticket = await this.getTicketById(restaurantId, id);
    if (!ticket) return null;

    ticket.status = status;
    if (status === 'REJECTED' && rejectionReason) {
      ticket.rejectionReason = rejectionReason;
      ticket.messages.push({
        senderName: 'System',
        senderRole: 'SYSTEM',
        message: `Ticket rejected. Reason: ${rejectionReason}`,
        createdAt: new Date(),
      });
    } else if (status === 'RESOLVED') {
      ticket.messages.push({
        senderName: 'System',
        senderRole: 'SYSTEM',
        message: 'Ticket resolved by Restaurant Admin.',
        createdAt: new Date(),
      });
    }

    return await ticket.save();
  }

  static async escalateTicket(
    restaurantId: string,
    id: string,
    reason?: string,
    userRole: string = 'RESTAURANT_ADMIN',
    userName: string = 'Admin User'
  ): Promise<ITicket | null> {
    const ticket = await this.getTicketById(restaurantId, id);
    if (!ticket) return null;

    ticket.status = 'ESCALATED';
    ticket.targetRole = 'SUPER_ADMIN';
    ticket.escalatedTo = 'SUPER_ADMIN';
    ticket.escalatedAt = new Date();
    if (reason) {
      ticket.escalationReason = reason;
    }

    ticket.messages.push({
      senderName: userName,
      senderRole: userRole,
      message: `[ESCALATED TO SUPER ADMIN] ${reason || 'Escalated for higher priority resolution.'}`,
      createdAt: new Date(),
    });

    return await ticket.save();
  }

  // ────────────────────────────────────────────────────────────────
  // SUPER ADMIN SPECIFIC TICKET METHODS
  // ────────────────────────────────────────────────────────────────

  static async getSuperAdminTickets(query: {
    restaurantId?: string;
    status?: TicketStatus;
    category?: TicketCategory;
    priority?: TicketPriority;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};

    if (query.restaurantId) {
      filter.restaurantId = new Types.ObjectId(query.restaurantId);
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }
    if (query.search) {
      filter.$or = [
        { ticketId: { $regex: query.search, $options: 'i' } },
        { subject: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      TicketModel.find(filter)
        .populate('restaurantId', 'name city ownerName email')
        .populate('createdBy', 'name email mobile role')
        .populate('targetUser', 'name email mobile role')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .setOptions({ bypassTenant: true })
        .lean(),
      TicketModel.countDocuments(filter),
    ]);

    const statsResult = await TicketModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      total: 0,
      open: 0,
      inProgress: 0,
      escalated: 0,
      resolved: 0,
      rejected: 0,
      closed: 0,
    };

    statsResult.forEach((item) => {
      stats.total += item.count;
      if (item._id === 'OPEN') stats.open = item.count;
      if (item._id === 'IN_PROGRESS') stats.inProgress = item.count;
      if (item._id === 'ESCALATED') stats.escalated = item.count;
      if (item._id === 'RESOLVED') stats.resolved = item.count;
      if (item._id === 'REJECTED') stats.rejected = item.count;
      if (item._id === 'CLOSED') stats.closed = item.count;
    });

    return {
      tickets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    };
  }

  static async superAdminAddMessage(
    id: string,
    dto: AddMessageDTO
  ): Promise<ITicket | null> {
    const isMongoId = Types.ObjectId.isValid(id);
    const query = isMongoId ? { $or: [{ _id: new Types.ObjectId(id) }, { ticketId: id }] } : { ticketId: id };

    const ticket = await TicketModel.findOne(query)
      .populate('createdBy', 'name email mobile role')
      .populate('targetUser', 'name email mobile role')
      .setOptions({ bypassTenant: true });
    if (!ticket) return null;

    const newMessage: any = {
      senderId: dto.senderId ? new Types.ObjectId(dto.senderId) : undefined,
      senderName: dto.senderName || 'SuperAdmin Support',
      senderRole: 'SUPER_ADMIN',
      message: dto.message,
      attachments: dto.attachments || [],
      createdAt: new Date(),
    };

    ticket.messages.push(newMessage);
    ticket.lastRepliedAt = new Date();

    if (ticket.status === 'OPEN' || ticket.status === 'ESCALATED') {
      ticket.status = 'IN_PROGRESS';
    }

    return await ticket.save();
  }

  static async superAdminUpdateStatus(
    id: string,
    status: TicketStatus,
    rejectionReason?: string,
    senderName: string = 'SuperAdmin Support'
  ): Promise<ITicket | null> {
    const isMongoId = Types.ObjectId.isValid(id);
    const query = isMongoId ? { $or: [{ _id: new Types.ObjectId(id) }, { ticketId: id }] } : { ticketId: id };

    const ticket = await TicketModel.findOne(query)
      .populate('createdBy', 'name email mobile role')
      .populate('targetUser', 'name email mobile role')
      .setOptions({ bypassTenant: true });
    if (!ticket) return null;

    ticket.status = status;
    if (status === 'REJECTED' && rejectionReason) {
      ticket.rejectionReason = rejectionReason;
      ticket.messages.push({
        senderName,
        senderRole: 'SUPER_ADMIN',
        message: `Ticket rejected by SuperAdmin. Reason: ${rejectionReason}`,
        createdAt: new Date(),
      });
    } else if (status === 'RESOLVED') {
      ticket.messages.push({
        senderName,
        senderRole: 'SUPER_ADMIN',
        message: 'Ticket resolved by SuperAdmin Support.',
        createdAt: new Date(),
      });
    }

    return await ticket.save();
  }

  static async deleteTicket(restaurantId?: string, id?: string): Promise<boolean> {
    const isMongoId = Types.ObjectId.isValid(id || '');
    const query: any = {};
    if (restaurantId) query.restaurantId = new Types.ObjectId(restaurantId);
    if (isMongoId) {
      query.$or = [{ _id: new Types.ObjectId(id) }, { ticketId: id }];
    } else {
      query.ticketId = id;
    }
    const res = await TicketModel.deleteOne(query).setOptions({ bypassTenant: !restaurantId });
    return res.deletedCount > 0;
  }

  static async deleteMessage(
    restaurantId?: string,
    ticketId?: string,
    messageId?: string,
    deleteForEveryone: boolean = false
  ): Promise<ITicket | null> {
    const isMongoId = Types.ObjectId.isValid(ticketId || '');
    const query: any = {};
    if (restaurantId) query.restaurantId = new Types.ObjectId(restaurantId);
    if (isMongoId) {
      query.$or = [{ _id: new Types.ObjectId(ticketId) }, { ticketId: ticketId }];
    } else {
      query.ticketId = ticketId;
    }

    const ticket = await TicketModel.findOne(query).setOptions({ bypassTenant: !restaurantId });
    if (!ticket) return null;

    const msgIndex = ticket.messages.findIndex((m: any) => m._id?.toString() === messageId);
    if (msgIndex !== -1) {
      if (deleteForEveryone) {
        ticket.messages[msgIndex].message = 'This message was deleted';
        ticket.messages[msgIndex].deletedForEveryone = true;
      } else {
        ticket.messages.splice(msgIndex, 1);
      }
      await ticket.save();
    }

    return await TicketModel.findById(ticket._id)
      .populate('createdBy', 'name email mobile role')
      .populate('targetUser', 'name email mobile role')
      .setOptions({ bypassTenant: true });
  }

  static async toggleBlockTicket(restaurantId?: string, id?: string): Promise<ITicket | null> {
    const isMongoId = Types.ObjectId.isValid(id || '');
    const query: any = {};
    if (restaurantId) query.restaurantId = new Types.ObjectId(restaurantId);
    if (isMongoId) {
      query.$or = [{ _id: new Types.ObjectId(id) }, { ticketId: id }];
    } else {
      query.ticketId = id;
    }

    const ticket = await TicketModel.findOne(query).setOptions({ bypassTenant: !restaurantId });
    if (!ticket) return null;

    ticket.isBlocked = !ticket.isBlocked;
    await ticket.save();

    return await TicketModel.findById(ticket._id)
      .populate('createdBy', 'name email mobile role')
      .populate('targetUser', 'name email mobile role')
      .setOptions({ bypassTenant: true });
  }
}
