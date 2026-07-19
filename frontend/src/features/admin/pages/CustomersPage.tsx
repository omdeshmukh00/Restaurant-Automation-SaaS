import React, { useEffect } from 'react';
import { useCustomersStore, type SpendFilter } from '../store/customers.store';
import {
  CustomersHeader,
  CustomersStatCards,
  CustomersFilterBar,
  CustomersTable,
  CustomersPagination,
  TopCustomersPanel,
  CustomerOverviewChart,
  LoyaltyTierChart,
  EditCustomerModal,
  DeleteCustomerModal,
} from '../components/customers';

const SPEND_THRESHOLDS: Record<SpendFilter, number> = {
  All: 0,
  above500: 500,
  above1000: 1000,
  above2000: 2000,
  above5000: 5000,
};

export function CustomersPage() {
  const {
    customers,
    searchQuery,
    activeStatusFilter,
    activeTierFilter,
    activeSpendFilter,
    currentPage,
    perPage,
    loading,
    error,
    fetchCustomers,
  } = useCustomersStore();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Filter
  const filtered = customers.filter((c) => {
    const matchStatus = activeStatusFilter === 'All' || c.status === activeStatusFilter;
    const matchTier   = activeTierFilter   === 'All' || c.loyaltyTier === activeTierFilter;
    const q           = searchQuery.toLowerCase();
    const matchSearch = !q
      || c.name.toLowerCase().includes(q)
      || c.email.toLowerCase().includes(q)
      || c.phone.toLowerCase().includes(q);
    const matchSpend = c.totalSpentRaw >= SPEND_THRESHOLDS[activeSpendFilter];
    return matchStatus && matchTier && matchSearch && matchSpend;
  });

  // Paginate
  const paginated = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Page header */}
      <CustomersHeader />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {loading && !error && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Loading customers…
        </div>
      )}

      {/* 2. Stat cards */}
      <CustomersStatCards />

      {/* 3. Main content
            Mobile / tablet : stack vertically (sidebar below table)
            lg+             : side-by-side (sidebar fixed width on right)
      */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 items-start">
        {/* Left: Table card */}
        <div className="w-full min-w-0 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <CustomersFilterBar />
          <CustomersTable customers={paginated} />
          <CustomersPagination totalFiltered={filtered.length} />
        </div>

        {/* Right sidebar — full width on mobile, fixed on lg */}
        <div className="w-full lg:w-64 xl:w-72 lg:flex-shrink-0 space-y-4">
          <TopCustomersPanel />
          <CustomerOverviewChart />
          <LoyaltyTierChart />
        </div>
      </div>

      {/* Edit / Remove customer dialogs */}
      <EditCustomerModal />
      <DeleteCustomerModal />
    </div>
  );
}