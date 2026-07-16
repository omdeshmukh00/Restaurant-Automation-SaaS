import React, { useEffect, useState } from 'react';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useOrdersStore, type PaymentMethod } from '../../store/orders.store';
import { useTablesStore } from '../../store/tables.store';
import { useStaffStore } from '../../store/staff.store';
import { useMenuStore } from '../../store/menu.store';

interface NewOrderModalProps {
  onClose: () => void;
}

const PAYMENT_OPTIONS: PaymentMethod[] = ['Unpaid', 'Cash', 'Card', 'Online'];

type CartItem = { name: string; price: number; qty: number };

export function NewOrderModal({ onClose }: NewOrderModalProps) {
  const { createOrder } = useOrdersStore();
  const { tables, fetchTables } = useTablesStore();
  const { members, fetchMembers } = useStaffStore();
  const menuItems = useMenuStore((s) => s.items);

  const [customerName, setCustomerName] = useState('');
  const [table, setTable] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [staffId, setStaffId] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'details' | 'items'>('details');

  useEffect(() => {
    fetchTables();
    fetchMembers();
  }, [fetchTables, fetchMembers]);

  // Default to the first real table so we never send a number the backend can't resolve.
  useEffect(() => {
    if (!table && tables.length) setTable(tables[0].label);
  }, [tables, table]);

  const availableMenu = menuItems.filter(
    (item) => item.enabled !== false && item.status !== 'Out of Stock',
  );

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  function addItem(item: { name: string; price: number }) {
    setCart((prev) => {
      const existing = prev.find((c) => c.name === item.name);
      if (existing) return prev.map((c) => c.name === item.name ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function removeItem(name: string) {
    setCart((prev) => {
      const existing = prev.find((c) => c.name === name);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter((c) => c.name !== name);
      return prev.map((c) => c.name === name ? { ...c, qty: c.qty - 1 } : c);
    });
  }

  function qtyOf(name: string) {
    return cart.find((c) => c.name === name)?.qty ?? 0;
  }

  async function handleCreate() {
    if (!customerName.trim() || cart.length === 0 || !table) return;
    setSaving(true);
    try {
      await createOrder({
        customerName: customerName.trim(),
        table,
        payment,
        staffId: staffId || undefined,
        notes: notes.trim(),
        items: cart.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.qty,
        })),
      });
      onClose();
    } catch (error) {
      console.error('Failed to create order', error);
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    'w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

  const canNext = customerName.trim().length > 0;
  const canCreate = canNext && cart.length > 0 && !!table;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">New Order</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {step === 'details' ? 'Step 1 · Order details' : 'Step 2 · Add items'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'details' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="customer-name" className={labelClass}>Customer Name</label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="table-select" className={labelClass}>Table</label>
                <select
                  id="table-select"
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  className={fieldClass}
                >
                  {tables.length === 0 && <option value="">No tables available</option>}
                  {tables.map((t) => (
                    <option key={t.id} value={t.label}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="staff-select" className={labelClass}>Assigned Staff</label>
                <select
                  id="staff-select"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="payment-select" className={labelClass}>Payment Method</label>
                <select
                  id="payment-select"
                  value={payment}
                  onChange={(e) => setPayment(e.target.value as PaymentMethod)}
                  className={fieldClass}
                >
                  {PAYMENT_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="notes" className={labelClass}>Notes (optional)</label>
                <textarea
                  id="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Allergies, special requests…"
                  className={fieldClass}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {availableMenu.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No menu items available.</p>
                )}
                {availableMenu.map((item) => {
                  const qty = qtyOf(item.name);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{item.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          ₹{item.price.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {qty > 0 ? (
                          <>
                            <button
                              onClick={() => removeItem(item.name)}
                              className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-5 text-center text-sm font-bold text-gray-800 dark:text-gray-100">
                              {qty}
                            </span>
                          </>
                        ) : (
                          <span className="w-5 text-center" />
                        )}
                        <button
                          onClick={() => addItem(item)}
                          className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {cart.length > 0 && (
                <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Order Summary</p>
                  {cart.map((item) => (
                    <div key={item.name} className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>
                        {item.qty} × {item.name}
                      </span>
                      <span>₹{(item.price * item.qty).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 text-sm font-bold text-gray-800 dark:text-gray-100">
                    <span>Total</span>
                    <span>₹{total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          {step === 'items' ? (
            <button
              onClick={() => setStep('details')}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              ← Back
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
              <ShoppingBag className="w-4 h-4" /> Add items next
            </span>
          )}

          {step === 'details' ? (
            <button
              disabled={!canNext}
              onClick={() => setStep('items')}
              className="px-5 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Next: Items
            </button>
          ) : (
            <button
              disabled={!canCreate || saving}
              onClick={handleCreate}
              className="px-5 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving ? 'Creating…' : 'Create Order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
