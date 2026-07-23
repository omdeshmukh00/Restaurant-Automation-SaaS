import React from 'react';

export type PaymentRecord = {
  _id: string;
  method: string;
  amount: number;
  status: string;
  createdAt: string;
  providerPaymentId?: string;
};

interface PaymentHistoryCardProps {
  payments: PaymentRecord[];
  amountPaid: number;
  className?: string;
}

export const PaymentHistoryCard: React.FC<PaymentHistoryCardProps> = ({ payments, amountPaid, className = '' }) => {
  if (!payments || payments.length === 0) return null;

  return (
    <div className={`bg-sd-surface dark:bg-sd-surface-container-low rounded-xl p-6 border border-sd-outline-variant ${className}`}>
      <h4 className="font-bold text-lg mb-4 text-sd-on-surface font-sans">Payment History</h4>
      <div className="space-y-4">
        {payments.map((payment) => (
          <div key={payment._id} className="flex justify-between items-center border-b border-sd-surface-variant pb-4 last:border-0 last:pb-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                {payment.status === 'COMPLETED' || payment.status === 'PAID' ? (
                  <span className="material-symbols-outlined text-green-600 text-[18px]">check_circle</span>
                ) : (
                  <span className="material-symbols-outlined text-red-600 text-[18px]">cancel</span>
                )}
                <span className="font-bold text-sd-on-surface text-sm capitalize">{payment.status.toLowerCase()}</span>
              </div>
              <span className="text-xs text-sd-on-surface-variant mt-1 capitalize font-medium">{payment.method?.toLowerCase() || 'Online'}</span>
              <span className="text-[11px] text-sd-on-surface-variant/80 mt-0.5">
                {new Date(payment.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })} • {new Date(payment.createdAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit'
                })}
              </span>
              {payment.providerPaymentId && (
                <span className="text-[10px] text-sd-on-surface-variant/60 font-mono mt-0.5">Ref: {payment.providerPaymentId}</span>
              )}
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="font-bold text-sd-on-surface">₹{Number(payment.amount).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center pt-4 mt-4 border-t border-sd-surface-variant text-base">
        <span className="font-bold text-sd-on-surface">Total Paid</span>
        <span className="font-bold text-sd-primary">₹{Number(amountPaid).toFixed(2)}</span>
      </div>
    </div>
  );
};
