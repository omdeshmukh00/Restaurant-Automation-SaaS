import React, { useMemo, useState, useEffect } from 'react';
import { LogItem, LogType, initialLogs } from "../store/AuditLogs";
import { exportLogsAsCSV, exportLogsAsPDF, getBadgeStyles } from "../utils/Auditlogsutils";
import { apiClient } from '../../../shared/services/apiClient';
import { Search, Globe, Store, User, Smartphone, Mail, Clock, ChevronRight, Eye } from 'lucide-react';

import AuditLogsHeader from "../components/Audit/Auditlogsheader";
import AuditLogsKPICards from "../components/Audit/Auditlogskpicards";
import AuditLogsFilterBar from "../components/Audit/Auditlogsfilterbar";
import AuditLogsTable from "../components/Audit/Auditlogstable";
import AuditLogsMobileCards from "../components/Audit/Auditlogsmobilecards";
import AuditDetailModal from "../components/Audit/AuditDetailModal";
import TablePagination from "../components/common/TablePagination";

function formatCleanIp(ip?: string): string {
  if (!ip) return '127.0.0.1 (Localhost)';
  let clean = ip;
  if (clean.startsWith('::ffff:')) {
    clean = clean.replace('::ffff:', '');
  }
  if (clean === '::1' || clean === '127.0.0.1') {
    return '127.0.0.1 (Localhost)';
  }
  return clean;
}

function mapEntityTypeToLogType(entityType?: string, action?: string): LogType {
  const et = (entityType || '').toUpperCase();
  const act = (action || '').toLowerCase();

  if (et === 'ADMIN' || act.includes('commission') || act.includes('role') || act.includes('deleted')) {
    return 'Admin';
  }
  if (et === 'RESTAURANT' || act.includes('restaurant') || act.includes('onboarding') || act.includes('menu')) {
    return 'Restaurant';
  }
  if (et === 'SUBSCRIPTION' || act.includes('subscription') || act.includes('plan')) {
    return 'Subscription';
  }
  if (et === 'TRANSACTION' || act.includes('payment') || act.includes('fee') || act.includes('settled')) {
    return 'Transaction';
  }
  if (et === 'SYSTEM' || act.includes('maintenance') || act.includes('backup')) {
    return 'System';
  }
  return 'System';
}

function formatActorRole(role?: string): string {
  if (!role || role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'RESTAURANT_ADMIN') return 'Admin User';
  if (role === 'CUSTOMER') return 'Customer';
  if (role === 'system') return 'System Auto';
  return role;
}

import { useAuditLogsStore } from '../store/AuditLogsStore';

