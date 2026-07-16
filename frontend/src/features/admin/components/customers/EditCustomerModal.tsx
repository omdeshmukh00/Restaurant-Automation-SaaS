import React, { useEffect, useState } from 'react';
import { X, Check, Pencil } from 'lucide-react';
import { useCustomersStore } from '../../store/customers.store';

interface FormState {
  name: string;
  email: string;
}

export function EditCustomerModal() {
  const editingCustomer = useCustomersStore((s) => s.editingCustomer);
  const setEditingCustomer = useCustomersStore((s) => s.setEditingCustomer);
  const updateCustomer = useCustomersStore((s) => s.updateCustomer);

  const [form, setForm]       = useState<FormState>({ name: '', email: '' });
  const [error, setError]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    if (editingCustomer) {
      setForm({ name: editingCustomer.name, email: editingCustomer.email });
      setError('');
      setSaved(false);
    }
  }, [editingCustomer]);

  if (!editingCustomer) return null;

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Full name is required.'); return; }
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email)) {
      setError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await updateCustomer(editingCustomer.id, {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setEditingCustomer(null), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update customer');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setEditingCustomer(null);
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
        className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-5 sm:p-6 w-full sm:max-w-md sm:mx-4 max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-customer-title"
      >
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2
            id="edit-customer-title"
            className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2"
          >
            <Pencil className="w-4 h-4 text-orange-500" />
            Edit Customer
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

        {saved ? (
          <div className="flex flex-col items-center py-8 sm:py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-3">
              <Check className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-base font-bold text-gray-900 dark:text-white">Customer Updated!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {form.name}'s details have been saved.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="edit-name"
                className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1"
              >
                Full Name
              </label>
              <input
                id="edit-name"
                type="text"
                placeholder="e.g. Priya Sharma"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="edit-email"
                className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1"
              >
                Email Address (optional)
              </label>
              <input
                id="edit-email"
                type="email"
                placeholder="customer@email.com"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 transition-all"
              />
            </div>

            {/* Phone (read-only — mobile is the account key and cannot be changed) */}
            <div>
              <label
                htmlFor="edit-phone"
                className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1"
              >
                Phone Number
              </label>
              <input
                id="edit-phone"
                type="tel"
                value={editingCustomer.phone}
                disabled
                className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 dark:text-gray-500 cursor-not-allowed"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
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
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors disabled:opacity-70"
              >
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
