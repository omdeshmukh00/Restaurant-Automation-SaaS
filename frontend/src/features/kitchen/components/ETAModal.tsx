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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 font-sans">Set Preparation Time</h3>
          <p className="text-xs text-slate-500 font-sans mt-1">Order #{orderId}</p>
        </div>
        
        <div className="p-6">
          <p className="text-sm font-bold text-slate-700 mb-3 font-sans">Estimated Time (Minutes)</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => { setSelectedETA(preset); setIsCustom(false); }}
                className={`py-2 rounded-xl text-sm font-bold font-sans transition-colors ${
                  !isCustom && selectedETA === preset
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
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
                  ? 'bg-orange-50 text-orange-600 border border-orange-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Custom
            </button>
            {isCustom && (
              <input
                type="number"
                min="1"
                placeholder="Mins"
                value={customETA}
                onChange={(e) => setCustomETA(e.target.value)}
                className="flex-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 font-sans"
              />
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors font-sans"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-orange-600 shadow-md shadow-orange-200 hover:bg-orange-700 active:scale-95 transition-all font-sans"
          >
            Accept Order
          </button>
        </div>
      </div>
    </div>
  );
}
