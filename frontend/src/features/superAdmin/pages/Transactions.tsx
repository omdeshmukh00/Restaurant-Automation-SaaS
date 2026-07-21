import { useState, useMemo, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { StatusFilter, SortField, SortOrder, DateRange, Transaction } from "../components/Transactions/Transactiontypes";
import { filterByDateRange, computeMetrics, exportToCSV, exportToPDF } from "../utils/transactionUtils";
import TransactionMetrics from "../components/Transactions/Transactionmetrics";
import TransactionControls from "../components/Transactions/Transactioncontrols";
import TransactionTable from "../components/Transactions/Transactiontable";
import TransactionSummaryBar from "../components/Transactions/Transactionsummarybar";
import { superAdminRestaurantRequestsApi } from "../api/superAdmin.api";

import TablePagination from "../components/common/TablePagination";

interface LayoutContextType {
  darkMode: boolean;
}

export default function Transactions() {
  const { darkMode } = useOutletContext<LayoutContextType>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const handleThemeSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail !== undefined) {
        if (customEvent.detail.darkMode) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };
    window.addEventListener("sync-app-theme", handleThemeSync);

    const fetchTransactions = async () => {
      try {
        const txs = await superAdminRestaurantRequestsApi.getTransactions();
        setTransactions(txs);
      } catch (error) {
        console.error("Failed to fetch transactions", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();

    return () => window.removeEventListener("sync-app-theme", handleThemeSync);
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, paymentFilter, dateRange, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleResetAll = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setPaymentFilter("All");
    setDateRange("all");
  };

  const dateFiltered = useMemo(
    () => filterByDateRange(transactions, dateRange),
    [transactions, dateRange]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return dateFiltered.filter((tx) => {
      const matchesSearch =
        tx.id.toLowerCase().includes(q) ||
        tx.restaurant.toLowerCase().includes(q) ||
        tx.city.toLowerCase().includes(q) ||
        tx.restaurantId.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || tx.status === statusFilter;
      const matchesPayment = paymentFilter === "All" || tx.paymentMethod === paymentFilter;
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [dateFiltered, searchTerm, statusFilter, paymentFilter]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      if (sortField === "timestamp") {
        return sortOrder === "asc"
          ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      if (sortField === "restaurant") {
        return sortOrder === "asc"
          ? a.restaurant.localeCompare(b.restaurant)
          : b.restaurant.localeCompare(a.restaurant);
      }
      const va = a[sortField] as number;
      const vb = b[sortField] as number;
      return sortOrder === "asc" ? va - vb : vb - va;
    });
  }, [filteredTransactions, sortField, sortOrder]);

  const metrics = useMemo(() => computeMetrics(filteredTransactions), [filteredTransactions]);
  const handleExportCSV = () => exportToCSV(sortedTransactions, "transactions-export.csv");
  const handleExportPDF = () => exportToPDF(sortedTransactions);

  return (
    // px-4 on mobile → px-6 on desktop, slightly tighter top padding on mobile
    <div className={`min-h-screen px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 transition-colors duration-300 ${
      darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"
    }`}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transactions</h1>
          <p className={`text-xs sm:text-sm mt-1 font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            Monitor platform payments, commissions, and transaction logs.
          </p>
        </div>
      </div>

      <TransactionMetrics metrics={metrics} darkMode={darkMode} />
      <TransactionControls
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        paymentFilter={paymentFilter}
        dateRange={dateRange}
        darkMode={darkMode}
        totalCount={transactions.length}
        filteredCount={filteredTransactions.length}
        onSearchChange={setSearchTerm}
        onStatusChange={setStatusFilter}
        onPaymentChange={setPaymentFilter}
        onDateRangeChange={setDateRange}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        onResetAll={handleResetAll}
      />
      <div className={`rounded-2xl border overflow-hidden shadow-sm my-4 ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
      }`}>
        <div className="max-h-[620px] overflow-auto">
          <TransactionTable
            transactions={sortedTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
            darkMode={darkMode}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        </div>
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={sortedTransactions.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          darkMode={darkMode}
          itemLabel="transactions"
        />
      </div>
      <TransactionSummaryBar
        metrics={metrics}
        darkMode={darkMode}
        filteredCount={filteredTransactions.length}
      />
    </div>
  );
}
