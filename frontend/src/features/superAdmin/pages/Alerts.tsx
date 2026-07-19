// AlertsDashboard.tsx  ← main page component
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAlerts } from '../hooks/usealerts';
import Header from '../components/Alerts/Header';
import StatsGrid from '../components/Alerts/Statsgrid';
import Toolbar from '../components/Alerts/Toolbar';
import AlertCard from '../components/Alerts/Alertcard';
import EmptyState from '../components/Alerts/Emptystate';
import { cx } from '../utils/Alertutils';
import TablePagination from '../components/common/TablePagination';

export default function AlertsDashboard() {
  const { darkMode, toggleTheme } = useOutletContext<{ darkMode: boolean; toggleTheme: () => void }>();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const {
    alerts,
    filteredAlerts,
    stats,
    activeFilter,
    setActiveFilter,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    dismissAlert,
    acknowledgeAlert,
    resolveAlert,
    markAllRead,
    dismissAll,
  } = useAlerts();

  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery, sortOrder]);

  const paginatedAlerts = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAlerts.slice(start, start + pageSize);
  }, [filteredAlerts, currentPage, pageSize]);

  // Determine empty state type
  const emptyType = alerts.length === 0
    ? 'all-clear'
    : searchQuery.trim()
      ? 'no-results'
      : 'filtered-empty';

  return (
    <div className={cx(
      'min-h-screen font-sans antialiased transition-colors duration-300 py-6',
      darkMode ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'
    )}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Header darkMode={darkMode} toggleTheme={toggleTheme} newCount={stats.new} />
        <StatsGrid stats={stats} darkMode={darkMode} />
        <Toolbar
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onMarkAllRead={markAllRead}
          onDismissAll={dismissAll}
          newCount={stats.new}
          darkMode={darkMode}
        />

        {/* Alert list container */}
        <div className={`rounded-2xl border overflow-hidden shadow-sm p-4 ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
        }`}>
          <div className="max-h-[620px] overflow-auto pr-1 space-y-3">
            {paginatedAlerts.length > 0 ? (
              paginatedAlerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  darkMode={darkMode}
                  onDismiss={dismissAlert}
                  onAcknowledge={acknowledgeAlert}
                  onResolve={resolveAlert}
                />
              ))
            ) : (
              <EmptyState
                type={emptyType}
                darkMode={darkMode}
                onReset={() => {
                  setActiveFilter('all');
                  setSearchQuery('');
                }}
              />
            )}
          </div>

          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filteredAlerts.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            darkMode={darkMode}
            itemLabel="alerts"
          />
        </div>
      </div>
    </div>
  );
}