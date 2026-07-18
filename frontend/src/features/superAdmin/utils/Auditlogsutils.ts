import { LogType } from "../store/AuditLogs";

export const getBadgeStyles = (type: LogType, darkMode: boolean): string => {
  switch (type) {
    case 'Admin':
      return darkMode
        ? 'bg-red-950/40 text-red-400 border-red-900/40'
        : 'bg-red-50 text-red-600 border-red-100';
    case 'Restaurant':
      return darkMode
        ? 'bg-blue-950/40 text-blue-400 border-blue-900/40'
        : 'bg-blue-50 text-blue-600 border-blue-100';
    case 'Subscription':
      return darkMode
        ? 'bg-purple-950/40 text-purple-400 border-purple-900/40'
        : 'bg-purple-50 text-purple-600 border-purple-100';
    case 'Transaction':
      return darkMode
        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40'
        : 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'System':
    default:
      return darkMode
        ? 'bg-orange-950/40 text-orange-400 border-orange-900/40'
        : 'bg-orange-50 text-orange-600 border-orange-100';
  }
};

export const exportLogsAsCSV = (
  logs: {
    type: string;
    action: string;
    performedBy: string;
    target: string;
    details: string;
    ipAddress: string;
    timestamp: string;
  }[]
) => {
  const headers = ['Type', 'Action', 'Performed By', 'Target', 'Details', 'IP Address', 'Timestamp'];

  const rows = logs.map((log) => [
    `"${(log.type || '').replace(/"/g, '""')}"`,
    `"${(log.action || '').replace(/"/g, '""')}"`,
    `"${(log.performedBy || '').replace(/"/g, '""')}"`,
    `"${(log.target || '').replace(/"/g, '""')}"`,
    `"${(log.details || '').replace(/"/g, '""')}"`,
    `"${(log.ipAddress || '').replace(/"/g, '""')}"`,
    `"${(log.timestamp || '').replace(/"/g, '""')}"`,
  ].join(','));

  // UTF-8 BOM prefix guarantees Microsoft Excel parses encoding correctly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `audit_logs_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};