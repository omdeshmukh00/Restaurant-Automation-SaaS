import React, { useState, useEffect } from 'react';
import { useKitchenSearch } from '../components/dashboard/KitchenSearchContext';
import { getKitchenLoad } from '../api/kitchen.api';

export interface KitchenStation {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'maintenance';
  chef: string;
  activeOrders: number;
  load: number;
  currentItems: string[];
  avgPrepTime: string;
}

const DEFAULT_STATIONS: KitchenStation[] = [
  { id: 'STN-1', name: 'Tandoor Station', type: 'Grill & Oven', status: 'active', chef: 'Chef Vikram', activeOrders: 5, load: 75, currentItems: ['Chicken Tikka', 'Naan'], avgPrepTime: '12m' },
  { id: 'STN-2', name: 'Bar & Beverages', type: 'Beverage Bar', status: 'active', chef: 'Barista Rahul', activeOrders: 3, load: 45, currentItems: ['Mojito', 'Mango Lassi'], avgPrepTime: '5m' },
  { id: 'STN-3', name: 'Main Kitchen', type: 'Curry & Mains', status: 'active', chef: 'Chef Arjun', activeOrders: 8, load: 88, currentItems: ['Butter Chicken', 'Paneer Butter Masala'], avgPrepTime: '15m' },
  { id: 'STN-4', name: 'Grill Station', type: 'Hot Line', status: 'idle', chef: 'Chef Suresh', activeOrders: 0, load: 0, currentItems: [], avgPrepTime: '10m' },
  { id: 'STN-5', name: 'Dessert Counter', type: 'Pastry & Sweets', status: 'active', chef: 'Chef Priya', activeOrders: 2, load: 30, currentItems: ['Gulab Jamun', 'Tiramisu'], avgPrepTime: '8m' },
];

const PRESET_STATIONS = [
  { name: 'Bar & Beverages', type: 'Beverage Bar', icon: 'local_bar', items: ['Mojito', 'Mango Lassi', 'Cold Coffee'] },
  { name: 'Main Kitchen', type: 'Curry & Mains', icon: 'soup_kitchen', items: ['Butter Chicken', 'Paneer Butter Masala', 'Dal Makhani'] },
  { name: 'Tandoor Station', type: 'Grill & Oven', icon: 'skillet', items: ['Chicken Tikka', 'Butter Naan', 'Tandoori Roti'] },
  { name: 'Grill Station', type: 'Hot Line', icon: 'local_fire_department', items: ['Grilled Chicken', 'BBQ Wings', 'Grilled Paneer'] },
  { name: 'Biryani & Rice', type: 'Rice & Biryani', icon: 'rice_bowl', items: ['Chicken Biryani', 'Veg Pulao', 'Jeera Rice'] },
  { name: 'Fry & Appetizers', type: 'Fry Station', icon: 'fastfood', items: ['French Fries', 'Samosa', 'Spring Rolls'] },
  { name: 'Dessert Counter', type: 'Pastry & Sweets', icon: 'icecream', items: ['Gulab Jamun', 'Tiramisu', 'Ice Cream Sundae'] },
];

