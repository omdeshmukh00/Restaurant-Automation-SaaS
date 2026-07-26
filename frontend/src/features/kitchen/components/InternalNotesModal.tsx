import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
  orderId: string;
}

export default function InternalNotesModal({ isOpen, onClose, onSave, orderId }: Props) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setIsSubmitting(true);
      await onSave(content);
      setContent('');
      onClose();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-100">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white font-sans">Add Chef Note</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto">
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 font-sans">
              Internal Note for Order #{orderId}
            </label>
            <textarea
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl p-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none placeholder-slate-400 dark:placeholder-slate-500"
              rows={4}
              placeholder="E.g. Customer allergic to peanuts..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-sans">
              This note is only visible to kitchen and management staff. It will not appear on the customer bill.
            </p>
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
              disabled={isSubmitting || !content.trim()}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              Save Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
