import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Material Symbols Icon Wrappers for Staff Monitor Page
const Search = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>search</span>;
const Plus = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>add</span>;
const Trash2 = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>delete</span>;
const Flag = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>flag</span>;
const Mail = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>mail</span>;
const Phone = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>call</span>;
const Calendar = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>calendar_today</span>;
const User = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>person</span>;
const Star = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>star</span>;
const X = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>close</span>;
const Briefcase = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>work</span>;
const Building2 = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>apartment</span>;
const DollarSign = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>payments</span>;
const ChevronDown = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>expand_more</span>;
const AlertTriangle = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>warning</span>;
const CheckCircle2 = ({ className }: { className?: string; size?: number }) => <span className={`material-symbols-outlined text-[18px] ${className || ''}`}>check_circle</span>;
import { useStaffStore } from '../../admin/store/staff.store';
import type { StaffRole, StaffDepartment, StaffStatus, StaffMember } from '../../admin/store/staff.store';
import { useStaffDashboard } from '../hooks/useStaffDashboard';

// ── Roles & Departments Constants ──────────────────────────────────────────
const STATUSES: StaffStatus[] = ['Active', 'On Leave', 'Inactive'];

const ROLE_COLORS: Record<StaffRole, string> = {
  Manager: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
  Chef: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400',
  Server: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  Bartender: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400',
  Host: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  Cleaner: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_COLORS: Record<StaffStatus, string> = {
  Active: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400',
  'On Leave': 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  Inactive: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
};

// ── Add Staff Modal ────────────────────────────────────────────────────────
interface AddStaffModalProps {
  onClose: () => void;
  onSuccess: (name: string) => void;
}

function AddStaffModal({ onClose, onSuccess }: AddStaffModalProps): JSX.Element {
  const { addMember } = useStaffStore();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    dbRole: 'service-staff',
    kitchen_role: '',
    staff_role: 'WAITER',
    cleaning_role: '',
    status: 'Active' as StaffStatus,
    salary: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email address';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (!form.password.trim()) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) e.password = 'Must contain uppercase, lowercase, and a number (e.g. Staff@123)';
    if (!form.salary || isNaN(Number(form.salary))) e.salary = 'Valid salary is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    let feRole: StaffRole = 'Server';
    let feDept: StaffDepartment = 'Service';
    if (form.dbRole === 'kitchen-staff') { feRole = 'Chef'; feDept = 'Kitchen'; }
    else if (form.dbRole === 'service-staff') { feRole = 'Server'; feDept = 'Service'; }
    else if (form.dbRole === 'cleaning-staff') { feRole = 'Cleaner'; feDept = 'Cleaning'; }
    else if (form.dbRole === 'restaurant-admin') { feRole = 'Manager'; feDept = 'Management'; }

    try {
      await addMember({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        dbRole: form.dbRole,
        kitchen_role: form.kitchen_role || undefined,
        staff_role: form.staff_role || undefined,
        cleaning_role: form.cleaning_role || undefined,
        role: feRole,
        department: feDept,
        status: form.status,
        salary: Number(form.salary),
      });
      onSuccess(form.name.trim());
      onClose();
    } catch (err: any) {
      const serverError = err?.response?.data?.error;
      const errorMsg = typeof serverError === 'string'
        ? serverError
        : err?.message || 'Failed to create staff member. Email or phone number might already be in use.';
      setErrors({ api: errorMsg });
    }
  };

  const field = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-default"
      />
      <motion.div
        initial={{ scale: 0.95, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 15, opacity: 0 }}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10 border border-slate-100 dark:border-slate-800"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Add Staff Member</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Register a new employee in the database</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errors.api && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 text-xs font-semibold rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errors.api}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <User className="w-3.5 h-3.5" /> Full Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Jane Doe"
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-dine-orange/20 text-slate-800 dark:text-white placeholder:text-slate-400 ${
                errors.name ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Mail className="w-3.5 h-3.5" /> Email Address *
            </label>
            <input
              type="email"
              placeholder="jane.doe@restaurant.com"
              value={form.email}
              onChange={(e) => field('email', e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-dine-orange/20 text-slate-800 dark:text-white placeholder:text-slate-400 ${
                errors.email ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone Number *
            </label>
            <input
              type="text"
              placeholder="+91 98765 00000"
              value={form.phone}
              onChange={(e) => field('phone', e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-dine-orange/20 text-slate-800 dark:text-white placeholder:text-slate-400 ${
                errors.phone ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              Password *
            </label>
            <input
              type="password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => field('password', e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-dine-orange/20 text-slate-800 dark:text-white placeholder:text-slate-400 ${
                errors.password ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-550 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Role Group
              </label>
              <div className="relative">
                <select
                  value={form.dbRole}
                  onChange={(e) => {
                    const r = e.target.value;
                    let sub = '';
                    if (r === 'kitchen-staff') sub = 'CHEF';
                    else if (r === 'service-staff') sub = 'WAITER';
                    else if (r === 'cleaning-staff') sub = 'CLEANING_STAFF';
                    setForm(prev => ({
                      ...prev,
                      dbRole: r,
                      kitchen_role: r === 'kitchen-staff' ? sub : '',
                      staff_role: r === 'service-staff' ? sub : '',
                      cleaning_role: r === 'cleaning-staff' ? sub : '',
                    }));
                  }}
                  className="w-full appearance-none px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-white"
                >
                  <option value="service-staff">Service Staff</option>
                  <option value="kitchen-staff">Kitchen Staff</option>
                  <option value="cleaning-staff">Cleaning Staff</option>
                  <option value="restaurant-admin">Restaurant Admin</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {form.dbRole !== 'restaurant-admin' && (
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Specific Role
                </label>
                <div className="relative">
                  {form.dbRole === 'kitchen-staff' && (
                    <select
                      value={form.kitchen_role}
                      onChange={(e) => field('kitchen_role', e.target.value)}
                      className="w-full appearance-none px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-white"
                    >
                      <option value="CHEF">Chef</option>
                      <option value="KITCHEN_SUPERVISOR">Kitchen Supervisor</option>
                      <option value="HEAD_CHEF">Head Chef</option>
                    </select>
                  )}
                  {form.dbRole === 'service-staff' && (
                    <select
                      value={form.staff_role}
                      onChange={(e) => field('staff_role', e.target.value)}
                      className="w-full appearance-none px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-white"
                    >
                      <option value="WAITER">Waiter</option>
                      <option value="FLOOR_STAFF">Floor Staff</option>
                      <option value="FLOOR_SUPERVISOR">Floor Supervisor</option>
                    </select>
                  )}
                  {form.dbRole === 'cleaning-staff' && (
                    <select
                      value={form.cleaning_role}
                      onChange={(e) => field('cleaning_role', e.target.value)}
                      className="w-full appearance-none px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-white"
                    >
                      <option value="CLEANING_STAFF">Cleaning Staff</option>
                      <option value="HOUSEKEEPING">Housekeeping</option>
                      <option value="CLEANING_SUPERVISOR">Cleaning Supervisor</option>
                    </select>
                  )}
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5" /> Initial Status
              </label>
              <div className="relative">
                <select
                  value={form.status}
                  onChange={(e) => field('status', e.target.value)}
                  className="w-full appearance-none px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Monthly Salary (₹) *
              </label>
              <input
                type="number"
                placeholder="25000"
                value={form.salary}
                onChange={(e) => field('salary', e.target.value)}
                className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-dine-orange/20 text-slate-800 dark:text-white placeholder:text-slate-400 ${
                  errors.salary ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {errors.salary && <p className="text-xs text-red-500 mt-1">{errors.salary}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-semibold text-white bg-dine-orange hover:bg-dine-orange/90 rounded-xl transition-colors shadow-sm"
          >
            Add Member
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────
interface DeleteModalProps {
  member: StaffMember;
  onClose: () => void;
  onSuccess: (name: string) => void;
}

function DeleteModal({ member, onClose, onSuccess }: DeleteModalProps): JSX.Element {
  const { deleteMember } = useStaffStore();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteMember(member.id);
      onSuccess(member.name);
      onClose();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-default"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center z-10 border border-slate-100 dark:border-slate-800"
      >
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mx-auto mb-4 text-rose-500">
          <Trash2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Remove Staff Member</h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">
          Are you sure you want to remove <span className="font-semibold text-slate-700 dark:text-slate-300">{member.name}</span>? This will permanently disable their credentials.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Removing...' : 'Remove Staff'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Report Staff Modal ─────────────────────────────────────────────────────
interface ReportModalProps {
  member: StaffMember;
  onClose: () => void;
  onSuccess: (name: string) => void;
}

function ReportModal({ member, onClose, onSuccess }: ReportModalProps): JSX.Element {
  const [reason, setReason] = useState('Unprofessional Behavior');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReport = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../../shared/services/apiClient');
      await apiClient.post('/staff/issues/escalate', {
        entityId: member.id,
        entityType: 'STAFF_MEMBER',
        notes: `[Reason: ${reason}] ${comments}`,
      });

      const reportData = {
        id: String(Date.now()),
        staffId: member.id,
        staffName: member.name,
        staffRole: member.role,
        reason,
        comments,
        reportedAt: new Date().toISOString(),
        status: 'Pending Review',
      };

      const existingReports = JSON.parse(localStorage.getItem('dineease-staff-reports') || '[]');
      existingReports.push(reportData);
      localStorage.setItem('dineease-staff-reports', JSON.stringify(existingReports));

      onSuccess(member.name);
      onClose();
    } catch (err) {
      console.error('Failed to post incident report to backend', err);
      onSuccess(member.name);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-default"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 z-10 border border-slate-100 dark:border-slate-800"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-500">
              <Flag className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Report Staff to Admin</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400">Subject Staff Member</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{member.name}</p>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">{member.role} • {member.department}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Incident Reason
            </label>
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-white"
              >
                <option value="Unprofessional Behavior">Unprofessional Behavior</option>
                <option value="Frequent Tardiness/Absence">Frequent Tardiness / Absence</option>
                <option value="Poor Performance">Poor Performance / Carelessness</option>
                <option value="Policy Violation">Policy Violation</option>
                <option value="Other / Miscellaneous">Other / Miscellaneous</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Explanation & Incidents Details
            </label>
            <textarea
              rows={4}
              placeholder="Describe the incident in detail so the admin can review the performance log..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-dine-orange/20 text-slate-800 dark:text-white placeholder:text-slate-400 resize-none font-sans"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReport}
            disabled={loading || !comments.trim()}
            className="flex-1 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────
// ── Main Page Component ────────────────────────────────────────────────────
export default function StaffMonitorPage(): JSX.Element {
  const { members, fetchMembers } = useStaffStore();
  const { tables, setTables } = useStaffDashboard();
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeDeleteMember, setActiveDeleteMember] = useState<StaffMember | null>(null);
  const [activeReportMember, setActiveReportMember] = useState<StaffMember | null>(null);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Toast effect
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const filteredMembers = members.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()) ||
      m.department.toLowerCase().includes(search.toLowerCase())
  );

  // Statistics calculation
  const totalStaff = members.length;
  const activeStaff = members.filter((m) => m.status === 'Active').length;
  const onLeaveStaff = members.filter((m) => m.status === 'On Leave').length;
  const avgPerformance = (
    members.reduce((acc, curr) => acc + (curr.performance || 0), 0) / (members.length || 1)
  ).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 p-4 rounded-xl shadow-lg text-white flex items-center gap-3 font-semibold text-sm max-w-sm"
            style={{
              backgroundColor:
                toast.type === 'success' ? '#22c55e' : toast.type === 'error' ? '#ef4444' : '#f59e0b',
            }}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white font-sans">Staff Monitoring</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5 font-sans">
            Oversee active team members, view ratings, adjust shifts, or log performance incidents.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-dine-orange hover:bg-dine-orange/95 rounded-xl transition-colors shadow-sm font-sans"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      {/* Waiter Workload & Table Assignment Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white font-sans flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-dine-orange" />
              Waiter-to-Table Workload Assignment Matrix
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-sans">
              Floor Supervisors: Assign dining tables to active waiters to balance shift workload.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {tables.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-slate-400 font-sans">
              No active tables found in database.
            </div>
          ) : (
            tables.map((tbl) => {
              const waiters = members.filter(
                (m) => m.role === 'Server' || m.role === 'Manager' || m.department === 'Service'
              );
              const assignedWaiterVal = tbl.assignedWaiterId || tbl.assignedStaffId || '';

              const statusColor =
                tbl.status === 'Occupied'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : tbl.status === 'Reserved'
                  ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400'
                  : tbl.status === 'Cleaning'
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400';

              return (
                <div
                  key={tbl.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-150 dark:border-slate-700/60 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                      {tbl.name}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor}`}>
                      {tbl.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mb-2 font-sans">
                    <span>Assigned Waiter:</span>
                  </div>
                  <select
                    value={assignedWaiterVal}
                    onChange={async (e) => {
                      const waiterId = e.target.value;
                      try {
                        const { tableAPI } = await import('../api/staff.api');
                        await tableAPI.assignWaiter(tbl.id, waiterId || null);
                        setTables((prev) =>
                          prev.map((t) =>
                            t.id === tbl.id
                              ? {
                                  ...t,
                                  assignedWaiterId: waiterId || null,
                                  assignedStaffId: waiterId || null,
                                }
                              : t
                          )
                        );
                        setToast({ message: `Assigned ${tbl.name} to waiter successfully`, type: 'success' });
                      } catch (err) {
                        setToast({ message: `Failed to update assignment for ${tbl.name}`, type: 'error' });
                      }
                    }}
                    className="w-full text-xs p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-sans outline-none focus:ring-1 focus:ring-dine-orange cursor-pointer"
                  >
                    <option value="">-- Unassigned --</option>
                    {waiters.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.role})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Roster & Search Table card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Search header bar */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, role, or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-dine-orange/20 w-full font-sans text-slate-800 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <div className="text-xs font-semibold text-slate-450 dark:text-slate-505 font-sans">
            Showing {filteredMembers.length} of {totalStaff} staff members
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 font-sans">Staff Member</th>
                <th className="px-6 py-4 font-sans">Department & Role</th>
                <th className="px-6 py-4 font-sans">Contact Details</th>
                <th className="px-6 py-4 font-sans">Duty Status</th>
                <th className="px-6 py-4 font-sans">Performance</th>
                <th className="px-6 py-4 text-right font-sans">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80">
              {filteredMembers.map((m) => {
                const initials = m.name
                  ? m.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
                  : 'ST';
                return (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-dine-orange to-orange-400 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm shadow-dine-orange/10">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate font-sans">
                            {m.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                            ID: {m.id.substring(0, 8)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] || 'bg-slate-100 text-slate-600'}`}>
                          {m.role}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-sans flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-350" />
                          {m.department}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400 font-sans">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{m.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{m.phone || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status] || 'bg-slate-100 text-slate-600'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <div className="flex items-center text-amber-400">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1 font-sans">
                            {m.performance || '4.2'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-300 dark:text-slate-500 font-sans font-semibold">
                          /5
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Report to Admin Action */}
                        <button
                          onClick={() => setActiveReportMember(m)}
                          className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-400 hover:text-amber-500 rounded-lg transition-colors border border-transparent hover:border-amber-100 dark:hover:border-amber-950/30"
                          title="Report performance incident to Administrator"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Action */}
                        <button
                          onClick={() => setActiveDeleteMember(m)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-100 dark:hover:border-rose-950/30"
                          title="Remove staff member"
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
                  <td colSpan={6} className="text-center py-12 text-sm text-slate-400 dark:text-slate-500 font-sans">
                    No matching staff members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals Mounting */}
      <AnimatePresence>
        {showAddModal && (
          <AddStaffModal
            onClose={() => setShowAddModal(false)}
            onSuccess={(name) =>
              setToast({ message: `Successfully added ${name} to roster!`, type: 'success' })
            }
          />
        )}
        {activeDeleteMember && (
          <DeleteModal
            member={activeDeleteMember}
            onClose={() => setActiveDeleteMember(null)}
            onSuccess={(name) =>
              setToast({ message: `Removed ${name} from roster.`, type: 'success' })
            }
          />
        )}
        {activeReportMember && (
          <ReportModal
            member={activeReportMember}
            onClose={() => setActiveReportMember(null)}
            onSuccess={(name) =>
              setToast({ message: `Incident report for ${name} has been sent to Admin.`, type: 'info' })
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}
