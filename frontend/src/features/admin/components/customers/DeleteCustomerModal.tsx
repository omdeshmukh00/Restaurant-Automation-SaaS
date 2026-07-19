import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useCustomersStore } from '../../store/customers.store';

export function DeleteCustomerModal() {
  const deletingCustomer = useCustomersStore((s) => s.deletingCustomer);
  const setDeletingCustomer = useCustomersStore((s) => s.setDeletingCustomer);
  const removeCustomer = useCustomersStore((s) => s.removeCustomer);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  if (!deletingCustomer) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await removeCustomer(deletingCustomer.id);
      setDeletingCustomer(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to remove customer');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setDeletingCustomer(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 w-full h-full cursor-default"
        onClick={handleClose}
      />

      <div
        className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-5 sm:p-6 w-full sm:max-w-sm sm:mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-customer-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="delete-customer-title"
            className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Remove Customer
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          Are you sure you want to remove{' '}
          <span className="font-semibold text-gray-800 dark:text-gray-100">{deletingCustomer.name}</span>?
          This will permanently delete their account and analytics, and cannot be undone.
        </p>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 font-medium mt-3">{error}</p>
        )}

        <div className="flex gap-2 pt-1 mt-5">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-70"
          >
            {submitting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
