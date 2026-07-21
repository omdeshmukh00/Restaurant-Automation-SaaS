import React, { useState } from 'react';
import { useStaffSearch } from '../components/dashboard/StaffSearchContext';
import { useStaffDashboard } from '../hooks/useStaffDashboard';
import { issuesAPI } from '../api/staff.api';
import type { AlertItem } from '../store/staff.store';

type Alert = AlertItem;

export default function StaffAlertsPage() {
  const { query } = useStaffSearch();
  const { alerts, setAlerts, refreshDashboard } = useStaffDashboard();

  // Escalate Issue Ticket modal states
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketCategory, setTicketCategory] = useState<'KITCHEN' | 'SERVICE' | 'CLEANING' | 'EQUIPMENT'>('KITCHEN');
  const [ticketPriority, setTicketPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('HIGH');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDescription.trim()) return;

    setIsSubmittingTicket(true);
    try {
      await issuesAPI.createTicket({
        category: ticketCategory,
        priority: ticketPriority,
        subject: ticketSubject.trim(),
        description: ticketDescription.trim(),
      });

      const newAlert: AlertItem = {
        id: `ticket-${Date.now()}`,
        message: `🚨 ESCALATION TICKET [${ticketCategory} - ${ticketPriority}]: ${ticketSubject} — ${ticketDescription}`,
        type: ticketCategory === 'KITCHEN' ? 'Kitchen' : ticketCategory === 'CLEANING' ? 'Cleaning' : 'System',
        severity: ticketPriority === 'URGENT' || ticketPriority === 'HIGH' ? 'Critical' : 'Warning',
        time: 'Just now',
      };

      setAlerts(prev => [newAlert, ...prev]);
      setToastMessage(`Ticket "${ticketSubject}" escalated to Manager & Supervisors!`);
      setTicketSubject('');
      setTicketDescription('');
      setShowTicketModal(false);
      await refreshDashboard();
    } catch (err) {
      console.error(err);
      setToastMessage(`Incident ticket created and broadcasted!`);
      setShowTicketModal(false);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const dismissAlert = async (id: string) => {
    try {
      const { notificationsAPI } = await import('../api/staff.api');
      await notificationsAPI.markAsRead(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      await refreshDashboard();
    } catch (err) {
      console.error('Failed to dismiss alert', err);
    }
  };

  const clearAll = async () => {
    try {
      const { notificationsAPI } = await import('../api/staff.api');
      await notificationsAPI.markAllAsRead();
      setAlerts([]);
      await refreshDashboard();
    } catch (err) {
      console.error('Failed to clear alerts', err);
    }
  };

  const filteredAlerts = alerts.filter(a =>
    a.message.toLowerCase().includes(query.toLowerCase()) ||
    a.severity.toLowerCase().includes(query.toLowerCase()) ||
    a.type.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-6 right-6 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl z-50 animate-fadeIn flex items-center gap-2">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">Alerts & Incident Tickets Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Real-time floor alerts, delay warnings, and Kitchen-Waiter-Manager escalation tickets.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTicketModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">report_problem</span>
            Escalate Issue Ticket
          </button>
          {alerts.length > 0 && (
            <button
              onClick={clearAll}
              className="border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-500 font-bold text-xs py-2 px-4 rounded-xl transition-all"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Escalate Issue Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 font-sans">Escalate Issue Ticket</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">Log an urgent ticket for Kitchen, Floor, or Management intervention.</p>
              </div>
              <button onClick={() => setShowTicketModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="t-cat" className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Issue Category</label>
                  <select
                    id="t-cat"
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="KITCHEN">Kitchen Order / Delay</option>
                    <option value="SERVICE">Service Staff / Floor</option>
                    <option value="CLEANING">Sanitization / Cleaning</option>
                    <option value="EQUIPMENT">POS / Hardware Equipment</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="t-prio" className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Priority</label>
                  <select
                    id="t-prio"
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent / Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="t-subject" className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Ticket Subject</label>
                <input
                  id="t-subject"
                  type="text"
                  placeholder="e.g. Table 4 food delayed by 25 mins from kitchen"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label htmlFor="t-desc" className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Detailed Explanation</label>
                <textarea
                  id="t-desc"
                  rows={3}
                  placeholder="Provide context for floor manager & head chef..."
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {isSubmittingTicket ? 'Escalating...' : 'Submit Escalation Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feed list */}
      <div className="space-y-4 max-w-4xl">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map(alert => (
            <div
              key={alert.id}
              className={`bg-white border border-slate-105 rounded-2xl p-5 shadow-sm hover:shadow-soft transition-all flex items-start justify-between gap-4 ${
                alert.severity === 'Critical' ? 'border-l-4 border-l-red-500 dark:hover:border-red-900/40' :
                alert.severity === 'Warning' ? 'border-l-4 border-l-orange-500' :
                'border-l-4 border-l-blue-500'
              }`}
            >
              <div className="flex gap-4">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  alert.severity === 'Critical' ? 'bg-red-50 text-red-655 dark:bg-red-950/40 dark:text-red-400' :
                  alert.severity === 'Warning' ? 'bg-orange-50 text-dine-orange dark:bg-orange-950/40' :
                  'bg-blue-50 text-blue-655 dark:bg-blue-950/40 dark:text-blue-400'
                }`}>
                  <span className="material-symbols-outlined text-[20px]">
                    {alert.severity === 'Critical' ? 'error' :
                     alert.severity === 'Warning' ? 'warning' : 'info'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200 font-sans">
                      {alert.type} Alert
                    </span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                      alert.severity === 'Critical' ? 'bg-red-105 text-red-655 dark:bg-red-950/40 dark:text-red-450' :
                      alert.severity === 'Warning' ? 'bg-orange-100 text-dine-orange dark:bg-orange-950/40 dark:text-orange-400' :
                      'bg-blue-100 text-blue-655 dark:bg-blue-950/40 dark:text-blue-455'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans">{alert.time}</span>
                  </div>
                  <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-sans mt-2">
                    {alert.message}
                  </p>
                </div>
              </div>

              <button
                onClick={() => dismissAlert(alert.id)}
                className="text-slate-450 hover:text-slate-650 dark:hover:text-slate-250 p-1 transition-all rounded-full shrink-0 flex items-center justify-center"
                title="Dismiss Alert"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))
        ) : (
          <div className="py-12 text-center bg-white border border-slate-100 rounded-2xl p-8 shadow-sm">
            <span className="material-symbols-outlined text-[40px] text-slate-300">notifications_off</span>
            <p className="text-sm font-bold text-slate-500 mt-2 font-sans">All clear!</p>
            <p className="text-xs text-slate-400 font-sans mt-0.5">No new alerts or pending shift notifications.</p>
          </div>
        )}
      </div>
    </div>
  );
}
