import { LogType, LogItem } from "../store/AuditLogs";

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
  logs: LogItem[]
) => {
  const headers = ['Type', 'Action', 'Performed By', 'Customer Name', 'Mobile Number', 'Email', 'Restaurant', 'Details', 'IP Address', 'Timestamp'];

  const rows = logs.map((log) => [
    `"${(log.type || '').replace(/"/g, '""')}"`,
    `"${(log.action || '').replace(/"/g, '""')}"`,
    `"${(log.performedBy || '').replace(/"/g, '""')}"`,
    `"${(log.customerName || log.metadata?.customerName || '').replace(/"/g, '""')}"`,
    `"${(log.customerPhone || log.metadata?.customerPhone || '').replace(/"/g, '""')}"`,
    `"${(log.customerEmail || log.metadata?.customerEmail || log.metadata?.email || '').replace(/"/g, '""')}"`,
    `"${(log.restaurantName || log.target || '').replace(/"/g, '""')}"`,
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

export const exportLogsAsPDF = (logs: LogItem[]) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateStr = new Date().toLocaleString();
  const rowsHtml = logs.map((log, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${log.type}</strong></td>
      <td>${log.action}</td>
      <td>
        <strong>${log.customerName || log.performedBy}</strong>
        ${log.customerPhone ? `<br><small style="color:#10b981;">📱 ${log.customerPhone}</small>` : ''}
        ${log.customerEmail ? `<br><small style="color:#3b82f6;">✉️ ${log.customerEmail}</small>` : ''}
      </td>
      <td>${log.restaurantName || log.target || '-'}</td>
      <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace;">${log.ipAddress}</code></td>
      <td>${log.timestamp}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Audit Logs Report - ${dateStr}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-bottom: 20px; }
          h1 { margin: 0; font-size: 24px; color: #ea580c; }
          .meta { font-size: 12px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #f8fafc; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; font-weight: 700; color: #475569; }
          td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
          tr:nth-child(even) { background: #fafafa; }
          @media print {
            body { padding: 0; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Audit & Security Activity Log Report</h1>
            <div class="meta">Generated on ${dateStr} • Total Entries: ${logs.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Action</th>
              <th>Performed By / Contact</th>
              <th>Restaurant</th>
              <th>Real IP</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

export const exportSingleLogAsPDF = (log: LogItem) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const metadata = log.metadata || {};
  const metadataRows = Object.entries(metadata).map(([k, v]) => `
    <tr>
      <td style="font-weight:bold;color:#475569;width:35%;">${k.toUpperCase()}</td>
      <td>${typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Audit Log Entry - ${log.action}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #0f172a; max-width: 800px; margin: 0 auto; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          .header { border-bottom: 2px solid #ea580c; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { font-size: 20px; font-weight: 800; color: #0f172a; }
          .badge { background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-block; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
          .label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .val { font-size: 14px; font-weight: 700; color: #0f172a; }
          .sub { font-size: 12px; color: #059669; font-weight: 600; margin-top: 2px; }
          .sub-blue { font-size: 12px; color: #2563eb; font-weight: 600; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div>
              <span class="badge">${log.type}</span>
              <div class="title" style="margin-top:8px;">${log.action}</div>
            </div>
            <div style="text-align:right;font-size:12px;color:#64748b;">
              <strong>Date:</strong> ${log.timestamp}
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <div class="label">Restaurant</div>
              <div class="val">${log.restaurantName || log.target || 'Platform Wide'}</div>
              ${log.restaurantId ? `<div style="font-size:11px;color:#64748b;">ID: ${log.restaurantId}</div>` : ''}
            </div>

            <div class="box">
              <div class="label">Performed By / Customer</div>
              <div class="val">${log.customerName || log.performedBy}</div>
              ${log.customerPhone ? `<div class="sub">📱 Mobile: ${log.customerPhone}</div>` : ''}
              ${log.customerEmail ? `<div class="sub-blue">✉️ Email: ${log.customerEmail}</div>` : ''}
            </div>
          </div>

          <div class="box" style="margin-bottom:20px;">
            <div class="label">Live IP & Network Information</div>
            <div style="display:flex;gap:20px;margin-top:6px;font-size:13px;">
              <div><strong>Exact Real IP:</strong> <code style="color:#059669;background:#ecfdf5;padding:2px 6px;border-radius:4px;">${log.ipAddress}</code></div>
              <div><strong>Entity Role:</strong> ${log.performedBy}</div>
            </div>
          </div>

          <div class="box" style="margin-bottom:20px;">
            <div class="label">Event Details</div>
            <div style="font-size:13px;color:#334155;margin-top:4px;">${log.details}</div>
          </div>

          ${metadataRows ? `
            <div class="box">
              <div class="label">Additional Event Metadata</div>
              <table>
                <tbody>${metadataRows}</tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};