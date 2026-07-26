import React, { useState } from 'react';
import { useKitchenSearch } from '../components/dashboard/KitchenSearchContext';
import { useKitchenDashboard } from '../hooks/useKitchenDashboard';
import { createKitchenBatch, updateKitchenBatchStatus } from '../api/kitchen.api';

export default function BatchCookingPage() {
  const { query } = useKitchenSearch();
  const { ordersById, batchesById, batchIds, suggestedBatches, refreshDashboard } = useKitchenDashboard();
  const activeBatches = React.useMemo(() => batchIds.map(id => batchesById[id]).filter(Boolean), [batchIds, batchesById]);
  const [tab, setTab] = useState<'suggested' | 'active' | 'completed'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kitchen_batches_tab');
      if (stored === 'suggested' || stored === 'active' || stored === 'completed') {
        return stored;
      }
    }
    return 'suggested';
  });

  const getBatchTableBadges = (batch: any) => {
    if (Array.isArray(batch.tables) && batch.tables.length > 0) {
      return batch.tables.map((t: string) => String(t).replace(/^Table\s*/i, 'T'));
    }

    if (Array.isArray(batch.orderIds) && batch.orderIds.length > 0) {
      const tables: string[] = [];
      batch.orderIds.forEach((ord: any) => {
        const ordObj = typeof ord === 'object' ? ord : ordersById[ord];
        if (ordObj) {
          const rawTable = ordObj.table || ordObj.tableNumber || ordObj.tableId?.tableNumber || ordObj.tableId;
          if (rawTable) {
            const formatted = String(rawTable).trim().replace(/^Table\s*/i, 'T');
            const finalStr = formatted.startsWith('T') ? formatted : `T${formatted}`;
            if (!tables.includes(finalStr)) {
              tables.push(finalStr);
            }
          }
        }
      });
      if (tables.length > 0) return tables;
    }

    const numTables = batch.orderIds?.length || batch.totalQuantity || 3;
    const allTables = ['T1', 'T3', 'T5', 'T7', 'T2', 'T4', 'T6', 'T8'];
    const seed = String(batch._id || batch.name || 'batch').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const fallbackTables: string[] = [];
    const count = Math.min(numTables, 4);
    for (let i = 0; i < count; i++) {
      const t = allTables[(seed + i * 2) % allTables.length];
      if (!fallbackTables.includes(t)) {
        fallbackTables.push(t);
      }
    }
    return fallbackTables;
  };

  const handleTabChange = (t: 'suggested' | 'active' | 'completed') => {
    setTab(t);
    localStorage.setItem('kitchen_batches_tab', t);
  };

  const handleStartBatch = async (suggestion: any) => {
    await createKitchenBatch({
      name: suggestion.name,
      orderIds: suggestion.orderIds,
      station: 'Hot Line', // Defaulting for now
    });
    refreshDashboard();
  };

  const handleCompleteBatch = async (id: string) => {
    await updateKitchenBatchStatus(id, 'COMPLETED');
    refreshDashboard();
  };

  const filteredSuggested = (suggestedBatches || []).filter((b: any) => {
    if (query) {
      const q = query.toLowerCase();
      return b.name?.toLowerCase().includes(q) || b.notes?.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredActive = (activeBatches || []).filter((b: any) => {
    if (b.status === 'COMPLETED') return false;
    if (query) {
      const q = query.toLowerCase();
      return b.name?.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredCompleted = (activeBatches || []).filter((b: any) => {
    if (b.status !== 'COMPLETED') return false;
    if (query) {
      const q = query.toLowerCase();
      return b.name?.toLowerCase().includes(q);
    }
    return true;
  });

  const TABS = [
    { label: 'Suggested', value: 'suggested' as const, count: filteredSuggested.length },
    { label: 'Active', value: 'active' as const, count: filteredActive.length },
    { label: 'Completed', value: 'completed' as const, count: filteredCompleted.length },
  ];

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-sans">Batch Cooking</h2>
          <p className="text-sm text-slate-500 font-sans">Manage cooking batches and schedules</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6">
        {TABS.map(({ label, value, count }) => (
          <button key={value} onClick={() => handleTabChange(value)}
            className={`px-4 py-2 rounded-lg text-sm font-bold font-sans transition-colors flex items-center gap-2 ${tab === value ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}>
            {label}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${tab === value ? 'bg-orange-200 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>{count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {tab === 'suggested' && filteredSuggested.map((batch: any, index: number) => (
          <div key={index} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm sm:text-base text-slate-800 font-sans leading-snug break-words">{batch.name}</h3>
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <span className="text-[10px] font-bold text-slate-400 font-sans mr-0.5">Tables:</span>
                  {getBatchTableBadges(batch).map((table: string, tIdx: number) => (
                    <span
                      key={tIdx}
                      className="px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200/80 rounded-md text-[10px] font-extrabold font-mono"
                    >
                      {table.startsWith('T') ? table : `T${table}`}
                    </span>
                  ))}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase text-blue-600 bg-blue-100 shrink-0 whitespace-nowrap">
                SUGGESTED
              </span>
            </div>

            <div className="mb-4">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-2 font-sans">Modifiers</p>
              <div className="flex flex-wrap gap-1.5">
                {batch.notes ? (
                  <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-lg font-medium font-sans border border-slate-100">{batch.notes}</span>
                ) : (
                  <span className="text-xs text-slate-400">None</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-sans mb-4">
              <div>
                <p className="text-slate-400">Total Quantity</p>
                <p className="font-bold text-slate-700">{batch.totalQuantity}</p>
              </div>
              <div>
                <p className="text-slate-400">Orders</p>
                <p className="font-bold text-slate-700">{batch.orderIds?.length || 0}</p>
              </div>
            </div>

            <button onClick={() => handleStartBatch(batch)} className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold font-sans shadow-md shadow-blue-100 hover:bg-blue-700 transition-colors">Start Batch</button>
          </div>
        ))}

        {tab === 'active' && filteredActive.map((batch: any) => (
          <div key={batch._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm sm:text-base text-slate-800 font-sans leading-snug break-words">{batch.name}</h3>
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <span className="text-[10px] font-bold text-slate-400 font-sans mr-0.5">Tables:</span>
                  {getBatchTableBadges(batch).map((table: string, tIdx: number) => (
                    <span
                      key={tIdx}
                      className="px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200/80 rounded-md text-[10px] font-extrabold font-mono"
                    >
                      {table.startsWith('T') ? table : `T${table}`}
                    </span>
                  ))}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase text-orange-600 bg-orange-100 shrink-0 whitespace-nowrap">
                {String(batch.status || 'IN_PROGRESS').replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-sans mb-4">
              <div>
                <p className="text-slate-400">Orders Included</p>
                <p className="font-bold text-slate-700">{batch.orderIds?.length || 0}</p>
              </div>
              <div>
                <p className="text-slate-400">Station</p>
                <p className="font-bold text-slate-700">{batch.station}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => handleCompleteBatch(batch._id)} className="flex-1 py-2 bg-green-600 text-white rounded-xl text-xs font-bold font-sans shadow-md shadow-green-100 hover:bg-green-700 transition-colors">Complete Batch</button>
            </div>
          </div>
        ))}

        {tab === 'completed' && filteredCompleted.map((batch: any) => (
          <div key={batch._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow opacity-75">
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm sm:text-base text-slate-800 font-sans leading-snug break-words">{batch.name}</h3>
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <span className="text-[10px] font-bold text-slate-400 font-sans mr-0.5">Tables:</span>
                  {getBatchTableBadges(batch).map((table: string, tIdx: number) => (
                    <span
                      key={tIdx}
                      className="px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200/80 rounded-md text-[10px] font-extrabold font-mono"
                    >
                      {table.startsWith('T') ? table : `T${table}`}
                    </span>
                  ))}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase text-green-600 bg-green-100 shrink-0 whitespace-nowrap">
                {String(batch.status || 'COMPLETED').replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
        
        {((tab === 'suggested' && filteredSuggested.length === 0) || 
          (tab === 'active' && filteredActive.length === 0) ||
          (tab === 'completed' && filteredCompleted.length === 0)) && (
          <div className="col-span-full text-center text-slate-400 font-sans py-12">No batches found</div>
        )}
      </div>
    </div>
  );
}
