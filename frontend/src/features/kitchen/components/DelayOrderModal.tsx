import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (delayMinutes: number, reason: string) => Promise<void>;
  orderId: string;
}

const REASONS = [
  { value: 'HIGH_LOAD', label: 'High Kitchen Load' },
  { value: 'INGREDIENT_SHORTAGE', label: 'Ingredient Shortage' },
  { value: 'EQUIPMENT_ISSUE', label: 'Equipment Issue' },
  { value: 'COMPLEX_ORDER', label: 'Complex Order' },
  { value: 'OTHER', label: 'Other Reason' },
];

export default function DelayOrderModal({ isOpen, onClose, onConfirm, orderId }: Props) {
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [reason, setReason] = useState('HIGH_LOAD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delayMinutes <= 0) return;

    try {
      setIsSubmitting(true);
      await onConfirm(delayMinutes, reason);
      setDelayMinutes(15);
      setReason('HIGH_LOAD');
      onClose();
    } catch (error) {
      console.error('Failed to delay order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-100">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white font-sans">Delay Order #{orderId}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 font-sans">
              Delay Duration (Minutes)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl p-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(parseInt(e.target.value, 10) || 0)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 font-sans">
              Reason for Delay
            </label>
            <select
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl p-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value} className="dark:bg-slate-800 dark:text-white">
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || delayMinutes <= 0}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              Confirm Delay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
