import React, { useState } from 'react';

interface ETAModalProps {
  isOpen: boolean;
  orderId: string | null;
  onConfirm: (eta: number) => void;
  onCancel: () => void;
}

const PRESETS = [5, 10, 15, 20, 25, 30];

export default function ETAModal({ isOpen, orderId, onConfirm, onCancel }: ETAModalProps) {
  const [selectedETA, setSelectedETA] = useState<number>(15);
  const [customETA, setCustomETA] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    let eta = isCustom ? parseInt(customETA, 10) : selectedETA;
    if (isNaN(eta) || eta <= 0) eta = 15;
    onConfirm(eta);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-sm overflow-hidden text-slate-800 dark:text-slate-100 animate-scaleUp">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white font-sans">Set Preparation Time</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">Order #{orderId}</p>
        </div>
        
        <div className="p-6">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 font-sans">Estimated Time (Minutes)</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => { setSelectedETA(preset); setIsCustom(false); }}
                className={`py-2 rounded-xl text-sm font-bold font-sans transition-colors ${
                  !isCustom && selectedETA === preset
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-200 dark:shadow-none'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => { setIsCustom(true); }}
              className={`flex-1 py-2 rounded-xl text-sm font-bold font-sans transition-colors ${
                isCustom
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Custom
            </button>
            {isCustom && (
              <input
                type="number"
                min="1"
                max="180"
                value={customETA}
                onChange={(e) => setCustomETA(e.target.value)}
                className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl text-sm font-bold font-sans text-center focus:outline-orange-500"
                placeholder="Mins"
              />
            )}
          </div>
        </div>

        <div className="flex gap-2 p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-xs font-bold font-sans transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold font-sans transition-all shadow-md"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
