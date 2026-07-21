import { PlatformOrder } from "../store/Analytics";

export const exportOrdersAsCSV = (orders: PlatformOrder[]) => {
  const headers = "Transaction_ID,Restaurant,Route,Gross_Amount,Commission,Status,Timestamp\n";
  const rows = orders
    .map(
      (o) =>
        `"${o.id}","${o.restaurant}","${o.type}",${o.grossAmount},${o.commission},"${o.status}","${o.timestamp || ''}"`
    )
    .join("\n");

  const blob = new Blob(['\uFEFF' + headers + rows], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute(
    "download",
    `analytics_report_${new Date().toISOString().slice(0, 10)}.csv`
  );
  a.click();
  window.URL.revokeObjectURL(url);
};

export const exportOrdersAsPDF = (orders: PlatformOrder[]) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateStr = new Date().toLocaleString();
  const rowsHtml = orders.map((o, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${o.id}</strong></td>
      <td>${o.restaurant}</td>
      <td>${o.type}</td>
      <td>₹${o.grossAmount.toLocaleString('en-IN')}</td>
      <td>₹${o.commission.toLocaleString('en-IN')}</td>
      <td><span style="font-weight:bold;color:${o.status === 'Settled' ? '#059669' : o.status === 'Processing' ? '#3b82f6' : '#dc2626'};">${o.status}</span></td>
      <td>${o.timestamp || '-'}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Platform Analytics Telemetry Report - ${dateStr}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; }
          .header { border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
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
            <h1>Platform Telemetry & Analytics Report</h1>
            <div class="meta">Generated on ${dateStr} • Total Orders Analyzed: ${orders.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order / Tx ID</th>
              <th>Restaurant</th>
              <th>Type</th>
              <th>Gross Amount</th>
              <th>Commission</th>
              <th>Status</th>
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