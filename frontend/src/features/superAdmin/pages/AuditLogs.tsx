import React, { useMemo, useState, useEffect } from 'react';
import { LogItem, LogType, initialLogs } from "../store/AuditLogs";
import { exportLogsAsCSV } from "../utils/Auditlogsutils";
import { apiClient } from '../../../shared/services/apiClient';

import AuditLogsHeader from "../components/Audit/Auditlogsheader";
import AuditLogsKPICards from "../components/Audit/Auditlogskpicards";
import AuditLogsFilterBar from "../components/Audit/Auditlogsfilterbar";
import AuditLogsTable from "../components/Audit/Auditlogstable";
import AuditLogsMobileCards from "../components/Audit/Auditlogsmobilecards";

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
  if (role === 'system') return 'System Auto';
  return role;
}

import TablePagination from "../components/common/TablePagination";

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<LogType | 'All'>('All');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType]);

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

  // Fetch live audit logs from backend API
  useEffect(() => {
    let isMounted = true;
    const fetchAuditLogs = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/super-admin/audit-logs');
        const rawLogs = res.data?.data?.auditLogs || res.data?.data?.logs || res.data?.auditLogs || [];

        if (isMounted && Array.isArray(rawLogs) && rawLogs.length > 0) {
          const formatted: LogItem[] = rawLogs.map((item: any) => {
            const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent';
            const type = mapEntityTypeToLogType(item.entityType, item.action);
            const target = item.metadata?.restaurantName || item.metadata?.target || item.entityId || 'Platform';
            const details = item.metadata?.details || item.metadata?.reason || `${item.action} recorded`;

            return {
              id: item._id || String(Math.random()),
              type,
              action: item.action || 'System Action',
              performedBy: formatActorRole(item.actorRole),
              target,
              details,
              ipAddress: formatCleanIp(item.ipAddress),
              timestamp: dateStr,
            };
          });
          setLogs(formatted);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Failed to fetch live audit logs:", err);
      }

      if (isMounted) {
        setLogs(initialLogs);
        setLoading(false);
      }
    };

    fetchAuditLogs();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const query = searchTerm.toLowerCase();
      const matchesSearch =
        log.action.toLowerCase().includes(query) ||
        log.performedBy.toLowerCase().includes(query) ||
        log.target.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        log.ipAddress.toLowerCase().includes(query);

      const matchesType = selectedType === 'All' || log.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [logs, searchTerm, selectedType]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleExport = () => exportLogsAsCSV(filteredLogs);

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-300 px-4 sm:px-6 py-6 sm:py-8 ${
        darkMode ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <div className="max-w-7xl mx-auto">

        {/* 1. Page header + export button */}
        <AuditLogsHeader darkMode={darkMode} onExport={handleExport} />

        {/* 2. KPI summary cards */}
        <AuditLogsKPICards darkMode={darkMode} logs={logs} />

        {/* 3. Search & type-filter bar */}
        <AuditLogsFilterBar
          darkMode={darkMode}
          searchTerm={searchTerm}
          selectedType={selectedType}
          onSearchChange={setSearchTerm}
          onTypeChange={setSelectedType}
        />

        {/* 4. Data table / card list */}
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
              {/* Scrollable table container */}
              <div className="max-h-[620px] overflow-auto">
                {/* Desktop table */}
                <AuditLogsTable darkMode={darkMode} logs={paginatedLogs} />

                {/* Mobile card list */}
                <AuditLogsMobileCards darkMode={darkMode} logs={paginatedLogs} />
              </div>

              {/* Pagination bar */}
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
      </div>
    </div>
  );
}
