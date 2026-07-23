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
  // Always show a fixed range of hours (8 AM - 11 PM) for consistent layout
  // unless there is activity outside this range, in which case we show all 24 hours.
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      // Generate empty layout if no data passed
      const emptyState: PeakHourItem[] = [];
      for (let h = 0; h < 24; h++) {
        emptyState.push({ hour: h, reservations: 0, queueEntries: 0 });
      }
      return emptyState.filter((d) => d.hour >= 8 && d.hour <= 23);
    }
    
    const activeOutsideRange = data.some(
      (d) => (d.hour < 8 || d.hour > 23) && (d.reservations > 0 || d.queueEntries > 0)
    );
    
    if (activeOutsideRange) {
      return data;
    }
    
    return data.filter((d) => d.hour >= 8 && d.hour <= 23);
  }, [data]);

  const maxVal = useMemo(() => {
    const max = Math.max(1, ...chartData.map((d) => d.reservations + d.queueEntries));
    return max;
  }, [chartData]);

  const formatHour = (h: number) => {
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
  };

  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-300 flex flex-col h-full ${
        darkMode
          ? "bg-slate-900/60 border-slate-800 text-slate-100 shadow-xl shadow-black/20"
          : "bg-white border-slate-200/80 text-slate-800 shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              darkMode ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-600"
            }`}
          >
            <Clock size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Peak Hours Distribution</h3>
            <p className={`text-[10px] font-semibold mt-0.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Reservations + Queue by hour of day
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/30" />
            <span className={darkMode ? "text-slate-400" : "text-slate-500"}>Reservations</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/30" />
            <span className={darkMode ? "text-slate-400" : "text-slate-500"}>Queue</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area - flex-1 to fill the vertical height of the stretched parent card */}
      <div className="relative w-full flex-1 min-h-[220px] flex items-end">
        {/* Background Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-[28px] pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-full border-t border-dashed ${
                darkMode ? "border-slate-800/60" : "border-slate-100"
              }`}
            />
          ))}
        </div>

        {/* Bars Container */}
        <div className="relative z-10 w-full h-full flex items-end justify-between gap-1 sm:gap-2 pb-[24px]">
          {chartData.map((item) => {
            const total = item.reservations + item.queueEntries;
            const totalPct = maxVal > 0 ? (total / maxVal) * 100 : 0;
            const resPct = total > 0 ? (item.reservations / total) * 100 : 0;
            const queuePct = total > 0 ? (item.queueEntries / total) * 100 : 0;
            const showLabel = item.hour % 2 === 0;

            return (
              <div
                key={item.hour}
                className="flex-1 flex flex-col justify-end items-center h-full min-w-0 group"
              >
                {/* Bar Slot */}
                <div className="flex-1 w-full flex flex-col justify-end items-center relative">
                  {total > 0 ? (
                    <div
                      className="w-[10px] sm:w-[14px] rounded-full overflow-hidden flex flex-col-reverse transition-all duration-300 hover:scale-110 shadow-sm"
                      style={{ height: `${Math.max(6, totalPct)}%` }}
                    >
                      {/* Queue (bottom) */}
                      <div
                        className="w-full bg-gradient-to-t from-orange-600 to-orange-400"
                        style={{ height: `${queuePct}%` }}
                      />
                      {/* Reservation (top) */}
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400"
                        style={{ height: `${resPct}%` }}
                      />
                    </div>
                  ) : (
                    // Subtle placeholder empty track
                    <div
                      className={`w-[4px] sm:w-[6px] rounded-full transition-all duration-300 ${
                        darkMode ? "bg-slate-800/40" : "bg-slate-100/60"
                      }`}
                      style={{ height: "6%" }}
                    />
                  )}

                  {/* Tooltip on Hover */}
                  {total > 0 && (
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-30">
                      <div className="bg-slate-950 text-white text-[9px] font-bold rounded-lg px-2 py-1 shadow-lg border border-slate-800 whitespace-nowrap">
                        <p className="text-orange-400">Queue: {item.queueEntries}</p>
                        <p className="text-blue-400">Reservations: {item.reservations}</p>
                      </div>
                      <div className="w-1.5 h-1.5 bg-slate-950 border-r border-b border-slate-800 transform rotate-45 -mt-1" />
                    </div>
                  )}
                </div>

                {/* X-Axis Label */}
                <span
                  className={`text-[9px] font-bold text-center leading-tight mt-2 h-[12px] block transition-colors ${
                    darkMode ? "text-slate-500 group-hover:text-slate-350" : "text-slate-400 group-hover:text-slate-650"
                  }`}
                >
                  {showLabel ? formatHour(item.hour).replace(" ", "") : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
