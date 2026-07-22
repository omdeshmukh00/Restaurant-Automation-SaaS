import React, { useState, useRef } from 'react';
import { Store, Camera, X, Image as ImageIcon } from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store';

export function RestaurantInfoCard(): JSX.Element {
  const { restaurant, editingRestaurant, setEditingRestaurant, updateRestaurantInfo } = useSettingsStore();
  const [draft, setDraft] = useState({ ...restaurant });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    const payload: any = { ...draft };
    if (imagePreview) {
      payload.coverImage = imagePreview;
    }
    updateRestaurantInfo(payload);
    setEditingRestaurant(false);
    setImagePreview(null);
  }

  function handleCancel() {
    setDraft({ ...restaurant });
    setEditingRestaurant(false);
    setImagePreview(null);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImagePreview(null);
    setDraft(d => ({ ...d, coverImage: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const displayImage = imagePreview || draft.coverImage || restaurant.coverImage;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-5">Restaurant Information</h3>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        {/* Cover Image / Icon */}
        <div className="relative group flex-shrink-0">
          {displayImage ? (
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 relative">
              <img
                src={displayImage}
                alt="Restaurant cover"
                className="w-full h-full object-cover"
              />
              {editingRestaurant && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 bg-white/90 rounded-full text-gray-700 hover:bg-white transition-colors mr-1"
                    title="Change image"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleRemoveImage}
                    className="p-1.5 bg-white/90 rounded-full text-red-600 hover:bg-white transition-colors"
                    title="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`w-20 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                editingRestaurant
                  ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-950/30 cursor-pointer hover:border-orange-400 dark:hover:border-orange-500'
                  : 'border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-950/40'
              }`}
              onClick={() => editingRestaurant && fileInputRef.current?.click()}
            >
              {editingRestaurant ? (
                <>
                  <Camera className="w-5 h-5 text-orange-400 dark:text-orange-500" />
                  <span className="text-[9px] font-medium text-orange-500 dark:text-orange-400">Add Photo</span>
                </>
              ) : (
                <Store className="w-7 h-7 text-green-500 dark:text-green-400" />
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>

        {/* Fields */}
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Restaurant Name">
            {editingRestaurant
              ? <input className={inputCls} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
              : <Value>{restaurant.name}</Value>}
          </Field>
          <Field label="Restaurant Type">
            {editingRestaurant
              ? <input className={inputCls} value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} />
              : <Value>{restaurant.type}</Value>}
          </Field>
          <Field label="Cuisine">
            {editingRestaurant
              ? <input className={inputCls} value={draft.cuisine} onChange={e => setDraft(d => ({ ...d, cuisine: e.target.value }))} />
              : <Value>{restaurant.cuisine}</Value>}
          </Field>
          <Field label="Phone Number">
            {editingRestaurant
              ? <input className={inputCls} value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} />
              : <Value>{restaurant.phone}</Value>}
          </Field>
          <Field label="Address" className="sm:col-span-2">
            {editingRestaurant
              ? <input className={inputCls} value={draft.address} onChange={e => setDraft(d => ({ ...d, address: e.target.value }))} />
              : <Value>{restaurant.address}</Value>}
          </Field>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row justify-end gap-2">
        {editingRestaurant ? (
          <>
            <button onClick={handleCancel} className={secondaryBtn}>Cancel</button>
            <button onClick={handleSave} className={primaryBtn} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Save Changes'}
            </button>
          </>
        ) : (
          <button onClick={() => setEditingRestaurant(true)} className={primaryBtn}>Edit Information</button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{children}</p>;
}

const inputCls =
  'w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800 focus:border-orange-300 dark:focus:border-orange-600 transition-all';

const primaryBtn =
  'px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors disabled:opacity-50';

const secondaryBtn =
  'px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors';