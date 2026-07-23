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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 font-sans">Add Chef Note</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto">
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2 font-sans">
              Internal Note for Order #{orderId}
            </label>
            <textarea
              className="w-full border border-slate-200 rounded-lg p-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="E.g. Customer allergic to peanuts..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-500 mt-2 font-sans">
              This note is only visible to kitchen and management staff. It will not appear on the customer bill.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100 mt-4">
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
              disabled={isSubmitting || !content.trim()}
              className="px-4 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg font-sans transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