export default function KitchenStationsPage() {
  const { query } = useKitchenSearch();

  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [aggregateLoad, setAggregateLoad] = useState(0);

  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [newChefName, setNewChefName] = useState<string>('');

  // Edit Modal state
  const [editingStation, setEditingStation] = useState<KitchenStation | null>(null);
  const [editItemInput, setEditItemInput] = useState<string>('');

  // Add Station Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addStationName, setAddStationName] = useState<string>('');
  const [addStationType, setAddStationType] = useState<string>('');
  const [addStationChef, setAddStationChef] = useState<string>('');
  const [addStationPrepTime, setAddStationPrepTime] = useState<string>('10m');
  const [addStationStatus, setAddStationStatus] = useState<'active' | 'idle' | 'maintenance'>('active');
  const [addStationItems, setAddStationItems] = useState<string[]>([]);
  const [newItemInput, setNewItemInput] = useState<string>('');

  useEffect(() => {
    const fetchStations = async () => {
      try {
        setLoading(true);
        const data = await getKitchenLoad();
        
        let mappedStations: KitchenStation[] = [];
        if (Array.isArray(data?.stations) && data.stations.length > 0) {
          mappedStations = data.stations.map((st: any, i: number) => ({
            id: `STN-${i + 1}`,
            name: st.station,
            type: 'Kitchen Station',
            status: st.loadPercent > 0 ? 'active' : 'idle',
            chef: '-',
            activeOrders: data.aggregate?.activeOrdersCount || 0,
            load: st.loadPercent || 0,
            currentItems: [],
            avgPrepTime: '12m'
          }));
        }

        if (mappedStations.length === 0) {
          mappedStations = DEFAULT_STATIONS;
        }

        setStations(mappedStations);
        
        const avg = mappedStations.length > 0 
          ? Math.round(mappedStations.reduce((acc: number, curr: any) => acc + curr.load, 0) / mappedStations.length)
          : 0;
        setAggregateLoad(avg);
      } catch (err) {
        console.error('Failed to load stations', err);
        setStations(DEFAULT_STATIONS);
        setAggregateLoad(48);
      } finally {
        setLoading(false);
      }
    };
    fetchStations();
  }, []);

  const filteredStations = stations.filter(station => {
    if (query) {
      const q = query.toLowerCase();
      return (
        station.name.toLowerCase().includes(q) ||
        station.chef.toLowerCase().includes(q) ||
        station.type.toLowerCase().includes(q) ||
        station.currentItems.some(i => i.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleStatusChange = (id: string, status: 'active' | 'idle' | 'maintenance') => {
    setStations(prev =>
      prev.map(st => {
        if (st.id === id) {
          const loadVal = status === 'active' ? Math.floor(Math.random() * 40) + 40 : 0;
          return {
            ...st,
            status,
            load: loadVal,
            activeOrders: status === 'active' ? Math.floor(Math.random() * 4) + 1 : 0,
            chef: status === 'maintenance' ? '-' : st.chef === '-' ? 'Chef Arjun' : st.chef,
          };
        }
        return st;
      })
    );
  };

  const handleDeleteStation = (id: string) => {
    setStations(prev => prev.filter(st => st.id !== id));
  };

  const handleAssignChefSubmit = (id: string) => {
    setStations(prev =>
      prev.map(st => {
        if (st.id === id) {
          return {
            ...st,
            chef: newChefName || '-',
          };
        }
        return st;
      })
    );
    setEditingStationId(null);
    setNewChefName('');
  };

  const handleAddItemToAddModal = () => {
    if (!newItemInput.trim()) return;
    if (!addStationItems.includes(newItemInput.trim())) {
      setAddStationItems(prev => [...prev, newItemInput.trim()]);
    }
    setNewItemInput('');
  };

  const handleRemoveItemFromAddModal = (itemToRemove: string) => {
    setAddStationItems(prev => prev.filter(i => i !== itemToRemove));
  };

  const handleAddItemToEditModal = () => {
    if (!editingStation || !editItemInput.trim()) return;
    const current = editingStation.currentItems || [];
    if (!current.includes(editItemInput.trim())) {
      setEditingStation({
        ...editingStation,
        currentItems: [...current, editItemInput.trim()],
      });
    }
    setEditItemInput('');
  };

  const handleRemoveItemFromEditModal = (itemToRemove: string) => {
    if (!editingStation) return;
    setEditingStation({
      ...editingStation,
      currentItems: (editingStation.currentItems || []).filter(i => i !== itemToRemove),
    });
  };

  const handleAddStationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStationName.trim()) return;

    const newStation: KitchenStation = {
      id: `STN-${Date.now().toString().slice(-3)}`,
      name: addStationName.trim(),
      type: addStationType.trim() || 'Kitchen Station',
      status: addStationStatus,
      chef: addStationChef.trim() || 'Unassigned',
      activeOrders: addStationStatus === 'active' ? Math.floor(Math.random() * 3) + 1 : 0,
      load: addStationStatus === 'active' ? 50 : 0,
      currentItems: addStationItems,
      avgPrepTime: addStationPrepTime.trim() || '10m',
    };

    setStations(prev => [newStation, ...prev]);
    setAddStationName('');
    setAddStationType('');
    setAddStationChef('');
    setAddStationPrepTime('10m');
    setAddStationStatus('active');
    setAddStationItems([]);
    setNewItemInput('');
    setIsAddModalOpen(false);
  };

  const handleEditStationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStation) return;

    setStations(prev =>
      prev.map(st => (st.id === editingStation.id ? editingStation : st))
    );
    setEditingStation(null);
    setEditItemInput('');
  };

  const selectPreset = (preset: { name: string; type: string; items: string[] }) => {
    setAddStationName(preset.name);
    setAddStationType(preset.type);
    setAddStationItems([...preset.items]);
  };

  // Stats calculation
  const totalStations = stations.length;
  const activeCount = stations.filter(s => s.status === 'active').length;
  const idleCount = stations.filter(s => s.status === 'idle').length;
  const maintenanceCount = stations.filter(s => s.status === 'maintenance').length;
  const avgLoad = aggregateLoad;

  const statusColors = {
    active: 'bg-green-500',
    idle: 'bg-amber-500',
    maintenance: 'bg-red-500',
  };

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto font-sans text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Kitchen Stations Monitor</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Track operational load, assign chefs, and manage prep stations</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-orange-50 dark:bg-orange-950/40 px-4 py-2 rounded-xl border border-orange-100 dark:border-orange-900/50 flex items-center gap-2">
            <span className="text-orange-600 dark:text-orange-400 font-bold text-sm">Average Active Load: {avgLoad}%</span>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Station
          </button>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Total Stations</p>
          <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">{totalStations}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Active</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Idle</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{idleCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Maintenance</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">{maintenanceCount}</p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredStations.map(station => {
          // Color coding load bars
          let loadColor = 'bg-green-500';
          if (station.load > 85) loadColor = 'bg-red-500';
          else if (station.load > 60) loadColor = 'bg-amber-500';

          return (
            <div
              key={station.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow relative min-w-0"
            >
              {/* Header Row 1: Title & Category + Action Buttons */}
              <div className="flex justify-between items-start gap-2 mb-1.5 min-w-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-snug break-words" title={station.name}>
                    {station.name}
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 block truncate">{station.type}</span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-0.5 shrink-0 -mr-1">
                  <button
                    onClick={() => setEditingStation(station)}
                    className="p-1 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg transition-colors"
                    title="Edit Station"
                  >
                    <span className="material-symbols-outlined text-[15px] block">edit</span>
                  </button>

                  <button
                    onClick={() => handleDeleteStation(station.id)}
                    className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    title="Delete Station"
                  >
                    <span className="material-symbols-outlined text-[15px] block">delete</span>
                  </button>
                </div>
              </div>

              {/* Header Row 2: Status Pill */}
              <div className="mb-3">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-slate-200 dark:border-slate-700/80 rounded-full text-[9px] font-bold uppercase select-none bg-slate-50/50 dark:bg-slate-800/50">
                  <div className={`w-1.5 h-1.5 rounded-full ${statusColors[station.status]}`} />
                  <span className="text-slate-600 dark:text-slate-300">{station.status}</span>
                </div>
              </div>

              {/* Load Meter */}
              {station.status === 'active' && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Operational Load</span>
                    <span className="text-slate-700 dark:text-slate-200">{station.load}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${loadColor}`}
                      style={{ width: `${station.load}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Station Info */}
              <div className="space-y-2 mb-3 min-w-0 font-sans">
                {/* Assigned Chef Dedicated Row */}
                <div className="bg-slate-50 dark:bg-slate-800/70 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/70 min-w-0">
                  <p className="text-slate-400 dark:text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Assigned Chef</p>
                  {editingStationId === station.id ? (
                    <div className="flex items-center gap-1 mt-1 min-w-0">
                      <input
                        type="text"
                        defaultValue={station.chef === '-' ? '' : station.chef}
                        onChange={e => setNewChefName(e.target.value)}
                        placeholder="Chef Name"
                        className="px-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded text-xs w-full focus:outline-orange-500 min-w-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                      />
                      <button
                        onClick={() => handleAssignChefSubmit(station.id)}
                        className="px-2 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold shrink-0 shadow-sm"
                      >
                        Set
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1 mt-0.5 min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-xs break-words min-w-0" title={station.chef}>
                        {station.chef || 'Unassigned'}
                      </span>
                      {station.status !== 'maintenance' && (
                        <button
                          onClick={() => {
                            setEditingStationId(station.id);
                            setNewChefName(station.chef);
                          }}
                          className="text-orange-500 hover:text-orange-600 shrink-0 p-0.5 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded"
                          title="Quick Edit Chef"
                        >
                          <span className="material-symbols-outlined text-[14px] block">edit</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 3-column stats bar */}
                <div className="grid grid-cols-3 gap-1 text-[11px] min-w-0 bg-slate-50/60 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-center">
                  <div className="min-w-0">
                    <p className="text-slate-400 dark:text-slate-400 font-semibold text-[9px] uppercase tracking-tight">Active</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5 text-xs truncate">{station.activeOrders} Orders</p>
                  </div>
                  <div className="min-w-0 border-x border-slate-200/60 dark:border-slate-700/60">
                    <p className="text-slate-400 dark:text-slate-400 font-semibold text-[9px] uppercase tracking-tight">Prep Time</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5 text-xs truncate">{station.avgPrepTime}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-400 dark:text-slate-400 font-semibold text-[9px] uppercase tracking-tight">ID</p>
                    <p className="font-bold text-slate-400 dark:text-slate-400 mt-0.5 text-[10px] truncate">{station.id}</p>
                  </div>
                </div>
              </div>

              {/* Current cooking items list */}
              {station.currentItems && station.currentItems.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase mb-1">Current Items</p>
                  <div className="flex flex-wrap gap-1">
                    {station.currentItems.map((item: string, iIdx: number) => (
                      <span
                        key={iIdx}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate max-w-full"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex gap-1.5">
                <button
                  onClick={() => handleStatusChange(station.id, 'active')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                    station.status === 'active'
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
                      : 'bg-white dark:bg-slate-800/50 text-slate-400 dark:text-slate-400 border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => handleStatusChange(station.id, 'idle')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                    station.status === 'idle'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-white dark:bg-slate-800/50 text-slate-400 dark:text-slate-400 border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Idle
                </button>
                <button
                  onClick={() => handleStatusChange(station.id, 'maintenance')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                    station.status === 'maintenance'
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                      : 'bg-white dark:bg-slate-800/50 text-slate-400 dark:text-slate-400 border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Repair
                </button>
              </div>
            </div>
          );
        })}
        {filteredStations.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[48px] mb-2">soup_kitchen</span>
            <p className="text-slate-600 dark:text-slate-200 font-bold text-base mb-1">No kitchen stations found</p>
            <p className="text-slate-400 dark:text-slate-400 text-xs mb-4">Click below to add a new station (Bar, Tandoor, Main Kitchen, etc.)</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-2 transition-all shadow-md"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add Station
            </button>
          </div>
        )}
      </div>

      {/* Edit Station Modal */}
      {editingStation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto text-slate-800 dark:text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600 dark:text-orange-400 text-[22px]">edit</span>
                <h3 className="font-bold text-base text-slate-800 dark:text-white">Edit Kitchen Station</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStation(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleEditStationSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Station Name</label>
                <input
                  type="text"
                  required
                  value={editingStation.name}
                  onChange={e => setEditingStation({ ...editingStation, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Station Category / Type</label>
                <input
                  type="text"
                  value={editingStation.type}
                  onChange={e => setEditingStation({ ...editingStation, type: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Assigned Chef</label>
                  <input
                    type="text"
                    value={editingStation.chef}
                    onChange={e => setEditingStation({ ...editingStation, chef: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Avg Prep Time</label>
                  <input
                    type="text"
                    value={editingStation.avgPrepTime}
                    onChange={e => setEditingStation({ ...editingStation, avgPrepTime: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Status</label>
                <select
                  value={editingStation.status}
                  onChange={e => setEditingStation({ ...editingStation, status: e.target.value as any })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                >
                  <option value="active" className="dark:bg-slate-800 dark:text-white">Active</option>
                  <option value="idle" className="dark:bg-slate-800 dark:text-white">Idle</option>
                  <option value="maintenance" className="dark:bg-slate-800 dark:text-white">Maintenance</option>
                </select>
              </div>

              {/* Current Items Todo List Input */}
              <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Current Items / Todo List</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Butter Chicken, Mojito"
                    value={editItemInput}
                    onChange={e => setEditItemInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItemToEditModal();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddItemToEditModal()}
                    className="px-3 py-1.5 bg-orange-100 dark:bg-orange-950/60 hover:bg-orange-200 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span> Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {(editingStation.currentItems || []).map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveItemFromEditModal(item)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-full p-0.5"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </span>
                  ))}
                  {(!editingStation.currentItems || editingStation.currentItems.length === 0) && (
                    <span className="text-[11px] text-slate-400 italic">No current items assigned</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStation(null)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Station Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600 dark:text-orange-400 text-[22px]">add_business</span>
                <h3 className="font-bold text-base text-slate-800 dark:text-white">Add Kitchen Station</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">Quick Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_STATIONS.map(preset => {
                  const isSelected = addStationName === preset.name;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => selectPreset(preset)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border ${
                        isSelected
                          ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                          : 'bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 border-orange-200/60 dark:border-orange-900/50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{preset.icon}</span>
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleAddStationSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="add-station-name" className="block text-xs font-bold text-slate-600 dark:text-slate-300">Station Name *</label>
                <input
                  id="add-station-name"
                  type="text"
                  required
                  placeholder="e.g. Bar & Beverages, Tandoor Station"
                  value={addStationName}
                  onChange={e => setAddStationName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="add-station-type" className="block text-xs font-bold text-slate-600 dark:text-slate-300">Station Category / Type</label>
                <input
                  id="add-station-type"
                  type="text"
                  placeholder="e.g. Beverage Bar, Grill & Oven, Hot Line"
                  value={addStationType}
                  onChange={e => setAddStationType(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="add-station-chef" className="block text-xs font-bold text-slate-600 dark:text-slate-300">Assigned Chef</label>
                  <input
                    id="add-station-chef"
                    type="text"
                    placeholder="e.g. Chef Vikram"
                    value={addStationChef}
                    onChange={e => setAddStationChef(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="add-station-prep-time" className="block text-xs font-bold text-slate-600 dark:text-slate-300">Avg Prep Time</label>
                  <input
                    id="add-station-prep-time"
                    type="text"
                    placeholder="e.g. 10m"
                    value={addStationPrepTime}
                    onChange={e => setAddStationPrepTime(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="add-station-status" className="block text-xs font-bold text-slate-600 dark:text-slate-300">Initial Status</label>
                <select
                  id="add-station-status"
                  value={addStationStatus}
                  onChange={e => setAddStationStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                >
                  <option value="active" className="dark:bg-slate-800 dark:text-white">Active</option>
                  <option value="idle" className="dark:bg-slate-800 dark:text-white">Idle</option>
                  <option value="maintenance" className="dark:bg-slate-800 dark:text-white">Maintenance</option>
                </select>
              </div>

              {/* Current Items Todo List Input */}
              <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Current Items / Todo List</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add dish item (e.g. Butter Chicken, Mojito)"
                    value={newItemInput}
                    onChange={e => setNewItemInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItemToAddModal();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddItemToAddModal()}
                    className="px-3 py-1.5 bg-orange-100 dark:bg-orange-950/60 hover:bg-orange-200 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span> Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {addStationItems.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveItemFromAddModal(item)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-full p-0.5"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </span>
                  ))}
                  {addStationItems.length === 0 && (
                    <span className="text-[11px] text-slate-400 italic">No current items added</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Add Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
