import React, { useEffect, useState, useCallback } from 'react';
import { useOffersStore, type OfferStatusFilter } from '../store/offers.store';
import {
  Plus, Search, X, Tag, Edit2, Trash2,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, ToggleLeft, ToggleRight,
  Sparkles, Clock, Copy, Check,
} from 'lucide-react';
import type { AdminOffer, CreateOfferPayload } from '../api/admin.offers.api';

// ── Helpers ────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateForInput(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16);
}

function computeDisplayStatus(offer: AdminOffer, now: Date): AdminOffer['status'] {
  if (offer.status === 'EXPIRED') return 'EXPIRED';
  if (new Date(offer.expiryDate) < now) return 'EXPIRED';
  if (offer.status === 'INACTIVE') return 'INACTIVE';
  if (offer.status === 'ACTIVE' && new Date(offer.startDate) <= now && new Date(offer.expiryDate) >= now) return 'ACTIVE';
  return offer.status;
}

function StatusBadge({ status }: { status: AdminOffer['status'] }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    EXPIRED: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  };
  const dots: Record<string, string> = {
    ACTIVE: 'bg-emerald-500', INACTIVE: 'bg-gray-400', EXPIRED: 'bg-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border ${colors[status] || colors.INACTIVE}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] || dots.INACTIVE}`} />
      {status}
    </span>
  );
}

