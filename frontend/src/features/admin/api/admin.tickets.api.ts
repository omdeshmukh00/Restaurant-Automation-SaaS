import { apiClient } from '../../../shared/services/apiClient';

export type TicketCategory =
  | 'TECHNICAL'
  | 'BILLING'
  | 'FEATURE_REQUEST'
  | 'ACCOUNT'
  | 'ORDER_QUERY'
  | 'STAFF_QUERY'
  | 'OTHER';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CLOSED';

export type TicketTargetRole =
  | 'SUPER_ADMIN'
  | 'RESTAURANT_ADMIN'
  | 'STAFF'
  | 'KITCHEN'
  | 'CLEANING'
  | 'CUSTOMER';

export interface UserContact {
  _id: string;
  name: string;
  email?: string;
  mobile?: string;
  role: string;
  kitchen_role?: string;
  staff_role?: string;
  cleaning_role?: string;
  avatar?: string;
  restaurantId?: string | { _id: string; name: string };
  createdAt?: string;
}

export interface AdminContactsResponse {
  superAdmin: UserContact;
  staff: UserContact[];
  customers: UserContact[];
}

export interface TicketMessage {
  _id?: string;
  senderId?: string;
  senderName: string;
  senderRole: string;
  message: string;
  attachments?: string[];
  status?: 'sent' | 'delivered' | 'seen';
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
  createdAt: string;
}

export interface AdminTicket {
  _id: string;
  ticketId: string;
  restaurantId: string | { _id: string; name: string; city?: string; ownerName?: string; email?: string };
  createdBy: string | UserContact;
  targetRole?: TicketTargetRole;
  targetUser?: string | UserContact;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  rejectionReason?: string;
  escalatedTo?: string;
  escalationReason?: string;
  escalatedAt?: string;
  messages: TicketMessage[];
  attachments?: string[];
  isBlocked?: boolean;
  blockedBy?: string;
  lastRepliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListResponse {
  tickets: AdminTicket[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    total: number;
    open: number;
    inProgress: number;
    escalated: number;
    resolved: number;
    rejected: number;
    closed: number;
  };
}

export interface TicketListParams {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  targetRole?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTicketPayload {
  subject: string;
  category: TicketCategory;
  priority?: TicketPriority;
  targetRole?: TicketTargetRole;
  targetUser?: string;
  description: string;
  attachments?: string[];
}

export const adminTicketsApi = {
  getContacts: async (): Promise<AdminContactsResponse> => {
    const res = await apiClient.get('/admin/tickets/contacts');
    return res.data.data.contacts;
  },

  create: async (payload: CreateTicketPayload): Promise<AdminTicket> => {
    const res = await apiClient.post('/admin/tickets', payload);
    return res.data.data.ticket;
  },

  list: async (params: TicketListParams = {}): Promise<TicketListResponse> => {
    const res = await apiClient.get('/admin/tickets', { params });
    return res.data.data;
  },

  getById: async (id: string): Promise<AdminTicket> => {
    const res = await apiClient.get(`/admin/tickets/${id}`);
    return res.data.data.ticket;
  },

  addMessage: async (id: string, message: string, attachments?: string[]): Promise<AdminTicket> => {
    const res = await apiClient.post(`/admin/tickets/${id}/messages`, { message, attachments });
    return res.data.data.ticket;
  },

  updateStatus: async (id: string, status: TicketStatus, rejectionReason?: string): Promise<AdminTicket> => {
    const res = await apiClient.patch(`/admin/tickets/${id}/status`, { status, rejectionReason });
    return res.data.data.ticket;
  },

  escalate: async (id: string, reason?: string): Promise<AdminTicket> => {
    const res = await apiClient.post(`/admin/tickets/${id}/escalate`, { reason });
    return res.data.data.ticket;
  },

  deleteTicket: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/tickets/${id}`);
  },

  deleteMessage: async (ticketId: string, messageId: string, deleteForEveryone: boolean = false): Promise<AdminTicket> => {
    const res = await apiClient.post(`/admin/tickets/${ticketId}/delete-message`, { messageId, deleteForEveryone });
    return res.data.data.ticket;
  },

  toggleBlock: async (id: string): Promise<AdminTicket> => {
    const res = await apiClient.post(`/admin/tickets/${id}/block`);
    return res.data.data.ticket;
  },
};
