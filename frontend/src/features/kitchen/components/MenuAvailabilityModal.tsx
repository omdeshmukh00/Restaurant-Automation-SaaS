import React, { useState, useEffect } from 'react';
import { getKitchenMenuItems, updateMenuAvailability } from '../api/kitchen.api';

interface MenuAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MenuAvailabilityModal({ isOpen, onClose }: MenuAvailabilityModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, search]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getKitchenMenuItems(search);
      setItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'TEMPORARILY_UNAVAILABLE') => {
    setUpdatingId(id);
    try {
      await updateMenuAvailability(id, status);
      await fetchItems(); // refresh list
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800 font-sans">Menu Availability</h2>
            <p className="text-sm text-slate-500 font-sans mt-1">Quickly toggle item availability to block customer orders.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search menu items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-sans transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-slate-400">
              <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
              Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-slate-400 text-sm font-sans">
              No menu items found.
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {items.map((item) => {
                // Determine current status. Default to AVAILABLE if undefined but isAvailable is true
                let currentStatus = item.availabilityStatus;
                if (!currentStatus) {
                  currentStatus = item.isAvailable ? 'AVAILABLE' : 'OUT_OF_STOCK';
                }

                return (
                  <div key={item.id || item._id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-4">
                      {item.image && (
                        <img src={item.image.startsWith('http') ? item.image : `http://localhost:3000${item.image}`} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                      )}
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm font-sans">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`w-2 h-2 rounded-full ${currentStatus === 'AVAILABLE' ? 'bg-green-500' : currentStatus === 'TEMPORARILY_UNAVAILABLE' ? 'bg-orange-500' : 'bg-red-500'}`} />
                          <span className="text-[11px] font-medium text-slate-500 font-sans">
                            {currentStatus === 'AVAILABLE' ? 'Available' : currentStatus === 'TEMPORARILY_UNAVAILABLE' ? 'Temporarily Unavailable' : 'Out of Stock'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button
                        disabled={updatingId === (item.id || item._id)}
                        onClick={() => handleUpdate(item.id || item._id, 'AVAILABLE')}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold font-sans transition-all ${
                          currentStatus === 'AVAILABLE' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Available
                      </button>
                      <button
                        disabled={updatingId === (item.id || item._id)}
                        onClick={() => handleUpdate(item.id || item._id, 'TEMPORARILY_UNAVAILABLE')}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold font-sans transition-all ${
                          currentStatus === 'TEMPORARILY_UNAVAILABLE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Temp. Unavailable
                      </button>
                      <button
                        disabled={updatingId === (item.id || item._id)}
                        onClick={() => handleUpdate(item.id || item._id, 'OUT_OF_STOCK')}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold font-sans transition-all ${
                          currentStatus === 'OUT_OF_STOCK' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Out of Stock
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
