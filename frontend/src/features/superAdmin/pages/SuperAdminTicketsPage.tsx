import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import {
  LifeBuoy, Search, X, Send, CheckCircle2,
  Clock, AlertCircle, MessageSquare, ChevronRight, RefreshCw,
  Tag, ShieldAlert, ArrowUpRight, Ban, Building2, User, Phone, Mail,
  Info, Filter, Check, CheckCheck, MoreVertical, Trash2, ShieldOff
} from 'lucide-react';
import { superAdminTicketsApi, SuperAdminContactsResponse } from '../api/superAdmin.tickets.api';
import {
  AdminTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketListResponse,
  UserContact,
  TicketMessage,
} from '../../admin/api/admin.tickets.api';

interface LayoutContextType {
  darkMode: boolean;
}

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
      bg: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
      text: 'Closed',
      dot: 'bg-zinc-400',
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
    LOW: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md border ${styles[priority] || styles.MEDIUM}`}>
      {priority}
    </span>
  );
}

function RoleBadge({ role }: { role?: string }) {
  if (!role) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase">User</span>;
  const r = role.toUpperCase();
  if (r.includes('SUPER')) return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase">SuperAdmin</span>;
  if (r.includes('RESTAURANT_ADMIN') || r === 'ADMIN' || r === 'RESTAURANT-ADMIN') return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 uppercase">Resto Admin</span>;
  if (r.includes('KITCHEN') || r.includes('CLEANING') || r.includes('STAFF')) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 uppercase">Staff</span>;
  if (r.includes('CUSTOMER')) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 uppercase">Customer</span>;
  return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase">{role}</span>;
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

function getContactFromTicket(ticket: AdminTicket): { name: string; role: string; email?: string; mobile?: string; restaurantName?: string } {
  let restName: string | undefined;
  if (typeof ticket.restaurantId === 'object' && ticket.restaurantId?.name) {
    restName = ticket.restaurantId.name;
  }

  if (typeof ticket.createdBy === 'object' && ticket.createdBy?.name) {
    return {
      name: ticket.createdBy.name,
      role: ticket.createdBy.role || 'USER',
      email: ticket.createdBy.email,
      mobile: ticket.createdBy.mobile,
      restaurantName: restName,
    };
  }

  return { name: 'Restaurant Admin', role: 'RESTAURANT_ADMIN', restaurantName: restName };
}

export default function SuperAdminTicketsPage(): JSX.Element {
  const context = useOutletContext<LayoutContextType>();
  const darkMode = context?.darkMode ?? true;

  const [data, setData] = useState<TicketListResponse | null>(null);
  const [contacts, setContacts] = useState<SuperAdminContactsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Ticket Conversation
  const [selectedTicket, setSelectedTicket] = useState<AdminTicket | null>(null);
  const [showRightDrawer, setShowRightDrawer] = useState<boolean>(true);
  const [showHeaderMenu, setShowHeaderMenu] = useState<boolean>(false);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');

  // Reject Modal
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Clicked Message Modal State
  const [selectedMessage, setSelectedMessage] = useState<TicketMessage | null>(null);
  const [messageModalOpen, setMessageModalOpen] = useState<boolean>(false);

  // Reply Input State
  const [replyMessage, setReplyMessage] = useState<string>('');
  const [replying, setReplying] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch Tickets
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [ticketsRes, contactsRes] = await Promise.all([
        superAdminTicketsApi.list({
          search: search || undefined,
          status: statusFilter || undefined,
        }),
        superAdminTicketsApi.getContacts(),
      ]);

      setData(ticketsRes);
      setContacts(contactsRes);

      setSelectedTicket((prev) => {
        if (!prev) return ticketsRes.tickets[0] || null;
        const updatedSelected = ticketsRes.tickets.find((t) => t._id === prev._id);
        return updatedSelected || prev;
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load platform support tickets');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedTicket) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  // Handle SuperAdmin Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim() || selectedTicket.isBlocked) return;

    try {
      setReplying(true);
      const updatedTicket = await superAdminTicketsApi.addMessage(
        selectedTicket._id || selectedTicket.ticketId,
        replyMessage.trim()
      );
      setSelectedTicket(updatedTicket);
      setReplyMessage('');
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  // Handle Status Update
  const handleStatusChange = async (newStatus: TicketStatus, rejectionReason?: string) => {
    if (!selectedTicket) return;
    try {
      setActionLoading(true);
      const updated = await superAdminTicketsApi.updateStatus(
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

  // Handle Three-Dot Options: Delete Ticket
  const handleDeleteChat = async () => {
    if (!selectedTicket) return;
    if (!window.confirm(`Are you sure you want to delete chat ${selectedTicket.ticketId}? This cannot be undone.`)) return;

    try {
      setActionLoading(true);
      await superAdminTicketsApi.deleteTicket(selectedTicket._id || selectedTicket.ticketId);
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
      const updated = await superAdminTicketsApi.toggleBlock(selectedTicket._id || selectedTicket.ticketId);
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
      const updated = await superAdminTicketsApi.deleteMessage(
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

  return (
    <div className={`h-[calc(100vh-4.5rem)] max-w-[1700px] mx-auto flex flex-col p-2 sm:p-4 gap-3 select-none font-sans ${
      darkMode ? 'text-zinc-100' : 'text-zinc-900'
    }`}>
      {/* ── Top Bar Header ───────────────────────────────────────────── */}
      <div className={`border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 ${
        darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              Platform Support Chat Portal
            </h1>
            <p className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Manage support tickets, customer issues, and direct support inquiries across all registered restaurants.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchData()}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            darkMode ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Main 3-Pane Layout ──────────────────────────────────────── */}
      <div className={`flex-1 border rounded-3xl shadow-sm overflow-hidden flex min-h-0 ${
        darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        
        {/* ── LEFT PANE: Conversations List ────────────────────────────── */}
        <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col shrink-0 ${
          darkMode ? 'border-zinc-800 bg-zinc-950/40' : 'border-zinc-200 bg-zinc-50/50'
        }`}>
          {/* Search & Filters */}
          <div className={`p-3 border-b space-y-2.5 ${darkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket ID, restaurant name..."
                className={`w-full pl-9 pr-8 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                }`}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus | '')}
              className={`w-full px-3 py-1.5 text-xs border rounded-xl focus:outline-none ${
                darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-900'
              }`}
            >
              <option value="">All Statuses</option>
              <option value="ESCALATED">Escalated Only</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Ticket Threads */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/50 dark:divide-zinc-800/60">
            {loading && !data ? (
              <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
                <span>Loading tickets...</span>
              </div>
            ) : !data?.tickets.length ? (
              <div className="p-8 text-center space-y-2 text-zinc-400">
                <MessageSquare className="w-8 h-8 mx-auto" />
                <p className="text-xs font-semibold">No Platform Tickets Found</p>
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
                        ? darkMode ? 'bg-purple-950/40 border-l-4 border-purple-500' : 'bg-purple-50 border-l-4 border-purple-600'
                        : darkMode ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-100/60'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm relative">
                      {contact.name.charAt(0).toUpperCase()}
                      {ticket.isBlocked && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-600 rounded-full border-2 border-zinc-900" title="Blocked" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold truncate">{contact.name}</h4>
                        <span className="text-[10px] opacity-60 shrink-0">{formatDate(ticket.updatedAt || ticket.createdAt)}</span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {contact.restaurantName && (
                          <span className="text-[10px] font-semibold text-purple-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {contact.restaurantName}
                          </span>
                        )}
                        <RoleBadge role={contact.role} />
                      </div>

                      <p className="text-xs font-semibold mt-1 truncate">{ticket.subject}</p>

                      <div className="flex items-center justify-between gap-1 mt-1.5">
                        <p className="text-[11px] opacity-70 truncate max-w-[170px]">
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

        {/* ── CENTER PANE: Active Support Thread ─────────────────────── */}
        {selectedTicket ? (
          <div className={`flex-1 flex flex-col min-w-0 relative ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
            {/* Active Header (2-Row Layout: Row 1 User & Utils, Row 2 Actions) */}
            <div className={`px-4 py-3 border-b space-y-2.5 shrink-0 ${
              darkMode ? 'border-zinc-800 bg-zinc-950/60' : 'border-zinc-200 bg-zinc-50'
            }`}>
              {/* Row 1: Contact Details & Utility Buttons */}
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    {activeContact?.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold truncate">{activeContact?.name}</h3>
                      <RoleBadge role={activeContact?.role} />
                      {selectedTicket.isBlocked && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-950/60 text-rose-300 uppercase">
                          Blocked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs opacity-70 flex-wrap mt-0.5">
                      <span className="font-mono font-bold text-purple-400">{selectedTicket.ticketId}</span>
                      <span>•</span>
                      <span className="truncate max-w-[200px] sm:max-w-[300px]">{selectedTicket.subject}</span>
                    </div>
                  </div>
                </div>

                {/* Right Utility Buttons (Info + Three-Dot Dropdown) */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowRightDrawer(!showRightDrawer)}
                    className={`p-2 rounded-xl border transition-colors ${
                      showRightDrawer
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                    }`}
                    title="Toggle Metadata Panel"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                      className="p-2 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="More Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showHeaderMenu && (
                      <div className="absolute right-0 top-11 z-50 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-1 space-y-1 animate-fade-in text-white text-left">
                        <button
                          onClick={handleToggleBlock}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-amber-300 hover:bg-amber-950/40 transition-colors cursor-pointer"
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
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
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
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-zinc-800/60">
                <StatusBadge status={selectedTicket.status} />

                {selectedTicket.status !== 'IN_PROGRESS' && selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                  <button
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>In Progress</span>
                  </button>
                )}

                {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                  <button
                    onClick={() => handleStatusChange('RESOLVED')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer whitespace-nowrap"
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

            {/* Blocked Banner */}
            {selectedTicket.isBlocked && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800 flex items-center justify-between gap-3 text-xs text-rose-200">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-rose-400 shrink-0" />
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
              <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-400">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider">Ticket Rejected: </span>
                  <span className="font-medium">{selectedTicket.rejectionReason}</span>
                </div>
              </div>
            )}

            {/* Message Stream */}
            <div className={`flex-1 p-4 space-y-4 overflow-y-auto ${
              darkMode ? 'bg-zinc-950/20' : 'bg-zinc-50/30'
            }`}>
              {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                selectedTicket.messages.map((msg, idx) => {
                  const isSuperAdmin = msg.senderRole === 'SUPER_ADMIN';
                  const isSystem = msg.senderRole === 'SYSTEM';

                  if (isSystem) {
                    return (
                      <div key={msg._id || idx} className="flex justify-center my-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                        }`}>
                          {msg.message}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg._id || idx}
                      className={`flex flex-col ${isSuperAdmin ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] opacity-70">
                        <span className="font-semibold">{msg.senderName}</span>
                        <RoleBadge role={msg.senderRole} />
                        <span>• {formatDate(msg.createdAt)}</span>
                      </div>
                      
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
                            ? darkMode
                              ? 'bg-[#1c1c20] text-gray-400 italic border border-[#2b2b30]'
                              : 'bg-gray-100 text-gray-500 italic border border-gray-200'
                            : isSuperAdmin
                            ? 'bg-purple-600 text-white rounded-tr-none'
                            : darkMode
                            ? 'bg-[#1c1c20] text-white border border-[#2b2b30] rounded-tl-none'
                            : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                        }`}
                        title="Right click or tap for message options"
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>

                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-80">
                          <MessageTick status={msg.status} isOutgoing={isSuperAdmin} />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  <p>No messages in thread.</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className={`p-3 border-t ${darkMode ? 'border-[#242428] bg-[#121214]' : 'border-zinc-200 bg-white'}`}>
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
                  placeholder={selectedTicket.isBlocked ? "Contact blocked. Unblock to reply." : "Reply as SuperAdmin Support... (Press Enter to send)"}
                  className={`flex-1 p-3 text-xs sm:text-sm border rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none disabled:opacity-50 ${
                    darkMode ? 'bg-[#1c1c20] border-[#2b2b30] text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                  }`}
                />
                <button
                  type="submit"
                  disabled={replying || !replyMessage.trim() || selectedTicket.isBlocked}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-semibold flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 transition-all cursor-pointer shrink-0 h-10 text-xs"
                >
                  {replying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Reply</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
            <MessageSquare className="w-12 h-12 mb-3 text-purple-500" />
            <h3 className="text-base font-bold">Select a Support Ticket</h3>
            <p className="text-xs max-w-sm mt-1">Pick a conversation thread from the left pane to view messages and respond.</p>
          </div>
        )}

        {/* ── RIGHT PANE: Metadata Drawer (Collapsible) ─────────────── */}
        {selectedTicket && showRightDrawer && (
          <div className={`w-72 lg:w-80 border-l p-4 overflow-y-auto space-y-4 shrink-0 ${
            darkMode ? 'border-zinc-800 bg-zinc-950/40' : 'border-zinc-200 bg-zinc-50/40'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-70">
                Ticket Details
              </h3>
              <button onClick={() => setShowRightDrawer(false)} className="p-1 text-zinc-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Card */}
            <div className={`border rounded-2xl p-4 shadow-sm text-center space-y-2 ${
              darkMode ? 'bg-[#121214] border-[#242428]' : 'bg-white border-zinc-200'
            }`}>
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-extrabold text-xl flex items-center justify-center mx-auto shadow-md">
                {activeContact?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-sm font-bold">{activeContact?.name}</h4>
                <div className="mt-1">
                  <RoleBadge role={activeContact?.role} />
                </div>
              </div>

              {activeContact?.restaurantName && (
                <p className="text-xs text-purple-400 font-semibold flex items-center justify-center gap-1 mt-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {activeContact.restaurantName}
                </p>
              )}

              <div className="pt-2 text-xs text-left space-y-1.5 border-t border-zinc-800 opacity-80">
                {activeContact?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{activeContact.email}</span>
                  </div>
                )}
                {activeContact?.mobile && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>{activeContact.mobile}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata Card */}
            <div className={`border rounded-2xl p-4 shadow-sm space-y-3 ${
              darkMode ? 'bg-[#121214] border-[#242428]' : 'bg-white border-zinc-200'
            }`}>
              <h4 className="text-xs font-bold uppercase tracking-wider">Ticket Summary</h4>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="opacity-70">Ticket ID</span>
                  <span className="font-mono font-bold text-purple-400">{selectedTicket.ticketId}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="opacity-70">Status</span>
                  <StatusBadge status={selectedTicket.status} />
                </div>

                <div className="flex justify-between items-center">
                  <span className="opacity-70">Priority</span>
                  <PriorityBadge priority={selectedTicket.priority} />
                </div>

                <div className="flex justify-between items-center">
                  <span className="opacity-70">Category</span>
                  <span className="font-semibold">{selectedTicket.category}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="opacity-70">Created</span>
                  <span>{formatDate(selectedTicket.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: Message Options (Delete / Delete for Everyone / Cancel) */}
      {messageModalOpen && selectedMessage && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in font-sans">
          <div className={`border rounded-3xl shadow-lg w-full max-w-sm overflow-hidden p-5 space-y-4 ${
            darkMode ? 'bg-[#121214] border-[#242428] text-white' : 'bg-white border-zinc-200 text-zinc-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              darkMode ? 'border-[#242428]' : 'border-zinc-200'
            }`}>
              <h3 className="font-sans font-bold text-base">Message Options</h3>
              <button onClick={() => setMessageModalOpen(false)} className={`p-1 ${darkMode ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-800'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`p-3 rounded-2xl text-xs italic border ${
              darkMode ? 'bg-[#1c1c20] text-gray-300 border-[#2b2b30]' : 'bg-zinc-100 text-zinc-700 border-zinc-200'
            }`}>
              "{selectedMessage.message}"
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleDeleteMessageAction(false)}
                disabled={actionLoading}
                className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  darkMode ? 'bg-[#1c1c20] hover:bg-[#26262b] text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                }`}
              >
                <Trash2 className="w-4 h-4 text-zinc-400" />
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
                className={`w-full py-2 px-4 border text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                  darkMode ? 'border-[#2b2b30] text-zinc-400 hover:bg-[#1c1c20]' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: Reject Ticket ──────────────────────────────────────── */}
      {rejectModalOpen && selectedTicket && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 animate-fade-in font-sans">
          <div className={`border rounded-3xl shadow-lg w-full max-w-md p-6 space-y-4 ${
            darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
          }`}>
            <div className="flex items-center gap-3 text-rose-500">
              <Ban className="w-6 h-6" />
              <h3 className="font-sans font-bold text-lg">Reject Ticket</h3>
            </div>
            <p className="text-xs opacity-70">
              Provide a mandatory rejection reason for ticket <span className="font-bold">{selectedTicket.ticketId}</span>.
            </p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
                Rejection Reason *
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Enter rejection reason..."
                className={`w-full p-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none ${
                  darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                }`}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className={`px-4 py-2 text-sm font-semibold rounded-xl ${
                  darkMode ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-600'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !rejectionReasonInput.trim()}
                onClick={() => handleStatusChange('REJECTED', rejectionReasonInput.trim())}
                className="px-5 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                <span>Reject Ticket</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
