import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useTablesStore } from '../../store/tables.store';

interface Props {
  onClose: () => void;
}

export function ManageLayoutModal({ onClose }: Props): JSX.Element {
  const { floors: storeFloors, sections: storeSections, updateRestaurantSettings } = useTablesStore();

  const [floors, setFloors] = useState<{ name: string; number: number }[]>(() =>
    storeFloors.map((f) => ({ name: f.name, number: f.number }))
  );
  const [sections, setSections] = useState<string[]>(() => [...storeSections]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddFloor = () => {
    const nextNum = floors.length > 0 ? Math.max(...floors.map((f) => f.number)) + 1 : 1;
    setFloors([...floors, { name: `Floor ${nextNum}`, number: nextNum }]);
  };

  const handleRemoveFloor = (index: number) => {
    setFloors(floors.filter((_, i) => i !== index));
  };

  const handleFloorChange = (index: number, field: 'name' | 'number', value: any) => {
    const updated = [...floors];
    updated[index] = { ...updated[index], [field]: value };
    setFloors(updated);
  };

  const handleAddSection = () => {
    setSections([...sections, `Section ${sections.length + 1}`]);
  };

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleSectionChange = (index: number, value: string) => {
    const updated = [...sections];
    updated[index] = value;
    setSections(updated);
  };

  const handleSave = async () => {
    setError(null);
    setLoading(true);
    try {
      // Validate unique floor numbers
      const floorNumbers = floors.map((f) => f.number);
      if (new Set(floorNumbers).size !== floorNumbers.length) {
        throw new Error('Floor numbers must be unique.');
      }

      // Validate unique section names
      const sectionNames = sections.map((s) => s.trim().toUpperCase());
      if (new Set(sectionNames).size !== sectionNames.length) {
        throw new Error('Section names must be unique.');
      }

      await updateRestaurantSettings({ floors, sections });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 w-full h-full cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Manage Layout Settings
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Configure floors and seating sections for table categorization
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Floors Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Floors</h3>
              <button
                type="button"
                onClick={handleAddFloor}
                className="flex items-center gap-1 text-[11px] font-bold text-orange-500 hover:text-orange-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Floor
              </button>
            </div>
            
            <div className="space-y-2">
              {floors.map((floor, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/40 p-2 rounded-xl border border-gray-100 dark:border-gray-800">
                  <input
                    type="text"
                    value={floor.name}
                    onChange={(e) => handleFloorChange(idx, 'name', e.target.value)}
                    placeholder="Floor Name"
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-gray-800 dark:text-gray-100"
                  />
                  <input
                    type="number"
                    value={floor.number}
                    onChange={(e) => handleFloorChange(idx, 'number', Number(e.target.value))}
                    placeholder="Number"
                    className="w-16 px-2 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-gray-800 dark:text-gray-100 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveFloor(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {floors.length === 0 && (
                <p className="text-xs text-gray-400 italic">No floors configured. Tables must belong to a floor.</p>
              )}
            </div>
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Sections Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sections</h3>
              <button
                type="button"
                onClick={handleAddSection}
                className="flex items-center gap-1 text-[11px] font-bold text-orange-500 hover:text-orange-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>

            <div className="space-y-2">
              {sections.map((section, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/40 p-2 rounded-xl border border-gray-100 dark:border-gray-800">
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => handleSectionChange(idx, e.target.value)}
                    placeholder="Section Name"
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {sections.length === 0 && (
                <p className="text-xs text-gray-400 italic">No sections configured.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-5 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
