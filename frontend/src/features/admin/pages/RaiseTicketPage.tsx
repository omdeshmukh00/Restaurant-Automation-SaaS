import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LifeBuoy, Plus, Search, X, Send, CheckCircle2,
  Clock, AlertCircle, MessageSquare, ChevronRight, RefreshCw,
  Tag, ShieldAlert, ArrowUpRight, Ban, Building2, User, Phone, Mail,
  Info, Filter, Check, CheckCheck, MoreVertical, Trash2, ShieldOff
} from 'lucide-react';
import {
  adminTicketsApi,
  AdminTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketListResponse,
  AdminContactsResponse,
  UserContact,
  TicketTargetRole,
  TicketMessage,
} from '../api/admin.tickets.api';

// ── Badges & Formatting Helpers ────────────────────────────────────────

function StatusBadge({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, { bg: string; text: string; dot: string }> = {
    OPEN: {
      bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      text: 'Open',
      dot: 'bg-blue-500',
    },
    IN_PROGRESS: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      text: 'In Progress',
      dot: 'bg-amber-500',
    },
    ESCALATED: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      text: 'Escalated to SuperAdmin',
      dot: 'bg-purple-500 animate-pulse',
    },
    RESOLVED: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      text: 'Resolved',
      dot: 'bg-emerald-500',
    },
    REJECTED: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      text: 'Rejected',
      dot: 'bg-rose-500',
    },
    CLOSED: {
      bg: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      text: 'Closed',
      dot: 'bg-gray-400',
    },
  };
  const config = styles[status] || styles.OPEN;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.text}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const styles: Record<TicketPriority, string> = {
    URGENT: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md border ${styles[priority] || styles.MEDIUM}`}>
      {priority}
    </span>
  );
}

function RoleBadge({ role, subRole }: { role?: string; subRole?: string }) {
  if (!role) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase">User</span>;
  const r = role.toUpperCase();
  if (r.includes('SUPER')) return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase">SuperAdmin</span>;
  if (r.includes('RESTAURANT_ADMIN') || r === 'ADMIN' || r === 'RESTAURANT-ADMIN') return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 uppercase">Admin</span>;
  if (r.includes('KITCHEN')) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 uppercase">Kitchen Staff</span>;
  if (r.includes('CLEANING')) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 uppercase">Cleaning Staff</span>;
  if (r.includes('STAFF') || r.includes('WAITER')) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 uppercase">{subRole || 'Staff'}</span>;
  if (r.includes('CUSTOMER')) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 uppercase">Customer</span>;
  return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase">{role}</span>;
}

function MessageTick({ status, isOutgoing }: { status?: 'sent' | 'delivered' | 'seen'; isOutgoing?: boolean }) {
  if (!isOutgoing) return null;
  const s = status || 'seen';
  if (s === 'sent') {
    return (
      <span title="Sent">
        <Check className="w-3.5 h-3.5 text-white/80 inline-block ml-1" />
      </span>
    );
  }
  if (s === 'delivered') {
    return (
      <span title="Delivered">
        <CheckCheck className="w-3.5 h-3.5 text-white/80 inline-block ml-1" />
      </span>
    );
  }
  return (
    <span title="Seen">
      <CheckCheck className="w-3.5 h-3.5 text-amber-300 dark:text-amber-300 font-extrabold inline-block ml-1" />
    </span>
  );
}

function formatDate(isoDate?: string): string {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getContactFromTicket(ticket: AdminTicket): { name: string; role: string; email?: string; mobile?: string; avatar?: string } {
  // Case 1: Target role is SUPER_ADMIN or ticket escalated to SuperAdmin
  if (ticket.targetRole === 'SUPER_ADMIN' || (ticket.status === 'ESCALATED' && typeof ticket.createdBy === 'object' && (ticket.createdBy?.role === 'restaurant-admin' || ticket.createdBy?.role === 'RESTAURANT_ADMIN' || ticket.createdBy?.role === 'ADMIN'))) {
    return {
      name: 'SuperAdmin Support',
      role: 'SUPER_ADMIN',
      email: 'superadmin@platform.com',
    };
  }

  // Case 2: Target User exists and is set
  if (typeof ticket.targetUser === 'object' && ticket.targetUser?.name) {
    return {
      name: ticket.targetUser.name,
      role: ticket.targetUser.role || ticket.targetRole || 'USER',
      email: ticket.targetUser.email,
      mobile: ticket.targetUser.mobile,
      avatar: ticket.targetUser.avatar,
    };
  }

  // Case 3: Created By user exists
  if (typeof ticket.createdBy === 'object' && ticket.createdBy?.name) {
    return {
      name: ticket.createdBy.name,
      role: ticket.createdBy.role || 'USER',
      email: ticket.createdBy.email,
      mobile: ticket.createdBy.mobile,
      avatar: ticket.createdBy.avatar,
    };
  }

  return { name: 'SuperAdmin Support', role: 'SUPER_ADMIN' };
}

export default function RaiseTicketPage(): JSX.Element {
  const [data, setData] = useState<TicketListResponse | null>(null);
  const [contacts, setContacts] = useState<AdminContactsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Ticket Conversation
  const [selectedTicket, setSelectedTicket] = useState<AdminTicket | null>(null);
  const [showRightDrawer, setShowRightDrawer] = useState<boolean>(true);
  const [showHeaderMenu, setShowHeaderMenu] = useState<boolean>(false);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [tabFilter, setTabFilter] = useState<'ALL' | 'SUPER_ADMIN' | 'STAFF' | 'CUSTOMER' | 'ESCALATED'>('ALL');

  // New Chat / Ticket Modal State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [targetType, setTargetType] = useState<TicketTargetRole>('SUPER_ADMIN');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [createSubject, setCreateSubject] = useState<string>('');
  const [createCategory, setCreateCategory] = useState<TicketCategory>('TECHNICAL');
  const [createPriority, setCreatePriority] = useState<TicketPriority>('MEDIUM');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Action Modals: Rejection & Escalation & Message Click Modal
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [escalateModalOpen, setEscalateModalOpen] = useState<boolean>(false);
  const [escalateReasonInput, setEscalateReasonInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Clicked Message Modal State
  const [selectedMessage, setSelectedMessage] = useState<TicketMessage | null>(null);
  const [messageModalOpen, setMessageModalOpen] = useState<boolean>(false);

  // Reply Input State
  const [replyMessage, setReplyMessage] = useState<string>('');
  const [replying, setReplying] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch Tickets and Contacts
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let targetRoleQuery: string | undefined;
      let statusQuery: TicketStatus | undefined;

      if (tabFilter === 'SUPER_ADMIN') targetRoleQuery = 'SUPER_ADMIN';
      if (tabFilter === 'STAFF') targetRoleQuery = 'STAFF';
      if (tabFilter === 'CUSTOMER') targetRoleQuery = 'CUSTOMER';
      if (tabFilter === 'ESCALATED') statusQuery = 'ESCALATED';

      const [ticketsRes, contactsRes] = await Promise.all([
        adminTicketsApi.list({
          search: search || undefined,
          targetRole: targetRoleQuery,
          status: statusQuery,
        }),
        adminTicketsApi.getContacts(),
      ]);

      setData(ticketsRes);
      setContacts(contactsRes);

      // Auto-select first ticket if none selected or update active reference
      setSelectedTicket((prev) => {
        if (!prev) return ticketsRes.tickets[0] || null;
        const updatedSelected = ticketsRes.tickets.find((t) => t._id === prev._id);
        return updatedSelected || prev;
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load support chats');
    } finally {
      setLoading(false);
    }
  }, [search, tabFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scroll to bottom of chat thread on new messages
  useEffect(() => {
    if (selectedTicket) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  // Handle Send Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim() || selectedTicket.isBlocked) return;

    try {
      setReplying(true);
      const updatedTicket = await adminTicketsApi.addMessage(
        selectedTicket._id || selectedTicket.ticketId,
        replyMessage.trim()
      );
      setSelectedTicket(updatedTicket);
      setReplyMessage('');
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send message');
    } finally {
      setReplying(false);
    }
  };

  // Handle Create Ticket Submit
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createSubject.trim() || !createDescription.trim()) return;

    try {
      setSubmitting(true);
      const created = await adminTicketsApi.create({
        subject: createSubject.trim(),
        category: createCategory,
        priority: createPriority,
        targetRole: targetType,
        targetUser: selectedRecipientId || undefined,
        description: createDescription.trim(),
      });

      setIsCreateOpen(false);
      setCreateSubject('');
      setCreateDescription('');
      setSelectedRecipientId('');
      setSelectedTicket(created);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to start support ticket');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Status Update
  const handleStatusChange = async (newStatus: TicketStatus, rejectionReason?: string) => {
    if (!selectedTicket) return;
    try {
      setActionLoading(true);
      const updated = await adminTicketsApi.updateStatus(
        selectedTicket._id || selectedTicket.ticketId,
        newStatus,
        rejectionReason
      );
      setSelectedTicket(updated);
      setRejectModalOpen(false);
      setRejectionReasonInput('');
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update ticket status');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Escalation Submit
  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    try {
      setActionLoading(true);
      const updated = await adminTicketsApi.escalate(
        selectedTicket._id || selectedTicket.ticketId,
        escalateReasonInput.trim()
      );
      setSelectedTicket(updated);
      setEscalateModalOpen(false);
      setEscalateReasonInput('');
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to escalate ticket');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Three-Dot Options: Delete Ticket
  const handleDeleteChat = async () => {
    if (!selectedTicket) return;
    if (!window.confirm(`Are you sure you want to delete chat ${selectedTicket.ticketId}? This cannot be undone.`)) return;

    try {
      setActionLoading(true);
      await adminTicketsApi.deleteTicket(selectedTicket._id || selectedTicket.ticketId);
      setShowHeaderMenu(false);
      setSelectedTicket(null);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete chat');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Three-Dot Options: Toggle Block Contact
  const handleToggleBlock = async () => {
    if (!selectedTicket) return;
    try {
      setActionLoading(true);
      const updated = await adminTicketsApi.toggleBlock(selectedTicket._id || selectedTicket.ticketId);
      setSelectedTicket(updated);
      setShowHeaderMenu(false);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to toggle block status');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Message Deletion Options (Delete for Me vs Delete for Everyone)
  const handleDeleteMessageAction = async (deleteForEveryone: boolean) => {
    if (!selectedTicket || !selectedMessage?._id) return;
    try {
      setActionLoading(true);
      const updated = await adminTicketsApi.deleteMessage(
        selectedTicket._id || selectedTicket.ticketId,
        selectedMessage._id,
        deleteForEveryone
      );
      setSelectedTicket(updated);
      setMessageModalOpen(false);
      setSelectedMessage(null);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete message');
    } finally {
      setActionLoading(false);
    }
  };

  const activeContact = selectedTicket ? getContactFromTicket(selectedTicket) : null;

  const handleOpenCreateModal = () => {
    if (tabFilter === 'STAFF') {
      setTargetType('STAFF');
    } else if (tabFilter === 'CUSTOMER') {
      setTargetType('CUSTOMER');
    } else if (tabFilter === 'SUPER_ADMIN') {
      setTargetType('SUPER_ADMIN');
    } else {
      setTargetType('SUPER_ADMIN');
    }
    setSelectedRecipientId('');
    setIsCreateOpen(true);
  };

  return (
    <div className="h-[calc(100vh-4.5rem)] max-w-[1700px] mx-auto flex flex-col p-2 sm:p-4 gap-3 select-none font-sans">
      {/* ── Top Header Bar ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Support & Staff/Customer Chat
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Direct support chat with Customers, Staff members, and SuperAdmin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => fetchData()}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh tickets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-semibold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Ticket / Chat</span>
          </button>
        </div>
      </div>

      {/* ── Main 3-Pane Layout ──────────────────────────────────────── */}
      <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden flex min-h-0">
        
        {/* ── LEFT PANE: Contacts & Ticket Conversations List ──────────── */}
        <div className="w-full md:w-80 lg:w-96 border-r border-gray-200/80 dark:border-gray-800 flex flex-col shrink-0 bg-gray-50/40 dark:bg-gray-950/40">
          {/* Search Bar */}
          <div className="p-3 border-b border-gray-200/80 dark:border-gray-800 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats, contacts, tickets..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
              {(['ALL', 'SUPER_ADMIN', 'STAFF', 'CUSTOMER', 'ESCALATED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabFilter(tab)}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    tabFilter === tab
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200/60 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab === 'ALL' && 'All'}
                  {tab === 'SUPER_ADMIN' && 'SuperAdmin'}
                  {tab === 'STAFF' && 'Staff'}
                  {tab === 'CUSTOMER' && 'Customers'}
                  {tab === 'ESCALATED' && 'Escalated'}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
            {loading && !data ? (
              <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
                <span>Loading conversations...</span>
              </div>
            ) : !data?.tickets.length ? (
              <div className="p-8 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto" />
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">No Chats Found</p>
                <button
                  onClick={handleOpenCreateModal}
                  className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold shadow-sm cursor-pointer"
                >
                  + New Chat
                </button>
              </div>
            ) : (
              data.tickets.map((ticket) => {
                const contact = getContactFromTicket(ticket);
                const isSelected = selectedTicket?._id === ticket._id;
                const lastMsg = ticket.messages?.[ticket.messages.length - 1];

                return (
                  <div
                    key={ticket._id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 relative ${
                      isSelected
                        ? 'bg-orange-50/80 dark:bg-orange-950/30 border-l-4 border-orange-500'
                        : 'hover:bg-gray-100/60 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm relative">
                      {contact.name.charAt(0).toUpperCase()}
                      {ticket.isBlocked && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-600 rounded-full border-2 border-white dark:border-gray-900" title="Blocked" />
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {contact.name}
                        </h4>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {formatDate(ticket.updatedAt || ticket.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RoleBadge role={contact.role} />
                        <span className="font-mono text-[10px] text-gray-400 font-semibold">{ticket.ticketId}</span>
                      </div>

                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1 truncate">
                        {ticket.subject}
                      </p>

                      <div className="flex items-center justify-between gap-1 mt-1.5">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[170px]">
                          {lastMsg ? lastMsg.message : ticket.description}
                        </p>
                        <StatusBadge status={ticket.status} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── CENTER PANE: Active Chat Thread ─────────────────────────── */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900 relative">
            {/* Active Header (2-Row Layout: Row 1 User & Utils, Row 2 Actions) */}
            <div className="px-4 py-3 border-b border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 space-y-2.5 shrink-0">
              {/* Row 1: Contact Details & Utility Buttons */}
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    {activeContact?.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {activeContact?.name}
                      </h3>
                      <RoleBadge role={activeContact?.role} />
                      {selectedTicket.isBlocked && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 uppercase">
                          Blocked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap mt-0.5">
                      <span className="font-mono font-bold text-orange-500">{selectedTicket.ticketId}</span>
                      <span>•</span>
                      <span className="truncate max-w-[200px] sm:max-w-[300px]">{selectedTicket.subject}</span>
                    </div>
                  </div>
                </div>

                {/* Right Utility Buttons (Info + Three-Dot Menu) */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowRightDrawer(!showRightDrawer)}
                    className={`p-2 rounded-xl border transition-colors ${
                      showRightDrawer
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 border-orange-200 dark:border-orange-800'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title="Toggle Info Drawer"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                      className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      title="More Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showHeaderMenu && (
                      <div className="absolute right-0 top-11 z-50 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-1 space-y-1 animate-fade-in text-left">
                        <button
                          onClick={handleToggleBlock}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                        >
                          {selectedTicket.isBlocked ? (
                            <>
                              <ShieldOff className="w-4 h-4" />
                              <span>Unblock Contact</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-4 h-4 text-rose-500" />
                              <span>Block User</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleDeleteChat}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Chat</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Action Buttons Bar */}
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-200/50 dark:border-gray-800/50">
                <StatusBadge status={selectedTicket.status} />

                {selectedTicket.status !== 'ESCALATED' && selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                  <button
                    onClick={() => setEscalateModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Escalate to SuperAdmin</span>
                  </button>
                )}

                {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                  <button
                    onClick={() => handleStatusChange('RESOLVED')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Resolve</span>
                  </button>
                )}

                {selectedTicket.status !== 'REJECTED' && selectedTicket.status !== 'CLOSED' && (
                  <button
                    onClick={() => setRejectModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}
              </div>
            </div>

            {/* Blocked Contact Warning Banner */}
            {selectedTicket.isBlocked && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>You have blocked this contact. Messages cannot be sent.</span>
                </div>
                <button
                  onClick={handleToggleBlock}
                  className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors"
                >
                  Unblock
                </button>
              </div>
            )}

            {/* Rejection Banner */}
            {selectedTicket.status === 'REJECTED' && selectedTicket.rejectionReason && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">Ticket Rejected: </span>
                  <span className="text-rose-700 dark:text-rose-400 font-medium">{selectedTicket.rejectionReason}</span>
                </div>
              </div>
            )}

            {/* Chat Thread Messages Stream */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50/20 dark:bg-gray-950/20">
              {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                selectedTicket.messages.map((msg, idx) => {
                  const isStaffOrAdmin = msg.senderRole === 'RESTAURANT_ADMIN' || msg.senderRole === 'SUPER_ADMIN' || msg.senderRole === 'SUPPORT' || msg.senderRole === 'RESTAURANT-ADMIN';
                  const isSystem = msg.senderRole === 'SYSTEM';

                  if (isSystem) {
                    return (
                      <div key={msg._id || idx} className="flex justify-center my-2">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700">
                          {msg.message}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg._id || idx}
                      className={`flex flex-col ${isStaffOrAdmin ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">{msg.senderName}</span>
                        <RoleBadge role={msg.senderRole} />
                        <span>• {formatDate(msg.createdAt)}</span>
                      </div>
                      
                      {/* Clickable Chat Message Bubble */}
                      <div
                        onClick={() => {
                          setSelectedMessage(msg);
                          setMessageModalOpen(true);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedMessage(msg);
                          setMessageModalOpen(true);
                        }}
                        className={`p-3.5 rounded-2xl max-w-lg text-xs sm:text-sm leading-relaxed shadow-sm transition-all hover:opacity-95 cursor-pointer relative group ${
                          msg.deletedForEveryone
                            ? 'bg-gray-100 dark:bg-[#1c1c20] text-gray-400 dark:text-gray-500 italic border border-gray-200 dark:border-[#2b2b30]'
                            : isStaffOrAdmin
                            ? 'bg-orange-500 text-white rounded-tr-none'
                            : 'bg-white dark:bg-[#1c1c20] text-gray-900 dark:text-white border border-gray-200 dark:border-[#2b2b30] rounded-tl-none'
                        }`}
                        title="Right click or tap for message options"
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                        
                        {/* Read Receipt Ticks (For Outgoing Messages) */}
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-80">
                          <MessageTick status={msg.status} isOutgoing={isStaffOrAdmin} />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-gray-400 text-xs">
                  <p>No messages yet in this conversation.</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Reply Input */}
            <div className="p-3 border-t border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900">
              <form onSubmit={handleSendReply} className="flex gap-2 items-end">
                <textarea
                  rows={2}
                  disabled={selectedTicket.isBlocked}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply(e);
                    }
                  }}
                  placeholder={selectedTicket.isBlocked ? "Contact blocked. Unblock to reply." : "Type a message reply... (Press Enter to send)"}
                  className="flex-1 p-3 text-xs sm:text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white resize-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={replying || !replyMessage.trim() || selectedTicket.isBlocked}
                  className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 transition-all cursor-pointer shrink-0 h-10 text-xs"
                >
                  {replying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <MessageSquare className="w-12 h-12 mb-3 text-orange-400" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">Select a Support Conversation</h3>
            <p className="text-xs max-w-sm mt-1">Pick a contact from the left pane or start a new support ticket with Staff, Customers, or SuperAdmin.</p>
          </div>
        )}

        {/* ── RIGHT PANE: Contact Info & Ticket Drawer (Collapsible) ──── */}
        {selectedTicket && showRightDrawer && (
          <div className="w-72 lg:w-80 border-l border-gray-200/80 dark:border-gray-800 p-4 overflow-y-auto space-y-4 shrink-0 bg-gray-50/40 dark:bg-gray-950/40">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200/80 dark:border-gray-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Contact & Ticket Info
              </h3>
              <button
                onClick={() => setShowRightDrawer(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold text-xl flex items-center justify-center mx-auto shadow-md">
                {activeContact?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{activeContact?.name}</h4>
                <div className="mt-1">
                  <RoleBadge role={activeContact?.role} />
                </div>
              </div>

              <div className="pt-2 text-xs text-left space-y-1.5 border-t border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300">
                {activeContact?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{activeContact.email}</span>
                  </div>
                )}
                {activeContact?.mobile && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{activeContact.mobile}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ticket Metadata Card */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Ticket Metadata</h4>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Ticket ID</span>
                  <span className="font-mono font-bold text-orange-500">{selectedTicket.ticketId}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Status</span>
                  <StatusBadge status={selectedTicket.status} />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Priority</span>
                  <PriorityBadge priority={selectedTicket.priority} />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Category</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedTicket.category}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Created</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatDate(selectedTicket.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* ── MODAL: Raise / Start New Ticket / Chat ───────────────────── */}
      {isCreateOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in font-sans">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4" />
                </div>
                <h3 className="font-sans font-bold text-lg text-gray-900 dark:text-white">Start New Support Ticket / Chat</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-4 overflow-y-auto flex-1 font-sans">
              {/* Recipient Type Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Select Recipient Target *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setTargetType('SUPER_ADMIN'); setSelectedRecipientId(''); }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      targetType === 'SUPER_ADMIN'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    SuperAdmin
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTargetType('STAFF'); setSelectedRecipientId(''); }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      targetType === 'STAFF'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    Staff Member
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTargetType('CUSTOMER'); setSelectedRecipientId(''); }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      targetType === 'CUSTOMER'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    Customer
                  </button>
                </div>
              </div>

              {/* Specific Recipient Select (If Staff or Customer) */}
              {targetType !== 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                    Choose Specific {targetType === 'STAFF' ? 'Staff Member' : 'Customer'} *
                  </label>
                  <select
                    required
                    value={selectedRecipientId}
                    onChange={(e) => setSelectedRecipientId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
                  >
                    <option value="">Select recipient...</option>
                    {targetType === 'STAFF' &&
                      contacts?.staff?.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name} ({u.role}) - {u.mobile || u.email || 'No contact'}
                        </option>
                      ))}
                    {targetType === 'CUSTOMER' &&
                      contacts?.customers?.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name} (Customer) - {u.mobile || u.email || 'No contact'}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={createSubject}
                  onChange={(e) => setCreateSubject(e.target.value)}
                  placeholder="Brief summary of your query or support message"
                  className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                    Category *
                  </label>
                  <select
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value as TicketCategory)}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
                  >
                    <option value="TECHNICAL">Technical Issue</option>
                    <option value="BILLING">Billing & Subscription</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="ACCOUNT">Account Management</option>
                    <option value="ORDER_QUERY">Order Query</option>
                    <option value="STAFF_QUERY">Staff Query</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                    Priority *
                  </label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value as TicketPriority)}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Initial Message */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Initial Message *
                </label>
                <textarea
                  required
                  rows={4}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Describe your question or message in detail..."
                  className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !createSubject.trim() || !createDescription.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-semibold text-sm shadow-md disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Submit Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Reject Ticket ──────────────────────────────────────── */}
      {rejectModalOpen && selectedTicket && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 animate-fade-in font-sans">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Ban className="w-6 h-6" />
              <h3 className="font-sans font-bold text-lg text-gray-900 dark:text-white">Reject Support Ticket</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Please specify the reason for rejecting ticket <span className="font-bold text-gray-700 dark:text-gray-300">{selectedTicket.ticketId}</span>.
            </p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                Rejection Reason *
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Enter detailed reason for rejection..."
                className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-gray-900 dark:text-white resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !rejectionReasonInput.trim()}
                onClick={() => handleStatusChange('REJECTED', rejectionReasonInput.trim())}
                className="px-5 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                <span>Reject Ticket</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Escalate Ticket ────────────────────────────────────── */}
      {escalateModalOpen && selectedTicket && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 animate-fade-in font-sans">
          <form onSubmit={handleEscalateSubmit} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-purple-600">
              <ArrowUpRight className="w-6 h-6" />
              <h3 className="font-sans font-bold text-lg text-gray-900 dark:text-white">Escalate to SuperAdmin</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This ticket will be flagged directly to the SuperAdmin team for immediate intervention.
            </p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                Reason for Escalation (Optional)
              </label>
              <textarea
                rows={3}
                value={escalateReasonInput}
                onChange={(e) => setEscalateReasonInput(e.target.value)}
                placeholder="Explain why this ticket requires SuperAdmin escalation..."
                className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEscalateModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                <span>Confirm Escalation</span>
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* ── MODAL: Message Options (Delete / Delete for Everyone / Cancel) */}
      {messageModalOpen && selectedMessage && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in font-sans">
          <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-[#242428] text-gray-900 dark:text-white rounded-3xl shadow-lg w-full max-w-sm overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#242428] pb-3">
              <h3 className="font-sans font-bold text-base">Message Options</h3>
              <button onClick={() => setMessageModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-gray-100 dark:bg-[#1c1c20] text-gray-700 dark:text-gray-300 rounded-2xl text-xs italic border border-gray-200 dark:border-[#2b2b30]">
              "{selectedMessage.message}"
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleDeleteMessageAction(false)}
                disabled={actionLoading}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-[#1c1c20] dark:hover:bg-[#26262b] text-gray-800 dark:text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>Delete for Me</span>
              </button>

              {!selectedMessage.deletedForEveryone && (
                <button
                  onClick={() => handleDeleteMessageAction(true)}
                  disabled={actionLoading}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete for Everyone</span>
                </button>
              )}

              <button
                onClick={() => setMessageModalOpen(false)}
                className="w-full py-2 px-4 border border-gray-200 dark:border-[#2b2b30] text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-[#1c1c20] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
