// components/SubscriptionControls.tsx

import { useState } from "react";
import { Search, X, RefreshCcw, Download, Plus, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import type { StatusFilter, TierFilter, SortField, SortOrder } from "./Subcriptiontypes";

interface SubscriptionControlsProps {
  searchQuery: string;
  statusFilter: StatusFilter;
  tierFilter: TierFilter;
  sortField: SortField;
  sortOrder: SortOrder;
  darkMode: boolean;
  totalCount: number;
  filteredCount: number;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: StatusFilter) => void;
  onSortChange: (field: SortField) => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onResetAll: () => void;
  onAddClick: () => void;
}

function SortBtn({
  field, label, sortField, sortOrder, darkMode, onClick
}: {
  field: SortField; label: string; sortField: SortField;
  sortOrder: SortOrder; darkMode: boolean; onClick: () => void;
}) {
  const isActive = sortField === field;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
        isActive
          ? "bg-orange-500 text-white border-orange-500"
          : darkMode
          ? "bg-slate-900/30 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
      {isActive
        ? sortOrder === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
        : <ArrowUpDown size={11} className="opacity-40" />}
    </button>
  );
}

export default function SubscriptionControls({
  searchQuery,
  statusFilter,
  tierFilter,
  sortField,
  sortOrder,
  darkMode,
  totalCount,
  filteredCount,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onExportCSV,
  onExportPDF,
  onResetAll,
  onAddClick,
}: SubscriptionControlsProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const hasActiveFilter =
    searchQuery !== "" || statusFilter !== "All" || tierFilter !== "All";

  const statusOptions: StatusFilter[] = [
    "All", "Active", "Trial", "Inactive"
  ];

  return (
    <div className={`rounded-2xl border mb-6 ${
      darkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200/80 shadow-sm"
    }`}>
      {/* Row 1 — Search + Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b border-inherit">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${
            darkMode ? "text-slate-500" : "text-slate-400"
          }`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search restaurant, owner, city, email..."
            className={`w-full h-10 pl-10 pr-9 text-xs rounded-xl border outline-none transition-all ${
              darkMode
                ? "bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-orange-500/50"
                : "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-orange-500/50"
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${
                darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-200 text-slate-600"
              }`}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          {hasActiveFilter && (
            <button
              onClick={onResetAll}
              className={`flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-semibold border transition-colors ${
                darkMode
                  ? "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20"
                  : "bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"
              }`}
            >
              <RefreshCcw size={13} />
              <span>{filteredCount}/{totalCount}</span>
              <X size={11} />
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className={`flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-semibold border transition-colors ${
                darkMode
                  ? "bg-slate-900/50 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Download size={14} />
              <span>Export</span>
              <ChevronDown size={12} />
            </button>

            {exportMenuOpen && (
              <div
                className={`absolute right-0 mt-1.5 w-40 rounded-xl border shadow-xl py-1 z-30 ${
                  darkMode ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                }`}
              >
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    onExportCSV();
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${
                    darkMode ? "hover:bg-slate-800 text-emerald-400" : "hover:bg-slate-50 text-emerald-600"
                  }`}
                >
                  Download CSV (.csv)
                </button>
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    onExportPDF();
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${
                    darkMode ? "hover:bg-slate-800 text-blue-400" : "hover:bg-slate-50 text-blue-600"
                  }`}
                >
                  Download PDF (.pdf)
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onAddClick}
            className="flex items-center gap-1.5 h-10 px-4 text-xs font-bold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all shadow-sm shadow-orange-500/20"
          >
            <Plus size={14} />
            <span>Add Restaurant</span>
          </button>
        </div>
      </div>

      {/* Row 2 — status tabs + sort controls */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {/* Status filter pills */}
        <div className={`flex items-center gap-1 p-1 rounded-xl ${darkMode ? "bg-slate-950/40" : "bg-slate-100/60"}`}>
          {statusOptions.map((st) => (
            <button
              key={st}
              onClick={() => onStatusChange(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? "bg-orange-500 text-white shadow-sm"
                  : darkMode
                  ? "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className={`h-5 w-px ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />

        {/* Sort buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-600" : "text-slate-400"}`}>
            Sort:
          </span>
          {[
            { field: "name" as SortField, label: "Name" },
            { field: "revenue" as SortField, label: "Revenue" },
            { field: "branches" as SortField, label: "Branches" },
            { field: "plan" as SortField, label: "Plan" },
            { field: "status" as SortField, label: "Status" },
          ].map((s) => (
            <SortBtn
              key={s.field}
              field={s.field}
              label={s.label}
              sortField={sortField}
              sortOrder={sortOrder}
              darkMode={darkMode}
              onClick={() => onSortChange(s.field)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}