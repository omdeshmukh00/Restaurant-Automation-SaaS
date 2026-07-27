import React from 'react';
import { X, User, Store, Shield, Globe, Clock, FileText, Smartphone, Mail, Hash, Layers, Download, FileSpreadsheet } from 'lucide-react';
import { LogItem } from '../../store/AuditLogs';
import { getBadgeStyles, exportSingleLogAsPDF, exportLogsAsCSV } from '../../utils/Auditlogsutils';

interface AuditDetailModalProps {
  log: LogItem | null;
  darkMode: boolean;
  onClose: () => void;
}

export default function AuditDetailModal({ log, darkMode, onClose }: AuditDetailModalProps) {
  if (!log) return null;

  const bg = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const cardInnerBg = darkMode ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200/60';
  const textPrimary = darkMode ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = darkMode ? 'text-slate-400' : 'text-slate-600';
  const textMuted = darkMode ? 'text-slate-500' : 'text-slate-400';

  const metadata = log.metadata || {};
  const rawLog = log.rawLog || {};

  const customerName = log.customerName || metadata.customerName || metadata.userName || rawLog.actorId?.name || log.performedBy;
  const customerMobile = log.customerPhone || metadata.customerPhone || metadata.userPhone || metadata.userMobile || metadata.mobile || metadata.phone || rawLog.actorId?.mobile || rawLog.actorId?.phone;
  const customerEmail = log.customerEmail || metadata.customerEmail || metadata.email || metadata.userEmail || rawLog.actorId?.email;

  return (
    <div
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
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getBadgeStyles(log.type, darkMode)}`}>
              {log.type}
            </span>
            <div>
              <h3 className="text-lg font-extrabold tracking-tight">{log.action}</h3>
              <p className={`text-xs ${textMuted}`}>{log.timestamp}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Key Info Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Restaurant Info */}
            <div className={`p-3.5 rounded-xl border ${cardInnerBg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Store className="w-4 h-4 text-orange-500" />
                <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Restaurant</span>
              </div>
              <p className="text-sm font-black">{log.restaurantName || log.target || 'Platform Wide'}</p>
              {log.restaurantId && (
                <p className={`text-[11px] font-mono mt-0.5 ${textMuted}`}>ID: {log.restaurantId}</p>
              )}
            </div>

            {/* Performed By / Customer Contact Info */}
            <div className={`p-3.5 rounded-xl border ${cardInnerBg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <User className="w-4 h-4 text-blue-500" />
                <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Performed By</span>
              </div>
              <p className="text-sm font-black">{customerName}</p>

              {/* Mobile Number */}
              {customerMobile && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-emerald-500">
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>{customerMobile}</span>
                </div>
              )}

              {/* Email Address */}
              {customerEmail && (
                <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-blue-400">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate" title={customerEmail}>{customerEmail}</span>
                </div>
              )}
            </div>
          </div>

          {/* Network & Live IP Info */}
          <div className={`p-4 rounded-xl border ${cardInnerBg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Live IP Tracking & Network</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className={`block font-medium ${textMuted}`}>Exact IP Address</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{log.ipAddress}</span>
              </div>
              <div>
                <span className={`block font-medium ${textMuted}`}>Actor Role / Entity</span>
                <span className="font-semibold">{log.performedBy} ({log.entityType || 'General'})</span>
              </div>
            </div>
            {rawLog?.userAgent && (
              <div className="mt-3 pt-2.5 border-t border-slate-800/40 text-[11px]">
                <span className={`block font-medium mb-0.5 ${textMuted}`}>User Agent / Device:</span>
                <p className={`font-mono truncate ${textSecondary}`} title={rawLog.userAgent}>{rawLog.userAgent}</p>
              </div>
            )}
          </div>

          {/* Event Details */}
          <div className={`p-4 rounded-xl border ${cardInnerBg}`}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-amber-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Event Details</span>
            </div>
            <p className={`text-xs leading-relaxed font-medium ${textSecondary}`}>{log.details}</p>
          </div>

          {/* Metadata Breakdown if present */}
          {Object.keys(metadata).length > 0 && (
            <div className={`p-4 rounded-xl border ${cardInnerBg}`}>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-purple-500" />
                <span className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Additional Metadata</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(metadata).map(([key, val]) => (
                  <div key={key} className={`p-2 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>{key}</span>
                    <p className="font-semibold truncate">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON Accordion */}
          <details className="group">
            <summary className={`cursor-pointer text-xs font-semibold py-2 ${textMuted} hover:${textPrimary} transition-colors list-none flex items-center justify-between`}>
              <span>View Raw JSON Data</span>
              <Hash className="w-3.5 h-3.5" />
            </summary>
            <pre className={`mt-2 p-3 rounded-xl border text-[11px] font-mono overflow-x-auto max-h-40 ${darkMode ? 'bg-black/50 border-slate-800 text-emerald-400' : 'bg-slate-900 text-emerald-300'}`}>
              {JSON.stringify(rawLog.metadata ? rawLog : log, null, 2)}
            </pre>
          </details>
        </div>

        {/* Footer with Download PDF & CSV buttons */}
        <div className={`flex items-center justify-between px-6 py-3.5 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSingleLogAsPDF(log)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm"
              title="Download clean PDF report for this entry"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>

            <button
              onClick={() => exportLogsAsCSV([log])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm"
              title="Export CSV for this entry"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition-colors shadow-sm"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
