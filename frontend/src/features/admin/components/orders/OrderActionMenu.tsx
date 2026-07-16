import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, Edit, Trash2, XCircle } from 'lucide-react';
import { useOrdersStore, type Order } from '../../store/orders.store';
import { OrderDetailModal } from './OrderDetailModal';
import { EditOrderModal } from './EditOrderModal';

interface OrderActionMenuProps {
  order: Order;
}

export function OrderActionMenu({ order }: OrderActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { updateOrder, deleteOrder } = useOrdersStore();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCancel = async () => {
    try {
      // force:true bypasses the normal state machine so an admin can cancel
      // from any status (same override used by the Edit Order modal).
      await updateOrder(order.id, { status: 'Cancelled' }, true);
    } catch (err) {
      console.error('Failed to cancel order', err);
    } finally {
      setOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete order ${order.orderNumber}? This action cannot be undone.`)) {
      setOpen(false);
      return;
    }
    try {
      await deleteOrder(order.id);
    } catch (err) {
      console.error('Failed to delete order', err);
    } finally {
      setOpen(false);
    }
  };

  const itemBase =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700';

  const disabled = order.status === 'Cancelled';

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          aria-label="Order actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {open && (
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <button className={itemBase} onClick={() => { setShowDetail(true); setOpen(false); }}>
              <Eye className="h-4 w-4" /> View Details
            </button>
            <button className={itemBase} onClick={() => { setShowEdit(true); setOpen(false); }}>
              <Edit className="h-4 w-4" /> Edit Order
            </button>

            <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

            <button
              className={`${itemBase} ${
                disabled
                  ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                  : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30'
              }`}
              onClick={disabled ? undefined : handleCancel}
              disabled={disabled}
            >
              <XCircle className="h-4 w-4" /> Cancel Order
            </button>
            <button
              className={`${itemBase} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30`}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" /> Delete Order
            </button>
          </div>
        )}
      </div>

      {showDetail && (
        <OrderDetailModal order={order} onClose={() => setShowDetail(false)} />
      )}
      {showEdit && (
        <EditOrderModal order={order} onClose={() => setShowEdit(false)} />
      )}
    </>
  );
}