export default function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState<'audit' | 'details'>('audit');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsSearchInput, setDetailsSearchInput] = useState('');
  const [detailsSearchTerm, setDetailsSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<LogType | 'All'>('All');
  
  const logs = useAuditLogsStore((state) => state.logs);
  const loading = useAuditLogsStore((state) => state.loading);
  const fetchLogs = useAuditLogsStore((state) => state.fetchLogs);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, detailsSearchTerm, selectedType, activeTab]);

  // Dark mode: initialise from localStorage, default to dark
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false;
  });

  // Sync theme when a global "sync-app-theme" event fires (e.g. from Layout sidebar)
  useEffect(() => {
    const handleThemeSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.darkMode !== undefined) {
        setDarkMode(customEvent.detail.darkMode);
      }
    };
    window.addEventListener('sync-app-theme', handleThemeSync);
    return () => window.removeEventListener('sync-app-theme', handleThemeSync);
  }, []);

  // Keep <html> class in sync for Tailwind dark: variants
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Fetch live audit logs from backend API via store
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const activeSearch = activeTab === 'details' ? detailsSearchTerm : searchTerm;
      const query = activeSearch.toLowerCase();
      
      const matchesSearch =
        !query ||
        log.action.toLowerCase().includes(query) ||
        log.performedBy.toLowerCase().includes(query) ||
        log.target.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        log.ipAddress.toLowerCase().includes(query) ||
        (log.customerName && log.customerName.toLowerCase().includes(query)) ||
        (log.customerPhone && log.customerPhone.toLowerCase().includes(query)) ||
        (log.customerEmail && log.customerEmail.toLowerCase().includes(query)) ||
        (log.restaurantName && log.restaurantName.toLowerCase().includes(query));

      const matchesType = selectedType === 'All' || log.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [logs, searchTerm, detailsSearchTerm, selectedType, activeTab]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleExportCSV = () => exportLogsAsCSV(filteredLogs);
  const handleExportPDF = () => exportLogsAsPDF(filteredLogs);

  const handleDetailsSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsSearchTerm(detailsSearchInput);
  };

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-300 ${
        darkMode ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* 1. Page header + Tab switcher + Export CSV / PDF */}
        <AuditLogsHeader
          darkMode={darkMode}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
        />

        {/* 2. KPI summary cards */}
        <AuditLogsKPICards darkMode={darkMode} logs={logs} />

        {/* 3. Tab Content */}
        {activeTab === 'audit' ? (
          <>
            {/* Audit Tab: Filter bar */}
            <AuditLogsFilterBar
              darkMode={darkMode}
              searchTerm={searchTerm}
              selectedType={selectedType}
              onSearchChange={setSearchTerm}
              onTypeChange={setSelectedType}
            />

            {/* Audit Tab: Table view */}
            <div
              className={`rounded-2xl border overflow-hidden shadow-sm ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
              }`}
            >
              {loading ? (
                <div className="p-12 text-center text-slate-500 font-medium animate-pulse">
                  Loading live audit logs...
                </div>
              ) : (
                <>
                  <div className="max-h-[620px] overflow-auto">
                    <AuditLogsTable darkMode={darkMode} logs={paginatedLogs} />
                    <AuditLogsMobileCards darkMode={darkMode} logs={paginatedLogs} />
                  </div>

                  <TablePagination
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalItems={filteredLogs.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                    darkMode={darkMode}
                    itemLabel="logs"
                  />
                </>
              )}
            </div>
          </>
        ) : (
          /* Details Tab: Rich Card Grid with Search Button & Modal */
          <div className="space-y-6">
            {/* Search Bar + Search Button + Category Filter Bar */}
            <div className={`p-4 rounded-2xl border space-y-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <form onSubmit={handleDetailsSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    value={detailsSearchInput}
                    onChange={(e) => setDetailsSearchInput(e.target.value)}
                    placeholder="Search by customer name, mobile, email, restaurant, action, IP..."
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                      darkMode
                        ? 'bg-slate-950 border-slate-800 text-slate-100 focus:border-orange-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all shrink-0"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>
              </form>

              {/* Category Pills */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-800/40">
                <span className={`text-xs font-bold uppercase tracking-wider mr-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Filter:</span>
                {(['All', 'Admin', 'Restaurant', 'Subscription', 'Transaction', 'System'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedType === type
                        ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                        : darkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Cards Grid */}
            {loading ? (
              <div className="p-12 text-center text-slate-500 font-medium animate-pulse">
                Loading detailed activity cards...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className={`p-12 text-center rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>
                <p className="font-semibold text-sm">No activity log details found matching your search.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedLogs.map((log) => {
                    const custName = log.customerName || log.metadata?.customerName || log.metadata?.userName || log.rawLog?.actorId?.name || log.performedBy;
                    const custMobile = log.customerPhone || log.metadata?.customerPhone || log.metadata?.userPhone || log.metadata?.userMobile || log.metadata?.mobile || log.metadata?.phone || log.rawLog?.actorId?.mobile || log.rawLog?.actorId?.phone;
                    const custEmail = log.customerEmail || log.metadata?.customerEmail || log.metadata?.email || log.metadata?.userEmail || log.rawLog?.actorId?.email;

                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`group p-4 rounded-2xl border cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-xl ${
                          darkMode
                            ? 'bg-slate-900/90 border-slate-800 hover:border-orange-500/50 hover:bg-slate-900'
                            : 'bg-white border-slate-200/80 hover:border-orange-500/50 hover:bg-slate-50/50'
                        }`}
                      >
                        {/* Top row: Badge & Time */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getBadgeStyles(log.type, darkMode)}`}>
                            {log.action}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>{log.timestamp}</span>
                          </div>
                        </div>

                        {/* Main Info */}
                        <div className="space-y-2 mb-3">
                          {/* Restaurant */}
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-orange-500 shrink-0" />
                            <span className={`text-xs font-black truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              {log.restaurantName || log.target || 'Platform Wide'}
                            </span>
                          </div>

                          {/* Customer / Performed by */}
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className={`font-bold truncate ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {custName}
                              </span>
                            </div>

                            {/* Mobile & Email Row */}
                            <div className="flex items-center gap-3 flex-wrap text-[11px] pt-0.5">
                              {custMobile && (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-500 shrink-0">
                                  <Smartphone className="w-3 h-3" />
                                  {custMobile}
                                </span>
                              )}
                              {custEmail && (
                                <span className="inline-flex items-center gap-1 font-semibold text-blue-400 truncate shrink-0 max-w-[180px]" title={custEmail}>
                                  <Mail className="w-3 h-3" />
                                  {custEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Details snippet */}
                        <p className={`text-xs line-clamp-2 mb-3 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          {log.details}
                        </p>

                        {/* Footer: Real IP Address badge & View Details action */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/40 text-xs">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-400">
                            <Globe className="w-3.5 h-3.5" />
                            <span>{log.ipAddress}</span>
                          </div>
                          <span className="flex items-center gap-1 text-[11px] font-bold text-orange-500 group-hover:translate-x-0.5 transition-transform">
                            <Eye className="w-3.5 h-3.5" />
                            Details
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination bar for Details tab */}
                <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <TablePagination
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalItems={filteredLogs.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                    darkMode={darkMode}
                    itemLabel="cards"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Audit Detail Modal when card clicked */}
        <AuditDetailModal
          log={selectedLog}
          darkMode={darkMode}
          onClose={() => setSelectedLog(null)}
        />
      </div>
    </div>
  );
}
