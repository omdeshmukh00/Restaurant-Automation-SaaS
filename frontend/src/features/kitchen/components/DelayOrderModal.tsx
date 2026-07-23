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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 font-sans">Delay Order #{orderId}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 font-sans">
              Delay Duration (Minutes)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              className="w-full border border-slate-200 rounded-lg p-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 font-sans">
              Reason for Delay
            </label>
            <select
              className="w-full border border-slate-200 rounded-lg p-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg font-sans transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || delayMinutes <= 0}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg font-sans transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isSubmitting ? 'Delaying...' : (
                <>
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  Confirm Delay
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
