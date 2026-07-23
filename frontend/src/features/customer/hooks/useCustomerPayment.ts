import { useState, useCallback, useRef } from 'react';
import { createCustomerPayment, verifyCustomerPayment, requestCashPayment } from '../api/customer.api';
import { useCustomerStore } from '../store/customer.store';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.id = 'razorpay-checkout-sdk';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export function useCustomerPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'INITIATING' | 'PROCESSING' | 'VERIFYING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const razorpaySuccessFiredRef = useRef(false);
  
  const { fetchLiveBill, fetchOrders, addNotification } = useCustomerStore();

  const handleSuccess = useCallback(async () => {
    setPaymentStatus('SUCCESS');
    addNotification('Payment Successful! 🎉', 'Your bill has been paid successfully.', 'info');
    // Fetch live bill to update the UI
    await fetchLiveBill();
    // Fetch orders to update order statuses locally
    await fetchOrders();
    setLoading(false);
  }, [fetchLiveBill, fetchOrders, addNotification]);

  const payLiveBill = useCallback(async () => {
    try {
      razorpaySuccessFiredRef.current = false;
      setLoading(true);
      setError(null);
      setPaymentStatus('INITIATING');

      // 1. Create Payment on Backend
      const paymentData = await createCustomerPayment('ONLINE');

      if (!paymentData || !paymentData.paymentId) {
        throw new Error('Failed to initiate payment. Please try again.');
      }

      // If mock payment provider, skip Razorpay
      if (paymentData.provider === 'mock') {
        setPaymentStatus('VERIFYING');
        await verifyCustomerPayment({
          paymentId: paymentData.paymentId,
          simulateStatus: 'PAID',
        });
        await handleSuccess();
        return;
      }

      // 2. Load Razorpay
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your network connection.');
      }

      setPaymentStatus('PROCESSING');

      // 3. Initialize Razorpay
      const options = {
        key: paymentData.razorpayKeyId,
        amount: paymentData.amount * 100, // paise
        currency: paymentData.currency,
        name: 'Smart Dining',
        description: 'Live Bill Payment',
        order_id: paymentData.razorpayOrderId,
        handler: async (response: any) => {
          razorpaySuccessFiredRef.current = true;
          try {
            setPaymentStatus('VERIFYING');
            // 4. Verify Payment on Backend
            await verifyCustomerPayment({
              paymentId: paymentData.paymentId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            await handleSuccess();
          } catch (verifyError: any) {
            console.error('Payment verification failed:', verifyError);
            setError(verifyError.message || 'Payment verification failed. Please contact staff.');
            setPaymentStatus('FAILED');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (razorpaySuccessFiredRef.current) {
              // Ignore ondismiss because the success handler has already fired.
              // The modal closing here is expected, either automatically or manually after success/failure.
              return;
            }
            setPaymentStatus('FAILED');
            setError('Payment was cancelled.');
            setLoading(false);
          },
        },
        theme: {
          color: '#eb7828', // Smart Dining primary color
        },
      };

      // 4. Open Razorpay Popup
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        console.error('Razorpay payment failed:', response.error);
        setError(response.error.description || 'Payment failed.');
        setPaymentStatus('FAILED');
        setLoading(false);
      });
      rzp.open();

    } catch (err: any) {
      console.error('Payment initiation error:', err);
      setError(err.message || 'Unable to process payment right now.');
      setPaymentStatus('FAILED');
      setLoading(false);
    }
  }, [handleSuccess]);

  const resetPayment = useCallback(() => {
    setPaymentStatus('IDLE');
    setError(null);
    razorpaySuccessFiredRef.current = false;
  }, []);

  const payCashAtCounter = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setPaymentStatus('INITIATING');
      await requestCashPayment();
      setPaymentStatus('SUCCESS');
      addNotification('Cash Payment Requested 💵', 'Please pay at the counter. The staff has been notified.', 'info');
      await fetchLiveBill();
      setLoading(false);
    } catch (err: any) {
      console.error('Cash payment request error:', err);
      setError(err.message || 'Unable to request cash payment right now.');
      setPaymentStatus('FAILED');
      setLoading(false);
    }
  }, [fetchLiveBill, addNotification]);

  return { payLiveBill, payCashAtCounter, loading, error, paymentStatus, resetPayment };
}