// ── Offer Card ─────────────────────────────────────────────────────────
function OfferCard({
  offer,
  onEdit, onDelete, onToggle,
}: {
  offer: AdminOffer;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const now = new Date();
  const displayStatus = computeDisplayStatus(offer, now);
  const isActive = displayStatus === 'ACTIVE';
  const isExpired = displayStatus === 'EXPIRED';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(offer.promoCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-gray-200/80 dark:border-gray-700/80 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 bg-white dark:bg-gray-900"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Card body */}
      <div className="p-4 sm:p-5 space-y-3">
        {/* Status + Actions */}
        <div className="flex items-start justify-between gap-2">
          <StatusBadge status={displayStatus} />
          {/* Action buttons - always visible */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              disabled={isExpired}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={isActive ? 'Deactivate' : 'Activate'}
            >
              {isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 text-gray-400 hover:text-orange-500 transition-colors"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Discount headline */}
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            {offer.discountType === 'PERCENTAGE'
              ? `${offer.discountValue}% OFF`
              : `₹${offer.discountValue} OFF`}
          </h3>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-0.5">{offer.title}</p>
        </div>

        {offer.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{offer.description}</p>
        )}

        {/* Promo code */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="font-mono tracking-wider">{offer.promoCode}</span>
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
          </button>
          {offer.maxDiscount && offer.maxDiscount > 0 && offer.discountType === 'PERCENTAGE' && (
            <span className="text-[10px] text-gray-400">Max ₹{offer.maxDiscount}</span>
          )}
        </div>

        {/* Min order */}
        {offer.minOrderAmount && offer.minOrderAmount > 0 && (
          <p className="text-[11px] text-gray-400">Min. order: ₹{offer.minOrderAmount}</p>
        )}
      </div>

      {/* Bottom bar: validity */}
      <div className="px-4 sm:px-5 py-2.5 flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-800">
        <Clock className="w-3 h-3 text-gray-400" />
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          Valid till {formatDate(offer.expiryDate)}
        </span>
      </div>
    </div>
  );
}

// ── Create/Edit Offer Modal (simplified, matches Add Customer pattern) ──
interface OfferFormModalProps {
  open: boolean;
  onClose: () => void;
  editing?: AdminOffer | null;
}

function OfferFormModal({ open, onClose, editing }: OfferFormModalProps) {
  const createOffer = useOffersStore((s) => s.createOffer);
  const updateOffer = useOffersStore((s) => s.updateOffer);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [requiredPoints, setRequiredPoints] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const resetForm = useCallback(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description || '');
      setPromoCode(editing.promoCode);
      setDiscountType(editing.discountType);
      setDiscountValue(String(editing.discountValue));
      setRequiredPoints(String(editing.requiredPoints ?? 0));
      setMinOrderAmount(editing.minOrderAmount != null ? String(editing.minOrderAmount) : '');
      setMaxDiscount(editing.maxDiscount != null ? String(editing.maxDiscount) : '');
      setStartDate(formatDateForInput(editing.startDate));
      setExpiryDate(formatDateForInput(editing.expiryDate));
    } else {
      setTitle(''); setDescription(''); setPromoCode('');
      setDiscountType('PERCENTAGE'); setDiscountValue(''); setRequiredPoints('0');
      setMinOrderAmount(''); setMaxDiscount('');
      setStartDate(''); setExpiryDate('');
    }
    setError(null);
    setSaved(false);
  }, [editing]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  const validate = (): string | null => {
    if (!title.trim()) return 'Title is required';
    if (!promoCode.trim()) return 'Promo code is required';
    if (!discountValue || Number(discountValue) <= 0) return 'Discount value must be positive';
    if (discountType === 'PERCENTAGE' && Number(discountValue) > 100) return 'Percentage cannot exceed 100';
    if (!startDate) return 'Start date is required';
    if (!expiryDate) return 'Expiry date is required';
    if (new Date(expiryDate) <= new Date(startDate)) return 'Expiry date must be after start date';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    setError(null);

    try {
      const payload: CreateOfferPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        promoCode: promoCode.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        requiredPoints: Number(requiredPoints) || 0,
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : null,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        startDate: new Date(startDate).toISOString(),
        expiryDate: new Date(expiryDate).toISOString(),
      };

      if (editing) {
        await updateOffer(editing._id, payload);
      } else {
        await createOffer(payload);
      }
      setSaved(true);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to save offer');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <button type="button" aria-label="Close" className="absolute inset-0 w-full h-full cursor-default" onClick={handleClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-5 sm:p-6 w-full sm:max-w-lg sm:mx-4 max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-orange-500" />
            {editing ? 'Edit Offer' : 'Create Offer'}
          </h2>
          <button type="button" onClick={handleClose} disabled={saving} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-col items-center py-8 sm:py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-3">
              <Check className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-base font-bold text-gray-900 dark:text-white">
              {editing ? 'Offer Updated!' : 'Offer Created!'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {title} has been {editing ? 'updated' : 'created'} successfully.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                  placeholder="e.g. Summer Special" />
              </div>

              {/* Promo Code */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Promo Code *</label>
                <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 font-mono uppercase"
                  placeholder="SUMMER20" />
              </div>

              {/* Discount Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Discount Type *</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100">
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                </select>
              </div>

              {/* Discount Value */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Discount Value *</label>
                <div className="relative">
                  <input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} type="number" min={0} step="any"
                    className="w-full pl-7 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                    placeholder="20" />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                    {discountType === 'PERCENTAGE' ? '%' : '₹'}
                  </span>
                </div>
              </div>

              {/* Required Points (Loyalty) */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Required Points</label>
                <input value={requiredPoints} onChange={(e) => setRequiredPoints(e.target.value)} type="number" min={0}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                  placeholder="Loyalty points to redeem" />
              </div>

              {/* Min Order Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Min Order Amount</label>
                <input value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} type="number" min={0}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                  placeholder="Optional" />
              </div>

              {/* Max Discount */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Max Discount</label>
                <input value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} type="number" min={0}
                  disabled={discountType !== 'PERCENTAGE'}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 disabled:opacity-40"
                  placeholder="For % discounts" />
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 resize-none"
                  placeholder="Optional description" />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Start Date *</label>
                <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="datetime-local"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100" />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Expiry Date *</label>
                <input value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} type="datetime-local"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 focus:border-orange-300 text-gray-800 dark:text-gray-100" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={handleClose} disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving…' : editing ? 'Update Offer' : 'Create Offer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────
function DeleteConfirmModal({ open, onClose, offer, onConfirm }: {
  open: boolean;
  onClose: () => void;
  offer: AdminOffer | null;
  onConfirm: () => void;
}) {
  if (!open || !offer) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Offer</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Are you sure you want to delete <strong className="text-gray-700 dark:text-gray-300">{offer.title}</strong>? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all flex items-center gap-2 shadow-sm">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Offers Page ──────────────────────────────────────────────────
export function OffersPage() {
  const {
    offers, loading, error, total, page, totalPages, searchQuery, statusFilter,
    fetchOffers, setSearchQuery, setStatusFilter, setPage, deleteOffer, toggleStatus,
  } = useOffersStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<AdminOffer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminOffer | null>(null);

  // Re-fetch whenever page, statusFilter, or searchQuery changes
  useEffect(() => { fetchOffers(); }, [fetchOffers, page, statusFilter, searchQuery]);

  const handleEdit = (offer: AdminOffer) => { setEditingOffer(offer); setShowCreateModal(true); };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteOffer(deleteTarget._id); } catch { /* */ }
    setDeleteTarget(null);
  };
  const handleToggle = async (offer: AdminOffer) => {
    try { await toggleStatus(offer._id, offer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'); } catch { /* */ }
  };

  const statusTabs: { label: string; value: OfferStatusFilter }[] = [
    { label: 'All', value: 'ALL' }, { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' }, { label: 'Expired', value: 'EXPIRED' },
  ];

  return (
    <div className="space-y-5 w-full min-w-0 max-w-full overflow-hidden">
      {/* Header - matches CustomersPage pattern */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Offers</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Create and manage promotional offers for your restaurant
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setEditingOffer(null); setShowCreateModal(true); }}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 active:bg-orange-700 rounded-xl transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Create Offer
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search offers..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 outline-none text-sm" />
        </div>
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
          {statusTabs.map((tab) => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${statusFilter === tab.value
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && offers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
          <p className="text-sm font-semibold text-gray-500">Loading offers...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-2xl border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Failed to load offers</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button onClick={fetchOffers} className="ml-auto text-xs font-bold text-red-600 dark:text-red-400 hover:underline shrink-0">Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && offers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No offers found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
            {searchQuery || statusFilter !== 'ALL'
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first promotional offer to attract more customers'}
          </p>
          {!searchQuery && statusFilter === 'ALL' && (
            <button onClick={() => { setEditingOffer(null); setShowCreateModal(true); }}
              className="mt-4 px-4 py-2 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Offer
            </button>
          )}
        </div>
      )}

      {/* Offer Cards Grid */}
      {offers.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {offers.map((offer) => (
              <OfferCard key={offer._id} offer={offer}
                onEdit={() => handleEdit(offer)}
                onDelete={() => setDeleteTarget(offer)}
                onToggle={() => handleToggle(offer)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500">Showing {offers.length} of {total} offers</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, page - 2);
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 text-xs font-bold rounded-lg ${p === page ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <OfferFormModal open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setEditingOffer(null); }}
        editing={editingOffer} />
      <DeleteConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        offer={deleteTarget} onConfirm={handleDelete} />
    </div>
  );
}
