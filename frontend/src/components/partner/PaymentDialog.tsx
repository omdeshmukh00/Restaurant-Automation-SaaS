import React, { useState } from 'react';
import { CreditCard, AlertCircle, RefreshCw, X, Check } from 'lucide-react';
import { apiClient } from '../../shared/services/apiClient';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  currency: string;
  requestId: string;
  ownerName: string;
  email: string;
  phone: string;
  refundPolicy: string;
  onPaymentSuccess: (response: any) => void;
  onPaymentFailure: (errorMessage: string) => void;
}

export default function PaymentDialog({
  isOpen,
  onClose,
  orderId,
  amount,
  currency,
  requestId,
  ownerName,
  email,
  phone,
  refundPolicy,
  onPaymentSuccess,
  onPaymentFailure,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

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

      // 2. Configure Razorpay Options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_T2OBoMpRJxZfjk',
        amount: amount * 100, // Razorpay expects paise
        currency: currency,
        name: 'RestoHub Partner Onboarding',
        description: 'Application Processing Fee',
        order_id: orderId,
        handler: async function (response: any) {
          setLoading(false);
          setVerifying(true);
          try {
            // Verify payment on the backend
            const verifyRes = await apiClient.post('/public/partner-request/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            onPaymentSuccess(verifyRes.data);
          } catch (err: any) {
            console.error('Payment verification failed:', err);
            const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Verification failed.';
            setErrorMessage(msg);
            onPaymentFailure(msg);
          } finally {
            setVerifying(false);
          }
        },
        prefill: {
          name: ownerName,
          email: email,
          contact: phone,
        },
        notes: {
          requestId,
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

      // 3. Open Razorpay Popup
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={(loading || verifying) ? undefined : onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-xl overflow-hidden text-slate-800">
        <button
          type="button"
          onClick={onClose}
          disabled={loading || verifying}
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
              <h3 className="text-base font-bold text-slate-850">Processing Fee Required</h3>
              <p className="text-xs text-slate-500">Complete payment to submit your partner application</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-150 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Fee Details:</span>
              <span className="font-bold text-slate-800">Application Review & Verification</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Refund Policy:</span>
              <span className="text-orange-600 font-bold capitalize">{refundPolicy}</span>
            </div>
            <div className="border-t border-slate-200/60 my-2" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Processing Fee:</span>
              <span className="text-2xl font-extrabold text-orange-500 font-sans">₹{amount}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || verifying}
              className="flex-1 py-3 px-4 rounded-full border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-650 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePayment}
              disabled={loading || verifying}
              className="flex-[1.5] py-3 px-4 rounded-full bg-[#FF6B1A] hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-orange-500/10 transition-all duration-200"
            >
              {verifying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Verifying...
                </>
              ) : loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Checkout...
                </>
              ) : (
                <>
                  <CreditCard className="w-3.5 h-3.5" />
                  Pay & Submit
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
