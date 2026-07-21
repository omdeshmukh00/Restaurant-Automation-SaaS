// src/features/superAdmin/components/Analytics/Analyticsheader.tsx
import React, { useState } from "react";
import { RefreshCw, Download, PlusCircle, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";

interface AnalyticsHeaderProps {
  darkMode: boolean;
  isRefreshing: boolean;
  onSync: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onOnboard: () => void;
}

export default function AnalyticsHeader({
  darkMode,
  isRefreshing,
  onSync,
  onExportCSV,
  onExportPDF,
  onOnboard,
}: AnalyticsHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const ghostBtn = [
    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
    darkMode
      ? "bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm",
  ].join(" ");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-1">
      {/* Left: title + subtitle */}
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
          Analytics
        </h1>
        <p
          className={`text-xs sm:text-sm mt-1 font-medium ${
            darkMode ? "text-slate-400" : "text-slate-600"
          }`}
        >
          Platform metrics, order telemetry, and cluster state logs.
        </p>
      </div>

      {/* Right: action buttons */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        <button onClick={onSync} type="button" className={ghostBtn}>
          <RefreshCw
            size={13}
            className={
              isRefreshing ? "animate-spin text-orange-500" : ""
            }
          />
          <span className="hidden xs:inline">
            {isRefreshing ? "Syncing…" : "Sync"}
          </span>
          <span className="xs:hidden">
            {isRefreshing ? "…" : "Sync"}
          </span>
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            type="button"
            className={ghostBtn}
          >
            <Download size={13} className="text-blue-500" />
            <span>Export</span>
            <ChevronDown size={12} />
          </button>

          {dropdownOpen && (
            <div
              className={`absolute right-0 mt-1.5 w-44 rounded-xl border shadow-xl py-1 z-30 ${
                darkMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onExportCSV();
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${
                  darkMode ? "hover:bg-slate-800 text-emerald-400" : "hover:bg-slate-50 text-emerald-600"
                }`}
              >
                <FileSpreadsheet size={13} />
                Download CSV (.csv)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onExportPDF();
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${
                  darkMode ? "hover:bg-slate-800 text-blue-400" : "hover:bg-slate-50 text-blue-600"
                }`}
              >
                <FileText size={13} />
                Download PDF (.pdf)
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onOnboard}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm hover:opacity-90 active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          <PlusCircle size={13} />
          <span>Onboard Franchise</span>
        </button>
      </div>
    </div>
  );
}