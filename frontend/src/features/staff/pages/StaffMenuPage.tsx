import React, { useState, useEffect } from 'react';
import { useStaffSearch } from '../components/dashboard/StaffSearchContext';
import { useStaffDashboard } from '../hooks/useStaffDashboard';
import { useStaffProfile } from '../hooks/useStaffProfile';
import { menuAPI } from '../api/staff.api';

interface MenuItem {
  id: string;
  name: string;
  category: 'Starters' | 'Mains' | 'Desserts' | 'Beverages';
  price: number;
  available: boolean;
  spicy?: boolean;
  veg: boolean;
  description: string;
}

export default function StaffMenuPage() {
  const { profile } = useStaffProfile();
  const normalizedRole = (profile?.role || '').toLowerCase();
  const isSupervisor = normalizedRole.includes('supervisor') || normalizedRole.includes('manager') || normalizedRole.includes('admin');
  const canModifyMenu = isSupervisor;
  const canAddDish = isSupervisor;

  const { query } = useStaffSearch();
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Starters' | 'Mains' | 'Desserts' | 'Beverages'>('All');
  const { menuItems, setMenuItems } = useStaffDashboard();
  const [categories, setCategories] = useState<any[]>([]);

  // Modal addition states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<MenuItem['category']>('Starters');
  const [newItemVeg, setNewItemVeg] = useState(true);
  const [newItemSpicy, setNewItemSpicy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await menuAPI.getCategories();
        if (res.success && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    void fetchCategories();
  }, [showAddModal]);

  const toggleAvailability = async (id: string) => {
    if (!canModifyMenu) {
      alert('Menu modifications are only permitted for Floor Supervisors.');
      return;
    }
    try {
      const item = menuItems.find(i => i.id === id);
      if (item) {
        await menuAPI.toggleAvailability(id, !item.available);
        setMenuItems(prev => prev.map(i => i.id === id ? { ...i, available: !item.available } : i));
      }
    } catch (err) {
      console.error('Failed to toggle availability', err);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddDish) {
      alert('Only Floor Supervisors are permitted to add dishes to the menu.');
      setShowAddModal(false);
      return;
    }
    if (!newItemName || !newItemPrice || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let currentCategories = categories;
      if (currentCategories.length === 0) {
        const catRes = await menuAPI.getCategories();
        if (catRes.success && Array.isArray(catRes.data) && catRes.data.length > 0) {
          currentCategories = catRes.data;
          setCategories(catRes.data);
        }
      }

      const matchedCat = currentCategories.find(c => c.name.toLowerCase() === newItemCategory.toLowerCase());
      const categoryId = matchedCat?._id || (currentCategories.length > 0 ? currentCategories[0]._id : undefined);

      const res = await menuAPI.createItem({
        ...(categoryId ? { categoryId } : {}),
        name: newItemName,
        description: newItemDesc,
        price: parseFloat(newItemPrice),
        isVeg: newItemVeg,
        isAvailable: true,
      });

      if (res.success && res.data) {
        const item = res.data;
        const categoryName = item.categoryId?.name || item.category || newItemCategory;
        const addedItem: MenuItem = {
          id: String(item._id || item.id),
          name: item.name || newItemName,
          description: item.description || newItemDesc,
          price: Number(item.price ?? newItemPrice),
          category: (categoryName === 'Desserts' ? 'Desserts' : categoryName === 'Beverages' ? 'Beverages' : categoryName === 'Starters' ? 'Starters' : 'Mains') as any,
          veg: item.isVeg ?? newItemVeg,
          available: item.isAvailable !== false,
        };

        setMenuItems([addedItem, ...menuItems]);
        setNewItemName('');
        setNewItemDesc('');
        setNewItemPrice('');
        setNewItemCategory('Starters');
        setNewItemVeg(true);
        setNewItemSpicy(false);
        setShowAddModal(false);
      } else {
        alert(res.error || 'Failed to create menu item.');
      }
    } catch (err) {
      console.error('Failed to add item to menu', err);
      alert('An unexpected error occurred while adding the menu item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!canModifyMenu) {
      alert('Menu modifications are only permitted for Floor Supervisors.');
      return;
    }
    if (confirm("Are you sure you want to delete this menu item?")) {
      try {
        await menuAPI.deleteItem(id);
        setMenuItems(prev => prev.filter(item => item.id !== id));
      } catch (err) {
        console.error('Failed to delete menu item', err);
      }
    }
  };

  const filteredByCategory = menuItems.filter(item => 
    selectedCategory === 'All' ? true : item.category === selectedCategory
  );

  const searchedItems = filteredByCategory.filter(item => 
    item.name.toLowerCase().includes(query.toLowerCase()) ||
    item.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">Menu</h1>
          <p className="text-sm text-slate-550 mt-0.5">Browse menu items and manage real-time availability status.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full no-scrollbar pb-1">
            {(['All', 'Starters', 'Mains', 'Desserts', 'Beverages'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 text-xs font-bold py-2 px-3 rounded-lg border transition-all ${
                  selectedCategory === cat
                    ? 'bg-dine-orange text-white border-dine-orange shadow-sm'
                    : 'bg-white text-slate-655 border border-slate-100 hover:bg-slate-55'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {canAddDish && (
            <button
              onClick={() => setShowAddModal(true)}
              className="shrink-0 bg-dine-orange hover:bg-dine-orange/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all border-none outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Item
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {searchedItems.length > 0 ? (
          searchedItems.map(item => (
            <div
              key={item.id}
              className={`bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-soft transition-all flex flex-col justify-between`}
            >
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-405 font-bold uppercase font-sans bg-slate-55 px-2.5 py-0.5 rounded border border-slate-100">
                    {item.category}
                  </span>
                  <div className="flex gap-1.5 items-center">
                    {item.veg ? (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <title>Vegetarian</title>
                        <rect x="3" y="3" width="18" height="18" stroke="#0f8a3c" strokeWidth="2.5" />
                        <circle cx="12" cy="12" r="5" fill="#0f8a3c" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <title>Non-Vegetarian</title>
                        <rect x="3" y="3" width="18" height="18" stroke="#8b4513" strokeWidth="2.5" />
                        <polygon points="12,6 6,17 18,17" fill="#8b4513" />
                      </svg>
                    )}
                    {item.spicy && (
                      <span className="material-symbols-outlined text-red-500 text-[18px]" title="Spicy">local_fire_department</span>
                    )}
                    {canModifyMenu && (
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center focus:outline-none"
                        title="Delete Item"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 font-sans">{item.name}</h3>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="font-black text-sm text-slate-800 dark:text-slate-150 font-sans">₹{item.price}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold font-sans">{item.available ? 'In Stock' : 'Out of Stock'}</span>
                  {canModifyMenu ? (
                    <button
                      onClick={() => toggleAvailability(item.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        item.available ? 'bg-dine-orange' : 'bg-slate-200'
                  <button
                    onClick={() => toggleAvailability(item.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                      item.available
                        ? 'bg-dine-orange'
                        : 'bg-slate-300 dark:bg-slate-700 border border-slate-300 dark:border-slate-500'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        item.available ? 'translate-x-4' : 'translate-x-0.5'

                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          item.available ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  ) : (
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.available ? 'bg-emerald-500' : 'bg-slate-300'}`} title={item.available ? 'In Stock' : 'Out of Stock'} />
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">
            No matching menu items found.
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">Add Menu Item</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-4 font-sans leading-relaxed">
              Create a new food or beverage item.
            </p>
            <form onSubmit={handleAddItem} className="space-y-4 font-sans text-xs">
              <div>
                <label htmlFor="new-name" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Item Name</label>
                <input
                  id="new-name"
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div>
                <label htmlFor="new-desc" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Description</label>
                <textarea
                  id="new-desc"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-price" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Price (₹)</label>
                  <input
                    id="new-price"
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="new-cat" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Category</label>
                  <select
                    id="new-cat"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-slate-200"
                  >
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <option key={cat._id || cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Starters">Starters</option>
                        <option value="Mains">Mains</option>
                        <option value="Desserts">Desserts</option>
                        <option value="Beverages">Beverages</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="flex gap-6 py-1">
                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newItemVeg}
                    onChange={(e) => setNewItemVeg(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-200 text-dine-orange focus:ring-dine-orange cursor-pointer"
                  />
                  Vegetarian
                </label>
                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newItemSpicy}
                    onChange={(e) => setNewItemSpicy(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-200 text-dine-orange focus:ring-dine-orange cursor-pointer"
                  />
                  Spicy
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-640 dark:text-slate-400 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newItemName.trim() || !newItemPrice}
                  className="flex-1 py-2 bg-dine-orange text-white rounded-xl font-bold hover:bg-orange-600 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
