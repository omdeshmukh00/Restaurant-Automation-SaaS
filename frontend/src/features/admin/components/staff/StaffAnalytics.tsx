import React, { useState } from 'react';
import { X, TrendingDown, Star } from 'lucide-react';
import { useStaffStore } from '../../store/staff.store';

// ── Shared Modal Shell ─────────────────────────────────────────────────────

function ModalShell({
  title, subtitle, onClose, children,
}: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button 
        type="button" 
        aria-label="Close modal" 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm w-full h-full cursor-default" 
        onClick={onClose} 
      />
      <div className="relative z-10 bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Attendance Report Modal ────────────────────────────────────────────────

function AttendanceReportModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { attendanceBreakdown, stats } = useStaffStore();
  const total = attendanceBreakdown.reduce((s, a) => s + a.count, 0);

  return (
    <ModalShell title="Attendance Report" subtitle="This Month — Detailed Breakdown" onClose={onClose}>
      <div className="p-5 space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 rounded-xl p-4">
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">Overall Attendance</p>
            <p className="text-3xl font-black text-green-700 dark:text-green-300">{stats.attendancePct}%</p>
            <p className="text-xs text-green-500 mt-0.5">Live attendance status</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Total Records</p>
            <p className="text-3xl font-black text-blue-700 dark:text-blue-300">{total}</p>
            <p className="text-xs text-blue-400 mt-0.5">Across all staff</p>
          </div>
        </div>

        {/* Breakdown bars */}
        <div>
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3">Status Breakdown</p>
          <div className="space-y-3">
            {attendanceBreakdown.map((ab) => {
              const pct = Math.round((ab.count / total) * 100);
              return (
                <div key={ab.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ab.color }} />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{ab.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{ab.count}</span>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: ab.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real summary */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Summary</p>
          {attendanceBreakdown.map((ab) => (
            <div key={ab.label} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: ab.color }} />
              <span className="text-gray-600 dark:text-gray-400 flex-1">{ab.label}</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{ab.count}</span>
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

// ── Payroll Report Modal ───────────────────────────────────────────────────

function PayrollReportModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { payrollLines, stats, members } = useStaffStore();

  const deptPayroll = (() => {
    const map: Record<string, number> = {};
    members.forEach((m) => {
      map[m.department] = (map[m.department] || 0) + (m.salary || 0);
    });
    const totalSal = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    const colors: Record<string, string> = {
      Management: '#f97316', Kitchen: '#22c55e', Service: '#3b82f6',
      Bar: '#a855f7', 'Front Desk': '#eab308', Cleaning: '#64748b',
    };
    return Object.entries(map)
      .map(([dept, amount]) => ({ dept, amount, pct: Math.round((amount / totalSal) * 100), color: colors[dept] || '#64748b' }))
      .sort((a, b) => b.amount - a.amount);
  })();

  const topEarners = [...members]
    .sort((a, b) => b.salary - a.salary)
    .slice(0, 5);

  return (
    <ModalShell title="Payroll Report" subtitle="This Month — Full Summary" onClose={onClose}>
      <div className="p-5 space-y-5">
        {/* Total */}
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4">
          <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mb-0.5">Total Payroll This Month</p>
          <p className="text-3xl font-black text-gray-900 dark:text-gray-100">{stats.totalPayroll}</p>
          <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> {stats.totalPayrollChange}
          </p>
        </div>

        {/* Line items */}
        <div>
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3">Payroll Breakdown</p>
          <div className="space-y-2">
            {payrollLines.map((pl, i) => {
              const colors = ['bg-blue-400','bg-green-400','bg-red-400','bg-purple-400'];
              return (
                <div key={pl.label} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${colors[i]}`} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{pl.label}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{pl.amount}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dept distribution */}
        <div>
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3">By Department</p>
          <div className="space-y-2">
            {deptPayroll.map((d, i) => (
              <div key={d.dept}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">{d.dept}</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">₹{d.amount.toLocaleString()}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top earners */}
        <div>
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3">Top 5 Earners</p>
          <div className="space-y-2">
            {topEarners.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{m.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{m.name}</p>
                  <p className="text-[10px] text-gray-400">{m.role}</p>
                </div>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">₹{m.salary.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Performance Report Modal ───────────────────────────────────────────────

function PerformanceReportModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { members, stats, performance } = useStaffStore();

  const topPerformers = [...members].sort((a, b) => b.performance - a.performance).slice(0, 5);
  const needsAttention = [...members].filter(m => m.performance < 2.5).sort((a, b) => a.performance - b.performance);

  const avgService = performance.length ? Math.round(performance.reduce((s, p) => s + (p.serviceCompletionRate || 0), 0) / performance.length) : 0;
  const avgKitchen = performance.length ? Math.round(performance.reduce((s, p) => s + (p.kitchenCompletionRate || 0), 0) / performance.length) : 0;

  return (
    <ModalShell title="Performance Report" subtitle="This Month — Team Overview" onClose={onClose}>
      <div className="p-5 space-y-5">
        {/* Average score */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-0.5">Average Performance Score</p>
          <p className="text-4xl font-black text-gray-900 dark:text-gray-100">{stats.avgPerformance}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Blended service &amp; kitchen completion</p>
        </div>

        {/* Avg completion rates */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Team Completion Rates</p>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Service Completion</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{avgService}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${avgService}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Kitchen Completion</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{avgKitchen}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-green-400 transition-all duration-500" style={{ width: `${avgKitchen}%` }} />
            </div>
          </div>
        </div>

        {/* Raw metrics */}
        <div>
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3">Raw Metrics — Per Staff</p>
          <div className="space-y-2">
            {performance.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">No performance data available yet.</p>
            )}
            {performance.map((p) => {
              const cleaning = p.startedCleaningTasks ? `${p.completedCleaningTasks}/${p.startedCleaningTasks}` : '—';
              return (
                <div key={p.staffId} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{p.name}</p>
                    <span className="text-xs text-gray-400">{p.role}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{Math.round(p.serviceCompletionRate || 0)}%</p>
                      <p className="text-[9px] text-gray-400">Service</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">{Math.round(p.kitchenCompletionRate || 0)}%</p>
                      <p className="text-[9px] text-gray-400">Kitchen</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{p.avgKitchenMinutes || 0}m</p>
                      <p className="text-[9px] text-gray-400">Avg min</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{cleaning}</p>
                      <p className="text-[9px] text-gray-400">Cleaning</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top performers */}
        <div>
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3">Top Performers</p>
          <div className="space-y-2">
            {topPerformers.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 bg-green-50 dark:bg-green-950/20 rounded-xl">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{m.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{m.name}</p>
                  <p className="text-[10px] text-gray-400">{m.role}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{m.performance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Needs attention */}
        {needsAttention.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3">Needs Attention (below 2.5)</p>
            <div className="space-y-2">
              {needsAttention.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-2.5 bg-red-50 dark:bg-red-950/20 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{m.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{m.name}</p>
                    <p className="text-[10px] text-gray-400">{m.role} • {m.department}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-red-400 text-red-400" />
                    <span className="text-xs font-bold text-red-500">{m.performance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ── Roles Distribution View All Modal ─────────────────────────────────────

function RolesViewAllModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { roleDistribution, members, stats } = useStaffStore();

  const ROLE_COLORS_BG: Record<string, string> = {
    Manager:   'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400',
    Chef:      'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400',
    Server:    'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
    Bartender: 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400',
    Host:      'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
    Cleaner:   'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  };

  const allRoles = [...roleDistribution].sort((a, b) => b.count - a.count);

  return (
    <ModalShell title="Roles Distribution" subtitle={`${stats.totalStaff} total staff across all roles`} onClose={onClose}>
      <div className="p-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          {allRoles.slice(0, 3).map((rd) => (
            <div key={rd.role} className="rounded-xl p-3 text-center" style={{ background: `${rd.color}18` }}>
              <p className="text-xl font-black" style={{ color: rd.color }}>{rd.count}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{rd.role}s</p>
              <p className="text-[10px] font-semibold mt-0.5" style={{ color: rd.color }}>{rd.pct}</p>
            </div>
          ))}
        </div>

        {/* All roles bar chart */}
        <div>
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3">All Roles — Headcount</p>
          <div className="space-y-3">
            {allRoles.filter(rd => rd.count > 0).map((rd) => (
              <div key={rd.role}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: rd.color }} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{rd.role}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{rd.count}</span>
                    <span className="text-xs text-gray-400">{rd.pct}</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(rd.count / stats.totalStaff) * 100}%`, background: rd.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff grouped by role */}
        <div>
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3">Staff by Role</p>
          <div className="space-y-4">
            {allRoles.filter(rd => rd.count > 0).map((rd) => {
              const roleMembers = members.filter(m => m.role === rd.role);
              return (
                <div key={rd.role}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROLE_COLORS_BG[rd.role]}`}>{rd.role}</span>
                    <span className="text-xs text-gray-400">{roleMembers.length} member{roleMembers.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-1">
                    {roleMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">{m.avatar}</div>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{m.name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Attendance Overview ───────────────────────────────────────────────────

export function AttendanceOverview(): JSX.Element {
  const { stats, attendanceBreakdown } = useStaffStore();
  const [showReport, setShowReport] = useState(false);

  const total = attendanceBreakdown.reduce((s, a) => s + a.count, 0);
  const r = 45, cx = 60, cy = 60, circumference = 2 * Math.PI * r;

  const segments = attendanceBreakdown.reduce<Array<typeof attendanceBreakdown[number] & { dash: number; offset: number }>>(
    (acc, ab) => {
      const prev   = acc[acc.length - 1];
      const offset = prev ? prev.offset + prev.dash : 0;
      const pct    = ab.count / total;
      const dash   = pct * circumference;
      acc.push({ ...ab, dash, offset });
      return acc;
    },
    []
  );

  return (
    <>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Attendance Overview</h3>
            <p className="text-[11px] text-gray-400">This Month</p>
          </div>
          <button onClick={() => setShowReport(true)} className="text-xs font-semibold text-orange-500 hover:underline">View Report</button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <svg width="120" height="120" viewBox="0 0 120 120">
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="14"
                  strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                  strokeDashoffset={-seg.offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              ))}
              <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#111827" className="dark:fill-gray-100">{stats.attendancePct}%</text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#9ca3af">Overall</text>
              <text x={cx} y={cy + 21} textAnchor="middle" fontSize="9" fill="#9ca3af">Attendance</text>
            </svg>
          </div>
          <div className="space-y-1.5 flex-1">
            {attendanceBreakdown.map((ab) => (
              <div key={ab.label} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: ab.color }} />
                <span className="text-gray-600 dark:text-gray-400 flex-1">{ab.label}</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{ab.count}</span>
                <span className="text-gray-400">({Math.round(ab.count / total * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showReport && <AttendanceReportModal onClose={() => setShowReport(false)} />}
    </>
  );
}

// ── Payroll Summary ───────────────────────────────────────────────────────

export function PayrollSummary(): JSX.Element {
  const { stats, payrollLines } = useStaffStore();
  const [showReport, setShowReport] = useState(false);

  return (
    <>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Payroll Summary</h3>
            <p className="text-[11px] text-gray-400">This Month</p>
          </div>
          <button onClick={() => setShowReport(true)} className="text-xs font-semibold text-orange-500 hover:underline">View Report</button>
        </div>
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Payroll</p>
          <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{stats.totalPayroll}</p>
          <p className="text-xs text-red-500 mt-0.5">{stats.totalPayrollChange}</p>
        </div>
        <div className="w-full h-16 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-xl flex items-center justify-center mb-3">
          <div className="flex gap-1 items-end">
            {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
              <div key={i} style={{ height: h * 0.5 }} className="w-2.5 bg-orange-400 dark:bg-orange-500 rounded-sm opacity-80" />
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {payrollLines.map((pl) => (
            <div key={pl.label} className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">{pl.label}</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{pl.amount}</span>
            </div>
          ))}
        </div>
      </div>
      {showReport && <PayrollReportModal onClose={() => setShowReport(false)} />}
    </>
  );
}

// ── Performance Overview ──────────────────────────────────────────────────

export function PerformanceOverview(): JSX.Element {
  const { stats, performance } = useStaffStore();
  const [showReport, setShowReport] = useState(false);

  const avgService = performance.length ? Math.round(performance.reduce((s, p) => s + (p.serviceCompletionRate || 0), 0) / performance.length) : 0;
  const avgKitchen = performance.length ? Math.round(performance.reduce((s, p) => s + (p.kitchenCompletionRate || 0), 0) / performance.length) : 0;

  return (
    <>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Performance Overview</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Avg Score (0–5)</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-gray-900 dark:text-gray-100">{stats.avgPerformance}</span>
            </div>
            <p className="text-xs text-gray-400">Blended service &amp; kitchen</p>
          </div>
          <button onClick={() => setShowReport(true)} className="text-xs font-semibold text-orange-500 hover:underline self-start">View Report</button>
        </div>
        <div className="space-y-3 mt-2">
          {performance.length === 0 ? (
            <p className="text-xs text-gray-400">No performance data yet.</p>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Service Completion</span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{avgService}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${avgService}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Kitchen Completion</span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{avgKitchen}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-green-400 transition-all duration-500" style={{ width: `${avgKitchen}%` }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {showReport && <PerformanceReportModal onClose={() => setShowReport(false)} />}
    </>
  );
}

// ── Roles Distribution ────────────────────────────────────────────────────

export function RolesDistribution(): JSX.Element {
  const { roleDistribution, stats } = useStaffStore();
  const [showAll, setShowAll] = useState(false);

  const total = stats.totalStaff;
  const r = 45, cx = 60, cy = 60, circumference = 2 * Math.PI * r;

  const segments = roleDistribution
    .filter((rd) => rd.count > 0)
    .reduce<Array<typeof roleDistribution[number] & { dash: number; offset: number }>>(
      (acc, rd) => {
        const prev   = acc[acc.length - 1];
        const offset = prev ? prev.offset + prev.dash : 0;
        const pct    = rd.count / total;
        const dash   = pct * circumference;
        acc.push({ ...rd, dash, offset });
        return acc;
      },
      []
    );

  return (
    <>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Roles Distribution</h3>
          <button onClick={() => setShowAll(true)} className="text-xs font-semibold text-orange-500 hover:underline">View All</button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <svg width="120" height="120" viewBox="0 0 120 120">
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="14"
                  strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                  strokeDashoffset={-seg.offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              ))}
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827" className="dark:fill-gray-100">{total}</text>
              <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#9ca3af">Total</text>
            </svg>
          </div>
          <div className="space-y-1 flex-1">
            {roleDistribution.filter((rd) => rd.count > 0).map((rd) => (
              <div key={rd.role} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rd.color }} />
                <span className="text-gray-600 dark:text-gray-400 flex-1 truncate">{rd.role}s</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{rd.count}</span>
                <span className="text-gray-400">({rd.pct})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showAll && <RolesViewAllModal onClose={() => setShowAll(false)} />}
    </>
  );
}