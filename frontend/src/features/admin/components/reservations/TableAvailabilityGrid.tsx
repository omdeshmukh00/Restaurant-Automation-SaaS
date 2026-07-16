import React, { useEffect, useMemo } from 'react';
import { useReservationsStore } from '../../store/reservations.store';
import { useTablesStore, type Table, type TableStatus } from '../../store/tables.store';

const statusConfig: Record<TableStatus, { color: string; label: string; dot: string }> = {
  Available: {
    color:
      'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/60',
    label: 'Available',
    dot: 'bg-green-500',
  },
  Occupied: {
    color:
      'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/60',
    label: 'Occupied',
    dot: 'bg-orange-500',
  },
  Reserved: {
    color:
      'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60',
    label: 'Reserved',
    dot: 'bg-blue-500',
  },
  Cleaning: {
    color:
      'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-950/60',
    label: 'Cleaning',
    dot: 'bg-yellow-500',
  },
  Blocked: {
    color:
      'bg-gray-100 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
    label: 'Blocked',
    dot: 'bg-gray-400',
  },
};

const RESERVED_STATUSES = new Set(['Confirmed', 'Pending', 'Checked In']);

function toIso(dateStr: string): string {
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
}

function selectedDateToIso(label: string): string {
  const now = new Date();
  if (label.startsWith('Today')) return now.toISOString().split('T')[0];
  if (label.startsWith('Tomorrow')) {
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    return next.toISOString().split('T')[0];
  }
  const match = label.match(/([A-Za-z]{3})\w*\s+(\d{1,2}),\s*(\d{4})/);
  if (match) {
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const month = months[match[1]] ?? 0;
    const date = new Date(Number(match[3]), month, Number(match[2]));
    return date.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}

function TableIcon({ status }: { status: TableStatus }) {
  const colors: Record<TableStatus, string> = {
    Available: '#22c55e',
    Occupied: '#f97316',
    Reserved: '#3b82f6',
    Cleaning: '#eab308',
    Blocked: '#9ca3af',
  };
  return (
    <svg width="24" height="18" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="20" height="8" rx="2" fill={colors[status]} opacity="0.3" />
      <rect x="4" y="6" width="20" height="8" rx="2" stroke={colors[status]} strokeWidth="1.5" />
      <line x1="8" y1="6" x2="8" y2="18" stroke={colors[status]} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="6" x2="20" y2="18" stroke={colors[status]} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="2" x2="12" y2="6" stroke={colors[status]} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="6" stroke={colors[status]} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TableAvailabilityGrid(): JSX.Element {
  const { tables, fetchTables } = useTablesStore();
  const { allReservations, selectedDate } = useReservationsStore();

  useEffect(() => {
    if (tables.length === 0) fetchTables().catch(() => undefined);
  }, [tables.length, fetchTables]);

  const selectedIso = selectedDateToIso(selectedDate);

  // Tables that carry a booking for the currently selected date.
  const reservedLabelForDate = useMemo(() => {
    const set = new Set<string>();
    for (const reservation of allReservations) {
      if (!reservation.tableNumber) continue;
      if (!RESERVED_STATUSES.has(reservation.status)) continue;
      if (toIso(reservation.date) !== selectedIso) continue;
      set.add(String(reservation.tableNumber));
    }
    return set;
  }, [allReservations, selectedIso]);

  const displayStatusFor = (table: Table): TableStatus => {
    if (table.status === 'Occupied') return 'Occupied';
    if (reservedLabelForDate.has(String(table.label))) return 'Reserved';
    return table.status;
  };

  const counts = useMemo(() => {
    const tally: Record<TableStatus, number> = {
      Available: 0, Occupied: 0, Reserved: 0, Cleaning: 0, Blocked: 0,
    };
    for (const table of tables) tally[displayStatusFor(table)] += 1;
    return tally;
  }, [tables, reservedLabelForDate]);

  const legend = [
    { key: 'Available' as TableStatus, dot: statusConfig.Available.dot, count: counts.Available },
    { key: 'Occupied' as TableStatus, dot: statusConfig.Occupied.dot, count: counts.Occupied },
    { key: 'Reserved' as TableStatus, dot: statusConfig.Reserved.dot, count: counts.Reserved },
  ];
  if (counts.Cleaning > 0) {
    legend.push({ key: 'Cleaning', dot: statusConfig.Cleaning.dot, count: counts.Cleaning });
  }
  if (counts.Blocked > 0) {
    legend.push({ key: 'Blocked', dot: statusConfig.Blocked.dot, count: counts.Blocked });
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">Table Availability</h3>
        <span className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500">{tables.length} tables</span>
      </div>

      {/* Legend with counts */}
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
        {legend.map(({ key, dot, count }) => (
          <span key={key} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400">
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${dot}`} />
            {statusConfig[key].label}
            <span className="font-semibold text-gray-700 dark:text-gray-300">{count}</span>
          </span>
        ))}
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {tables.map((table) => {
          const displayStatus = displayStatusFor(table);
          const cfg = statusConfig[displayStatus];
          return (
            <button
              key={table.id}
              className={`border rounded-xl p-2 sm:p-2.5 flex flex-col items-center gap-1 sm:gap-1.5 cursor-pointer transition-all ${cfg.color}`}
              title={`Table ${table.label} — ${cfg.label} (${table.seats} seats)`}
            >
              <TableIcon status={displayStatus} />
              <span className="text-[10px] sm:text-[11px] font-bold">{table.label}</span>
              <span className="text-[9px] sm:text-[10px] opacity-70">{table.seats} seats</span>
            </button>
          );
        })}
      </div>

      {tables.length === 0 && (
        <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 py-4">
          No tables loaded yet.
        </p>
      )}
    </div>
  );
}
