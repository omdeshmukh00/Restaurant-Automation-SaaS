// utils/subscriptionUtils.ts

import type { RestaurantNode, TierMetrics, TierMetric } from "../components/Subscriptions/Subcriptiontypes";

export function parseRevenue(raw: string): number {
  const num = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildTierMetric(nodes: RestaurantNode[]): TierMetric {
  const revenue = nodes.reduce((acc, r) => acc + parseRevenue(r.revenue), 0);
  return {
    count: nodes.length,
    revenue,
    formattedRevenue: formatCurrency(revenue),
    activeCount: nodes.filter((r) => r.status === "Active").length,
    trialCount: nodes.filter((r) => r.status === "Trial").length,
  };
}

export function computeTierMetrics(restaurants: RestaurantNode[]): TierMetrics {
  const basic      = restaurants.filter((r) => r.plan === "Basic");
  const standard   = restaurants.filter((r) => r.plan === "Standard");
  const premium    = restaurants.filter((r) => r.plan === "Premium");
  const enterprise = restaurants.filter((r) => r.plan === "Enterprise");
  const totalRevenue = restaurants.reduce((acc, r) => acc + parseRevenue(r.revenue), 0);

  return {
    basic:      buildTierMetric(basic),
    standard:   buildTierMetric(standard),
    premium:    buildTierMetric(premium),
    enterprise: buildTierMetric(enterprise),
    totalRevenue,
    totalNodes: restaurants.length,
  };
}

export function exportToCSV(restaurants: RestaurantNode[], filename = "subscriptions.csv") {
  const headers = [
    "ID", "Name", "Owner", "Email", "Phone", "Location",
    "Plan", "Status", "Revenue", "Branches", "Joined Date", "Last Active", "Tags"
  ];
  const rows = restaurants.map((r) => [
    r.id, r.name, r.owner, r.email, r.phone, r.location,
    r.plan, r.status, r.revenue, r.branches, r.joinedDate, r.lastActive,
    (r.tags ?? []).join("; ")
  ]);

  const csv = ['\uFEFF' + headers.join(','), ...rows.map((row) => row.map((v) => `"${v}"`).join(","))]
    .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSubscriptionsAsPDF(restaurants: RestaurantNode[]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateStr = new Date().toLocaleString();
  const rowsHtml = restaurants.map((r, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${r.name}</strong> <br><small style="color:#64748b;">${r.location}</small></td>
      <td>${r.owner} <br><small style="color:#2563eb;">${r.email}</small> <small style="color:#059669;">${r.phone}</small></td>
      <td><strong>${r.plan}</strong></td>
      <td><span style="font-weight:bold;color:${r.status === 'Active' ? '#059669' : r.status === 'Inactive' ? '#dc2626' : '#d97706'};">${r.status}</span></td>
      <td>${r.revenue}</td>
      <td>${r.joinedDate}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Subscriptions Report - ${dateStr}</title>
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
            <h1>Platform Restaurant Subscriptions Report</h1>
            <div class="meta">Generated on ${dateStr} • Total Restaurants: ${restaurants.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Restaurant & Location</th>
              <th>Owner Contact Info</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Revenue</th>
              <th>Joined Date</th>
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

export function generateId(): string {
  return `RST-${Math.floor(1000 + Math.random() * 9000)}`;
}