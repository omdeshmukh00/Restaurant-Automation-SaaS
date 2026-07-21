import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface TablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  darkMode?: boolean;
  itemLabel?: string;
}

export default function TablePagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  darkMode = false,
  itemLabel = "items",
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) {
      pages.push(p);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div
      className={`sticky bottom-0 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t rounded-b-2xl backdrop-blur-md transition-colors ${
        darkMode
          ? "border-slate-800/80 bg-slate-900/95 text-slate-300 shadow-lg"
          : "border-slate-200/80 bg-white/95 text-slate-600 shadow-md"
      }`}
    >
      {/* Left section: Rows per page selector + Range summary */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold opacity-70">Rows per page:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border focus:outline-none focus:border-orange-500 cursor-pointer transition-colors ${
              darkMode
                ? "bg-slate-950 border-slate-800 text-white"
                : "bg-slate-50 border-slate-200 text-slate-800"
            }`}
          >
            {[25, 50, 75, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-400 font-medium">|</span>

        <p className="text-[11px] font-medium">
          Showing <span className="font-bold text-orange-500">{startItem}</span>–
          <span className="font-bold text-orange-500">{endItem}</span> of{" "}
          <span className="font-bold">{totalItems}</span> {itemLabel}
        </p>
      </div>

      {/* Right section: Page navigation buttons */}
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
            darkMode
              ? "border-slate-800 hover:bg-slate-800 text-slate-300"
              : "border-slate-200 hover:bg-slate-100 text-slate-700"
          }`}
          title="Previous Page"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page Number Pills */}
        <div className="flex items-center gap-1 px-1">
          {getPageNumbers().map((p, idx) =>
            p === "..." ? (
              <span key={`dots-${idx}`} className="px-1.5 text-xs opacity-40">
                ...
              </span>
            ) : (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                  currentPage === p
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                    : darkMode
                    ? "hover:bg-slate-800 text-slate-300"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
            darkMode
              ? "border-slate-800 hover:bg-slate-800 text-slate-300"
              : "border-slate-200 hover:bg-slate-100 text-slate-700"
          }`}
          title="Next Page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
