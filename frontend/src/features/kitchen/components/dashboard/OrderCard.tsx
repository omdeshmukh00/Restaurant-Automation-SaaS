import React from 'react';
import { type UIKitchenOrder as KitchenOrder } from '../../pages/KitchenOverviewPage';

interface Props {
  order: KitchenOrder;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onMarkReady?: (id: string) => void;
  onDelay?: (id: string) => void;
  onRush?: (id: string) => void;
  onPickup?: (id: string) => void;
  onAddNote?: (id: string) => void;
  stretch?: boolean;
}

const STATUS_COLORS = {
  new: { border: 'border-l-blue-500', text: 'text-blue-600', bg: 'bg-blue-100', btnPrimary: 'bg-blue-600 hover:bg-blue-700 shadow-blue-100', btnSecondary: 'border-red-200 text-red-500 hover:bg-red-50' },
  preparing: { border: 'border-l-orange-500', text: 'text-orange-600', bg: 'bg-orange-100', btnPrimary: 'bg-orange-600 hover:bg-orange-700 shadow-orange-100', btnSecondary: 'border-orange-200 text-orange-500 hover:bg-orange-50' },
  ready: { border: 'border-l-green-500', text: 'text-green-600', bg: 'bg-green-100', btnPrimary: 'bg-green-600 hover:bg-green-700 shadow-green-100', btnSecondary: '' },
  delayed: { border: 'border-l-red-500', text: 'text-red-600', bg: 'bg-red-100', btnPrimary: 'border-red-200 text-red-500 hover:bg-red-50', btnSecondary: 'border-slate-200 text-slate-500 hover:bg-slate-50' },
  completed: { border: 'border-l-slate-300', text: 'text-slate-500', bg: 'bg-slate-100', btnPrimary: '', btnSecondary: '' },
  cancelled: { border: 'border-l-slate-300', text: 'text-slate-400', bg: 'bg-slate-50', btnPrimary: '', btnSecondary: '' },
};

