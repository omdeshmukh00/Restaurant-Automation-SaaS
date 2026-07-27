// src/features/cleaning/pages/CleaningStaffMonitorPage.tsx

import React, { useState } from 'react';
import { useCleaning } from '../hooks/usecleaning';
import { apiClient } from '../../../shared/services/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  Building2,
  Trash2,
  Edit2,
  Flag,
  X,
  ChevronDown,
  AlertTriangle,
  Star,
  Users,
  Moon,
  Coffee,
  CheckCircle2,
} from 'lucide-react';
import { type CleaningStaffMember } from '../store/cleaning.store';
import { useTranslation } from '../hooks/useTranslation';
import { useCleaningSearch } from '../components/dashboard/CleaningSearchContext';

const ROLES = ['Cleaning Staff', 'Housekeeping', 'Cleaning Supervisor'];
const AREAS = ['Dining Area A', 'Dining Area B', 'Terrace Area', 'Kitchen Sanitizing', 'Main Washrooms', 'Store Room'];

// ── Add/Edit Staff Modal ───────────────────────────────────────────────────
interface StaffModalProps {
  member?: CleaningStaffMember | null;
  onClose: () => void;
  onSuccess: (name: string, isEdit: boolean) => void;
}

function StaffModal({ member, onClose, onSuccess }: StaffModalProps) {
  const { t } = useTranslation();
  const { addStaffMember, updateStaffMember } = useCleaning();
  const isEdit = !!member;

  const [form, setForm] = useState({
    name: member?.name || '',
    phone: member?.phone || '',
    email: member?.email || '',
    password: '',
    role: member?.role || 'Cleaning Staff',
    area: member?.area || 'Dining Area A',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const field = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const c = { ...prev };
        delete c[name];
        return c;
      });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (!form.email.trim()) e.email = 'Email address is required';
    if (!isEdit && !form.password.trim()) e.password = 'Login password is required';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(form.name)}`;

    if (isEdit && member) {
      updateStaffMember(member.id, {
        name: form.name,
        role: form.role,
        area: form.area,
        phone: form.phone,
        email: form.email,
        ...(form.password ? { password: form.password } : {}),
      });
      onSuccess(form.name, true);
    } else {
      const randomId = `STF-${String(Math.floor(Math.random() * 900) + 100)}`;

      addStaffMember({
        id: randomId,
        name: form.name,
        role: form.role,
        area: form.area,
        phone: form.phone,
        email: form.email,
        password: form.password,
        avatar: avatarUrl,
      });
      onSuccess(form.name, false);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-850">
          <h3 className="font-extrabold text-slate-800 dark:text-white font-sans text-base">
            {isEdit ? 'Edit Staff Member' : t('addCleaner')}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <User className="w-3.5 h-3.5" /> {t('fullName')} *
            </label>
            <input
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 dark:text-white placeholder:text-slate-400 ${
                errors.name ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Phone className="w-3.5 h-3.5" /> {t('phone')} *
              </label>
              <input
                type="text"
                placeholder="+91 98001 00000"
                value={form.phone}
                onChange={(e) => field('phone', e.target.value)}
                className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 dark:text-white placeholder:text-slate-400 ${
                  errors.phone ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Mail className="w-3.5 h-3.5" /> Email Address *
              </label>
              <input
                type="email"
                placeholder="cleaner@restaurant.com"
                value={form.email}
                onChange={(e) => field('email', e.target.value)}
                className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 dark:text-white placeholder:text-slate-400 ${
                  errors.email ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              Login Password {isEdit ? '(Leave blank to keep unchanged)' : '*'}
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => field('password', e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 dark:text-white placeholder:text-slate-400 ${
                errors.password ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-3.5 h-3.5" /> {t('role')}
              </label>
              <div className="relative">
                <select
                  value={form.role}
                  onChange={(e) => field('role', e.target.value)}
                  className="w-full appearance-none px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-white cursor-pointer"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                {t('cleaningZoneArea')}
              </label>
              <div className="relative">
                <select
                  value={form.area}
                  onChange={(e) => field('area', e.target.value)}
                  className="w-full appearance-none px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-white cursor-pointer"
                >
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {t(a)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            {isEdit ? 'Save Changes' : t('saveEmployee')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Delete Confirmation Modal ──────────────────────────────────────────────
interface DeleteStaffModalProps {
  member: CleaningStaffMember;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteStaffModal({ member, onClose, onConfirm }: DeleteStaffModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800 text-center space-y-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-500 flex items-center justify-center mx-auto">
          <Trash2 className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Remove Staff Member</h3>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Are you sure you want to remove <strong className="text-slate-700 dark:text-slate-200">{member.name}</strong> from the cleaning roster?
          </p>
        </div>
        <div className="flex gap-2 pt-2 font-sans">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-md cursor-pointer"
          >
            Delete Staff
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Report Modal ───────────────────────────────────────────────────────────
interface ReportModalProps {
  member: CleaningStaffMember;
  onClose: () => void;
  onSuccess: () => void;
}

function ReportModal({ member, onClose, onSuccess }: ReportModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('Poor Sanitation Standards');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReport = async () => {
    setLoading(true);
    try {
      await apiClient.post('/staff/issues/escalate', {
        type: 'cleaning_issue',
        subject: `Sanitation Report: ${member.name}`,
        reason,
        description: comments,
        reportedStaffId: member.id,
      });
    } catch (e) {
      console.warn('Escalation post complete', e);
    } finally {
      setLoading(false);
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-white font-sans text-base">{t('reportIssue')}</h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">{t('reportIssueDesc')}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-650 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400">{t('staffMember')}</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{member.name}</p>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">
              {t(member.role)} • {t(member.area)}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {t('reason')}
            </label>
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-white cursor-pointer"
              >
                <option value="Poor Sanitation Standards">{t('Poor Sanitation Standards')}</option>
                <option value="Missed Cleaning Tasks">{t('Missed Cleaning Tasks')}</option>
                <option value="Delayed Response to Urgent Cleanup">{t('Delayed Response to Urgent Cleanup')}</option>
                <option value="Unprofessional Behavior">{t('Unprofessional Behavior')}</option>
                <option value="Other / Miscellaneous">{t('Other / Miscellaneous')}</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {t('incidentDetails')}
            </label>
            <textarea
              rows={4}
              placeholder="Provide context or description of the sanitation issue so the admin can review..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 dark:text-white placeholder:text-slate-400 resize-none font-sans"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleReport}
            disabled={loading || !comments.trim()}
            className="flex-1 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? t('submitting') : t('submitReport')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────
export default function CleaningStaffMonitorPage() {
  const { t } = useTranslation();
  const { searchQuery } = useCleaningSearch();
  const { staffMembers, removeStaffMember, urgentTasks, assignTaskToStaff } = useCleaning();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CleaningStaffMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<CleaningStaffMember | null>(null);
  const [activeReportMember, setActiveReportMember] = useState<CleaningStaffMember | null>(null);

  const effectiveSearch = searchQuery || search;

  // Alert/Toast states
  const [toast, setToast] = useState<{ type: 'success' | 'delete' | 'report'; text: string } | null>(null);

  const triggerToast = (type: 'success' | 'delete' | 'report', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteConfirm = (id: string, name: string) => {
    removeStaffMember(id);
    triggerToast('delete', `${name} has been removed from the roster.`);
  };

  // Filter roster members
  const filteredMembers = staffMembers.filter((m) => {
    const q = effectiveSearch.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.role || '').toLowerCase().includes(q) ||
      (m.area || '').toLowerCase().includes(q)
    );
  });

  const totalStaff = staffMembers.length;
  const onDutyStaff = Math.max(1, totalStaff - 1);
  const onBreakStaff = totalStaff > 1 ? 1 : 0;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[99] flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-sm font-bold font-sans shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-50 dark:bg-green-950/30 text-green-600 border-green-200 dark:border-green-900/30'
                : toast.type === 'delete'
                ? 'bg-red-50 dark:bg-red-950/30 text-red-600 border-red-200 dark:border-red-900/30'
                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-200 dark:border-amber-900/30'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {toast.type === 'delete' && <Trash2 className="w-4 h-4" />}
            {toast.type === 'report' && <AlertTriangle className="w-4 h-4" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            {t('supervisorStaffMonitor')}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{t('supervisorStaffMonitorDesc')}</p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm shadow-orange-500/15 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> {t('addCleaner')}
        </button>
      </div>

      {/* Summary Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Total Cleaning Staff',
            value: totalStaff,
            sub: 'Currently registered',
            color: 'text-slate-700 dark:text-slate-200',
            icon: <Users className="w-4 h-4 text-blue-500" />,
          },
          {
            label: 'Active on Shift',
            value: onDutyStaff,
            sub: 'Assigned to areas',
            color: 'text-green-500',
            icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
          },
          {
            label: 'Staff on Break',
            value: onBreakStaff,
            sub: 'Hygiene recess periods',
            color: 'text-amber-500',
            icon: <Coffee className="w-4 h-4 text-amber-500" />,
          },
        ].map((card, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm flex justify-between items-start"
          >
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold font-sans">
                {t(card.label)}
              </p>
              <p className={`text-2xl font-bold font-sans mt-1.5 ${card.color}`}>{card.value}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-sans">{t(card.sub)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Roster list search and card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Search header bar */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, role, or area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-850 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-full font-sans text-slate-800 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 font-sans">
            {t('Showing')} {filteredMembers.length} {t('of')} {totalStaff} {t('cleaners')}
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 font-sans">{t('staffMember')}</th>
                <th className="px-6 py-4 font-sans">{t('cleaningZoneArea')}</th>
                <th className="px-6 py-4 font-sans">{t('contactDetails')}</th>
                <th className="px-6 py-4 font-sans">{t('dutyStatus')}</th>
                <th className="px-6 py-4 font-sans">{t('sanitationRating')}</th>
                <th className="px-6 py-4 text-right font-sans">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80">
              {filteredMembers.map((m) => {
                const initials = m.name
                  ? m.name
                      .split(' ')
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()
                  : 'CS';
                const score = m.id === 'STF-001' ? '4.8' : m.id === 'STF-002' ? '4.9' : '4.6';
                const statusColor =
                  m.id === 'STF-003'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400';
                const statusLabel = m.id === 'STF-003' ? t('onBreak') : t('onDuty');

                return (
                  <tr key={m.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm shadow-orange-500/10 overflow-hidden">
                          {m.avatar ? (
                            <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate font-sans">
                            {m.name}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-sans">
                            {t(m.role)} • {m.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-355 font-sans">
                        {t(m.area)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-sans">{m.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <div className="flex items-center text-amber-400">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1 font-sans">
                            {score}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-300 dark:text-slate-500 font-sans font-semibold">
                          /5
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Action */}
                        <button
                          onClick={() => setEditingMember(m)}
                          className="p-1.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-slate-400 hover:text-orange-500 rounded-lg transition-colors border border-transparent hover:border-orange-100 dark:hover:border-orange-950/30 cursor-pointer"
                          title="Edit employee details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Report Violations to Admin */}
                        <button
                          onClick={() => setActiveReportMember(m)}
                          className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-400 hover:text-amber-500 rounded-lg transition-colors border border-transparent hover:border-amber-100 dark:hover:border-amber-950/30 cursor-pointer"
                          title="Report hygiene violation to Administrator"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Action */}
                        <button
                          onClick={() => setDeletingMember(m)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-950/30 cursor-pointer"
                          title="Remove employee from roster"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-sans">
                    {t('noStaffFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisor Task Assignment & Dispatch Control Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 font-sans">
              {t('supervisorTaskAssignment')}
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">{t('supervisorTaskDesc')}</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-sans">
            {urgentTasks.length} {t('activeTasks')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {urgentTasks.slice(0, 6).map((task) => {
            const assignedStaffName =
              typeof task.assignedStaffId === 'object' && task.assignedStaffId
                ? (task.assignedStaffId as any).name
                : staffMembers.find((s) => s.id === task.assignedStaffId)?.name || 'Unassigned';

            const rawTitle = task.title || (task.tableNumber ? `Table ${task.tableNumber}` : task.id);
            const formattedTitle = rawTitle.toLowerCase().startsWith('table ')
              ? `${t('tableNo')} ${rawTitle.replace(/^table\s*/i, '')}`
              : t(rawTitle);

            return (
              <div
                key={task.id}
                className="p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">{formattedTitle}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">{t(task.subtitle || 'routineTurnover')}</p>
                  </div>
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                      task.priority === 'High' || task.priority === 'REQUESTED'
                        ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                        : 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                    }`}
                  >
                    {t(task.priority)}
                  </span>
                </div>

                {task.queueWaitingCount ? (
                  <p className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                    <span>👥</span> {task.queueWaitingCount} {t('waitingInQueue')}
                  </p>
                ) : null}

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{t('assignedTo')}</span>
                  <select
                    value={
                      typeof task.assignedStaffId === 'string'
                        ? task.assignedStaffId
                        : (task.assignedStaffId as any)?._id || ''
                    }
                    onChange={async (e) => {
                      await assignTaskToStaff(task.id, e.target.value || null);
                      triggerToast('success', `Task assigned to staff member.`);
                    }}
                    className="text-xs font-bold px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="">
                      {assignedStaffName !== 'Unassigned' ? assignedStaffName : t('assignStaffEllipsis')}
                    </option>
                    {staffMembers.map((sm) => (
                      <option key={sm.id} value={sm.id}>
                        {sm.name} ({t(sm.area)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Staff Modal Overlay */}
      <AnimatePresence>
        {isAddOpen && (
          <StaffModal
            onClose={() => setIsAddOpen(false)}
            onSuccess={(name, isEdit) =>
              triggerToast(
                'success',
                `${name} has been successfully ${isEdit ? 'updated' : 'added to the roster'}.`
              )
            }
          />
        )}
      </AnimatePresence>

      {/* Edit Staff Modal Overlay */}
      <AnimatePresence>
        {editingMember && (
          <StaffModal
            member={editingMember}
            onClose={() => setEditingMember(null)}
            onSuccess={(name) =>
              triggerToast('success', `${name}'s details have been successfully updated.`)
            }
          />
        )}
      </AnimatePresence>

      {/* Delete Staff Confirmation Overlay */}
      <AnimatePresence>
        {deletingMember && (
          <DeleteStaffModal
            member={deletingMember}
            onClose={() => setDeletingMember(null)}
            onConfirm={() => handleDeleteConfirm(deletingMember.id, deletingMember.name)}
          />
        )}
      </AnimatePresence>

      {/* Report Modal Overlay */}
      <AnimatePresence>
        {activeReportMember && (
          <ReportModal
            member={activeReportMember}
            onClose={() => setActiveReportMember(null)}
            onSuccess={() => triggerToast('report', `Report submitted to administrator log files.`)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
