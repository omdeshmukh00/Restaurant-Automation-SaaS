import React, { useState } from 'react';
import { CreditCard, AlertCircle, RefreshCw, X } from 'lucide-react';
import { apiClient } from '../../shared/services/apiClient';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  plan: string;
  amount: number;
  ownerName: string;
  email: string;
  phone: string;
  onPaymentSuccess: (metadata: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onPaymentFailure: (errorMessage: string) => void;
}

export default function PaymentDialog({
  isOpen,
  onClose,
  plan,
  amount,
  ownerName,
  email,
  phone,
  onPaymentSuccess,
  onPaymentFailure,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.id = 'razorpay-checkout-sdk';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Load Razorpay SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // 2. Create Order on Backend
      const orderResponse = await apiClient.post('/public/partner-request/create-order', {
        plan,
      });

      const { orderId, amount, currency } = orderResponse.data.data;

      // 3. Configure Razorpay Options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_T2OBoMpRJxZfjk',
        amount: amount,
        currency: currency,
        name: 'RestoHub SaaS Partner',
        description: `Setup & Subscription for ${plan} Plan`,
        order_id: orderId,
        handler: function (response: any) {
          setLoading(false);
          onPaymentSuccess({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        prefill: {
          name: ownerName,
          email: email,
          contact: phone,
        },
        notes: {
          plan,
          ownerName,
        },
        theme: {
          color: '#FF6B1A',
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            onPaymentFailure('Payment checkout cancelled.');
          },
        },
      };

      // 4. Open Razorpay Popup
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setLoading(false);
        onPaymentFailure(resp.error.description || 'Payment transaction failed.');
      });
      rzp.open();

    } catch (err: any) {
      console.error('Payment error:', err);
      const msg = err.response?.data?.message || err.message || 'Payment initiation failed.';
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={loading ? undefined : onClose} />

      {/* Modal Dialog (Light Mode) */}
      <div className="relative w-full max-w-md bg-white border border-slate-100 rounded-[1.75rem] p-6 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-250 text-slate-800">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-650 disabled:opacity-50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center text-orange-500">
              <CreditCard className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-850">Plan Setup Fee</h3>
              <p className="text-xs text-slate-500">Complete payment to finalize your request</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-150 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Plan Selected:</span>
              <span className="font-bold text-slate-800">{plan} Subscription</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Billing Frequency:</span>
              <span className="text-slate-800 font-bold">Monthly</span>
            </div>
            <div className="border-t border-slate-200/60 my-2" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Total Setup Fee:</span>
              <span className="text-2xl font-extrabold text-orange-500 font-sans">₹{amount}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-full border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePayment}
              disabled={loading}
              className="flex-[1.5] py-3 px-4 rounded-full bg-[#FF6B1A] hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-orange-500/10 transition-all duration-200"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CreditCard className="w-3.5 h-3.5" />
              )}
              {loading ? 'Processing...' : `Pay ₹${amount} & Submit`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