export default function OrderCard({ order, onAccept, onReject, onMarkReady, onDelay, onRush, onPickup, onAddNote, stretch = false }: Props) {
  const colors = STATUS_COLORS[order.status];

  return (
    <div className={`bg-white dark:bg-slate-900 border-l-4 ${colors.border} rounded-xl shadow-sm p-4 border border-slate-100 dark:border-slate-800 ${stretch ? 'flex flex-col justify-between h-full' : 'h-auto flex flex-col'}`}>
      {/* Top Body */}
      <div className={stretch ? 'flex-1 flex flex-col' : 'flex flex-col'}>
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className="font-bold text-base font-sans text-slate-800 dark:text-white whitespace-nowrap">{order.table}</h4>
            <div className="flex items-center gap-1.5 shrink-0">
              {onAddNote && (
                <button onClick={() => onAddNote(order.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Add Note">
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                </button>
              )}
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium font-sans whitespace-nowrap">{order.timeAgo || order.time}</span>
            </div>
          </div>

          {order.id && (
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 font-mono tracking-tight mb-1">
              {/^[0-9a-fA-F]{24}$/.test(order.id) ? `#${order.id.slice(-6).toUpperCase()}` : order.id}
            </div>
          )}

          {order.serviceFlags && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {order.serviceFlags.isVip && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 uppercase tracking-wider">VIP</span>
              )}
              {order.serviceFlags.isRush && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 uppercase tracking-wider">RUSH</span>
              )}
              {order.serviceFlags.allergyAlert && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 uppercase tracking-wider">ALLERGY</span>
              )}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 mb-3 font-sans">
          {order.items.map((item, i) => (
            <p key={i}>{item.qty} × {item.name}</p>
          ))}
        </div>

        {/* Progress Bar (Preparing) */}
        {order.status === 'preparing' && order.progress !== undefined && (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full transition-all" style={{ width: `${order.progress}%` }} />
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-3 font-sans">{order.progress}%</span>
            </div>
          </div>
        )}

        {/* Delay Info (Delayed) */}
        {order.status === 'delayed' && order.delayMins && (
          <div className="mb-3">
            <p className="text-[11px] font-bold text-red-600 dark:text-red-400 font-sans">{order.delayMins} mins delay</p>
            {order.delayHistory && order.delayHistory.length > 0 && (
              <p className="text-[10px] text-red-500 dark:text-red-400 font-sans mt-0.5">
                Reason: {order.delayHistory[order.delayHistory.length - 1].reason.replace(/_/g, ' ')}
              </p>
            )}
          </div>
        )}

        {/* Internal Notes */}
        {order.internalNotes && order.internalNotes.length > 0 && (
          <div className="mb-3 p-2 bg-yellow-50/50 dark:bg-yellow-950/30 border border-yellow-200/50 dark:border-yellow-900/40 rounded-lg space-y-1.5">
            {order.internalNotes.slice(-2).map((note: any, idx: number) => (
              <div key={idx} className="text-[10px] font-sans">
                <span className="font-bold text-yellow-800 dark:text-yellow-300">{note.authorName}: </span>
                <span className="text-yellow-700 dark:text-yellow-200">{note.content}</span>
              </div>
            ))}
            {order.internalNotes.length > 2 && (
              <div className="text-[9px] text-yellow-600 dark:text-yellow-400 font-bold font-sans">
                +{order.internalNotes.length - 2} more notes
              </div>
            )}
          </div>
        )}

        {/* Table & Type */}
        <div className={`flex items-center gap-2 text-[10px] mb-3 font-sans ${stretch ? 'mt-auto' : 'mt-1'}`}>
          <span className={`font-bold ${colors.text} capitalize`}>{order.type.replace('-', ' ')}</span>
          {order.chef && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-400 dark:text-slate-400">{order.chef.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={stretch ? 'mt-auto pt-2 shrink-0' : 'pt-2 shrink-0'}>
        {order.status === 'new' && (
          <div className="flex flex-col min-[380px]:flex-row lg:flex-col xl:flex-col min-[1400px]:flex-row gap-2">
            <button onClick={() => onReject?.(order.id)} className={`flex-1 py-1.5 border dark:border-slate-700 dark:bg-slate-800/80 rounded-lg text-xs font-bold font-sans ${colors.btnSecondary}`}>Reject</button>
            <button onClick={() => onAccept?.(order.id)} className={`flex-1 py-1.5 text-white rounded-lg text-xs font-bold shadow-md font-sans ${colors.btnPrimary}`}>Accept</button>
          </div>
        )}
        {order.status === 'preparing' && (
          <div className="flex flex-col min-[380px]:flex-row lg:flex-col xl:flex-col min-[1400px]:flex-row gap-2">
            <button onClick={() => onDelay?.(order.id)} className={`flex-1 py-1.5 border dark:border-slate-700 dark:bg-slate-800/80 rounded-lg text-xs font-bold font-sans flex items-center justify-center gap-1 ${colors.btnSecondary}`}>
              <span className="material-symbols-outlined text-[14px]">schedule</span> Delay
            </button>
            <button onClick={() => onMarkReady?.(order.id)} className={`flex-1 py-1.5 text-white rounded-lg text-xs font-bold shadow-md font-sans ${colors.btnPrimary}`}>Mark Ready</button>
          </div>
        )}
        {order.status === 'ready' && (
          <button onClick={() => onPickup?.(order.id)} className={`w-full py-2 text-white rounded-lg text-xs font-bold font-sans ${colors.btnPrimary}`}>Ready for Pickup</button>
        )}
        {order.status === 'delayed' && (
          <div className="flex flex-col min-[380px]:flex-row lg:flex-col xl:flex-col min-[1400px]:flex-row gap-2">
            <button onClick={() => onRush?.(order.id)} className="flex-1 py-1.5 border border-red-200 dark:border-red-900/50 text-red-500 dark:text-red-400 dark:bg-slate-800/80 rounded-lg text-xs font-bold font-sans flex items-center justify-center gap-1">⚡ Rush</button>
            <button className="flex-1 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 dark:bg-slate-800/80 rounded-lg text-xs font-bold font-sans">Delay Info</button>
          </div>
        )}
      </div>
    </div>
  );
}
