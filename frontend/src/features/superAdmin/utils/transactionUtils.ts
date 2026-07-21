// utils/transactionUtils.ts

import type { Transaction, MetricSummary, DateRange } from "../components/Transactions/Transactiontypes";

export function filterByDateRange(transactions: Transaction[], range: DateRange): Transaction[] {
  if (range === "all") return transactions;

  const now = new Date("2026-05-19T23:59:59"); // pinned to demo data window
  const msMap: Record<string, number> = {
    today: 1,
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };

  const daysAgo = msMap[range] ?? 999;
  const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  return transactions.filter((tx) => new Date(tx.timestamp) >= cutoff);
}

export function computeMetrics(transactions: Transaction[]): MetricSummary {
  const completed = transactions.filter((t) => t.status === "Completed");
  const failed = transactions.filter((t) => t.status === "Failed");
  const pending = transactions.filter((t) => t.status === "Pending");
  const refunded = transactions.filter((t) => t.status === "Refunded");

  const totalRevenue = completed.reduce((s, t) => s + t.amount, 0);
  const totalCommission = completed.reduce((s, t) => s + t.commission, 0);
  const avgOrderValue = completed.length ? totalRevenue / completed.length : 0;
  const avgCommissionRate =
    transactions.length
      ? transactions.reduce((s, t) => s + t.commissionRate, 0) / transactions.length
      : 0;

  return {
    totalRevenue,
    totalCommission,
    completedCount: completed.length,
    failedCount: failed.length,
    pendingCount: pending.length,
    refundedCount: refunded.length,
    successRate: transactions.length
      ? Math.round((completed.length / transactions.length) * 100)
      : 0,
    avgOrderValue,
    avgCommissionRate,
    totalTransactions: transactions.length,
  };
}

export function exportToCSV(transactions: Transaction[], filename = "transactions.csv") {
  const headers = [
    "Order ID", "Restaurant", "City", "Amount", "Commission",
    "Commission Rate", "Payment Method", "Status", "Timestamp", "Note"
  ];
  const rows = transactions.map((t) => [
    t.id, t.restaurant, t.city, t.amount, t.commission,
    `${t.commissionRate}%`, t.paymentMethod, t.status, t.timestamp, t.note ?? ""
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${v}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(transactions: Transaction[]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateStr = new Date().toLocaleString();
  const rowsHtml = transactions.map((t, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${t.id}</strong></td>
      <td>${t.restaurant} <br><small style="color:#64748b;">${t.city}</small></td>
      <td>₹${t.amount.toLocaleString('en-IN')}</td>
      <td>₹${t.commission.toLocaleString('en-IN')} (${t.commissionRate}%)</td>
      <td>${t.paymentMethod}</td>
      <td><span style="font-weight:bold;color:${t.status === 'Completed' ? '#059669' : t.status === 'Failed' ? '#dc2626' : '#d97706'};">${t.status}</span></td>
      <td>${t.timestamp}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Transactions Report - ${dateStr}</title>
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
            <h1>Platform Financial Transactions Report</h1>
            <div class="meta">Generated on ${dateStr} • Total Records: ${transactions.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order ID</th>
              <th>Restaurant & City</th>
              <th>Amount</th>
              <th>Commission</th>
              <th>Method</th>
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
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}