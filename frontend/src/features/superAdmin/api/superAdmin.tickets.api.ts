import { apiClient } from '../../../shared/services/apiClient';
import {
  AdminTicket,
  TicketListResponse,
  TicketStatus,
  TicketCategory,
  TicketPriority,
  UserContact,
} from '../../admin/api/admin.tickets.api';

export interface SuperAdminTicketListParams {
  restaurantId?: string;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SuperAdminContactsResponse {
  restaurantAdmins: UserContact[];
  staff: UserContact[];
  customers: UserContact[];
}

export const superAdminTicketsApi = {
  getContacts: async (): Promise<SuperAdminContactsResponse> => {
    const res = await apiClient.get('/superadmin/tickets/contacts');
    return res.data.data.contacts;
  },

  list: async (params: SuperAdminTicketListParams = {}): Promise<TicketListResponse> => {
    const res = await apiClient.get('/superadmin/tickets', { params });
    return res.data.data;
  },

  addMessage: async (id: string, message: string, attachments?: string[]): Promise<AdminTicket> => {
    const res = await apiClient.post(`/superadmin/tickets/${id}/messages`, { message, attachments });
    return res.data.data.ticket;
  },

  updateStatus: async (id: string, status: TicketStatus, rejectionReason?: string): Promise<AdminTicket> => {
    const res = await apiClient.patch(`/superadmin/tickets/${id}/status`, { status, rejectionReason });
    return res.data.data.ticket;
  },

  deleteTicket: async (id: string): Promise<void> => {
    await apiClient.delete(`/superadmin/tickets/${id}`);
  },

  deleteMessage: async (ticketId: string, messageId: string, deleteForEveryone: boolean = false): Promise<AdminTicket> => {
    const res = await apiClient.post(`/superadmin/tickets/${ticketId}/delete-message`, { messageId, deleteForEveryone });
    return res.data.data.ticket;
  },

  toggleBlock: async (id: string): Promise<AdminTicket> => {
    const res = await apiClient.post(`/superadmin/tickets/${id}/block`);
    return res.data.data.ticket;
  },
};
