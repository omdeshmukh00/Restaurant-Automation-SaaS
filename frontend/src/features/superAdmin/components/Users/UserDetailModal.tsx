import React from 'react';
import { X, User, Mail, Smartphone, Store, Shield, CheckCircle, Clock, FileText, Key, Award, AlertCircle } from 'lucide-react';

export interface UserItem {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  subRole?: string;
  status: string;
  restaurantName: string;
  restaurantId?: string;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  createdAt: string;
  lastActive: string;
  avatar?: string;
  rawUser?: any;
}

interface UserDetailModalProps {
  user: UserItem | null;
  darkMode: boolean;
  onClose: () => void;
}

export function exportSingleUserAsPDF(user: UserItem) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateStr = new Date().toLocaleString();

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>User Profile Report - ${user.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; color: #0f172a; }
          .header { border-bottom: 3px solid #ea580c; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
          h1 { margin: 0; font-size: 26px; color: #ea580c; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; }
          .section { background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
          .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; }
          .label { color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; }
          .val { font-weight: 700; color: #0f172a; margin-top: 2px; }
          @media print {
            body { padding: 0; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>User Account Overview</h1>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Generated on ${dateStr} • System Account Dossier</div>
          </div>
          <div class="badge">${user.role}</div>
        </div>

        <div class="section">
          <div class="section-title">Personal Contact Credentials</div>
          <div class="grid">
            <div>
              <div class="label">Full Name</div>
              <div class="val">${user.name}</div>
            </div>
            <div>
              <div class="label">Account Status</div>
              <div class="val" style="color: ${user.status === 'Active' || user.status === 'ACTIVE' ? '#059669' : '#dc2626'}">${user.status}</div>
            </div>
            <div>
              <div class="label">Email Address</div>
              <div class="val">${user.email} ${user.isEmailVerified ? '(Verified)' : '(Unverified)'}</div>
            </div>
            <div>
              <div class="label">Mobile Number</div>
              <div class="val">${user.mobile} ${user.isMobileVerified ? '(Verified)' : '(Unverified)'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">System Role & Access Scope</div>
          <div class="grid">
            <div>
              <div class="label">Primary Role</div>
              <div class="val">${user.role} ${user.subRole ? `(${user.subRole})` : ''}</div>
            </div>
            <div>
              <div class="label">Associated Entity / Restaurant</div>
              <div class="val">${user.restaurantName}</div>
            </div>
            <div>
              <div class="label">User Database ID</div>
              <div class="val" style="font-family: monospace;">${user.id}</div>
            </div>
            <div>
              <div class="label">Registration Date</div>
              <div class="val">${user.createdAt}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

export default function UserDetailModal({ user, darkMode, onClose }: UserDetailModalProps) {
  if (!user) return null;

  const bg = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const cardInnerBg = darkMode ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200/80';
  const textPrimary = darkMode ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = darkMode ? 'text-slate-300' : 'text-slate-700';
  const textMuted = darkMode ? 'text-slate-400' : 'text-slate-500';

  const isSuperAdmin = (user.role || '').toUpperCase().includes('SUPER');

  const getRoleBadgeClass = (role?: string) => {
    const r = (role || '').toUpperCase();
    if (r.includes('SUPER')) return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
    if (r.includes('ADMIN')) return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
    if (r.includes('KITCHEN') || r.includes('STAFF')) return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    if (r.includes('CLEANING')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
    return 'bg-purple-500/10 text-purple-500 border-purple-500/30';
  };

  return (
    <div
      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 pb-6 px-4 overflow-y-auto bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="button"
      tabIndex={0}
      aria-label="Close modal backdrop"
    >
      <div
        className={`w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border shadow-2xl ${
          darkMode ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base ${
              isSuperAdmin
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20'
                : darkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
            }`}>
              {isSuperAdmin ? <Award className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold tracking-tight">{user.name}</h3>
                {isSuperAdmin && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase">
                    Root Owner
                  </span>
                )}
              </div>
              <p className={`text-xs ${textMuted}`}>{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* User Status & Role Header Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
            isSuperAdmin
              ? darkMode ? 'bg-amber-950/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'
              : cardInnerBg
          }`}>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Account Role & Designation</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRoleBadgeClass(user.role)}`}>
                  {user.role} {user.subRole && `(${user.subRole})`}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  user.status === 'Active' || user.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-500 border border-red-500/30'
                }`}>
                  {user.status}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Registered Since</span>
              <p className="text-xs font-bold mt-0.5">{user.createdAt}</p>
            </div>
          </div>

          {/* Contact Information */}
          <div className={`p-4 rounded-xl border ${cardInnerBg}`}>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-blue-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Contact & Identity</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className={`block font-medium ${textMuted}`}>Email Address</span>
                <div className="flex items-center gap-1.5 font-bold mt-0.5">
                  <span>{user.email}</span>
                  {user.isEmailVerified ? (
                    <span title="Email Verified"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /></span>
                  ) : (
                    <span title="Unverified"><AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" /></span>
                  )}
                </div>
              </div>

              <div>
                <span className={`block font-medium ${textMuted}`}>Mobile Number</span>
                <div className="flex items-center gap-1.5 font-bold mt-0.5 text-emerald-500">
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>{user.mobile}</span>
                  {user.isMobileVerified && (
                    <span title="Mobile Verified"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /></span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Associated Entity / Restaurant */}
          <div className={`p-4 rounded-xl border ${cardInnerBg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-4 h-4 text-orange-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Associated Restaurant / Platform Scope</span>
            </div>
            <p className="text-sm font-black">{user.restaurantName}</p>
            {user.restaurantId && (
              <span className="text-[11px] font-mono text-slate-500 block mt-1">ID: {user.restaurantId}</span>
            )}
          </div>

          {/* System & Access Info */}
          <div className={`p-4 rounded-xl border ${cardInnerBg}`}>
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-emerald-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>System Metadata & Access Permissions</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className={`block font-medium ${textMuted}`}>Database ID</span>
                <span className="font-mono font-bold text-slate-400 text-[11px]">{user.id}</span>
              </div>
              <div>
                <span className={`block font-medium ${textMuted}`}>Last Activity Sync</span>
                <span className="font-semibold">{user.lastActive}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
          <button
            onClick={() => exportSingleUserAsPDF(user)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition-all shadow-md"
          >
            <FileText className="w-4 h-4" />
            Download User Dossier (PDF)
          </button>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
