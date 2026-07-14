// src/features/superAdmin/components/Analytics/PeakHoursChart.tsx
import React, { useMemo } from "react";
import { Clock } from "lucide-react";

interface PeakHourItem {
  hour: number;
  reservations: number;
  queueEntries: number;
}

interface PeakHoursChartProps {
  darkMode: boolean;
  data: PeakHourItem[];
}

export default function PeakHoursChart({ darkMode, data }: PeakHoursChartProps) {
  // Only show hours that have activity, or hours 8-23 as a reasonable restaurant window
  const filteredData = useMemo(() => {
    const active = data.filter((d) => d.reservations > 0 || d.queueEntries > 0);
    if (active.length > 0) return active;
    // Fallback: show 8AM - 11PM
    return data.filter((d) => d.hour >= 8 && d.hour <= 23);
  }, [data]);

  const maxVal = Math.max(
    1,
    ...filteredData.map((d) => d.reservations + d.queueEntries)
  );

  const formatHour = (h: number) => {
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
  };

  return (
    <div
      className={`rounded-xl border p-5 transition-colors duration-200 ${
        darkMode
          ? "bg-slate-900/60 border-slate-800"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            darkMode ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-600"
          }`}
        >
          <Clock size={15} />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Peak Hours Distribution</h3>
          <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
            Reservations + Queue by hour of day
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
          <span className={darkMode ? "text-slate-400" : "text-slate-500"}>Reservations</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
          <span className={darkMode ? "text-slate-400" : "text-slate-500"}>Queue</span>
        </div>
      </div>

      {/* Stacked bar chart */}
      <div className="flex items-end gap-1" style={{ height: "180px" }}>
        {filteredData.map((item) => {
          const total = item.reservations + item.queueEntries;
          const totalPct = (total / maxVal) * 100;
          const resPct = total > 0 ? (item.reservations / total) * 100 : 0;
          const queuePct = total > 0 ? (item.queueEntries / total) * 100 : 0;

          return (
            <div
              key={item.hour}
              className="flex-1 flex flex-col items-center gap-1 min-w-0"
              title={`${formatHour(item.hour)}: ${item.reservations} res, ${item.queueEntries} queue`}
            >
              {/* Bar */}
              <div
                className="w-full rounded-t-md overflow-hidden flex flex-col-reverse transition-all duration-500"
                style={{ height: `${Math.max(4, totalPct)}%` }}
              >
                {/* Queue (bottom) */}
                <div
                  className="w-full bg-gradient-to-t from-orange-500 to-orange-400"
                  style={{ height: `${queuePct}%` }}
                />
                {/* Reservation (top) */}
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400"
                  style={{ height: `${resPct}%` }}
                />
              </div>
              {/* Label */}
              <span
                className={`text-[8px] font-medium leading-none ${
                  darkMode ? "text-slate-600" : "text-slate-400"
                }`}
              >
                {item.hour % 2 === 0 ? formatHour(item.hour).replace(" ", "\n") : ""}
              </span>
            </div>
          );
        })}
      </div>

      {filteredData.length === 0 && (
        <p className={`text-center text-sm py-8 ${darkMode ? "text-slate-600" : "text-slate-400"}`}>
          No peak hour data available yet.
        </p>
      )}
    </div>
  );
}
