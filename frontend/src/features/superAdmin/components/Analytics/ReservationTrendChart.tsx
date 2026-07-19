// src/features/superAdmin/components/Analytics/ReservationTrendChart.tsx
import React from "react";
import { TrendingUp } from "lucide-react";

interface TrendItem {
  date: string;
  reservations: number;
  queueEntries: number;
}

interface ReservationTrendChartProps {
  darkMode: boolean;
  data: TrendItem[];
}

export default function ReservationTrendChart({ darkMode, data }: ReservationTrendChartProps) {
  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.reservations, d.queueEntries))
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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
            darkMode ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"
          }`}
        >
          <TrendingUp size={15} />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Daily Trend — Last 7 Days</h3>
          <p className={`text-[10px] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
            Reservations vs Queue Entries
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
          <span className={darkMode ? "text-slate-400" : "text-slate-500"}>Queue Entries</span>
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.date} className="space-y-1.5">
            <p className={`text-[10px] font-medium ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              {formatDate(item.date)}
            </p>
            {/* Reservation bar */}
            <div className="flex items-center gap-2">
              <div
                className={`h-5 rounded-md flex-1 overflow-hidden ${
                  darkMode ? "bg-slate-800" : "bg-slate-100"
                }`}
              >
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-md transition-all duration-500"
                  style={{ width: `${Math.max(2, (item.reservations / maxVal) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold w-8 text-right">{item.reservations}</span>
            </div>
            {/* Queue bar */}
            <div className="flex items-center gap-2">
              <div
                className={`h-5 rounded-md flex-1 overflow-hidden ${
                  darkMode ? "bg-slate-800" : "bg-slate-100"
                }`}
              >
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-md transition-all duration-500"
                  style={{ width: `${Math.max(2, (item.queueEntries / maxVal) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold w-8 text-right">{item.queueEntries}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <p className={`text-center text-sm py-8 ${darkMode ? "text-slate-600" : "text-slate-400"}`}>
          No trend data available yet.
        </p>
      )}
    </div>
  );
}
