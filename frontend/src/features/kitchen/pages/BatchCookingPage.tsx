import React, { useState } from 'react';
import { useKitchenSearch } from '../components/dashboard/KitchenSearchContext';
import { useKitchenDashboard } from '../hooks/useKitchenDashboard';
import { createKitchenBatch, updateKitchenBatchStatus } from '../api/kitchen.api';

export default function BatchCookingPage() {
  const { query } = useKitchenSearch();
  const { batchesById, batchIds, suggestedBatches, refreshDashboard } = useKitchenDashboard();
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {tab === 'suggested' && filteredSuggested.map((batch: any, index: number) => (
          <div key={index} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800 font-sans">{batch.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold font-sans">Suggested Batch</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase text-blue-600 bg-blue-100">
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
          <div key={batch._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800 font-sans">{batch.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold font-sans">{batch._id}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase text-orange-600 bg-orange-100">
                {batch.status}
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
          <div key={batch._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow opacity-75">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800 font-sans">{batch.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold font-sans">{batch._id}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase text-green-600 bg-green-100">
                {batch.status}
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
