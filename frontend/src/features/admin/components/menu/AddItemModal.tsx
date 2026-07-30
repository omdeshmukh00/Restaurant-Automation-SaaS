import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Image as ImageIcon, Upload } from 'lucide-react';

import { useMenuStore } from '../../store/menu.store';

interface AddItemModalProps {
  onClose: () => void;
}

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
      '<rect width="160" height="160" rx="12" fill="#f3f4f6"/>' +
      '<g fill="none" stroke="#9ca3af" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="80" cy="66" r="28"/>' +
      '<path d="M50 120c0-16 13-28 30-28s30 12 30 28"/>' +
      '</g></svg>',
  );

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

const btnOutline =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';

export function AddItemModal({ onClose }: AddItemModalProps): JSX.Element {
  const categories = useMenuStore((s) => s.categories);
  const addItem = useMenuStore((s) => s.addItem);
  const uploadImage = useMenuStore((s) => s.uploadImage);

  const validCategories = categories.filter((c) => c.id !== 'all');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [isVeg, setIsVeg] = useState(false);
  const [isSpicy, setIsSpicy] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!category && validCategories[0]) setCategory(validCategories[0].id);
  }, [validCategories, category]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Name is required');
      return;
    }
    if (!category) {
      setFormError('Please select a category');
      return;
    }
    const stockNum = Number(stock);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      setFormError('Stock must be a positive number');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      let imageUrl = '';
      if (imageFile) {
        setUploading(true);
        try {
          imageUrl = await uploadImage(imageFile);
        } catch (uploadErr) {
          console.warn('Image upload failed; creating item without image.', uploadErr);
          imageUrl = '';
          setFormError('Item created, but the image could not be uploaded.');
        } finally {
          setUploading(false);
        }
      }
      await addItem({
        name: trimmedName,
        description: description.trim(),
        price: Number(price) || 0,
        categoryId: category,
        isVeg,
        isSpicy,
        isAvailable,
        stockQuantity: stockNum,
        preparationComplexity: 1,
        image: imageUrl || '',
      });
      if (!formError) onClose();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Failed to create item');
      setUploading(false);
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add New Menu Item</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="e.g. Margherita Pizza"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short description"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Price (₹)</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Stock</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={stock}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStock(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <select
              className={inputClass}
              value={category}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
            >
              <option value="">Select category</option>
              {validCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vegetarian</span>
            <button
              type="button"
              onClick={() => setIsVeg((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isVeg ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isVeg ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available</span>
            <button
              type="button"
              onClick={() => setIsAvailable((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isAvailable ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAvailable ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">🌶️ Extra Spicy</span>
            <button
              type="button"
              onClick={() => setIsSpicy((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isSpicy ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isSpicy ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Image</label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                <img
                  src={imagePreview || FALLBACK}
                  alt="preview"
                  className="h-full w-full object-cover"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.src = FALLBACK;
                  }}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button type="button" className={btnOutline} onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} className="mr-2" /> {uploading ? 'Uploading…' : 'Choose Image'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              <ImageIcon size={12} className="mr-1 inline" />
              Uploaded images are stored on the server and attached to the item.
            </p>
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className={btnOutline} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={submitting || uploading}>
              <Plus size={16} className="mr-2" /> {submitting ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
