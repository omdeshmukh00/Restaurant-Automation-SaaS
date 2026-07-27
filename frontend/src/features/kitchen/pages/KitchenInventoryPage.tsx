import React, { useState, useEffect } from 'react';
import { useKitchenSearch } from '../components/dashboard/KitchenSearchContext';
import { updateInventoryUsage, restockInventory, getKitchenInventory } from '../api/kitchen.api';
import { useKitchenStore } from '../store/kitchen.store';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  minStock: number;
  lastRestocked: string;
  status: 'ok' | 'low' | 'critical';
  dailyUsage: number;
}

export default function KitchenInventoryPage() {
  const { query } = useKitchenSearch();
  const { inventory, setInventory } = useKitchenStore();
  const [loading, setLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const items = await getKitchenInventory();
      
      const mappedItems: InventoryItem[] = items.map((item: any) => ({
        id: item._id || item.id,
        name: item.name,
        category: item.category?.name || item.category || 'General',
        stock: item.stock || 0,
        unit: item.unit || 'units',
        minStock: item.threshold || 0,
        lastRestocked: item.lastRestocked ? new Date(item.lastRestocked).toLocaleDateString() : 'N/A',
        status: item.stock <= item.threshold ? (item.stock <= (item.threshold * 0.5) ? 'critical' : 'low') : 'ok',
        dailyUsage: item.dailyUsage || 0
      }));
      
      setInventory(mappedItems);
    } catch (err) {
      console.error('Failed to load inventory', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inventory.length === 0) {
      fetchInventory();
    }
  }, []);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const handleRestock = async (id: string) => {
    try {
      await restockInventory(id, 10);
      await fetchInventory(); // Refresh list after restocking
    } catch (err) {
      console.error('Failed to restock', err);
    }
  };

  const handleTrackUsage = async (id: string) => {
    try {
      await updateInventoryUsage(id, 1);
      await fetchInventory(); // Refresh list after usage
    } catch (err) {
      console.error('Failed to track usage', err);
    }
  };

  const categories = ['All', ...Array.from(new Set(inventory.map(item => item.category)))];

  const filteredItems = inventory.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    if (!matchesCategory) return false;

    if (query) {
      const q = query.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Metrics
  const totalItems = inventory.length;
  const lowStockCount = inventory.filter(i => i.status === 'low').length;
  const criticalStockCount = inventory.filter(i => i.status === 'critical').length;

  const statusColors = {
    ok: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
    low: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  };

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto font-sans text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Inventory Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Monitor stock levels, track usage, and manage ingredient reorders</p>
        </div>
        <button className="px-5 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 shadow-sm flex items-center gap-2 transition-all active:scale-[0.98]">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Item
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">inventory_2</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Total Ingredients</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{totalItems}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">warning</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Low Stock Alerts</p>
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{lowStockCount}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">error</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Critically Low</p>
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5">{criticalStockCount}</h3>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => handleCategoryChange(category)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCategory === category
                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800'
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Inventory Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Item Details</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-center">Stock Level</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-center">Daily Usage</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Last Restocked</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 dark:text-white text-sm">{item.name}</div>
                    {item.id && !/^[0-9a-fA-F]{24}$/.test(item.id) && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">{item.id}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="font-bold text-slate-700 dark:text-slate-200">
                      {item.stock} {item.unit}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">Min: {item.minStock} {item.unit}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-semibold text-slate-600 dark:text-slate-300">
                    {item.dailyUsage} {item.unit}/day
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-bold uppercase ${statusColors[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs font-medium">
                    {item.lastRestocked}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleTrackUsage(item.id)}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        title="Deduct 1 unit of stock"
                      >
                        Use 1
                      </button>
                      <button
                        onClick={() => handleRestock(item.id)}
                        className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm"
                      >
                        Restock
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                    No inventory items match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
