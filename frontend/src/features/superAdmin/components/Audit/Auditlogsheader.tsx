import React, { useState } from 'react';
import { Download, List, LayoutGrid, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';

interface AuditLogsHeaderProps {
  darkMode: boolean;
  activeTab: 'audit' | 'details';
  onTabChange: (tab: 'audit' | 'details') => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export default function AuditLogsHeader({
  darkMode,
  activeTab,
  onTabChange,
  onExportCSV,
  onExportPDF,
}: AuditLogsHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Audit & Details</h1>
        <p className={`text-xs sm:text-sm mt-1 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Complete activity tracking, detailed logs, real IP monitoring & security analytics.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Double Tab Switcher */}
        <div className={`flex p-1 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
          <button
            onClick={() => onTabChange('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-orange-600 text-white shadow-md'
                : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Audit
          </button>

          <button
            onClick={() => onTabChange('details')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'details'
                ? 'bg-orange-600 text-white shadow-md'
                : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Details
          </button>
        </div>

        {/* Export Options Menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export Logs
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {dropdownOpen && (
            <div
              className={`absolute right-0 mt-2 w-44 rounded-xl border shadow-xl py-1.5 z-20 ${
                darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onExportCSV();
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold transition-colors ${
                  darkMode ? 'hover:bg-slate-800 text-emerald-400' : 'hover:bg-slate-50 text-emerald-600'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV (.csv)
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onExportPDF();
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold transition-colors ${
                  darkMode ? 'hover:bg-slate-800 text-blue-400' : 'hover:bg-slate-50 text-blue-600'
                }`}
              >
                <FileText className="w-4 h-4" />
                Export PDF (.pdf)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}